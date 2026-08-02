import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { FileMeta } from '../models/file.model.js';
import { Member } from '../models/member.model.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
const mongoUsername = process.env.MONGODB_USERNAME;
const mongoPassword = process.env.MONGODB_PASSWORD;
const mongoDbName = process.env.MONGODB_DB ?? 'kaloob';

const connectionString = mongoUri
  ? mongoUri
  : mongoUsername && mongoPassword
  ? `mongodb://${encodeURIComponent(mongoUsername)}:${encodeURIComponent(mongoPassword)}@127.0.0.1:27017/${mongoDbName}`
  : null;

if (!connectionString) {
  console.error('MongoDB connection string not found in env. Set MONGODB_URI or username/password.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(connectionString);
  console.log('Connected to MongoDB');

  // Try to locate the uploaded file by a likely original name fragment
  const searchNames = ['Parish Pledgers', 'Parish Pledgers.xlsx', 'Parish Pledgers.xls'];
  let file = null;
  for (const name of searchNames) {
    file = await FileMeta.findOne({ originalName: { $regex: name, $options: 'i' } });
    if (file) break;
  }

  if (!file) {
    console.error('Uploaded file record not found. Provide a different originalName or edit the script.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Found file:', file.originalName, 'uploadedAt=', file.uploadedAt, 'churchId=', file.churchId);

  const uploadedAt = file.uploadedAt instanceof Date ? file.uploadedAt : new Date(file.uploadedAt);
  // Window: 10 minutes before upload to 4 hours after (tunable)
  const windowStart = new Date(uploadedAt.getTime() - 10 * 60 * 1000);
  const windowEnd = new Date(uploadedAt.getTime() + 4 * 60 * 60 * 1000);

  const candidates = await Member.find({
    churchId: file.churchId,
    createdAt: { $gte: windowStart, $lte: windowEnd },
  }).lean();

  console.log('Members found in window:', candidates.length);

  if (candidates.length === 0) {
    console.log('No members found to delete. Exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Backup to JSON file
  const backupDir = path.resolve('uploads');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `reverted-members-${file.filename || 'file'}-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(candidates, null, 2), 'utf8');
  console.log('Backed up members to', backupPath);

  // Delete the members
  const ids = candidates.map((c) => c._id);
  const delRes = await Member.deleteMany({ _id: { $in: ids } });
  console.log('Deleted count:', delRes.deletedCount);

  // Optionally remove the uploaded file from disk
  try {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      console.log('Removed uploaded file from disk:', file.path);
    }
  } catch (err) {
    console.warn('Could not remove uploaded file from disk:', err.message || err);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
