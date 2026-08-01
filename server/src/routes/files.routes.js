import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { FileMeta } from '../models/file.model.js';
import { AuditLog } from '../models/audit.model.js';
import { Member } from '../models/member.model.js';
import { Donation } from '../models/donation.model.js';
import { Chapel } from '../models/chapel.model.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { emitter } from '../events.js';

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

export function buildTrackingNumber(chapelId, sequence = 1) {
  const slug = String(chapelId || 'UNK')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 3);
  const prefix = slug || 'UNK';
  return `KLB-${prefix}-${String(sequence).padStart(4, '0')}`;
}

export async function resolveTargetChapels(user, selectedChapelId, chapels = []) {
  const normalizedSelection = String(selectedChapelId ?? 'all').trim();
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  if (isSuperAdmin) {
    if (normalizedSelection && normalizedSelection !== 'all') {
      return [normalizedSelection];
    }

    return (chapels || [])
      .map((chapel) => chapel?.chapelId || chapel?.id)
      .filter(Boolean);
  }

  if (user?.churchId) {
    return [user.churchId];
  }

  return [];
}

// Generate tracking number for a chapel
async function generateTrackingNumber(chapelId) {
  const count = await Member.countDocuments({ churchId: chapelId });
  return buildTrackingNumber(chapelId, count + 1);
}

function normalizeExcelRow(row) {
  const normalized = {};

  for (const key of Object.keys(row)) {
    const normalizedKey = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    normalized[normalizedKey] = row[key];
  }

  const getValue = (names) => {
    for (const name of names) {
      if (normalized[name] !== undefined && normalized[name] !== null && normalized[name] !== '') {
        return normalized[name];
      }
    }
    return undefined;
  };

  let fullName = getValue(['fullname', 'name', 'membername', 'member', 'residentname']);
  if (!fullName) {
    const first = getValue(['firstname', 'first', 'givenname']);
    const last = getValue(['lastname', 'last', 'surname', 'familyname']);
    if (first) {
      fullName = `${first}${last ? ` ${last}` : ''}`.trim();
    }
  }

  const amountRaw = getValue(['donationamount', 'amount', 'donation', 'contribution', 'giftamount']);
  const amount = typeof amountRaw === 'string'
    ? Number(String(amountRaw).replace(/[^0-9.\-]/g, ''))
    : Number(amountRaw ?? 0);

  const contactNumber = getValue(['contactnumber', 'phonenumber', 'phone', 'mobile', 'tel']);
  const address = getValue(['address', 'homeaddress', 'residence', 'location']);

  return {
    fullName: typeof fullName === 'string' ? fullName.trim() : fullName,
    amount: Number.isFinite(amount) ? amount : 0,
    contactNumber: typeof contactNumber === 'string' ? contactNumber.trim() : contactNumber || '',
    address: typeof address === 'string' ? address.trim() : address || '',
  };
}

// Parse Excel file for member/donation data
async function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return rawData
      .map((row) => normalizeExcelRow(row))
      .filter((row) => row.fullName && row.fullName.trim());
  } catch (err) {
    console.error('Excel parsing failed:', err);
    return [];
  }
}

// Parse PDF file (basic text extraction)
async function parsePdfFile(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return pdfData.text.split('\n').filter(line => line.trim());
  } catch (err) {
    console.error('PDF parsing failed:', err);
    return [];
  }
}

// Process file data into member/donation records for a single chapel
async function processFileDataToChapel(parsedData, chapelId, uploadedByLabel) {
  let createdMembers = 0;
  let createdDonations = 0;

  for (const row of parsedData) {
    try {
      const fullName = row.fullName || '';
      const amount = row.amount || 0;
      const contactNumber = row.contactNumber || '';
      const address = row.address || '';

      if (fullName && fullName.trim()) {
        const existingMember = await Member.findOne({ fullName: fullName.trim(), churchId: chapelId });

        if (!existingMember) {
          const trackingNumber = await generateTrackingNumber(chapelId);
          await Member.create({
            trackingNumber,
            fullName: fullName.trim(),
            address,
            contactNumber,
            dateRegistered: new Date(),
            churchId: chapelId,
            status: 'Active',
          });
          createdMembers++;
        }

        if (amount > 0) {
          const member = await Member.findOne({ fullName: fullName.trim(), churchId: chapelId });
            if (member) {
            const donation = await Donation.create({
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
            try {
              emitter.emit('donation-created', {
                chapelId,
                donation: {
                  _id: donation._id,
                  memberId: donation.memberId,
                  memberName: donation.memberName,
                  amount: donation.amount,
                  date: donation.date,
                  weekNumber: donation.weekNumber,
                  trackingNumber: donation.trackingNumber,
                },
              });
            } catch (e) {
              console.warn('Failed to emit donation-created during file import', e?.message || e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing row:', err);
    }
  }

  return { createdMembers, createdDonations, chapelId, rowsProcessed: parsedData.length };
}

router.use(verifyToken);

router.post('/upload', upload.single('file'), async (request, response, next) => {
  try {
    console.log('FILES ROUTE: content-type=', request.headers['content-type']);
    console.log('FILES ROUTE: file present=', !!request.file, 'body keys=', Object.keys(request.body));

    const isSuperAdmin = request.user.role === 'superadmin' || request.user.role === 'admin';
    if (!isSuperAdmin && !request.user.churchId) {
      return response.status(403).json({ message: 'Only authenticated chapel admins can upload files.' });
    }

    const file = request.file;
    const churchId = request.user.churchId;
    const selectedChapelId = String(request.body?.chapelId || request.body?.churchId || 'all');

    if (!file) {
      console.error('FILES ROUTE: no file found on request');
      console.error('FILES ROUTE: content-type=', request.headers['content-type']);
      console.error('FILES ROUTE: body keys=', Object.keys(request.body));
      console.error('FILES ROUTE: rawBody length=', request.rawBody?.length ?? 0);
      return response.status(400).json({
        message: 'File upload required.',
        debug: {
          contentType: request.headers['content-type'],
          bodyKeys: Object.keys(request.body),
          rawBodyLength: request.rawBody?.length ?? 0,
        },
      });
    }

    const fileType = path.extname(file.originalname).toLowerCase();
    const supportedTypes = ['.xlsx', '.xls', '.pdf', '.docx'];
    
    if (!supportedTypes.includes(fileType)) {
      return response.status(400).json({ message: 'Only .xlsx, .xls, .pdf, and .docx files are supported.' });
    }

    const debugLog = `UPLOAD DEBUG ${new Date().toISOString()}\ncontent-type: ${request.headers['content-type']}\nfile present: ${!!file}\nfile field: ${file ? file.fieldname : 'none'}\nfile originalname: ${file ? file.originalname : 'none'}\nfile mimetype: ${file ? file.mimetype : 'none'}\nbody keys: ${Object.keys(request.body).join(', ')}\n-----------\n`;
    fs.appendFileSync('uploads/upload-debug.log', debugLog);

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
    if (fileType === '.xlsx' || fileType === '.xls') {
      parsedData = await parseExcelFile(file.path);
    } else if (fileType === '.pdf') {
      parsedData = await parsePdfFile(file.path);
    }
    // For .docx, we'd need a library like docx or libreoffice integration

    const chapelTargets = await resolveTargetChapels(request.user, selectedChapelId, await Chapel.find({}, 'chapelId').lean());
    if (!chapelTargets.length) {
      return response.status(400).json({ message: 'No target chapel was selected for import.' });
    }

    let membersCreated = 0;
    let donationsCreated = 0;
    let rowsProcessed = 0;
    const processedChapels = [];

    for (const chapelId of chapelTargets) {
      const processResult = await processFileDataToChapel(parsedData, chapelId, request.user.label);
      membersCreated += processResult.createdMembers;
      donationsCreated += processResult.createdDonations;
      rowsProcessed += processResult.rowsProcessed;
      processedChapels.push(chapelId);
    }

    // Log audit
    await writeAudit(
      request.user,
      'create',
      'file',
      fileRecord._id.toString(),
      `Uploaded file ${fileRecord.originalName}. Processed: ${membersCreated} members, ${donationsCreated} donations across ${processedChapels.length} chapels`,
      churchId
    );

    response.status(201).json({
      file: fileRecord,
      processing: {
        membersCreated,
        donationsCreated,
        chapelId: processedChapels.length === 1 ? processedChapels[0] : 'multiple',
        chapelIds: processedChapels,
        rowsProcessed,
        chapelsProcessed: processedChapels.length,
        message: `File processed successfully for ${processedChapels.length} chapel${processedChapels.length === 1 ? '' : 's'}. Created ${membersCreated} members and ${donationsCreated} donations.`,
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

// List revert backup files stored in server/uploads (reverted-members-*.json)
router.get('/reverts', async (request, response, next) => {
  try {
    const uploadsDir = path.resolve('uploads');
    if (!fs.existsSync(uploadsDir)) return response.json({ reverts: [] });
    const files = fs.readdirSync(uploadsDir)
      .filter((f) => f.startsWith('reverted-members-') && f.endsWith('.json'))
      .map((f) => ({ name: f, url: `/uploads/${encodeURIComponent(f)}` }));
    response.json({ reverts: files });
  } catch (err) {
    next(err);
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
