export type UserSession = {
  token: string;
  role: 'admin' | 'church' | 'superadmin';
  label: string;
  churchId?: string;
};

export type ChapelReport = {
  weekLabel: string;
  donation: number;
  members: number;
  trackingNumber: string;
  notes: string;
};

export type Chapel = {
  chapelId: string;
  name: string;
  color: string;
  username: string;
  reports: ChapelReport[];
};
