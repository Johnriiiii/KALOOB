// delete_donation.js
// Logs in as SJ-PARISH and deletes the specified donation

const API = 'http://localhost:4000';
const username = 'SJ-PARISH';
const password = 'Kaloob2026!';
const donationId = process.argv[2] || '6a5e7111360eb85bee3d9fca';

(async () => {
  try {
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed', loginJson);
      process.exit(1);
    }
    const token = loginJson.token;
    console.log('Logged in, token length:', token?.length ?? 0);

    const res = await fetch(`${API}/api/donations/${donationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) {
      console.error('Delete failed', body);
      process.exit(1);
    }

    console.log('Delete response:', body);
    process.exit(0);
  } catch (e) {
    console.error('Error running delete:', e);
    process.exit(1);
  }
})();
