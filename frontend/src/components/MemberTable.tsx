import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { UserSession } from '../types';

type Member = {
  _id: string;
  trackingNumber: string;
  fullName: string;
  address?: string;
  contactNumber?: string;
  dateRegistered?: string;
  status?: string;
};

const MemberTable = forwardRef<{ refresh: () => void }, { apiUrl: string; session?: UserSession; searchQuery?: string }>(({ apiUrl, session, searchQuery = '' }, ref) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMembers, setShowMembers] = useState(false);

  useImperativeHandle(ref, () => ({
    refresh: fetchMembers,
  }));

  useEffect(() => {
    fetchMembers();
  }, [session]);

  const fetchMembers = async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // For chapel admins, filter by their chapel. For super admins, fetch all
      const url = session.role === 'superadmin' ? `${apiUrl}/api/members` : `${apiUrl}/api/members?churchId=${session.churchId ?? ''}`;
      const headers: Record<string,string> = { Authorization: `Bearer ${session?.token ?? ''}` };
      const res = await fetch(url, { headers });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let message = `Failed to load members (${res.status})`;
        if (contentType.includes('application/json')) {
          const payload = await res.json();
          if (payload?.message) message = payload.message;
          else if (typeof payload === 'string') message = payload;
        } else {
          message = await res.text();
        }
        throw new Error(message || `Failed to load members (${res.status})`);
      }

      if (contentType.includes('application/json')) {
        const data = await res.json();
        setMembers(Array.isArray(data.members) ? data.members : Array.isArray(data) ? data : []);
      } else {
        throw new Error('Unexpected non-JSON response from members endpoint');
      }
    } catch (err) {
      const msg = (err as Error).message || 'Failed to load members';
      setError(msg.length > 300 ? msg.slice(0, 300) + '...' : msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;

    return members.filter((member) => {
      const haystack = [
        member.fullName,
        member.trackingNumber,
        member.contactNumber,
        member.address,
        member.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [members, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!session) return;
    if (!confirm('Delete member?')) return;
    try {
      const res = await fetch(`${apiUrl}/api/members/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } });
      if (!res.ok) throw new Error('Delete failed');
      setMembers((m) => m.filter((x) => x._id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) return <div className="card glass-card panel-card">Loading members...</div>;
  
  return (
    <>
      {error && <div className="card glass-card panel-card error-message">{error}</div>}
      {!error && (
        <div className="card glass-card panel-card">
          <div className="members-header">
            <h3>Members</h3>
            <span className="status-chip">{members.length}</span>
          </div>
          {!showMembers ? (
            <div className="member-summary">
              <p className="member-summary-copy">Manage member records for your chapel from one place. Tap below to view the full list.</p>
              <button type="button" className="button primary full-width" onClick={() => setShowMembers(true)}>
                View all {members.length} members →
              </button>
            </div>
          ) : (
            <div className="members-list">
              {filteredMembers.length === 0 ? (
                <p className="empty-message">No members match your search.</p>
              ) : (
                filteredMembers.map((m) => (
                  <div key={m._id} className="member-item">
                    <div className="member-item-info">
                      <span className="member-id">{m.trackingNumber}</span>
                      <div className="member-row-name">{m.fullName}</div>
                      <div className="member-item-meta">
                        {m.contactNumber && <span>Phone: {m.contactNumber}</span>}
                        {m.address && <span>Address: {m.address}</span>}
                        {m.status && <span className={`status-badge ${m.status === 'Active' ? 'status-active' : 'status-inactive'}`}>{m.status}</span>}
                        {m.dateRegistered && <span>{new Date(m.dateRegistered).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="member-item-actions">
                      <button className="button secondary" onClick={() => navigator.clipboard.writeText(m.trackingNumber)} style={{ whiteSpace: 'nowrap' }}>Copy ID</button>
                      <button className="button danger" type="button" onClick={() => handleDelete(m._id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
});

MemberTable.displayName = 'MemberTable';
export default MemberTable;
