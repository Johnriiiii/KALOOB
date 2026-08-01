import { useState } from 'react';
import { Chapel } from '../types';

interface FileUploadProps {
  apiUrl: string;
  token: string;
  chapels: Chapel[];
  showChapelSelector?: boolean;
  onSuccess?: () => void;
}

export default function FileUpload({ apiUrl, token, chapels, showChapelSelector = true, onSuccess }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [selectedChapel, setSelectedChapel] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Select a file before uploading.');
      return;
    }

    const fileName = selectedFile.name?.toLowerCase() || '';
    const fileExtension = fileName.split('.').pop() ?? '';
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const validExtensions = ['xlsx', 'xls', 'pdf', 'docx'];

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
      setError('Only .xlsx, .pdf, and .docx files are supported');
      return;
    }

    setError('');
    setSuccess('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', description);
    formData.append('chapelId', selectedChapel);

    try {
      const response = await fetch(`${apiUrl}/api/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setSuccess(`File "${selectedFile.name}" uploaded successfully and processed across all chapels`);
      setSelectedFile(null);
      setDescription('');
      setSelectedChapel('all');
      onSuccess?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <div className={`file-upload-zone ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <div className="upload-icon">📁</div>
        <p className="upload-text">Drag and drop Excel, PDF, or Word files here</p>
        <p className="upload-subtext">or</p>
        <label className="button button-primary upload-select-button">
          Select File
          <input type="file" accept=".xlsx,.pdf,.docx" onChange={handleFileSelect} style={{ display: 'none' }} disabled={isUploading} />
        </label>
      </div>

      <div className="upload-details-row">
        <label className="upload-field">
          <span>File Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter file description"
          />
        </label>
        {showChapelSelector && (
          <label className="upload-field">
            <span>Church</span>
            <select value={selectedChapel} onChange={(e) => setSelectedChapel(e.target.value)}>
              <option value="all">All Churches</option>
              {chapels.map((chapel) => (
                <option key={chapel.chapelId} value={chapel.chapelId}>
                  {chapel.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button className="button button-primary upload-action-button" onClick={handleUpload} disabled={isUploading}>
        {isUploading ? 'Uploading...' : 'Upload File'}
      </button>

      {isUploading && <p className="upload-status">Processing file...</p>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="file-types-info">
        <p><strong>Supported formats:</strong></p>
        <ul>
          <li>📊 Excel (.xlsx) - for batch member/donation imports</li>
          <li>📄 PDF (.pdf) - for scanned records</li>
          <li>📝 Word (.docx) - for formatted documents</li>
        </ul>
      </div>
    </div>
  );
}
