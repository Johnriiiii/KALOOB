import { Chapel } from '../types';

export function getInitialChapels(): Chapel[] {
  return [
    {
      chapelId: 'st-joseph-parish',
      name: 'St. Joseph Parish',
      color: '#2ea44f',
      username: 'SJ-PARISH',
      reports: [
        { weekLabel: 'W1', donation: 18500, members: 168, trackingNumber: 'KLB-SJP-00001', notes: 'Seeded report' },
        { weekLabel: 'W2', donation: 19200, members: 170, trackingNumber: 'KLB-SJP-00002', notes: 'Seeded report' },
        { weekLabel: 'W3', donation: 19800, members: 172, trackingNumber: 'KLB-SJP-00003', notes: 'Seeded report' },
        { weekLabel: 'W4', donation: 20600, members: 174, trackingNumber: 'KLB-SJP-00004', notes: 'Seeded report' },
        { weekLabel: 'W5', donation: 21450, members: 176, trackingNumber: 'KLB-SJP-00005', notes: 'Seeded report' },
        { weekLabel: 'W6', donation: 22300, members: 179, trackingNumber: 'KLB-SJP-00006', notes: 'Seeded report' },
        { weekLabel: 'W7', donation: 23150, members: 181, trackingNumber: 'KLB-SJP-00007', notes: 'Seeded report' },
        { weekLabel: 'W8', donation: 24100, members: 183, trackingNumber: 'KLB-SJP-00008', notes: 'Seeded report' },
      ],
    },
    {
      chapelId: 'st-joseph-worker',
      name: 'St. Joseph the Worker Chapel',
      color: '#f0c400',
      username: 'SJ-WORKER',
      reports: [
        { weekLabel: 'W1', donation: 12100, members: 131, trackingNumber: 'KLB-SJW-00001', notes: 'Seeded report' },
        { weekLabel: 'W2', donation: 12450, members: 132, trackingNumber: 'KLB-SJW-00002', notes: 'Seeded report' },
        { weekLabel: 'W3', donation: 12800, members: 134, trackingNumber: 'KLB-SJW-00003', notes: 'Seeded report' },
        { weekLabel: 'W4', donation: 13150, members: 135, trackingNumber: 'KLB-SJW-00004', notes: 'Seeded report' },
        { weekLabel: 'W5', donation: 13580, members: 137, trackingNumber: 'KLB-SJW-00005', notes: 'Seeded report' },
        { weekLabel: 'W6', donation: 14050, members: 138, trackingNumber: 'KLB-SJW-00006', notes: 'Seeded report' },
        { weekLabel: 'W7', donation: 14510, members: 140, trackingNumber: 'KLB-SJW-00007', notes: 'Seeded report' },
        { weekLabel: 'W8', donation: 14980, members: 142, trackingNumber: 'KLB-SJW-00008', notes: 'Seeded report' },
      ],
    },
    {
      chapelId: 'our-lady-lourdes',
      name: 'Our Lady of Lourdes Chapel',
      color: '#2b7fff',
      username: 'LOURDES',
      reports: [
        { weekLabel: 'W1', donation: 9800, members: 101, trackingNumber: 'KLB-OLL-00001', notes: 'Seeded report' },
        { weekLabel: 'W2', donation: 10030, members: 102, trackingNumber: 'KLB-OLL-00002', notes: 'Seeded report' },
        { weekLabel: 'W3', donation: 10320, members: 103, trackingNumber: 'KLB-OLL-00003', notes: 'Seeded report' },
        { weekLabel: 'W4', donation: 10640, members: 104, trackingNumber: 'KLB-OLL-00004', notes: 'Seeded report' },
        { weekLabel: 'W5', donation: 10980, members: 105, trackingNumber: 'KLB-OLL-00005', notes: 'Seeded report' },
        { weekLabel: 'W6', donation: 11320, members: 107, trackingNumber: 'KLB-OLL-00006', notes: 'Seeded report' },
        { weekLabel: 'W7', donation: 11690, members: 108, trackingNumber: 'KLB-OLL-00007', notes: 'Seeded report' },
        { weekLabel: 'W8', donation: 12080, members: 110, trackingNumber: 'KLB-OLL-00008', notes: 'Seeded report' },
      ],
    },
    {
      chapelId: 'sto-nino',
      name: 'Sto. Nino Chapel',
      color: '#ef4c3c',
      username: 'STO-NINO',
      reports: [
        { weekLabel: 'W1', donation: 10850, members: 118, trackingNumber: 'KLB-STN-00001', notes: 'Seeded report' },
        { weekLabel: 'W2', donation: 11100, members: 119, trackingNumber: 'KLB-STN-00002', notes: 'Seeded report' },
        { weekLabel: 'W3', donation: 11420, members: 120, trackingNumber: 'KLB-STN-00003', notes: 'Seeded report' },
        { weekLabel: 'W4', donation: 11780, members: 121, trackingNumber: 'KLB-STN-00004', notes: 'Seeded report' },
        { weekLabel: 'W5', donation: 12110, members: 123, trackingNumber: 'KLB-STN-00005', notes: 'Seeded report' },
        { weekLabel: 'W6', donation: 12430, members: 124, trackingNumber: 'KLB-STN-00006', notes: 'Seeded report' },
        { weekLabel: 'W7', donation: 12790, members: 126, trackingNumber: 'KLB-STN-00007', notes: 'Seeded report' },
        { weekLabel: 'W8', donation: 13120, members: 127, trackingNumber: 'KLB-STN-00008', notes: 'Seeded report' },
      ],
    },
  ];
}

export function getChapelSummary(chapel: Chapel) {
  return {
    totalMembers: chapel.reports.at(-1)?.members ?? 0,
    totalDonations: chapel.reports.reduce((sum, report) => sum + report.donation, 0),
    averageDonation: Math.round(chapel.reports.reduce((sum, report) => sum + report.donation, 0) / chapel.reports.length),
  };
}
