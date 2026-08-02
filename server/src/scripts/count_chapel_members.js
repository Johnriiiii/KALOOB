import dotenv from 'dotenv';
import mongoose from 'mongoose';
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
  console.error('MongoDB connection string not found in env.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(connectionString);
  const chapelId = process.argv[2] || 'st-joseph-parish';
  const count = await Member.countDocuments({ churchId: chapelId });
  console.log(`Members for ${chapelId}:`, count);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
