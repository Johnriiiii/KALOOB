import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Chapel, UserSession } from '../types';

type Member = {
  _id: string;
  trackingNumber: string;
  fullName: string;
  contactNumber?: string;
  address?: string;
  status?: string;
};

type Donation = {
  _id: string;
  trackingNumber: string;
  memberId: string;
  memberName: string;
  churchId: string;
  date: string;
  weekNumber: number;
  amount: number;
  notes?: string;
};

const weatherMap: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Cloudy', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Foggy', icon: '🌫️' },
  51: { label: 'Drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Drizzle', icon: '🌧️' },
  61: { label: 'Rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '⛈️' },
  71: { label: 'Snow', icon: '❄️' },
  73: { label: 'Snow', icon: '❄️' },
  75: { label: 'Snow', icon: '❄️' },
  80: { label: 'Showers', icon: '🌦️' },
  81: { label: 'Showers', icon: '🌧️' },
  82: { label: 'Storms', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm', icon: '⛈️' },
  99: { label: 'Thunderstorm', icon: '⛈️' },
};

export default function DonationsPage({ session, chapel, chapels }: { session: UserSession | null; chapel: Chapel; chapels: Chapel[] }) {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
  const [dateTime, setDateTime] = useState(new Date());
  const [weather, setWeather] = useState({ temperature: 27, condition: 'Mostly cloudy', icon: '☀️' });
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const [donationsError, setDonationsError] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterWeek, setFilterWeek] = useState('all');
  const [weekNumber, setWeekNumber] = useState(4);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedDonations = useMemo(() => {
    return [...donations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [donations]);

  const totalDonations = useMemo(() => donations.reduce((sum, donation) => sum + Number(donation.amount), 0), [donations]);
  const latestWeek = sortedDonations[0]?.weekNumber ?? weekNumber;
  const weeklyTotal = useMemo(() => donations.filter((d) => d.weekNumber === latestWeek).reduce((sum, donation) => sum + Number(donation.amount), 0), [donations, latestWeek]);
  const monthlyTotal = useMemo(() => {
    const recentWeeks = Array.from(new Set(sortedDonations.map((donation) => donation.weekNumber))).slice(0, 4);
    return donations.filter((donation) => recentWeeks.includes(donation.weekNumber)).reduce((sum, donation) => sum + Number(donation.amount), 0);
  }, [donations, sortedDonations]);
  const averageDonation = donations.length > 0 ? Math.round(totalDonations / donations.length) : 0;
  const recentChange = useMemo(() => {
    const recent = sortedDonations.slice(0, 2);
    if (recent.length < 2) return 0;
    const current = Number(recent[0].amount);
    const previous = Number(recent[1].amount);
    return previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);
  }, [sortedDonations]);
  const monthlyComparison = useMemo(() => {
    if (sortedDonations.length < 8) return 0;
    const lastFour = sortedDonations.slice(0, 4).reduce((sum, donation) => sum + Number(donation.amount), 0);
    const prevFour = sortedDonations.slice(4, 8).reduce((sum, donation) => sum + Number(donation.amount), 0);
    return prevFour === 0 ? 0 : Math.round(((lastFour - prevFour) / prevFour) * 100);
  }, [sortedDonations]);
  const monthlyChange = monthlyComparison;

  const recentWeekNumbers = useMemo(() => {
    return Array.from(new Set(sortedDonations.map((donation) => donation.weekNumber))).slice(0, 4);
  }, [sortedDonations]);

  const recentWeeks = useMemo(() => {
    return recentWeekNumbers.map((weekNumber) => ({
      weekNumber,
      weekLabel: `Week ${weekNumber}`,
      donation: donations
        .filter((donation) => donation.weekNumber === weekNumber)
        .reduce((sum, donation) => sum + Number(donation.amount), 0),
    }));
  }, [donations, recentWeekNumbers]);

  const filteredDonations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sortedDonations.filter((donation) => {
      if (filterMemberId && donation.memberId !== filterMemberId) {
        return false;
      }
      if (filterWeek !== 'all' && donation.weekNumber !== Number(filterWeek)) {
        return false;
      }

      const haystack = [
        donation.memberName,
        donation.trackingNumber,
        donation.notes,
        donation.weekNumber.toString(),
        new Date(donation.date).toLocaleDateString(),
        Number(donation.amount).toString(),
      ].filter(Boolean).join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [sortedDonations, searchQuery, filterMemberId, filterWeek]);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!session) return;
      setMembersLoading(true);
      setMembersError('');

      try {
        const response = await fetch(`${apiUrl}/api/members?churchId=${chapel.chapelId}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || `Failed to load members (${response.status})`);
        }

        setMembers(Array.isArray(data.members) ? data.members : []);
      } catch (error) {
        setMembersError((error as Error).message || 'Unable to load members.');
      } finally {
        setMembersLoading(false);
      }
    };

    const fetchDonations = async () => {
      if (!session) return;
      setDonationsLoading(true);
      setDonationsError('');

      try {
        const response = await fetch(`${apiUrl}/api/donations?chapelId=${chapel.chapelId}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || `Failed to load donations (${response.status})`);
        }

        setDonations(Array.isArray(data.donations) ? data.donations : []);
      } catch (error) {
        setDonationsError((error as Error).message || 'Unable to load donations.');
      } finally {
        setDonationsLoading(false);
      }
    };

    fetchMembers();
    fetchDonations();
  }, [session, chapel.chapelId, apiUrl]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let lat = 14.5995;
        let lon = 120.9842;
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
        }

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        if (!res.ok) return;
        const data = await res.json();
        const current = data.current_weather;
        if (current) {
          const weatherInfo = weatherMap[current.weathercode] ?? { label: 'Clear', icon: '☀️' };
          setWeather({
            temperature: Math.round(current.temperature),
            condition: weatherInfo.label,
            icon: weatherInfo.icon,
          });
        }
      } catch {
        // ignore failures and keep default weather
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setSubmitError('');
    setSubmitSuccess('');
    if (!isAnonymous && !selectedMemberId) {
      setSubmitError('Please select a member or mark as anonymous donation.');
      return;
    }
    if (!date || !amount) {
      setSubmitError('Date and amount are required.');
      return;
    }

    let memberName = 'Anonymous';
    let memberId = undefined;

    if (!isAnonymous) {
      const member = members.find((m) => m._id === selectedMemberId);
      if (!member) {
        setSubmitError('Selected member not found.');
        return;
      }
      memberName = member.fullName;
      memberId = member._id;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/api/donations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          memberName,
          date,
          weekNumber,
          amount: Number(amount),
          notes,
          isAnonymous,
          chapelId: chapel.chapelId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || `Failed to record donation (${response.status})`);
      }

      setDonations((prev) => [data.donation, ...prev]);
      setSubmitSuccess(`Donation recorded successfully${isAnonymous ? ' (Anonymous)' : ''}.`);
      setSelectedMemberId('');
      setIsAnonymous(false);
      setAmount('');
      setNotes('');
      setWeekNumber(4);
      setDate(new Date().toISOString().slice(0, 10));
    } catch (error) {
      setSubmitError((error as Error).message || 'Unable to record donation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDonation = async (donationId: string) => {
    if (!session) return;
    try {
      const response = await fetch(`${apiUrl}/api/donations/${donationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || `Failed to remove donation (${response.status})`);
      }
      setDonations((prev) => prev.filter((donation) => donation._id !== donationId));
    } catch (error) {
      setDonationsError((error as Error).message || 'Unable to delete donation.');
    }
  };

  if (!session) {
    return <div className="content-panel"><h2>Session required</h2></div>;
  }

  const timeString = dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = dateTime.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  const showAllChapels = session.role === 'superadmin' || session.role === 'admin';

  return (
    <section className="page-container donations-page bg-pattern">
      <div className="status-bar donations-status-bar">
        <div className="status-left">
          <span className="weather-icon">{weather.icon}</span>
          <div>
            <div className="status-temp">{weather.temperature}°C</div>
            <div className="status-text">{weather.condition}</div>
          </div>
        </div>

        <div className="status-right">
          <div className="status-search">
            <span className="search-icon">🔍</span>
            <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search donations..." className="glass-input search-input" />
          </div>
          <span className="status-chip">{timeString}</span>
          <span className="status-chip">{dateString}</span>
        </div>
      </div>

      <div className="page-header">
        <h1>Donations</h1>
        <div className="page-subtitle-row">
          <span className="church-dot" style={{ backgroundColor: chapel.color }}></span>
          <div>
            <div className="page-subtitle-title">{chapel.name}</div>
            <div className="page-subtitle-text">
              {showAllChapels
                ? 'Track and manage weekly donations across the full chapel network.'
                : 'Track and manage weekly donations for your assigned chapel only.'}
            </div>
          </div>
        </div>
        {showAllChapels && (
          <div className="chapel-network-row">
            {chapels.map((item) => (
              <div key={item.chapelId} className={`chapel-pill${item.chapelId === chapel.chapelId ? ' active' : ''}`} style={{ borderColor: item.color }}>
                <span className="chapel-dot" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="donation-stats-grid">
        <div className="glass-card stat-card card-3d">
          <p className="stat-label">Total Donations</p>
          <p className="stat-value">₱{totalDonations.toLocaleString('en-PH')}</p>
          <span className="stat-change">{recentChange >= 0 ? `+${recentChange}%` : `${recentChange}%`}</span>
        </div>
        <div className="glass-card stat-card card-3d">
          <p className="stat-label">Weekly Total</p>
          <p className="stat-value">₱{weeklyTotal.toLocaleString('en-PH')}</p>
          <span className="stat-change">{recentWeeks.length > 1 ? `${recentWeeks.at(-1)?.weekLabel ?? ''} vs ${recentWeeks.at(-2)?.weekLabel ?? ''}` : 'Current week'}</span>
        </div>
        <div className="glass-card stat-card card-3d">
          <p className="stat-label">Monthly Total</p>
          <p className="stat-value">₱{monthlyTotal.toLocaleString('en-PH')}</p>
          <span className="stat-change">{monthlyChange >= 0 ? `+${monthlyChange}%` : `${monthlyChange}%`}</span>
        </div>
        <div className="glass-card stat-card card-3d">
          <p className="stat-label">Avg. Donation</p>
          <p className="stat-value">₱{averageDonation.toLocaleString('en-PH')}</p>
          <span className="stat-change secondary">per week</span>
        </div>
      </div>

      <div className="donation-page-grid">
        <div className="donation-left-col">
          <div className="glass-card panel-card card-3d sticky-card">
            <div className="panel-heading">
              <span className="panel-icon">＋</span>
              <h3>Record Donation</h3>
            </div>
            <p className="panel-copy">Add new donation entries for members</p>
            <form className="donation-form" onSubmit={handleSubmit}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                <span>Anonymous Donation</span>
              </label>

              {!isAnonymous && (
                <label>
                  <span>Member *</span>
                  <select
                    className="glass-select input-full"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    disabled={membersLoading}
                  >
                    <option value="">Select member</option>
                    {members.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.trackingNumber} - {member.fullName}
                      </option>
                    ))}
                  </select>
                  {membersError ? <p className="error-message" style={{ marginTop: 10 }}>{membersError}</p> : null}
                  {membersLoading ? <p style={{ marginTop: 10, color: '#5f6d57' }}>Loading members...</p> : null}
                </label>
              )}

              <label>
                <span>Week Number *</span>
                <select className="glass-select input-full" value={weekNumber} onChange={(e) => setWeekNumber(Number(e.target.value))}>
                  {[...Array(12)].map((_, idx) => {
                    const value = idx + 1;
                    return <option key={value} value={value}>Week {value}</option>;
                  })}
                </select>
              </label>

              <label>
                <span>Date *</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="glass-input input-full" />
              </label>

              <label>
                <span>Donation Amount *</span>
                <div className="amount-field">
                  <span className="currency-icon">₱</span>
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="glass-input input-full amount-input" />
                </div>
              </label>

              <label>
                <span>Notes</span>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="glass-input input-full" />
              </label>

              {submitError ? <div className="error-message">{submitError}</div> : null}
              {submitSuccess ? <div className="success-message">{submitSuccess}</div> : null}

              <button type="submit" className="gradient-btn full-width btn-submit" disabled={isSubmitting || (!isAnonymous && !selectedMemberId) || !date || !amount}>
                {isSubmitting ? 'Recording...' : 'Record Donation'}
              </button>
            </form>
          </div>
        </div>

        <div className="donation-right-col">
          <div className="glass-card panel-card card-3d">
            <div className="panel-heading space-between">
              <div className="panel-title">
                <span className="panel-icon">⟳</span>
                <h3>Donation History</h3>
              </div>
              <div className="panel-actions">
                <button type="button" className="filter-btn" onClick={() => setFilterWeek('all')}>Clear week filter</button>
                <button type="button" className="filter-btn" onClick={() => setFilterMemberId('')}>Clear member filter</button>
              </div>
            </div>

            <div className="history-filters">
              <div className="status-search">
                <span className="search-icon">🔍</span>
                <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search donations..." className="glass-input search-input" />
              </div>
              <select className="glass-select filter-select" value={filterMemberId} onChange={(event) => setFilterMemberId(event.target.value)}>
                <option value="">All Members</option>
                {members.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.trackingNumber} - {member.fullName}
                  </option>
                ))}
              </select>
              <select className="glass-select filter-select" value={filterWeek} onChange={(event) => setFilterWeek(event.target.value)}>
                <option value="all">All Weeks</option>
                {recentWeekNumbers.map((week) => (
                  <option key={week} value={week}>
                    Week {week}
                  </option>
                ))}
              </select>
            </div>

            {donationsError ? <div className="error-message">{donationsError}</div> : null}
            {donationsLoading ? (
              <div className="history-empty">Loading donation history...</div>
            ) : filteredDonations.length === 0 ? (
              <div className="history-empty">No donations match your search.</div>
            ) : (
              <div className="history-list">
                {(showAllHistory ? filteredDonations : filteredDonations.slice(0, 4)).map((item) => (
                  <div key={item._id} className="donation-item">
                    <div className="donation-item-left">
                      <div className="donation-item-name">{item.memberName}</div>
                      <div className="donation-item-meta">
                        <span>{item.trackingNumber}</span>
                        <span>·</span>
                        <span>Week {item.weekNumber}</span>
                        <span>·</span>
                        <span>{new Date(item.date).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="text-muted">{item.notes || 'Donation record'}</span>
                      </div>
                    </div>
                    <div className="donation-item-right">
                      <div className="donation-item-amount">₱{Number(item.amount).toLocaleString('en-PH')}</div>
                      <div className="donation-item-actions">
                        <button className="icon-btn delete-btn" type="button" onClick={() => handleDeleteDonation(item._id)}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="view-more-row">
              <button type="button" className="text-button" onClick={() => setShowAllHistory((prev) => !prev)}>
                {showAllHistory ? 'Show latest donations' : 'View all donation history →'}
              </button>
            </div>
          </div>

          <div className="glass-card panel-card card-3d">
            <div className="panel-heading">
              <span className="panel-icon">📊</span>
              <h3>Weekly Summary</h3>
            </div>
            <p className="panel-copy">See weekly donation totals and trends</p>

            <div className="summary-grid">
              {recentWeeks.map((item, index) => {
                const previous = recentWeeks[index - 1]?.donation ?? item.donation;
                const change = previous === 0 ? '+0%' : `${item.donation >= previous ? '+' : ''}${Math.round(((item.donation - previous) / previous) * 100)}%`;
                return (
                  <div key={item.weekLabel} className="summary-card">
                    <p className="summary-label">{item.weekLabel}</p>
                    <p className="summary-value">₱{item.donation.toLocaleString('en-PH')}</p>
                    <span className="summary-change">{change}</span>
                  </div>
                );
              })}
            </div>

            <div className="trend-chart">
              <svg viewBox="0 0 400 40" preserveAspectRatio="none">
                <polyline points="0,30 100,25 200,18 300,12 400,5" fill="none" stroke="#4a7a3a" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="chart-axis">
                <span>W1</span>
                <span>W2</span>
                <span>W3</span>
                <span>W4</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="donation-footer">
        <span>🔒 KALOOB Donations · All data is encrypted and secure</span>
      </div>
    </section>
  );
}
