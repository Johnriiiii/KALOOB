import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const fallbackChapels = [
  { chapelId: 'st-joseph-parish', name: 'St. Joseph Parish', color: '#4a7a3a' },
  { chapelId: 'st-joseph-worker', name: 'St. Joseph the Worker', color: '#d4c04a' },
  { chapelId: 'our-lady-lourdes', name: 'Our Lady of Lourdes', color: '#3b82f6' },
  { chapelId: 'sto-nino', name: 'Sto. Niño Chapel', color: '#dc2626' },
] as const;

const fallbackSummary = fallbackChapels.map((chapel, index) => ({
  chapelId: chapel.chapelId,
  name: chapel.name,
  color: chapel.color,
  latestDonation: [1200, 2400, 1500, 1800][index] ?? 1000,
  latestMembers: [310, 270, 328, 245][index] ?? 200,
  series: [200, 350, 420, 510, 820, 980, 1100, 1200].map((value, offset) => (index + 1) * value + offset * 40),
}));

const fallbackTotals = {
  totalMembers: fallbackSummary.reduce((sum, chapel) => sum + chapel.latestMembers, 0),
  totalAnnualDonations: fallbackSummary.reduce((sum, chapel) => sum + chapel.latestDonation, 0),
  growthPercentage: 18,
};

const API_BASE_URL = (() => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }

  return '';
})();

type ChapelReport = {
  weekLabel: string;
  donation: number;
  members: number;
  trackingNumber: string;
  notes: string;
  files: Array<{ name: string; type: string; uploadedAt: string }>;
};

type ChapelData = {
  chapelId: string;
  name: string;
  color: string;
  reports: ChapelReport[];
};

type ChapelSummary = {
  chapelId: string;
  name: string;
  color: string;
  latestDonation: number;
  latestMembers: number;
  series: number[];
};

const notifications = [
  { icon: '💚', label: 'Juan Dela Cruz donated ₱1,500 to St. Joseph Parish', time: '2 min ago' },
  { icon: '👤', label: 'Maria Santos joined as new member', time: '15 min ago' },
  { icon: '📄', label: 'Weekly Report generated for St. Joseph the Worker', time: '1 hour ago' },
];

export default function LandingPage() {
  const [selectedChurch, setSelectedChurch] = useState<string>(fallbackChapels[0].name);
  const [chapelsData, setChapelsData] = useState<ChapelData[]>([]);
  const [chapelsSummary, setChapelsSummary] = useState<ChapelSummary[]>(fallbackSummary);
  const [summaryTotals, setSummaryTotals] = useState<{ totalMembers: number; totalAnnualDonations: number; growthPercentage: number } | null>(fallbackTotals);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [donationAmount, setDonationAmount] = useState('100');
  const [donorName, setDonorName] = useState('');
  const [donorNumber, setDonorNumber] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donateAnonymous, setDonateAnonymous] = useState(false);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [donationStatus, setDonationStatus] = useState('');
  const [isDonating, setIsDonating] = useState(false);

  const numericDonationAmount = useMemo(() => {
    return Number(donationAmount.toString().replace(/[^0-9]/g, '')) || 0;
  }, [donationAmount]);

  const formattedDonationAmount = useMemo(() => {
    return numericDonationAmount > 0 ? `₱${numericDonationAmount.toLocaleString('en-PH')}` : '';
  }, [numericDonationAmount]);

  const canDonate = numericDonationAmount > 0 && (donateAnonymous || (
    donorName.trim().length > 0 &&
    donorNumber.trim().length > 0 &&
    donorEmail.trim().length > 0
  ));

  const displayChurchCards = useMemo(() => {
    if (chapelsSummary.length === 0) return [];

    return chapelsSummary.slice(0, 4).map((chapel) => {
      const previous = chapel.series.length > 1 ? chapel.series[chapel.series.length - 2] : chapel.latestDonation;
      const change = previous === 0 ? '+0%' : `${Math.round(((chapel.latestDonation - previous) / previous) * 100)}%`;
      return {
        name: chapel.name,
        amount: `₱${chapel.latestDonation.toLocaleString('en-PH')}`,
        details: `${chapel.latestMembers.toLocaleString('en-PH')} members · latest`,
        change,
        color: chapel.color || '#4a7a3a',
      };
    });
  }, [chapelsSummary]);

  const displayStatsCards = useMemo(() => {
    const totalChurches = chapelsData.length;
    const totalMembers = summaryTotals?.totalMembers ?? 0;
    const totalAnnualDonations = summaryTotals?.totalAnnualDonations ?? 0;
    const growthPercentage = summaryTotals?.growthPercentage ?? 0;

    return [
      { value: totalChurches, label: 'Churches' },
      { value: totalMembers, label: 'KALOOB Members' },
      { value: totalAnnualDonations / 1_000_000, suffix: 'M', label: 'Annual donations' },
      { value: growthPercentage, suffix: '%', label: 'Growth rate' },
    ];
  }, [chapelsData.length, summaryTotals]);

  const selectedChapelSummary = useMemo(() => {
    if (!chapelsSummary.length) return null;
    return chapelsSummary.find((chapel) => chapel.name === selectedChurch || chapel.chapelId === selectedChurch) ?? chapelsSummary[0];
  }, [chapelsSummary, selectedChurch]);

  const selectedChapelData = useMemo(() => {
    if (!chapelsData.length) return null;
    return chapelsData.find((chapel) => chapel.name === selectedChurch || chapel.chapelId === selectedChurch) ?? chapelsData[0];
  }, [chapelsData, selectedChurch]);

  const selectedLatestReport = selectedChapelData?.reports.at(-1) ?? null;

  const selectedChapelGrowth = useMemo(() => {
    if (!selectedChapelSummary) return '+0%';
    const previous = selectedChapelSummary.series.length > 1
      ? selectedChapelSummary.series.at(-2) ?? selectedChapelSummary.latestDonation
      : selectedChapelSummary.latestDonation;
    if (previous === 0) return '+0%';
    return `${Math.round(((selectedChapelSummary.latestDonation - previous) / previous) * 100)}%`;
  }, [selectedChapelSummary]);

  const heroMetrics = useMemo(() => {
    const weeklyCollection = chapelsSummary.reduce((sum, chapel) => sum + chapel.latestDonation, 0);
    const activeMembers = chapelsSummary.reduce((sum, chapel) => sum + chapel.latestMembers, 0);
    const previousTotal = chapelsSummary.reduce((sum, chapel) => sum + (chapel.series.at(-2) ?? 0), 0);
    const growth = previousTotal === 0 ? 0 : Math.round(((weeklyCollection - previousTotal) / previousTotal) * 100);

    return {
      weeklyCollection: `₱${weeklyCollection.toLocaleString('en-PH')}`,
      members: activeMembers.toLocaleString('en-PH'),
      growth: `${growth >= 0 ? '+' : ''}${growth}%`,
    };
  }, [chapelsSummary]);

  const donationTickerItems = useMemo(() => chapelsSummary.map((chapel) => ({
    name: chapel.name,
    amount: `₱${chapel.latestDonation.toLocaleString('en-PH')}`,
    time: 'Latest',
  })), [chapelsSummary]);

  const refreshLandingData = async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    }
    setFetchError('');

    try {
      const [chapelsResponse, summaryResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/chapels`),
        fetch(`${API_BASE_URL}/api/chapels/admin/summary`),
      ]);

      if (!chapelsResponse.ok || !summaryResponse.ok) {
        throw new Error(`API error: ${chapelsResponse.status} / ${summaryResponse.status}`);
      }

      const chapelsPayload = await chapelsResponse.json();
      const summaryPayload = await summaryResponse.json();
      const nextSummary = Array.isArray(summaryPayload?.summary) ? summaryPayload.summary : fallbackSummary;

      if (Array.isArray(chapelsPayload?.chapels)) {
        setChapelsData(chapelsPayload.chapels);
      }

      if (nextSummary.length > 0) {
        setChapelsSummary(nextSummary);
        setSelectedChurch((currentChurch) => {
          const defaultChurch = nextSummary[0]?.name ?? fallbackChapels[0].name;
          return currentChurch && nextSummary.some((chapel) => chapel.name === currentChurch)
            ? currentChurch
            : defaultChurch;
        });
      } else {
        setChapelsSummary(fallbackSummary);
        setSelectedChurch(fallbackChapels[0].name);
      }

      if (summaryPayload?.totals) {
        setSummaryTotals({
          totalMembers: summaryPayload.totals.totalMembers ?? fallbackTotals.totalMembers,
          totalAnnualDonations: summaryPayload.totals.totalAnnualDonations ?? fallbackTotals.totalAnnualDonations,
          growthPercentage: summaryPayload.totals.growthPercentage ?? fallbackTotals.growthPercentage,
        });
      }
    } catch (error) {
      console.error('LandingPage fetch failed', error);
      setChapelsSummary(fallbackSummary);
      setSummaryTotals(fallbackTotals);
      setSelectedChurch(fallbackChapels[0].name);
      setFetchError(`Unable to load landing page statistics. ${error instanceof Error ? error.message : ''}`);
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void refreshLandingData();
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem('kaloob_token');
    let eventSource: EventSource | null = null;
    let pollingInterval: number | null = null;

    const handleUpdate = () => {
      void refreshLandingData(true);
    };

    if (token) {
      const url = `${API_BASE_URL}/api/reports/stream?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(url);
      eventSource.addEventListener('donation', handleUpdate as EventListener);
      eventSource.addEventListener('message', handleUpdate as EventListener);
      eventSource.onerror = () => {
        // EventSource will automatically retry when the connection drops.
      };
    } else {
      pollingInterval = window.setInterval(() => {
        void refreshLandingData(true);
      }, 20000);
    }

    return () => {
      if (eventSource) {
        eventSource.removeEventListener('donation', handleUpdate as EventListener);
        eventSource.removeEventListener('message', handleUpdate as EventListener);
        eventSource.close();
      }
      if (pollingInterval) {
        window.clearInterval(pollingInterval);
      }
    };
  }, []);

  const handleDonate = async () => {
    if (!donationAmount) {
      setDonationStatus('Choose a donation amount first.');
      return;
    }

    if (!donateAnonymous) {
      if (!donorName.trim()) {
        setDonationStatus('Please enter your name.');
        return;
      }

      if (!donorNumber.trim()) {
        setDonationStatus('Please enter your phone number.');
        return;
      }

      if (!donorEmail.trim()) {
        setDonationStatus('Please enter your email.');
        return;
      }
    }

    setIsDonating(true);
    setDonationStatus('');

    try {
      if (numericDonationAmount <= 0) {
        setDonationStatus('Enter a valid donation amount.');
        return;
      }

      const churchName = selectedChapelSummary?.name || selectedChurch;
      if (!churchName) {
        setDonationStatus('Select a chapel before donating.');
        return;
      }

      const body = {
        amount: numericDonationAmount,
        paymentMethod: 'bank_transfer',
        donorName: donateAnonymous ? 'Anonymous Donor' : donorName.trim(),
        donorEmail: donateAnonymous ? 'anonymous@kaloob.local' : donorEmail.trim(),
        donorPhone: donateAnonymous ? '' : donorNumber.trim(),
        churchName,
        purpose: donateAnonymous ? 'Anonymous parish donation' : 'Parish donation',
      };

      const response = await fetch(`${API_BASE_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to create donation checkout.');
      }

      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        setDonationStatus('Redirecting to payment checkout...');
      } else {
        throw new Error('No checkout URL returned by the server.');
      }
    } catch (error) {
      setDonationStatus(`Donate failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDonating(false);
    }
  };

  useEffect(() => {
    const counters = Array.from(document.querySelectorAll<HTMLElement>('.counter'));

    const animateCounter = (counter: HTMLElement) => {
      const target = parseFloat(counter.dataset.target ?? '0');
      const suffix = counter.dataset.suffix ?? '';
      const duration = 1800;
      const start = performance.now();

      const update = (time: number) => {
        const elapsed = Math.min(time - start, duration);
        const progress = elapsed / duration;
        const current = target * progress;

        if (suffix === '%') {
          counter.textContent = `${Math.round(current)}%`;
        } else if (suffix === 'M') {
          counter.textContent = `${current.toFixed(1)}M`;
        } else {
          counter.textContent = `${Math.round(current)}`;
        }

        if (elapsed < duration) {
          requestAnimationFrame(update);
        } else {
          counter.textContent = suffix === '%'
            ? `${Math.round(target)}%`
            : suffix === 'M'
              ? `${target}M`
              : `${Math.round(target)}`;
        }
      };

      requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const counter = entry.target as HTMLElement;
          if (!counter.classList.contains('animated')) {
            counter.classList.add('animated');
            animateCounter(counter);
          }
        }
      });
    }, { threshold: 0.4 });

    counters.forEach((counter) => observer.observe(counter));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => revealObserver.observe(el));

    return () => {
      observer.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="landing-page-root">
      <button type="button" className="fab" onClick={() => scrollToSection('contact')} aria-label="Contact">
        ✉️
      </button>

      <div className="landing-page-bg">
        <div className="floating-shape shape-a" />
        <div className="floating-shape shape-b" />

        <nav className="landing-navbar">
          <div>
            <div className="landing-navbar-brand">
              <div className="brand-mark">K</div>
              <span>KALOOB</span>
            </div>
            <div className="landing-navbar-actions">
              <Link to="/login" className="nav-link login-link">Login</Link>
              <button type="button" className="gradient-btn" onClick={() => scrollToSection('donate')}>
                Donate Now
              </button>
            </div>
          </div>
        </nav>

        <section className="hero-section" id="home">
          <div className="hero-inner">
            <div className="hero-copy reveal">
              <div className="hero-badge">4 Churches · Unified Platform</div>
              <h1>KALOOB</h1>
              <p className="hero-text">
                Streamlined member tracking, donation monitoring, and data-driven insights across all 4 churches.
              </p>
              {loading && <p className="hero-subtext">Loading chapel data...</p>}
              {fetchError && <p className="hero-error">{fetchError}</p>}
              <div className="hero-actions">
                <button type="button" className="btn-neon-green" onClick={() => scrollToSection('about')}>
                  <span>▶</span> Learn More
                </button>
                <Link to="/login" className="btn-neon-yellow">
                  <span>🚀</span> Explore
                </Link>
              </div>
            </div>

            <div className="hero-preview reveal">
              <div className="glass-card preview-card card-3d">
                <div className="preview-top">
                  <div className="preview-icon">📊</div>
                  <div>
                    <p className="preview-label">{selectedChapelSummary?.name ?? 'KALOOB Chapel'}</p>
                    <p className="preview-sub">
                      {selectedLatestReport
                        ? `${selectedLatestReport.weekLabel} · ${selectedChapelSummary?.latestMembers ?? 0} members`
                        : 'Latest chapel account data'}
                    </p>
                  </div>
                </div>
                <div className="preview-grid">
                  <div className="preview-stat">
                    <p>Members</p>
                    <strong>{selectedChapelSummary ? selectedChapelSummary.latestMembers.toLocaleString('en-PH') : heroMetrics.members}</strong>
                  </div>
                  <div className="preview-stat">
                    <p>Donation</p>
                    <strong>{selectedChapelSummary ? `₱${selectedChapelSummary.latestDonation.toLocaleString('en-PH')}` : heroMetrics.weeklyCollection}</strong>
                  </div>
                  <div className="preview-stat">
                    <p>Growth</p>
                    <strong>{selectedChapelSummary ? selectedChapelGrowth : heroMetrics.growth}</strong>
                  </div>
                </div>
                <div className="preview-churches">
                  {(chapelsSummary.length > 0 ? chapelsSummary : [
                    { chapelId: 'st-joseph-parish', name: 'St. Joseph Parish', color: '#4a7a3a' },
                    { chapelId: 'st-joseph-worker', name: 'St. Joseph the Worker', color: '#d4c04a' },
                    { chapelId: 'our-lady-lourdes', name: 'Our Lady of Lourdes', color: '#3b82f6' },
                    { chapelId: 'sto-nino', name: 'Sto. Niño Chapel', color: '#dc2626' },
                  ]).map((church) => (
                    <span key={church.name}>
                      <span className="church-dot" style={{ background: church.color }} /> {church.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="hero-glow" />
            </div>
          </div>
        </section>

        <section className="stats-banner">
          <div className="stats-grid">
            {displayStatsCards.map((item) => (
              <div key={item.label} className="stats-card reveal">
                <div className="counter" data-target={item.value} data-suffix={item.suffix ?? ''}>0{item.suffix ?? ''}</div>
                <div className="stats-label">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ticker-section">
          <div className="ticker-wrapper glass-card">
            <div className="ticker-track">
              {donationTickerItems.map((item) => (
                <div key={item.name} className="ticker-item">
                  <span className="ticker-icon">💚</span>
                  <span className="ticker-name">{item.name}</span>
                  <span className="ticker-amount">{item.amount}</span>
                  <span className="ticker-time">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-inner">
            <div className="about-copy reveal">
              <span className="eyebrow">About KALOOB</span>
              <h2>
                Empowering Parish <br />
                <span className="highlight">Stewardship</span>
              </h2>
              <p>
                KALOOB is a centralized management system designed for churches under the parish. It streamlines member tracking, donation monitoring, and generates data-driven insights to support pastoral planning.
              </p>
              <ul className="about-list">
                <li>Real-time dashboard for each church</li>
                <li>Secure role-based access (Super Admin & Church Admin)</li>
                <li>Automated reports & AI-generated insights</li>
              </ul>
            </div>
            <div className="about-preview reveal">
              <div className="glass-card about-card card-3d">
                <div className="preview-top">
                  <div className="preview-icon">⛪</div>
                  <div>
                    <p className="preview-label">{selectedChapelSummary ? selectedChapelSummary.name : 'Loading chapel data'}</p>
                    <p className="preview-sub">
                      {selectedChapelSummary
                        ? `${selectedChapelSummary.latestMembers.toLocaleString('en-PH')} members · latest`
                        : 'Loading chapel account data'}
                    </p>
                  </div>
                </div>
                <div className="preview-footer">
                  <span>
                    <strong>{selectedChapelSummary ? `₱${selectedChapelSummary.latestDonation.toLocaleString('en-PH')}` : '₱0'}</strong> weekly
                  </span>
                  <span className="preview-pill">
                    {selectedChapelSummary
                      ? `${selectedChapelSummary.series.length > 1 ? `${Math.round(((selectedChapelSummary.latestDonation - (selectedChapelSummary.series.at(-2) ?? selectedChapelSummary.latestDonation)) / (selectedChapelSummary.series.at(-2) ?? selectedChapelSummary.latestDonation)) * 100)}%` : '+0%'}`
                      : '+0%'}
                  </span>
                </div>
                <div className="progress-labels">
                  <span>Monthly Goal</span>
                  <span>{selectedChapelSummary ? `₱${selectedChapelSummary.latestDonation.toLocaleString('en-PH')} / ₱50,000` : '₱0 / ₱50,000'}</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${selectedChapelSummary ? Math.min(Math.round((selectedChapelSummary.latestDonation / 50000) * 100), 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="about-glow" />
            </div>
          </div>
        </section>

        <section className="church-section" id="churches">
          <div className="section-heading reveal">
            <span className="eyebrow">Our Churches</span>
            <h2>Serving <span className="highlight">4 churches</span> across the parish</h2>
          </div>
          <div className="church-grid">
            {displayChurchCards.map((church) => (
              <button
                key={church.name}
                type="button"
                className={`church-card glass-card${selectedChurch === church.name ? ' selected' : ''}`}
                onClick={() => setSelectedChurch(church.name)}
              >
                <div className="church-card-row">
                  <div className="church-header">
                    <span className="church-dot" style={{ background: church.color }} />
                    <h4>{church.name}</h4>
                  </div>
                  <div className="church-meta">
                    <span className="church-pill">{church.change}</span>
                    <span className="church-view">View →</span>
                  </div>
                </div>
                <div className="church-card-info">
                  <span className="church-amount">{church.amount}</span>
                  <span className="church-detail">{church.details}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="donate-section" id="donate">
          <div className="glass-card donate-card reveal">
            <div className="donate-inner">
              <div>
                <span className="donate-badge"><span className="donate-badge-icon">🫶</span> DONATE NOW</span>
                <h3>Support Your <span className="highlight">Parish Community</span></h3>
                <p>
                  Every donation helps strengthen our church community. Choose your church and make a difference today.
                </p>
                <div className="btn-group">
                  <button type="button" className="gradient-btn">
                    <span>🫶</span> Donate Now
                  </button>
                  <button type="button" className="btn-outline">
                    <span>▶</span> Learn More
                  </button>
                </div>
                <div className="security-badges">
                  <span className="security-badge"><span>🔒</span> Secured</span>
                  <span className="security-badge"><span>🛡️</span> Encrypted</span>
                  <span className="security-badge"><span>✅</span> PCI Compliant</span>
                </div>
              </div>
              <div className="donation-box">
                <div className="form-title">Quick Donation</div>
                <div className="form-subtitle">Support your church in just a few clicks</div>

                <div className="form-group">
                  <label>
                    Select Church <span className="required">*</span>
                  </label>
                  <select className="glass-select donation-select" value={selectedChurch} onChange={(event) => setSelectedChurch(event.target.value)}>
                    {chapelsSummary.map((church) => (
                      <option key={church.chapelId} value={church.name}>{church.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Desired Amount <span className="required">*</span>
                  </label>
                  <div className="amount-grid">
                    {['100', '250', '500', '1000'].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`amount-button${donationAmount.replace(/[^0-9]/g, '') === amount && !isCustomAmount ? ' active' : ''}`}
                        onClick={() => {
                          setDonationAmount(amount);
                          setIsCustomAmount(false);
                        }}
                      >
                        ₱{amount}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`amount-button custom${isCustomAmount ? ' active' : ''}`}
                      onClick={() => {
                        setIsCustomAmount(true);
                        setDonationAmount('');
                      }}
                    >
                      Custom
                    </button>
                  </div>
                  <div className="amount-display">
                    Donating <span>{formattedDonationAmount || '₱0'}</span>
                  </div>
                  {isCustomAmount && (
                    <div className="custom-input-wrapper">
                      <input
                        type="number"
                        min="1"
                        value={donationAmount.replace(/[^0-9]/g, '')}
                        onChange={(event) => setDonationAmount(event.target.value)}
                        placeholder="Enter custom amount"
                        className="glass-input"
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(event) => setDonorName(event.target.value)}
                    className="glass-input donation-text-input"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={donorNumber}
                    onChange={(event) => setDonorNumber(event.target.value)}
                    className="glass-input donation-text-input"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={donorEmail}
                    onChange={(event) => setDonorEmail(event.target.value)}
                    className="glass-input donation-text-input"
                    placeholder="Enter your email"
                    disabled={donateAnonymous}
                  />
                </div>

                <div className="form-group checkbox-wrapper">
                  <label>
                    <input
                      type="checkbox"
                      checked={donateAnonymous}
                      onChange={(event) => setDonateAnonymous(event.target.checked)}
                    />
                    <span className="label-text">
                      Donate anonymously
                      <span className="hint">(Your name won't appear publicly)</span>
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  className="gradient-btn donation-submit"
                  onClick={handleDonate}
                  disabled={isDonating || !canDonate || !selectedChapelSummary}
                >
                  <span>🫶</span> Donate {formattedDonationAmount || 'Now'}
                </button>
                {donationStatus && <p className="secure-note">{donationStatus}</p>}

                <div className="secure-note">
                  <span>🔒</span> Your donation is secure and encrypted
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="glass-card contact-card-shell reveal">
            <div className="contact-inner">
              <div>
                <span className="eyebrow">Get in Touch</span>
                <h3>Ready to <span className="highlight">transform</span> your parish?</h3>
                <p>Contact our team for a personalized demo or to set up KALOOB for your church community.</p>
                <div className="contact-cards">
                  <div className="contact-card">
                    <div className="contact-icon">✉️</div>
                    <div>
                      <p className="contact-label">Email</p>
                      <a href="mailto:kaloob@parish.org" className="contact-link">kaloob@parish.org</a>
                    </div>
                  </div>
                  <div className="contact-card">
                    <div className="contact-icon">📞</div>
                    <div>
                      <p className="contact-label">Phone</p>
                      <a href="tel:+639515547440" className="contact-link">0951 555 7440</a>
                    </div>
                  </div>
                  <div className="contact-card">
                    <div className="contact-icon">📍</div>
                    <div>
                      <p className="contact-label">Location</p>
                      <p className="contact-link">Parish Office, Diocese</p>
                    </div>
                  </div>
                </div>
                <div className="social-links">
                  {['facebook', 'twitter', 'instagram', 'youtube'].map((network) => (
                    <a key={network} href="#" className="social-link">{network.charAt(0).toUpperCase()}</a>
                  ))}
                </div>
              </div>

              <div className="contact-form-shell">
                <h4>Send us a message</h4>
                <form className="contact-form-inner">
                  <label>
                    <span>Your Email *</span>
                    <input type="email" placeholder="Enter your email" className="glass-input" />
                  </label>
                  <label>
                    <span>Message *</span>
                    <textarea rows={4} placeholder="Tell us how we can help..." className="glass-input" />
                  </label>
                  <button type="submit" className="gradient-btn contact-send">Send Message</button>
                </form>
                <p className="contact-footnote">✳︎ Your information is secure</p>
              </div>
            </div>
          </div>
        </section>

        <section className="notification-section">
          <div className="glass-card notification-card reveal">
            <h3>Recent Activity</h3>
            <div className="notification-list">
              {notifications.map((item) => (
                <div key={item.label} className="notification-item">
                  <span className="notification-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="notification-time">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="footer-brand">
            <span className="brand-mark small">K</span>
            <span>KALOOB · 2026</span>
          </div>
          <div className="footer-links">
            <a href="#">Facebook</a>
            <a href="#">Twitter</a>
            <a href="#">Instagram</a>
            <a href="#">YouTube</a>
          </div>
          <span className="footer-copy">Built with ♥ for the Church</span>
        </footer>
      </div>
    </div>
  );
}
