import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    weekLabel: { type: String, required: true },
    donation: { type: Number, required: true },
    members: { type: Number, required: true },
    trackingNumber: { type: String, required: true },
    notes: { type: String, default: '' },
    files: [
      {
        name: { type: String, required: true },
        type: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { _id: false }
);

const chapelSchema = new mongoose.Schema(
  {
    chapelId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    totalCollection: { type: Number, default: 0 },
    reports: { type: [reportSchema], default: [] },
  },
  { timestamps: true }
);

export const Chapel = mongoose.model('Chapel', chapelSchema);
