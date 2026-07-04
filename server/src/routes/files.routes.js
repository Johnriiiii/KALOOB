import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { FileMeta } from '../models/file.model.js';
import { AuditLog } from '../models/audit.model.js';
import { Member } from '../models/member.model.js';
import { Donation } from '../models/donation.model.js';
import { Chapel } from '../models/chapel.model.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

function getChurchFilter(user, queryChurchId) {
  if (user.role === 'admin') {
    return queryChurchId ? { churchId: queryChurchId } : {};
  }
  return { churchId: user.churchId };
}

async function writeAudit(user, action, entity, entityId, details, churchId) {
  await AuditLog.create({ action, entity, entityId, userId: user.id, userLabel: user.label, churchId, details });
}

// Generate tracking number for a chapel
async function generateTrackingNumber(chapelId) {
  const prefix = chapelId.substring(0, 3).toUpperCase();
  const count = await Member.countDocuments({ churchId: chapelId });
  return `KLB-${prefix}-${String(count + 1).padStart(4, '0')}`;
}

// Parse Excel file for member/donation data
async function parseExcelFile(filePath) {
  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data.filter(row => Object.values(row).some(val => val !== null && val !== ''));
  } catch (err) {
    console.error('Excel parsing failed:', err);
    return [];
  }
}

// Parse PDF file (basic text extraction)
async function parsePdfFile(filePath) {
  try {
    const pdf = require('pdf-parse');
    const fs = require('fs');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    return pdfData.text.split('\n').filter(line => line.trim());
  } catch (err) {
    console.error('PDF parsing failed:', err);
    return [];
  }
}

// Process file data into member/donation records across all chapels
async function processFileDataToAllChapels(parsedData, uploadedByLabel) {
  const chapels = await Chapel.find().select('_id');
  let createdMembers = 0;
  let createdDonations = 0;

  for (const chapel of chapels) {
    const chapelId = chapel._id.toString();
    
    for (const row of parsedData) {
      try {
        // Try to extract member data
        const fullName = row.fullName || row['Full Name'] || row.name || row['Member Name'] || '';
        const amount = row.amount || row.donation || row['Donation Amount'] || 0;
        const contactNumber = row.contactNumber || row['Contact Number'] || row.phone || '';
        
        if (fullName && fullName.trim()) {
          // Create member record
          const trackingNumber = await generateTrackingNumber(chapelId);
          const existingMember = await Member.findOne({ fullName: fullName.trim(), churchId: chapelId });
          
          if (!existingMember) {
            await Member.create({
              trackingNumber,
              fullName: fullName.trim(),
              address: row.address || '',
              contactNumber,
              dateRegistered: new Date(),
              churchId: chapelId,
              status: 'Active',
            });
            createdMembers++;
          }

          // Create donation record if amount exists
          if (amount > 0) {
            const member = await Member.findOne({ fullName: fullName.trim(), churchId: chapelId });
            if (member) {
              await Donation.create({
                trackingNumber: await generateTrackingNumber(chapelId),
                memberId: member._id,
                memberName: fullName.trim(),
                churchId: chapelId,
                date: new Date(),
                weekNumber: Math.ceil(new Date().getDate() / 7),
                amount,
                notes: `Imported from file by ${uploadedByLabel}`,
                createdBy: uploadedByLabel,
              });
              createdDonations++;
            }
          }
        }
      } catch (err) {
        console.error('Error processing row:', err);
      }
    }
  }

  return { createdMembers, createdDonations, chapelsProcessed: chapels.length };
}

router.use(verifyToken);

router.post('/upload', upload.single('file'), async (request, response, next) => {
  try {
    // Only allow chapel admins to upload files
    if (request.user.role === 'admin') {
      return response.status(403).json({ message: 'Super Admin cannot upload files. Only chapel admins can upload.' });
    }

    const file = request.file;
    const churchId = request.user.churchId;
    
    if (!file) {
      return response.status(400).json({ message: 'File upload required.' });
    }

    const fileType = path.extname(file.originalname).toLowerCase();
    const supportedTypes = ['.xlsx', '.pdf', '.docx'];
    
    if (!supportedTypes.includes(fileType)) {
      return response.status(400).json({ message: 'Only .xlsx, .pdf, and .docx files are supported.' });
    }

    // Create file metadata record
    const fileRecord = await FileMeta.create({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      fileType,
      churchId, // Store original uploader's chapel ID
      uploadedBy: request.user.label,
    });

    // Parse file based on type
    let parsedData = [];
    if (fileType === '.xlsx') {
      parsedData = await parseExcelFile(file.path);
    } else if (fileType === '.pdf') {
      parsedData = await parsePdfFile(file.path);
    }
    // For .docx, we'd need a library like docx or libreoffice integration

    // Process data to all chapels
    const processResult = await processFileDataToAllChapels(parsedData, request.user.label);

    // Log audit
    await writeAudit(
      request.user,
      'create',
      'file',
      fileRecord._id.toString(),
      `Uploaded file ${fileRecord.originalName}. Processed: ${processResult.createdMembers} members, ${processResult.createdDonations} donations across ${processResult.chapelsProcessed} chapels`,
      churchId
    );

    response.status(201).json({
      file: fileRecord,
      processing: {
        membersCreated: processResult.createdMembers,
        donationsCreated: processResult.createdDonations,
        chapelsProcessed: processResult.chapelsProcessed,
        message: `File processed successfully. Created ${processResult.createdMembers} members and ${processResult.createdDonations} donations across all ${processResult.chapelsProcessed} chapels.`,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (request, response, next) => {
  try {
    const { churchId, name } = request.query;
    const filter = getChurchFilter(request.user, churchId);
    if (name) {
      filter.originalName = { $regex: String(name), $options: 'i' };
    }

    const files = await FileMeta.find(filter).sort({ uploadedAt: -1 }).lean();
    response.json(files);
  } catch (error) {
    next(error);
  }
});

router.delete('/:fileId', async (request, response, next) => {
  try {
    const { fileId } = request.params;
    const file = await FileMeta.findById(fileId);
    if (!file) {
      return response.status(404).json({ message: 'File not found.' });
    }
    if (request.user.role !== 'admin' && file.churchId !== request.user.churchId) {
      return response.status(403).json({ message: 'Forbidden' });
    }

    await FileMeta.deleteOne({ _id: fileId });
    await writeAudit(request.user, 'delete', 'file', file._id.toString(), `Deleted file ${file.originalName}`, file.churchId);
    response.json({ message: 'File deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
