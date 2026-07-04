import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    fileType: { type: String, required: true },
    churchId: { type: String, required: true, index: true },
    uploadedBy: { type: String, default: 'system' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const FileMeta = mongoose.model('FileMeta', fileSchema);
