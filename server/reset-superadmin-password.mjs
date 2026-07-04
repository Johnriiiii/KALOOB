import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI is not configured');
}

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

const newHash = await bcrypt.hash('KaloobAdmin2026!', 10);
await mongoose.connect(uri);
const result = await User.updateOne(
  { username: 'superadmin' },
  { $set: { passwordHash: newHash, role: 'superadmin', label: 'Super Admin', active: true } }
);
console.log('update result', result);
await mongoose.disconnect();
