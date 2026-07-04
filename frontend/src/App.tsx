import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import MembersPage from './pages/MembersPage';
import DonationsPage from './pages/DonationsPage';
import ReportsPage from './pages/ReportsPage';
import FilesPage from './pages/FilesPage';
import Sidebar from './components/Sidebar';
import { Chapel, UserSession } from './types';
import { getInitialChapels } from './data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [chapels, setChapels] = useState<Chapel[]>(getInitialChapels());
  const navigate = useNavigate();
  const location = useLocation();

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
    if (!session && location.pathname !== '/' && location.pathname !== '/landing' && location.pathname !== '/login' && !isRestoringSession) {
      navigate('/landing');
    }
  }, [session, location.pathname, navigate, isRestoringSession]);

  useEffect(() => {
    // restore session from localStorage if present
    try {
      const raw = window.localStorage.getItem('kaloob_session');
      if (raw) {
        const s = JSON.parse(raw) as UserSession;
        setSession(s);
      }
    } catch {
      // ignore
    } finally {
      setIsRestoringSession(false);
    }
  }, []);

  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    try {
      window.localStorage.setItem('kaloob_session', JSON.stringify(userSession));
      window.localStorage.setItem('kaloob_token', userSession.token);
    } catch {
      // ignore
    }
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setSession(null);
    try {
      window.localStorage.removeItem('kaloob_session');
      window.localStorage.removeItem('kaloob_token');
    } catch {}
  };

  const chapel = useMemo(() => chapels.find((item) => item.chapelId === session?.churchId) ?? chapels[0], [chapels, session]);
  const isAuthenticated = !!session;
  const showSidebar = isAuthenticated && location.pathname !== '/login' && location.pathname !== '/';

  return (
    <div className="app-shell">
      {showSidebar && <Sidebar session={session} onLogout={handleLogout} />}

      <div className={`main-content ${showSidebar ? 'with-sidebar' : ''}`}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/dashboard" element={isAuthenticated ? <DashboardPage session={session} chapel={chapel} chapels={chapels} /> : <LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/members" element={isAuthenticated ? <MembersPage session={session} chapel={chapel} chapels={chapels} /> : <LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/donations" element={isAuthenticated ? <DonationsPage session={session} chapel={chapel} chapels={chapels} /> : <LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/reports" element={isAuthenticated ? <ReportsPage session={session} chapel={chapel} /> : <LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/files" element={isAuthenticated ? <FilesPage session={session} apiUrl={API_BASE_URL} chapels={chapels} /> : <LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/admin" element={isAuthenticated && (session?.role === 'admin' || session?.role === 'superadmin') ? <AdminPage session={session} chapels={chapels} /> : <LoginPage onLogin={handleLogin} apiUrl={API_BASE_URL} />} />
          <Route path="/*" element={<LandingPage />} />
        </Routes>
      </div>
    </div>
  );
}
