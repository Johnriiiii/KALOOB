// test_sse_donation.js
// Logs in as SJ-PARISH and creates a small donation to trigger server SSE

const API = 'http://localhost:4000';
const username = 'SJ-PARISH';
const password = 'Kaloob2026!';

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

    const donation = {
      memberName: 'SSE Test Member',
      date: new Date().toISOString(),
      weekNumber: 1,
      amount: 100,
      notes: 'Automated SSE test donation',
    };

    const res = await fetch(`${API}/api/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(donation),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error('Donation creation failed', body);
      process.exit(1);
    }

    console.log('Donation created:', body.donation ? body.donation._id : body);
    process.exit(0);
  } catch (e) {
    console.error('Error running test:', e);
    process.exit(1);
  }
})();
