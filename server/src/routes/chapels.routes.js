import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Chapel } from '../models/chapel.model.js';
import { Member } from '../models/member.model.js';
import { Donation } from '../models/donation.model.js';

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
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

    const summary = await Promise.all(chapels.map(async (chapel) => {
      const memberCount = await Member.countDocuments({ churchId: chapel.chapelId });
      const donations = await Donation.find({ churchId: chapel.chapelId, date: { $gte: oneYearAgo } }).sort({ date: 1 }).lean();
      const annualDonations = donations.reduce((sum, donation) => sum + (donation.amount ?? 0), 0);
      const monthlyTotals = donations.reduce((totals, donation) => {
        const date = new Date(donation.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        totals[key] = (totals[key] || 0) + (donation.amount ?? 0);
        return totals;
      }, {});
      const currentMonthDonations = monthlyTotals[currentMonthKey] || 0;
      const previousMonthDonations = monthlyTotals[previousMonthKey] || 0;
      const growthPercentage = previousMonthDonations === 0
        ? currentMonthDonations > 0
          ? 100
          : 0
        : Math.round(((currentMonthDonations - previousMonthDonations) / previousMonthDonations) * 100);
      const latestDonation = donations.at(-1)?.amount ?? chapel.reports.at(-1)?.donation ?? 0;
      const latestMembers = chapel.reports.at(-1)?.members ?? 0;
      const series = Object.keys(monthlyTotals)
        .sort()
        .map((key) => ({ period: key, donations: monthlyTotals[key] }));

      return {
        chapelId: chapel.chapelId,
        name: chapel.name,
        color: chapel.color,
        latestDonation,
        latestMembers,
        memberCount,
        annualDonations,
        currentMonthDonations,
        previousMonthDonations,
        growthPercentage,
        series,
      };
    }));

    const totalMembers = summary.reduce((sum, chapel) => sum + (chapel.memberCount ?? 0), 0);
    const totalAnnualDonations = summary.reduce((sum, chapel) => sum + (chapel.annualDonations ?? 0), 0);
    const totalCurrentMonth = summary.reduce((sum, chapel) => sum + (chapel.currentMonthDonations ?? 0), 0);
    const totalPreviousMonth = summary.reduce((sum, chapel) => sum + (chapel.previousMonthDonations ?? 0), 0);
    const overallGrowthPercentage = totalPreviousMonth === 0
      ? totalCurrentMonth > 0
        ? 100
        : 0
      : Math.round(((totalCurrentMonth - totalPreviousMonth) / totalPreviousMonth) * 100);

    response.json({
      summary,
      totals: {
        totalMembers,
        totalAnnualDonations,
        growthPercentage: overallGrowthPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
