import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    userId: { type: String },
    userLabel: { type: String },
    chapelId: { type: String },
    details: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const AuditLog = mongoose.model('AuditLog', auditSchema);
