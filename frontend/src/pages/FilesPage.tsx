import { useEffect, useMemo, useState } from 'react';
import FileUpload from '../components/FileUpload';
import { Chapel, UserSession } from '../types';

interface FileRecord {
  _id: string;
  originalName: string;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  chapelId?: string;
  chapelName?: string;
}

interface FilesPageProps {
  session?: UserSession;
  apiUrl: string;
  chapels: Chapel[];
}

export default function FilesPage({ session, apiUrl, chapels }: FilesPageProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChapel, setSelectedChapel] = useState('all');

  const isSuperAdmin = session?.role === 'superadmin';

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchFiles();
  }, [session, apiUrl, isSuperAdmin]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/files`, {
        headers: { Authorization: `Bearer ${session?.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (selectedChapel === 'all') return files;
    return files.filter((file) => file.chapelId === selectedChapel);
  }, [files, selectedChapel]);

  const stats = useMemo(() => {
    const totalFiles = filteredFiles.length;
    const totalBytes = filteredFiles.reduce((sum, file) => sum + file.size, 0);
    const fileTypes = new Set(filteredFiles.map((file) => file.originalName.split('.').pop()?.toUpperCase() || ''));
    return {
      totalFiles,
      storageUsed: totalBytes,
      fileTypes: fileTypes.size,
      churches: chapels.length,
    };
  }, [filteredFiles, chapels.length]);

  if (!isSuperAdmin) {
    return (
      <div className="page-container">
        <div className="glass-panel restricted-panel">
          <span className="eyebrow">Access Restricted</span>
          <h1>Super Admin Only</h1>
          <p>File uploads and processing are reserved for Super Admin accounts. Please contact your administrator if you need access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">File Management</span>
        <h1>Centralized file storage across all churches</h1>
        <p>Manage uploads, track file usage, and keep records moving through every chapel.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Files</span>
          <strong>{stats.totalFiles}</strong>
          <span className="stat-meta">+12 this week</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Storage Used</span>
          <strong>{(stats.storageUsed / 1024 / 1024).toFixed(1)} GB</strong>
          <span className="stat-meta">of 10 GB</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">File Types</span>
          <strong>{stats.fileTypes}</strong>
          <span className="stat-meta">PDF · Excel · Word</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Churches</span>
          <strong>{stats.churches}</strong>
          <span className="stat-meta">All active</span>
        </div>
      </div>

      <div className="glass-panel filter-panel">
        <div className="filter-heading">Filter by Church:</div>
        <div className="filter-pills">
          <button type="button" className={`filter-pill ${selectedChapel === 'all' ? 'active' : ''}`} onClick={() => setSelectedChapel('all')}>
            All Churches
          </button>
          {chapels.map((chapel) => (
            <button
              key={chapel.chapelId}
              type="button"
              className={`filter-pill ${selectedChapel === chapel.chapelId ? 'active' : ''}`}
              onClick={() => setSelectedChapel(chapel.chapelId)}
            >
              {chapel.name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel file-management-panel">
        <FileUpload apiUrl={apiUrl} token={session?.token || ''} chapels={chapels} onSuccess={fetchFiles} />
      </div>

      <div className="glass-panel recent-uploads-panel">
        <div className="recent-uploads-header">
          <div>
            <h2>All Files</h2>
            <span className="recent-uploads-meta">{filteredFiles.length} files</span>
          </div>
          <div className="recent-actions">
            <button className="pill-button">Sort</button>
            <button className="pill-button">Grid</button>
            <button className="pill-button">List</button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading...</p>
        ) : filteredFiles.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No files uploaded yet.</p>
        ) : (
          <div className="files-table">
            {filteredFiles.map((file) => (
              <div key={file._id} className="table-row file-row">
                <div>
                  <div className="file-name">{file.originalName}</div>
                  <div className="file-subtext">{file.chapelName || file.uploadedBy}</div>
                </div>
                <div>{(file.size / 1024).toFixed(2)} KB</div>
                <div>{new Date(file.uploadedAt).toLocaleDateString()}</div>
                <div className="file-actions">
                  <button className="icon-button">⬇️</button>
                  <button className="icon-button">👁️</button>
                  <button className="icon-button">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
