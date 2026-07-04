import { useState } from 'react';
import { UserSession } from '../types';

export default function MemberForm({ apiUrl, session, chapelId, onSaved }: { apiUrl: string; session?: UserSession; chapelId?: string; onSaved?: () => void }) {
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return setError('Session required');
    if (!fullName.trim()) return setError('Full name is required');
    
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const body: any = { fullName: fullName.trim(), address: address.trim(), contactNumber: contactNumber.trim(), status };
      if (chapelId) body.churchId = chapelId;

      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (session?.token) headers.Authorization = `Bearer ${session.token}`;

      const res = await fetch(`${apiUrl}/api/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let message = `Failed to create member (${res.status})`;
        if (contentType.includes('application/json')) {
          const payload = await res.json();
          message = payload?.message || message;
        } else {
          const text = await res.text();
          message = text || message;
        }
        throw new Error(message);
      }

      if (contentType.includes('application/json')) {
        await res.json();
      }
      setSuccess('Member added successfully!');
      setFullName('');
      setAddress('');
      setContactNumber('');
      setStatus('Active');
      setTimeout(() => setSuccess(''), 3000);
      onSaved?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card glass-card panel-card" onSubmit={handleSubmit}>
      <h3>Add Member</h3>
      <div className="form-grid">
        <div className="form-field">
          <label>Full Name *</label>
          <input 
            type="text"
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            placeholder="Enter full name"
            required
            className="glass-input"
          />
        </div>
        <div className="form-field">
          <label>Address</label>
          <input 
            type="text"
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            placeholder="Enter address"
            className="glass-input"
          />
        </div>
        <div className="form-field">
          <label>Contact Number</label>
          <input 
            type="tel"
            value={contactNumber} 
            onChange={(e) => setContactNumber(e.target.value)} 
            placeholder="Enter contact number"
            className="glass-input"
          />
        </div>
        <div className="form-field">
          <label>Status</label>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="glass-select"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <button type="submit" className="button primary" disabled={loading || !fullName.trim()} style={{ width: '100%', marginTop: 12 }}>
        {loading ? 'Saving...' : 'Save Member'}
      </button>
      {error && <div className="error-message" style={{ marginTop: 12 }}>{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </form>
  );
}
