import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, required: true, unique: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    memberName: { type: String, required: true },
    churchId: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    weekNumber: { type: Number, required: true },
    amount: { type: Number, required: true },
    donorEmail: { type: String, default: '' },
    donorPhone: { type: String, default: '' },
    purpose: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

export const Donation = mongoose.model('Donation', donationSchema);
