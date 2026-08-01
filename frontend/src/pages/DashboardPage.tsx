import { useEffect, useMemo, useState, useRef } from 'react';
import { Chapel, UserSession } from '../types';
import { AreaChart, Area, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { downloadPDF } from '../utils/reportExport';

type ChapelReport = {
  chapelId: string;
  name: string;
  color: string;
  totalDonations: number;
  totalMembers: number;
  weekSeries: number[];
};

type AnalyticsPayload = {
  churchId: string;
  churchName: string;
  range: string;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  weeklyDonations: number;
  monthlyDonations: number;
  growthPercentage: number;
  donationGrowthPercentage: number;
  membershipGrowthPercentage: number;
  averageWeeklyDonation: number;
  highestDonationWeek: { label: string; amount: number } | null;
  lowestDonationWeek: { label: string; amount: number } | null;
  newMembers: number;
  series: Array<{ period: string; donations: number; members: number }>;
  interpretation: string;
  interpretationBullets: string[];
  recommendations: string[];
  exportData: {
    executiveSummary: string[];
    statisticalSummary: string[];
    trendAnalysis: string[];
    interpretation: string[];
    recommendations: string[];
  };
};

type ChapelAnalytics = AnalyticsPayload & {
  color: string;
};

export default function DashboardPage({ session, chapel, chapels }: { session: UserSession | null; chapel: Chapel; chapels: Chapel[] }) {
  const [chapelReports, setChapelReports] = useState<ChapelAnalytics[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [range, setRange] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  const [searchQuery, setSearchQuery] = useState('');
  const comparisonChartRef = useRef<HTMLDivElement | null>(null);
  const apiUrl = import.meta.env.VITE_API_BASE_URL || '';

  const handleExportDonationChart = async () => {
    if (!comparisonChartRef.current) {
      alert('Chart area not ready yet.');
      return;
    }

    const filename = `consolidated-donation-comparison-${new Date().toISOString().split('T')[0]}.pdf`;
    await downloadPDF(filename, comparisonChartRef.current);
  };

  useEffect(() => {
    if (session?.role === 'superadmin' || session?.role === 'admin') {
      void fetchAllChapelReports();
      const interval = window.setInterval(() => {
        void fetchAllChapelReports();
      }, 15000);
      return () => window.clearInterval(interval);
    }
    return undefined;
  }, [session, chapels, range]);

  // Real-time updates via Server-Sent Events: refresh reports when donations are created
  useEffect(() => {
    if (!(session?.role === 'superadmin' || session?.role === 'admin') || !session?.token) return undefined;
    const url = `${apiUrl}/api/reports/stream?token=${session.token}`;
    const es = new EventSource(url);
    const onDonation = (e: MessageEvent) => {
      try {
        // received donation payload — refresh chapel reports
        void fetchAllChapelReports();
      } catch (err) {
        console.warn('Failed to handle donation event', err);
      }
    };

    es.addEventListener('donation', onDonation as EventListener);
    es.addEventListener('message', onDonation as EventListener);
    es.onerror = (err) => {
      console.warn('SSE error', err);
      // EventSource will try to reconnect automatically
    };

    return () => {
      es.removeEventListener('donation', onDonation as EventListener);
      es.close();
    };
  }, [session?.role, session?.token, apiUrl]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session || !chapel?.chapelId) return;
    void fetchAnalytics();
    const interval = window.setInterval(() => {
      void fetchAnalytics();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [session, chapel?.chapelId, range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${session?.token ?? ''}` };
      const res = await fetch(`${apiUrl}/api/reports/analytics?churchId=${chapel.chapelId}&range=${range}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics ?? null);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllChapelReports = async () => {
    setLoading(true);
    setDashboardError('');
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${session?.token ?? ''}` };
      const res = await fetch(`${apiUrl}/api/reports/analytics/all`, { headers });
      if (!res.ok) {
        const errorBody = await res.text();
        const message = `Failed to fetch chapel data: ${res.status} ${res.statusText}`;
        setDashboardError(message);
        console.error(message, errorBody);
        return;
      }
      const data = await res.json();
      const analyticsList = Array.isArray(data.analytics) ? data.analytics : [];
      setChapelReports(
        analyticsList.map((item: AnalyticsPayload) => ({
          ...item,
          color: chapels.find((c) => c.chapelId === item.churchId)?.color ?? '#7bd540',
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching chapel data';
      setDashboardError(message);
      console.error('Failed to fetch chapel reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeVsInactive = useMemo(() => [
    { name: 'Active', value: analytics?.activeMembers ?? 0, color: '#7bd540' },
    { name: 'Inactive', value: analytics?.inactiveMembers ?? 0, color: '#ff7b72' },
  ], [analytics]);

  if (!session) {
    return (
      <section className="content-panel">
        <h2>Session required</h2>
        <p>Please sign in to view the dashboard content.</p>
      </section>
    );
  }

  if (session.role === 'superadmin' || session.role === 'admin') {
    const visibleChapelReports = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return chapelReports;

      return chapelReports.filter((report) => {
        const haystack = [report.churchName, report.interpretation, report.recommendations.join(' ')].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }, [chapelReports, searchQuery]);

    const pieData = visibleChapelReports.map((report) => ({
      name: report.churchName,
      value: report.totalMembers,
      color: report.color,
    }));

    const maxDistributionValue = Math.max(10, ...pieData.map((d) => d.value));

    const periodLabels = Array.from(
      new Set(visibleChapelReports.flatMap((report) => report.series.map((entry) => entry.period)))
    );

    const comparisonData = periodLabels.map((period) => {
      const row: Record<string, string | number> = { period };
      visibleChapelReports.forEach((report) => {
        const entry = report.series.find((item) => item.period === period);
        row[report.churchId] = entry?.donations ?? 0;
      });
      return row;
    });

    const totalMembers = visibleChapelReports.reduce((sum, report) => sum + (report.totalMembers ?? 0), 0);
    const activeMembers = visibleChapelReports.reduce((sum, report) => sum + (report.activeMembers ?? 0), 0);
    const weeklyCollection = visibleChapelReports.reduce((sum, report) => sum + (report.weeklyDonations ?? 0), 0);
    const totalDonations = visibleChapelReports.reduce(
      (sum, report) => sum + report.series.reduce((serieSum, entry) => serieSum + (entry.donations ?? 0), 0),
      0
    );
    const averageDonationGrowth = visibleChapelReports.length > 0
      ? Math.round(visibleChapelReports.reduce((sum, report) => sum + (report.donationGrowthPercentage ?? 0), 0) / visibleChapelReports.length)
      : 0;
    const averageMemberGrowth = visibleChapelReports.length > 0
      ? Math.round(visibleChapelReports.reduce((sum, report) => sum + (report.membershipGrowthPercentage ?? 0), 0) / visibleChapelReports.length)
      : 0;
    const totalGrowth = `${Math.round((averageDonationGrowth + averageMemberGrowth) / 2)}%`;
    const donationGrowth = `${averageDonationGrowth >= 0 ? '+' : ''}${averageDonationGrowth}%`;
    const memberGrowth = `${averageMemberGrowth >= 0 ? '+' : ''}${averageMemberGrowth}%`;
    const activeGrowth = visibleChapelReports.length > 0 ? `${Math.round((activeMembers / Math.max(1, totalMembers)) * 100)}%` : '+0%';

    return (
      <section className="page-container admin-dashboard">
        <div className="status-bar">
          <div className="status-left">
            <span className="status-icon">☀️</span>
            <strong>27°C</strong>
            <span>Mostly cloudy</span>
          </div>
          <div className="status-search">
            <span className="status-search-icon">🔍</span>
            <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search..." />
          </div>
          <div className="status-right">
            <span>{currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            <span>{currentTime.toLocaleDateString('en-US')}</span>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Loading chapel reports...</p>
        ) : (
          <>
            {dashboardError ? <div className="error-message" style={{ marginBottom: 16 }}>{dashboardError}</div> : null}
            <div className="admin-intro-row">
              <div className="welcome-card card-3d">
                <span className="eyebrow">WELCOME BACK</span>
                <h2>Hi, Super Admin</h2>
                <p>Track donation and membership trends across every church from one analytics command center.</p>
              </div>
              <div className="metrics-grid top-metrics">
                <div className="metric-card stat-card card-3d">
                  <p>Total Members</p>
                  <strong>{totalMembers.toLocaleString()}</strong>
                  <span className="metric-badge">{memberGrowth}</span>
                </div>
                <div className="metric-card stat-card card-3d">
                  <p>Active Members</p>
                  <strong>{activeMembers.toLocaleString()}</strong>
                  <span className="metric-badge">{activeGrowth}</span>
                </div>
                <div className="metric-card stat-card card-3d">
                  <p>Weekly Collection</p>
                  <strong>₱{weeklyCollection.toLocaleString('en-PH')}</strong>
                  <span className="metric-badge">{donationGrowth}</span>
                </div>
                <div className="metric-card stat-card card-3d">
                  <p>Total Donations</p>
                  <strong>₱{totalDonations.toLocaleString('en-PH')}</strong>
                  <span className="metric-badge">{totalGrowth}</span>
                </div>
              </div>
            </div>

            <div className="church-grid">
              {visibleChapelReports.map((report) => {
                const totalDonationAmount = report.series.reduce((sum, entry) => sum + (entry.donations ?? 0), 0);
                const weeklyLabel = report.weeklyDonations ? `₱${report.weeklyDonations.toLocaleString('en-PH')} this week` : 'No weekly donations yet';
                return (
                  <div key={report.churchId} className="church-card card-3d" style={{ borderColor: report.color }}>
                    <div className="church-card-heading">
                      <span className="church-dot" style={{ backgroundColor: report.color }} />
                      <span>{report.churchName}</span>
                    </div>
                    <div className="church-card-value">{report.totalMembers.toLocaleString()} members</div>
                    <div className="church-card-value">₱{totalDonationAmount.toLocaleString('en-PH')} donations</div>
                    <p>{weeklyLabel}</p>
                  </div>
                );
              })}
            </div>

            <div className="dashboard-grid">
              <div className="chart-card card-3d" ref={comparisonChartRef}>
                <div className="chart-card-header">
                  <div>
                    <h2>Consolidated weekly donation comparison</h2>
                    <p className="chart-meta">A multi-line view of all churches with hover tooltips and responsive resizing.</p>
                  </div>
                  <div className="chart-header-actions">
                    <div className="legend-pill-row">
                      {chapelReports.map((report) => (
                        <span key={report.churchId} className="legend-pill">
                          <span className="church-dot" style={{ backgroundColor: report.color }} />
                          {report.churchName}
                        </span>
                      ))}
                    </div>
                    <button className="export-btn gradient-outline" type="button" onClick={handleExportDonationChart}>Export report</button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={comparisonData} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 5" stroke="#b8c85a22" />
                    <XAxis dataKey="period" stroke="#7a9b4a" />
                    <YAxis stroke="#7a9b4a" />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d9d9d9', color: '#1f2937' }} labelStyle={{ color: '#1f2937' }} />
                    <Legend wrapperStyle={{ color: '#152a13', fontSize: '0.9rem' }} />
                    {chapelReports.map((report) => (
                      <Area key={report.churchId} type="monotone" dataKey={report.churchId} stroke={report.color} strokeWidth={3} fillOpacity={0.22} fill={report.color} name={report.churchName} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="distribution-card card-3d">
                <h2>Member distribution across churches</h2>
                <div className="distribution-list">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="distribution-item">
                      <div className="distribution-label">
                        <span className="church-dot" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}</span>
                        <strong>{entry.value}</strong>
                      </div>
                      <div className="distribution-bar">
                        <div
                          className="distribution-fill"
                          style={{
                            width: `${Math.max(12, Math.min(100, (entry.value / maxDistributionValue) * 100))}%`,
                            backgroundColor: entry.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="role-badges">
                  <span className="badge badge-green">CHURCH ADMIN</span>
                  <span className="badge badge-yellow">Super Admin</span>
                </div>
              </div>
            </div>

            <div className="hidden-export-preview" aria-hidden="true" ref={comparisonChartRef}>
              <div className="export-report-page">
                <div className="export-report-header">
                  <div className="export-report-brand">
                    <img src="/logo.png" alt="KALOOB logo" className="export-logo" />
                    <div>
                      <p className="export-report-label">EXPORT CHART REPORT</p>
                      <h1>{chapel.name.toUpperCase()}</h1>
                    </div>
                  </div>
                  <div className="export-report-badge">Donation Report</div>
                </div>

                <div className="export-section">
                  <div className="section-label">CHART DETAILS</div>
                  <div className="chart-card card-3d export-chart-card">
                    <div className="chart-card-header export-chart-header">
                      <div>
                        <h2>Consolidated weekly donation comparison</h2>
                        <p className="chart-meta">A multi-line view of all churches with hover tooltips and responsive resizing.</p>
                      </div>
                      <div className="legend-pill-row export-legend-row">
                        {chapelReports.map((report) => (
                          <span key={report.churchId} className="legend-pill">
                            <span className="church-dot" style={{ backgroundColor: report.color }} />
                            {report.churchName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={comparisonData} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 5" stroke="#b8c85a22" />
                        <XAxis dataKey="period" stroke="#7a9b4a" />
                        <YAxis stroke="#7a9b4a" />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d9d9d9', color: '#1f2937' }} labelStyle={{ color: '#1f2937' }} />
                        <Legend wrapperStyle={{ color: '#152a13', fontSize: '0.9rem' }} />
                        {chapelReports.map((report) => (
                          <Area key={report.churchId} type="monotone" dataKey={report.churchId} stroke={report.color} strokeWidth={3} fillOpacity={0.22} fill={report.color} name={report.churchName} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="export-section">
                  <div className="section-label">INTERPRETATION</div>
                  <div className="export-interpretation">
                    {visibleChapelReports.length > 0 ? (
                      visibleChapelReports.map((report) => (
                        <div key={report.churchId} className="export-interpretation-block">
                          <h3>{report.churchName}</h3>
                          {(report.interpretation ?? 'AI interpretation unavailable.').split('\n').filter(Boolean).map((line, idx) => (
                            <p key={`${report.churchId}-${idx}`}>{line}</p>
                          ))}
                        </div>
                      ))
                    ) : (
                      <p>AI interpretation unavailable.</p>
                    )}
                  </div>
                </div>

                <div className="export-report-footer">
                  <span>Generated by KALOOB Donation Management System</span>
                  <span>{new Date().toLocaleDateString('en-PH')}</span>
                </div>
              </div>
            </div>

            <div className="dashboard-footer">
              <span>Protected by enterprise-grade security</span>
            </div>
          </>
        )}
      </section>
    );
  }

  const latestDonation = analytics?.weeklyDonations ?? chapel.reports.at(-1)?.donation ?? 0;
  const latestMembers = analytics?.totalMembers ?? chapel.reports.at(-1)?.members ?? 0;
  const growthValue = analytics?.growthPercentage ?? 0;

  return (
    <section className="page-container church-dashboard">
      <div className="church-hero glass-card">
        <div className="hero-copy">
          <span className="eyebrow">Church analytics</span>
          <h1>{chapel.name}</h1>
          <p>Monitor weekly giving, membership activity, and chapel performance with clear insight and fast actions.</p>
          <div className="hero-metrics">
            <div>
              <p>Total members</p>
              <strong>{analytics?.totalMembers ?? latestMembers}</strong>
            </div>
            <div>
              <p>Active members</p>
              <strong>{analytics?.activeMembers ?? 0}</strong>
            </div>
            <div>
              <p>Weekly donations</p>
              <strong>₱{(analytics?.weeklyDonations ?? latestDonation).toLocaleString('en-PH')}</strong>
            </div>
          </div>
        </div>

        <div className="hero-summary-panel">
          <div className="summary-heading">
            <span className="eyebrow">This chapel</span>
            <h2>Performance snapshot</h2>
          </div>
          <div className="summary-stats">
            <div>
              <span className="summary-label">Membership growth</span>
              <strong>{growthValue.toFixed(1)}%</strong>
            </div>
            <div>
              <span className="summary-label">Monthly donations</span>
              <strong>₱{(analytics?.monthlyDonations ?? 0).toLocaleString('en-PH')}</strong>
            </div>
          </div>
          <div className="progress-block">
            <div className="progress-label">
              <span>Progress to goal</span>
              <strong>68%</strong>
            </div>
            <div className="progress-bar">
              <div style={{ width: '68%' }} />
            </div>
          </div>
          <div className="quick-action-grid">
            <button type="button" className="button primary">New member</button>
            <button type="button" className="button secondary">Log donation</button>
            <button type="button" className="button secondary">Upload report</button>
          </div>
        </div>
      </div>

      <div className="button-group church-toggle-group">
        {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((period) => (
          <button key={period} className={`button ${range === period ? 'primary' : 'secondary'}`} onClick={() => setRange(period)}>
            {period[0].toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <p className="loading-text">Refreshing analytics...</p> : null}

      <div className="overview-grid">
        <div className="overview-card glass-card">
          <span className="overview-title">Registered members</span>
          <strong>{analytics?.totalMembers ?? latestMembers}</strong>
          <p>Full membership count for this chapel.</p>
        </div>
        <div className="overview-card glass-card">
          <span className="overview-title">Active members</span>
          <strong>{analytics?.activeMembers ?? 0}</strong>
          <p>Members with recent attendance or contributions.</p>
        </div>
        <div className="overview-card glass-card">
          <span className="overview-title">Donation growth</span>
          <strong>{growthValue.toFixed(1)}%</strong>
          <p>Compared to previous selected period.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card glass-card">
          <div className="chart-card-header">
            <div>
              <h2>Weekly donation trend</h2>
              <p className="chart-meta">Line chart showing the selected reporting period.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={analytics?.series ?? chapel.reports.map((report) => ({ period: report.weekLabel, donations: report.donation, members: report.members }))} margin={{ top: 18, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="#9bb26633" />
              <XAxis dataKey="period" stroke="#354d2d" />
              <YAxis stroke="#354d2d" />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d9d9d9', color: '#1f2920' }} labelStyle={{ color: '#1f2920' }} />
              <Legend wrapperStyle={{ color: '#2f4732', fontSize: '0.9rem' }} />
              <Area type="monotone" dataKey="donations" stroke="#7bd540" strokeWidth={3} fillOpacity={0.22} fill="#7bd540" name="Donations" activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <aside className="side-panel glass-card">
          <div className="side-section">
            <div className="section-title">
              <h3>Recent activity</h3>
              <span className="status-tag">Live</span>
            </div>
            <div className="activity-list">
              <div className="activity-item">
                <div>
                  <strong>23 new pledges</strong>
                  <p>New giving commitments from chapel members.</p>
                </div>
                <span className="activity-time">3h ago</span>
              </div>
              <div className="activity-item">
                <div>
                  <strong>12 check-ins</strong>
                  <p>Attendance recorded for the latest service.</p>
                </div>
                <span className="activity-time">5h ago</span>
              </div>
              <div className="activity-item">
                <div>
                  <strong>3 documents uploaded</strong>
                  <p>Recent reports and sermon notes added.</p>
                </div>
                <span className="activity-time">1d ago</span>
              </div>
            </div>
          </div>

          <div className="side-section summary-block">
            <h3>Key priorities</h3>
            <div className="summary-row">
              <span>Improve attendance</span>
              <strong>+8%</strong>
            </div>
            <div className="summary-row">
              <span>Member outreach</span>
              <strong>2 events</strong>
            </div>
            <div className="summary-row">
              <span>Donation goal</span>
              <strong>₱120k</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
