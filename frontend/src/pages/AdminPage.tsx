import { useEffect, useMemo, useState } from 'react';
import { Chapel, UserSession } from '../types';
import { AreaChart, Area, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

type ChapelAnalytics = {
  churchId: string;
  churchName: string;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  weeklyDonations: number;
  monthlyDonations: number;
  donationGrowthPercentage: number;
  membershipGrowthPercentage: number;
  averageWeeklyDonation: number;
  series: Array<{ period: string; donations: number; members: number }>;
};

const COLOR_MAP_BY_USERNAME: Record<string, string> = {
  'SJ-PARISH': '#2ea44f', // green
  'SJ-WORKER': '#f0c400', // yellow
  'LOURDES': '#2b7fff',   // blue
  'STO-NINO': '#ef4c3c',  // red
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function AdminPage({ session, chapels: initialChapels }: { session: UserSession | null; chapels: Chapel[] }) {
  const [chapels, setChapels] = useState<Chapel[]>(initialChapels || []);
  const [analyticsList, setAnalyticsList] = useState<ChapelAnalytics[]>([]);
  const [colorsByChapel, setColorsByChapel] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadAdminData() {
      if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) return;
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
        const [chapelsRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/chapels`, { headers }),
          fetch(`${API_BASE_URL}/api/reports/analytics/all`, { headers }),
        ]);

        if (chapelsRes.ok) {
          const payload = await chapelsRes.json();
          const incoming = Array.isArray(payload.chapels) ? payload.chapels : payload;
          const normalized = incoming.map((c: any) => ({
            ...c,
            color: (c.username && COLOR_MAP_BY_USERNAME[c.username.toUpperCase()]) || c.color || '#888',
          }));
          setChapels(normalized);
          setColorsByChapel(normalized.reduce((acc, chapel) => {
            acc[chapel.chapelId] = chapel.color || '#888';
            return acc;
          }, {} as Record<string, string>));
        }

        if (analyticsRes.ok) {
          const payload = await analyticsRes.json();
          const analyticsData = Array.isArray(payload.analytics) ? payload.analytics : [];
          setAnalyticsList(analyticsData);
        }
      } catch (err) {
        console.error('Failed to load admin analytics:', err);
      }
    }

    loadAdminData();
  }, [session]);

  useEffect(() => {
    if (!(session?.role === 'admin' || session?.role === 'superadmin') || !session?.token) return;
    const url = `${API_BASE_URL}/api/reports/stream?token=${session.token}`;
    const es = new EventSource(url);

    const onDonation = async () => {
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
        const res = await fetch(`${API_BASE_URL}/api/reports/analytics/all`, { headers });
        if (!res.ok) return;
        const payload = await res.json();
        const analyticsData = Array.isArray(payload.analytics) ? payload.analytics : [];
        setAnalyticsList(analyticsData);
      } catch (err) {
        console.error('Failed to refresh admin analytics on donation event:', err);
      }
    };

    es.addEventListener('donation', onDonation as EventListener);
    es.addEventListener('message', onDonation as EventListener);
    es.onerror = () => {
      // EventSource will attempt reconnects automatically; no-op
    };

    return () => {
      es.removeEventListener('donation', onDonation as EventListener);
      es.close();
    };
  }, [session?.role, session?.token]);

  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    return (
      <section className="content-panel">
        <h2>Access denied</h2>
        <p>Admin or Super Admin access is required to view this page.</p>
      </section>
    );
  }

  const displayData = analyticsList.length > 0 ? analyticsList : chapels.map((chapel) => ({
    churchId: chapel.chapelId,
    churchName: chapel.name,
    totalMembers: chapel.reports.reduce((sum, report) => sum + (report.members || 0), 0),
    activeMembers: chapel.reports.at(-1)?.members ?? 0,
    inactiveMembers: 0,
    weeklyDonations: chapel.reports.at(-1)?.donation ?? 0,
    monthlyDonations: chapel.reports.slice(-4).reduce((sum, report) => sum + (report.donation || 0), 0),
    donationGrowthPercentage: 0,
    membershipGrowthPercentage: 0,
    averageWeeklyDonation: chapel.reports.length > 0 ? chapel.reports.reduce((sum, report) => sum + (report.donation || 0), 0) / chapel.reports.length : 0,
    series: chapel.reports.map((report) => ({ period: report.weekLabel, donations: report.donation || 0, members: report.members || 0 })),
  }));

  const chartData = useMemo(() => {
    if (displayData.length === 0) return [];
    const weeks = displayData[0].series.map((r) => r.period);
    return weeks.map((week, index) => ({
      week,
      ...displayData.reduce((acc, chapel) => ({
        ...acc,
        [chapel.churchId]: chapel.series[index]?.donations ?? 0,
      }), {} as Record<string, number>),
    }));
  }, [displayData]);

  return (
    <section className="admin-dashboard">
      <div className="dashboard-hero">
        <span className="eyebrow">Super Admin</span>
        <h1>Consolidated chapel analytics</h1>
        <p>Compare donations and members across all four churches in one central view.</p>
      </div>

      <div className="metrics-grid">
        {chapels.map((chapel) => (
          <div key={chapel.chapelId} className="metric-card" style={{ borderLeft: `4px solid ${chapel.color}` }}>
            <span>{chapel.name}</span>
            <strong>₱{chapel.reports.reduce((sum, report) => sum + (report.donation || 0), 0).toLocaleString()}</strong>
            <p>{chapel.reports.at(-1)?.members ?? 0} members latest</p>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <h2>Comparative donation performance</h2>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={chartData} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="#ffffff22" />
            <XAxis dataKey="week" stroke="#d8ff91" />
            <YAxis stroke="#d8ff91" />
            <Tooltip contentStyle={{ backgroundColor: '#0f180d', borderColor: '#333', color: '#fff' }} />
            <Legend />
            {chapels.map((chapel) => (
              <Area key={chapel.chapelId} type="monotone" dataKey={chapel.chapelId} stroke={chapel.color} fillOpacity={0.18} fill={chapel.color} name={chapel.name} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
