import { Chapel } from '../models/chapel.model.js';
import { CHAPELS } from '../config/chapels.js';

const defaultReports = [
  { weekLabel: 'W1', donation: 18500, members: 168, trackingNumber: 'KLB-2026-001', notes: 'Seeded report', files: [] },
  { weekLabel: 'W2', donation: 19200, members: 170, trackingNumber: 'KLB-2026-002', notes: 'Seeded report', files: [] },
  { weekLabel: 'W3', donation: 19800, members: 172, trackingNumber: 'KLB-2026-003', notes: 'Seeded report', files: [] },
  { weekLabel: 'W4', donation: 20600, members: 174, trackingNumber: 'KLB-2026-004', notes: 'Seeded report', files: [] },
  { weekLabel: 'W5', donation: 21450, members: 176, trackingNumber: 'KLB-2026-005', notes: 'Seeded report', files: [] },
  { weekLabel: 'W6', donation: 22300, members: 179, trackingNumber: 'KLB-2026-006', notes: 'Seeded report', files: [] },
  { weekLabel: 'W7', donation: 23150, members: 181, trackingNumber: 'KLB-2026-007', notes: 'Seeded report', files: [] },
  { weekLabel: 'W8', donation: 24100, members: 183, trackingNumber: 'KLB-2026-008', notes: 'Seeded report', files: [] },
];

export async function seedChapels() {
  for (const chapel of CHAPELS) {
    await Chapel.updateOne(
      { chapelId: chapel.id },
      {
        $setOnInsert: {
          chapelId: chapel.id,
          name: chapel.name,
          color: chapel.color,
          username: chapel.username,
          password: chapel.password,
          reports: chapel.id === 'st-joseph-parish' ? defaultReports : [],
        },
      },
      { upsert: true }
    );
  }
}
