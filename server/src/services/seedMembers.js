import { Member } from '../models/member.model.js';
import { CHAPELS } from '../config/chapels.js';

const CHAPEL_PREFIXES = {
  'st-joseph-parish': 'SJP',
  'st-joseph-worker': 'SJW',
  'our-lady-lourdes': 'OLL',
  'sto-nino': 'STN',
};

export async function seedMembers() {
  for (const chapel of CHAPELS) {
    const existing = await Member.countDocuments({ churchId: chapel.id });
    if (existing === 0) {
      const prefix = CHAPEL_PREFIXES[chapel.id] ?? 'KLB';
      const docs = [];
      for (let i = 1; i <= 5; i++) {
        const num = String(i).padStart(5, '0');
        docs.push({
          trackingNumber: `KLB-${prefix}-${num}`,
          fullName: `${chapel.name} Member ${i}`,
          address: `${i} Main St`,
          contactNumber: `0917${100000 + i}`,
          dateRegistered: new Date(),
          churchId: chapel.id,
          status: 'Active',
        });
      }
      try {
        await Member.insertMany(docs, { ordered: false });
        console.log(`Seeded ${docs.length} members for ${chapel.id}`);
      } catch (err) {
        console.log('Seed members error (some may already exist):', err.message ?? err);
      }
    }
  }
}

