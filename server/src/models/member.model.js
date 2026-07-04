import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    address: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    dateRegistered: { type: Date, default: Date.now },
    churchId: { type: String, required: true, index: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

export const Member = mongoose.model('Member', memberSchema);
