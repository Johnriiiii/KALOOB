import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Chapel } from '../models/chapel.model.js';
import { Member } from '../models/member.model.js';

const router = Router();
const jwtSecret = process.env.JWT_SECRET ?? 'kaloob-secret';
const adminUsername = process.env.SUPERADMIN_USERNAME ?? 'SUPERADMIN';
const adminPassword = process.env.SUPERADMIN_PASSWORD ?? 'KaloobAdmin2026!';

function createToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '6h' });
}

function authenticateToken(request, response, next) {
  const authHeader = request.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return response.status(401).json({ message: 'Missing authorization token.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    request.user = decoded;
    next();
  } catch (error) {
    return response.status(401).json({ message: 'Invalid or expired token.' });
  }
}

router.get('/', async (_request, response, next) => {
  try {
    const chapels = await Chapel.find().lean();
    response.json({ chapels });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (request, response, next) => {
  try {
    const { role, username, password } = request.body ?? {};

    if (role === 'admin') {
      if (username === adminUsername && password === adminPassword) {
        const token = createToken({ role: 'admin', label: 'Super Admin' });
        return response.json({ token, user: { role: 'admin', label: 'Super Admin' } });
      }

      return response.status(401).json({ message: 'Invalid super admin credentials.' });
    }

    const chapel = await Chapel.findOne({ username, password }).lean();
    if (!chapel) {
      return response.status(401).json({ message: 'Invalid chapel credentials.' });
    }

    const token = createToken({ role: 'chapel', chapelId: chapel.chapelId, label: chapel.name });
    response.json({ token, chapel });
  } catch (error) {
    next(error);
  }
});

router.post('/:chapelId/reports', authenticateToken, async (request, response, next) => {
  try {
    const { chapelId } = request.params;
    const { weekLabel, donation, members, trackingNumber, notes, files = [] } = request.body ?? {};

    const user = request.user;
    if (!user || (user.role !== 'admin' && user.chapelId !== chapelId)) {
      return response.status(403).json({ message: 'Not authorized to update this chapel.' });
    }

    const chapel = await Chapel.findOne({ chapelId });
    if (!chapel) {
      return response.status(404).json({ message: 'Chapel not found.' });
    }

    chapel.reports.push({ weekLabel, donation, members, trackingNumber, notes, files });
    await chapel.save();

    response.status(201).json({ chapel });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/summary', async (_request, response, next) => {
  try {
    const chapels = await Chapel.find().lean();

    const summary = await Promise.all(chapels.map(async (chapel) => {
      const memberCount = await Member.countDocuments({ churchId: chapel.chapelId });
      const reportedTotal = Array.isArray(chapel.reports)
        ? chapel.reports.reduce((sum, report) => sum + (report.donation ?? 0), 0)
        : 0;
      const totalCollection = reportedTotal > 0
        ? reportedTotal
        : (typeof chapel.totalCollection === 'number' ? chapel.totalCollection : 0);
      const latestDonation = chapel.reports.at(-1)?.donation ?? 0;
      const latestMembers = chapel.reports.at(-1)?.members ?? 0;
      return {
        chapelId: chapel.chapelId,
        name: chapel.name,
        color: chapel.color,
        latestDonation,
        latestMembers,
        memberCount,
        totalCollection,
        series: Array.isArray(chapel.reports) ? chapel.reports.map((report) => report.donation) : [],
      };
    }));

    response.json({ summary });
  } catch (error) {
    next(error);
  }
});

export default router;
