import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import { Chapel, UserSession } from './types';
import { getChapelSummary, getInitialChapels } from './data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [chapels, setChapels] = useState<Chapel[]>(getInitialChapels());
  const navigate = useNavigate();

  useEffect(() => {
    async function loadChapels() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chapels`);
        const payload = await response.json();
        if (Array.isArray(payload.chapels)) {
          setChapels(payload.chapels);
        }
      } catch {
        // Keep fallback seed data.
      }
    }

    loadChapels();
  }, []);

  useEffect(() => {
    if (!session) {
      navigate('/login');
    }
  }, [session, navigate]);

  const chapel = useMemo(() => chapels.find((item) => item.chapelId === session?.churchId) ?? chapels[0], [chapels, session]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">KALOOB</div>
        <nav className="topnav">
          <Link to="/">Home</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/reports">Reports</Link>
          {session ? <button className="logout" onClick={() => setSession(null)}>Logout</button> : <Link to="/login">Login</Link>}
        </nav>
      </header>

      <main className="page-body">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage onLogin={setSession} apiUrl={API_BASE_URL} />} />
          <Route path="/dashboard" element={<DashboardPage session={session} chapel={chapel} chapels={chapels} />} />
          <Route path="/admin" element={<AdminPage session={session} chapels={chapels} />} />
          <Route path="/*" element={<LandingPage />} />
        </Routes>
      </main>
    </div>
  );
}
