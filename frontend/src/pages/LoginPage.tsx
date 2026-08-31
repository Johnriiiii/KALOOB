import { useEffect, useState } from 'react';
import { UserSession } from '../types';

export default function LoginPage({ onLogin, apiUrl }: { onLogin: (session: UserSession) => void; apiUrl: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const togglePassword = () => setShowPassword((prev) => !prev);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
      setCurrentDate(now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }));
    };

    updateClock();
    const timer = window.setInterval(updateClock, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const trimmedApiUrl = apiUrl?.trim() || '';
      const response = await fetch(`${trimmedApiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await response.text();
      let payload: { token?: string; user?: any; message?: string } = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { message: responseText || response.statusText };
      }

      if (!response.ok) {
        throw new Error(payload.message || `Login failed (${response.status})`);
      }

      if (!payload.token || !payload.user) {
        throw new Error('Invalid login response from server.');
      }

      onLogin({ token: payload.token, role: payload.user.role, label: payload.user.label, churchId: payload.user.churchId });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="login-page login-page-light">
      <div className="login-status-bar">
        <div className="status-pill status-weather">
          <span className="status-chip">☀️</span>
          <div>
            <strong>27°C</strong>
            <span>Mostly cloudy</span>
          </div>
        </div>

        <button type="button" className="status-pill status-search" aria-label="Search">
          <span>🔍</span>
        </button>

        <div className="status-pill status-clock">
          <strong>{currentTime}</strong>
          <span>{currentDate}</span>
        </div>
      </div>

      <div className="login-panel login-panel-light">
        <div className="login-panel-accent">
          <span className="accent-bar" />
        </div>
        <div className="login-panel-header">
          <div className="brand-avatar">
            <img src="/logo.png" alt="KALOOB logo" />
          </div>
          <div>
            <h1>Secure Sign In</h1>
            <p className="login-hint">Login to KALOOB</p>
            <p className="login-subhint">Enter your credentials to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form login-form-light">
          <label>
            <span>USERNAME</span>
            <div className="input-wrap">
              <span className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z" stroke="#4E6643" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 20c0-3.31 2.69-6 6-6h4c3.31 0 6 2.69 6 6" stroke="#4E6643" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
          </label>

          <label>
            <span>PASSWORD</span>
            <div className="input-wrap input-wrap-password">
              <span className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="10" width="12" height="8" rx="2" stroke="#4E6643" strokeWidth="1.8"/>
                  <path d="M9 10V8a3 3 0 0 1 6 0v2" stroke="#4E6643" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button type="button" className="password-toggle" onClick={togglePassword}>
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.94 17.94L6.06 6.06" stroke="#4E6643" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M9.5 9.5a3 3 0 0 1 4.24 4.24" stroke="#4E6643" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M12 6.5c4.97 0 8.38 3.13 9.5 5.5-1.12 2.37-4.53 5.5-9.5 5.5-4.97 0-8.38-3.13-9.5-5.5C3.62 9.63 7.03 6.5 12 6.5Z" stroke="#4E6643" strokeWidth="1.8"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 6.5c4.97 0 8.38 3.13 9.5 5.5-1.12 2.37-4.53 5.5-9.5 5.5-4.97 0-8.38-3.13-9.5-5.5C3.62 9.63 7.03 6.5 12 6.5Z" stroke="#4E6643" strokeWidth="1.8"/>
                    <circle cx="12" cy="12" r="2.5" stroke="#4E6643" strokeWidth="1.8"/>
                  </svg>
                )}
              </button>
            </div>
          </label>

          <div className="login-form-footer">
            <a href="#" className="forgot-link">
              Forgot Password?
            </a>
          </div>

          <button type="submit" className="button primary login-submit">
            <span className="button-icon">↪</span>
            Sign In
          </button>

          {error && <div className="error-message">{error}</div>}

          <div className="login-footer-notice">
            <p>
              Don't have an account? <a href="#">Contact your administrator</a>
            </p>
            <p className="login-footer-meta">KALOOB v3.0 - secure JWT authentication</p>
          </div>
        </form>
      </div>

      <div className="login-security-note">Protected by enterprise-grade security</div>
    </section>
  );
}
