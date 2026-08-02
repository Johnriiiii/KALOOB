import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Chapel } from '../models/chapel.model.js';
import { Member } from '../models/member.model.js';
import { Donation } from '../models/donation.model.js';
import { buildAnalyticsPayload } from '../utils/analytics.js';

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
  const range = process.argv[3] || 'weekly';

  const chapel = await Chapel.findOne({ chapelId }).lean();
  if (!chapel) {
    console.error('Chapel not found:', chapelId);
    await mongoose.disconnect();
    process.exit(1);
  }

  const donations = await Donation.find({ churchId: chapelId }).sort({ date: 1 }).lean();
  const members = await Member.find({ churchId: chapelId }).lean();

  const reports = donations.map((d) => ({
    ...d,
    donation: d.amount,
    members: 0,
    weekLabel: d.weekNumber ? `W${d.weekNumber}` : undefined,
  }));

  const analytics = await buildAnalyticsPayload({ chapel, reports, members, range });
  console.log(JSON.stringify(analytics, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
