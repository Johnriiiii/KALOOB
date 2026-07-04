import MemberForm from '../components/MemberForm';
import MemberTable from '../components/MemberTable';
import FileUpload from '../components/FileUpload';
import { Chapel, UserSession } from '../types';
import { useEffect, useRef, useState } from 'react';

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

export default function MembersPage({ session, chapel, chapels }: { session: UserSession | null; chapel: Chapel; chapels: Chapel[] }) {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
  const memberTableRef = useRef<any>(null);
  const [dateTime, setDateTime] = useState(new Date());
  const [weather, setWeather] = useState({ temperature: 27, condition: 'Mostly cloudy', icon: '☁️' });
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      } catch (err) {
        // ignore and keep default weather
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!session) {
    return <div className="content-panel"><h2>Session required</h2></div>;
  }

  const timeString = dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = dateTime.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  const showAllChapels = session.role === 'superadmin' || session.role === 'admin';

  return (
    <section className="page-container members-page">
      <div className="status-bar pane glass-card">
        <div className="status-left">
          <span className="weather-icon">{weather.icon}</span>
          <div>
            <div className="status-temp">{weather.temperature}°C</div>
            <div className="status-text">{weather.condition}</div>
          </div>
        </div>

        <div className="status-right">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members..." className="glass-input search-input" />
          </div>
          <span className="status-chip">{timeString}</span>
          <span className="status-chip">{dateString}</span>
        </div>
      </div>

      <div className="page-header">
        <h1>Members</h1>
        <div className="page-subtitle-row">
          <span className="church-dot" style={{ backgroundColor: chapel.color }}></span>
          <div>
            <div className="page-subtitle-title">{chapel.name}</div>
            <div className="page-subtitle-text">
              {showAllChapels
                ? 'Manage KALOOB members and track membership growth across every chapel.'
                : 'Manage members and membership growth for your assigned chapel.'}
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

      <div className="content-grid members-grid">
        <div className="glass-card panel-card card-3d">
          <MemberForm apiUrl={apiUrl} session={session} chapelId={chapel.chapelId} onSaved={() => { memberTableRef.current?.refresh?.(); }} />
        </div>

        <div className="members-right-column">
          <div className="glass-card panel-card card-3d">
            <MemberTable ref={memberTableRef} apiUrl={apiUrl} session={session} searchQuery={memberSearch} />
          </div>

          <div className="glass-card panel-card card-3d">
            <h3>Bulk Import</h3>
            <p className="panel-copy">Upload Excel, PDF, or Word files to import members and donations for all chapels (uploads must be done by chapel admin).</p>
            <FileUpload apiUrl={apiUrl} token={session.token} chapels={chapels} onSuccess={() => { window.location.reload(); }} />
          </div>
        </div>
      </div>
    </section>
  );
}
