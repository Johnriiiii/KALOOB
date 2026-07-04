import { useState, useMemo, useRef, useEffect } from 'react';
import { Chapel, UserSession } from '../types';
import { generateReportInterpretation, exportToCSV, downloadCSV, downloadPDF, downloadExcel, ReportData } from '../utils/reportExport';

type AnalyticsPayload = {
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
  highestDonationWeek: { label: string; amount: number } | null;
  lowestDonationWeek: { label: string; amount: number } | null;
  newMembers: number;
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

export default function ReportsPage({ session, chapel }: { session: UserSession | null; chapel: Chapel }) {
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'annual'>('weekly');
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsAll, setAnalyticsAll] = useState<AnalyticsPayload[] | null>(null);
  const reportPreviewRef = useRef<HTMLDivElement | null>(null);
  const apiUrl = import.meta.env.VITE_API_BASE_URL || '';

  useEffect(() => {
    if (!session) return;
    const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
    const range = reportType === 'monthly' ? 'monthly' : reportType === 'annual' ? 'annual' : 'weekly';

    if (session.role === 'superadmin') {
      fetch(`${apiUrl}/api/reports/analytics/all?range=${range}`, { headers })
        .then((res) => res.json())
        .then((data) => setAnalyticsAll(Array.isArray(data.analytics) ? data.analytics : []))
        .catch(() => setAnalyticsAll(null));
      return;
    }

    if (!chapel?.chapelId) return;
    fetch(`${apiUrl}/api/reports/analytics?churchId=${chapel.chapelId}&range=${range}`, { headers })
      .then((res) => res.json())
      .then((data) => setAnalytics(data.analytics ?? null))
      .catch(() => setAnalytics(null));
  }, [session, chapel?.chapelId, reportType]);

  // Real-time refresh via SSE: refresh analytics when donations occur
  useEffect(() => {
    if (!session || !session.token) return;
    // EventSource cannot set Authorization header, so pass token as query param
    const url = `${apiUrl}/api/reports/stream?token=${session.token}`;
    const es = new EventSource(url);

    const handleEvent = async (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data ?? '{}');
        const chapelId = payload.chapelId || payload.chapel || payload.chapel_id;
        if (session.role === 'superadmin') {
          const range = reportType === 'monthly' ? 'monthly' : reportType === 'annual' ? 'annual' : 'weekly';
          const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
          const res = await fetch(`${apiUrl}/api/reports/analytics/all?range=${range}`, { headers });
          if (!res.ok) return;
          const data = await res.json();
          setAnalyticsAll(Array.isArray(data.analytics) ? data.analytics : []);
          return;
        }

        if (String(chapelId) === String(chapel?.chapelId)) {
          const range = reportType === 'monthly' ? 'monthly' : reportType === 'annual' ? 'annual' : 'weekly';
          const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
          const res = await fetch(`${apiUrl}/api/reports/analytics?churchId=${chapel?.chapelId}&range=${range}`, { headers });
          if (!res.ok) return;
          const data = await res.json();
          setAnalytics(data.analytics ?? null);
        }
      } catch (err) {
        // ignore parse errors
      }
    };

    es.addEventListener('donation', handleEvent as EventListener);
    es.addEventListener('message', handleEvent as EventListener);
    es.onerror = () => {
      // EventSource will attempt reconnects automatically; no-op
    };

    return () => {
      es.removeEventListener('donation', handleEvent as EventListener);
      es.close();
    };
  }, [session, session?.token, chapel?.chapelId, reportType, apiUrl]);

  if (!session) {
    return <div className="content-panel"><h2>Session required</h2></div>;
  }

  const periodLabel = useMemo(() => {
    const reports = chapel.reports || [];
    if (reportType === 'weekly') {
      const report = reports[selectedWeek];
      return report ? report.weekLabel : 'Weekly details';
    }

    if (reportType === 'monthly') {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      const now = new Date();
      return `${monthNames[now.getMonth()]} summary`;
    }

    return 'Annual summary';
  }, [chapel, reportType, selectedWeek]);

  const isSuperAdmin = session?.role === 'superadmin';
  const reportChapel = isSuperAdmin ? { ...chapel, name: 'All Chapels' } : chapel;

  const reportData = useMemo(() => {
    if (isSuperAdmin && analyticsAll && analyticsAll.length > 0) {
      const totalDonations = analyticsAll.reduce((sum, item) => sum + (reportType === 'monthly' ? item.monthlyDonations : item.weeklyDonations), 0);
      const totalMembers = analyticsAll.reduce((sum, item) => sum + item.totalMembers, 0);
      const averageDonation = analyticsAll.length > 0 ? totalDonations / analyticsAll.length : 0;
      const executiveSummary = analyticsAll.flatMap((item) => item.exportData?.executiveSummary ?? []);
      const statisticalSummary = analyticsAll.flatMap((item) => item.exportData?.statisticalSummary ?? []);
      const trendAnalysis = analyticsAll.flatMap((item) => item.exportData?.trendAnalysis ?? []);
      const interpretationBullets = analyticsAll.flatMap((item) => item.interpretationBullets ?? []);
      const recommendations = analyticsAll.flatMap((item) => item.recommendations ?? []);

      const data: ReportData = {
        chapel: reportChapel,
        totalDonations,
        totalMembers,
        averageDonation,
        interpretation: analyticsAll[0]?.interpretation ?? '',
        executiveSummary,
        statisticalSummary,
        trendAnalysis,
        interpretationBullets,
        recommendations,
      };

      data.interpretation = generateReportInterpretation(data);
      return data;
    }

    const reports = chapel.reports || [];
    let selectedReports = reports;

    if (reportType === 'weekly' && selectedWeek < reports.length) {
      selectedReports = [reports[selectedWeek]];
    } else if (reportType === 'monthly') {
      const now = new Date();
      const currentMonth = now.getMonth();
      selectedReports = reports.filter((_, idx) => {
        const reportDate = new Date(now);
        reportDate.setDate(reportDate.getDate() - (reports.length - 1 - idx) * 7);
        return reportDate.getMonth() === currentMonth;
      });
    }

    const derivedTotalDonations = selectedReports.reduce((sum, r) => sum + (r.donation || 0), 0);
    const derivedTotalMembers = selectedReports.reduce((sum, r) => sum + (r.members || 0), 0);
    const derivedAverageDonation = selectedReports.length > 0 ? derivedTotalDonations / selectedReports.length : 0;

    const analyticsTotalDonations = reportType === 'monthly'
      ? analytics?.monthlyDonations
      : analytics?.weeklyDonations;
    const totalDonations = analyticsTotalDonations ?? derivedTotalDonations;
    const totalMembers = analytics?.totalMembers ?? derivedTotalMembers;
    const averageDonation = analytics?.averageWeeklyDonation ?? derivedAverageDonation;

    const data: ReportData = {
      chapel,
      totalDonations,
      totalMembers,
      averageDonation,
      interpretation: analytics?.interpretation ?? '',
      executiveSummary: analytics?.exportData?.executiveSummary ?? [],
      statisticalSummary: analytics?.exportData?.statisticalSummary ?? [],
      trendAnalysis: analytics?.exportData?.trendAnalysis ?? [],
      interpretationBullets: analytics?.interpretationBullets ?? [],
      recommendations: analytics?.recommendations ?? [],
    };

    data.interpretation = generateReportInterpretation(data);
    return data;
  }, [chapel, reportType, selectedWeek, analytics, analyticsAll, isSuperAdmin]);

  const handleExportPDF = async () => {
    if (!reportPreviewRef.current) {
      alert('Report preview is not ready yet.');
      return;
    }

    const filename = `${reportData.chapel.name.replace(/\s+/g, '_')}-report-${new Date().toISOString().split('T')[0]}.pdf`;
    await downloadPDF(filename, reportPreviewRef.current);
  };

  const handleExportExcel = async () => {
    const filename = `${reportData.chapel.name.replace(/\s+/g, '_')}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    await downloadExcel(filename, reportData);
  };

  const handleExportCSV = () => {
    const csv = exportToCSV(reportData);
    const filename = `${reportData.chapel.name.replace(/\s+/g, '_')}-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, csv);
  };

  const recommendationItems = reportData.recommendations && reportData.recommendations.length > 0 ? reportData.recommendations : [
    'Continued member engagement programs are recommended to maintain positive growth.',
    'Consider increasing weekly outreach activities to sustain donation momentum.',
    'Monitor monthly trends to plan chapel activities with more precision.',
  ];

  return (
    <section className="page-container reports-page">
      <div className="page-header">
        <span className="eyebrow">Report Generation</span>
        <h1>Reports</h1>
        <p>Generate and export donation and member reports with chapel-specific interpretation.</p>
      </div>

      {session?.role === 'superadmin' && analyticsAll && analyticsAll.length > 0 ? (
        <div className="admin-report-cards">
          {analyticsAll.map((item) => {
            const donationValue = reportType === 'monthly' ? item.monthlyDonations : item.weeklyDonations;
            const periodLabel = reportType === 'monthly' ? 'this month' : 'this week';
            return (
              <div
                key={item.churchId}
                className="admin-report-card"
                style={{ borderColor: (item.churchId === 'st-joseph-parish' && '#2ea44f') || (item.churchId === 'st-joseph-worker' && '#f0c400') || (item.churchId === 'our-lady-lourdes' && '#2b7fff') || (item.churchId === 'sto-nino' && '#ef4c3c') || '#888' }}
              >
                <div className="admin-report-card-title">{item.churchName}</div>
                <div className="admin-report-card-value">{item.totalMembers.toLocaleString('en-PH')} members</div>
                <div className="admin-report-card-value">₱{donationValue.toLocaleString('en-PH')} donations</div>
                <div className="admin-report-card-sub">{periodLabel}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="report-builder">
        <div className="report-config-card">
          <div className="builder-header">
            <div>
              <span className="eyebrow">Report setup</span>
              <h3>Build your chapel summary</h3>
            </div>
            <p>Select the report period and optional week to optimize chapel planning.</p>
          </div>

          <div className="report-tabs">
            <button className={`tab-btn${reportType === 'weekly' ? ' active' : ''}`} type="button" onClick={() => setReportType('weekly')}>Weekly</button>
            <button className={`tab-btn${reportType === 'monthly' ? ' active' : ''}`} type="button" onClick={() => setReportType('monthly')}>Monthly</button>
            <button className={`tab-btn${reportType === 'annual' ? ' active' : ''}`} type="button" onClick={() => setReportType('annual')}>Annual</button>
          </div>

          {reportType === 'weekly' && (
            <div className="week-selector">
              <label>Select week</label>
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} className="glass-select">
                {chapel.reports?.map((report, idx) => (
                  <option key={idx} value={idx}>{report.weekLabel}</option>
                ))}
              </select>
            </div>
          )}

          <button type="button" className="export-btn gradient-btn full-width" onClick={handleExportPDF}>Generate preview</button>
        </div>

        <div className="report-preview-card">
          <div className="report-preview-header">
            <div>
              <span className="eyebrow">Report preview</span>
              <h3>{reportData.chapel.name} summary</h3>
            </div>
            <span className="report-period">{reportType === 'weekly' ? `Week ${selectedWeek + 1}` : reportType === 'monthly' ? 'Monthly' : 'Annual'}</span>
          </div>

          <div className="report-summary-grid">
            <div className="summary-card">
              <p className="summary-label">Total donations</p>
              <p className="summary-value">₱{reportData.totalDonations.toLocaleString('en-PH')}</p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Donors</p>
              <p className="summary-value">{reportData.totalMembers}</p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Avg donation</p>
              <p className="summary-value">₱{reportData.averageDonation.toFixed(0)}</p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Growth</p>
              <p className="summary-value">+9%</p>
            </div>
          </div>

          <div className="report-section">
            <h4>Executive summary</h4>
            <p className="report-copy">
              <strong>{reportData.chapel.name}</strong> collected <strong>₱{reportData.totalDonations.toLocaleString('en-PH')}</strong> with <strong>{reportData.totalMembers}</strong> members contributing during the selected period.
            </p>
          </div>

          <div className="report-section report-grid">
            <div className="report-card">
              <h5>Statistical analysis</h5>
              <ul>
                <li>Donations are stable and support chapel operations.</li>
                <li>Member participation is consistent.</li>
                <li>Average donation shows strength in the selected period.</li>
              </ul>
            </div>
            <div className="report-card">
              <h5>Interpretation</h5>
              <p>These results indicate healthy chapel engagement and support continued outreach planning.</p>
            </div>
          </div>

          <div className="report-section report-grid">
            <div className="report-card">
              <h5>Recommendations</h5>
              <ul>
                {recommendationItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="report-card export-panel">
              <h5>Export options</h5>
              <p>Download the chapel report in the format that works best for leaders and parish teams.</p>
              <div className="export-actions">
                <button className="export-btn gradient-btn" type="button" onClick={handleExportPDF}>Export PDF</button>
                <button className="export-btn gradient-outline" type="button" onClick={handleExportExcel}>Export Excel</button>
                <button className="export-btn gradient-outline" type="button" onClick={handleExportCSV}>Export CSV</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="summary-note">🔒 Chapel data is scoped to your assigned parish and chapel.</div>

      <div className="hidden-report-preview" aria-hidden="true">
        <div className="report-page" ref={reportPreviewRef}>
          <div className="top-stripe" />
          <div className="header">
            <img src="/logo.png" alt="KALOOB logo" className="header-logo" />
            <div className="header-text">
              <div className="header-brand">K<span>ALOOB</span></div>
              <div className="header-sub">Donation Summary Report</div>
            </div>
            <div className="header-badge">Donation Report</div>
          </div>

          <div className="body">
            <div className="sec-label">Report details</div>
            <div className="meta-grid">
              <div className="meta-item">
                <div className="meta-key">Chapel</div>
                <div className="meta-val">{reportData.chapel.name}</div>
              </div>
              <div className="meta-item">
                <div className="meta-key">Period</div>
                <div className="meta-val">{periodLabel}</div>
              </div>
              <div className="meta-item">
                <div className="meta-key">Generated</div>
                <div className="meta-val">{new Date().toLocaleDateString('en-PH')}</div>
              </div>
              <div className="meta-item">
                <div className="meta-key">Prepared by</div>
                <div className="meta-val">KALOOB Donation Management</div>
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-card green">
                <div className="stat-eyebrow">Total Donations</div>
                <div className="stat-number">₱{reportData.totalDonations.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div className="stat-desc">Total amount received</div>
              </div>
              <div className="stat-card blue">
                <div className="stat-eyebrow">Total Members</div>
                <div className="stat-number">{reportData.totalMembers}</div>
                <div className="stat-desc">Registered chapel members</div>
              </div>
              <div className="stat-card gold">
                <div className="stat-eyebrow">Average Donation</div>
                <div className="stat-number">₱{reportData.averageDonation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div className="stat-desc">Average support amount</div>
              </div>
            </div>

            <div className="sec-label">Executive summary</div>
            <div className="interp-box">
              <div className="interp-box-title">Automated summary</div>
              <ul className="assess-list">
                {(reportData.executiveSummary ?? []).map((item) => (
                  <li key={item}><span className="assess-dot" />{item}</li>
                ))}
              </ul>
            </div>

            <div className="sec-label">Statistical summary</div>
            <div className="interp-box">
              <ul className="assess-list">
                {(reportData.statisticalSummary ?? []).map((item) => (
                  <li key={item}><span className="assess-dot" />{item}</li>
                ))}
              </ul>
            </div>

            <div className="sec-label">Trend analysis</div>
            <div className="interp-box">
              <ul className="assess-list">
                {(reportData.trendAnalysis ?? []).map((item) => (
                  <li key={item}><span className="assess-dot" />{item}</li>
                ))}
              </ul>
            </div>

            <div className="sec-label">Insights</div>
            <div className="interp-grid">
              <div className="interp-box">
                <div className="interp-box-title">Report interpretation</div>
                <div className="interp-body">
                  {reportData.interpretation.split('\n').map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="interp-box">
                <div className="interp-box-title">Assessment</div>
                <ul className="assess-list">
                  <li>
                    <span className="assess-dot" />
                    {reportData.averageDonation >= 1000 ? 'Strong giving pattern across the chapel.' : reportData.averageDonation >= 500 ? 'Stable giving with room to grow.' : 'Average donations need stronger engagement.'}
                  </li>
                  <li>
                    <span className="assess-dot" />
                    {reportData.totalMembers >= 100 ? 'Healthy member participation is evident.' : 'Membership is growing; continue outreach.'}
                  </li>
                  <li>
                    <span className="assess-dot" />
                    Stable financial support encourages future planning.
                  </li>
                </ul>
              </div>
            </div>

            <div className="sec-label">Recommendations</div>
            <div className="rec-grid">
              {recommendationItems.map((item, index) => (
                <div className="rec-item" key={index}>
                  <div className="rec-num">{index + 1}</div>
                  <div>{item}</div>
                </div>
              ))}
            </div>

            <div className="quote-block">
              <div className="quote-mark">“</div>
              <div>
                <div className="quote-text">Thank you to all our generous parishioners for your continued support and commitment to {reportData.chapel.name}. Together, we build a stronger faith community.</div>
                <div className="quote-attr">Prepared by KALOOB Donation Management</div>
              </div>
            </div>
          </div>

          <div className="footer">
            <div className="footer-left">Generated: {new Date().toLocaleDateString('en-PH')} | {new Date().toLocaleTimeString('en-PH')}</div>
            <div className="footer-center">KALOOB Donation Management System</div>
            <div className="footer-right">Donation Summary Report</div>
          </div>

          <div className="bottom-stripe" />
        </div>
      </div>
    </section>
  );
}
