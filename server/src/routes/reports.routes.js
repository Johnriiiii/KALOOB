import { Router } from 'express';
import { Donation } from '../models/donation.model.js';
import { Member } from '../models/member.model.js';
import { Chapel } from '../models/chapel.model.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import { emitter } from '../events.js';
import { buildAnalyticsPayload } from '../utils/analytics.js';

const router = Router();
router.use(verifyToken);

function getChurchFilter(user, queryChurchId) {
  if (user.role === 'admin') {
    return queryChurchId ? { churchId: queryChurchId } : {};
  }
  return { churchId: user.churchId };
}

async function getDonationsForChapel(churchId) {
  return Donation.find({ churchId }).sort({ date: 1 }).lean();
}

function mapDonationsToReports(donations = []) {
  return donations.map((donation) => ({
    ...donation,
    donation: donation.amount,
    members: 0,
    weekLabel: donation.weekNumber ? `W${donation.weekNumber}` : undefined,
  }));
}

router.get('/donations', async (request, response, next) => {
  try {
    const { churchId, period = 'monthly' } = request.query;
    const filter = getChurchFilter(request.user, churchId);
    const donations = await Donation.find(filter).sort({ date: 1 }).lean();

    const grouped = donations.reduce((acc, donation) => {
      const date = new Date(donation.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const yearKey = `${date.getFullYear()}`;
      acc.monthly[monthKey] = (acc.monthly[monthKey] ?? 0) + donation.amount;
      acc.annual[yearKey] = (acc.annual[yearKey] ?? 0) + donation.amount;
      const weekKey = `W${donation.weekNumber}`;
      acc.weekly[weekKey] = (acc.weekly[weekKey] ?? 0) + donation.amount;
      return acc;
    }, { weekly: {}, monthly: {}, annual: {} });

    response.json({ report: grouped, period });
  } catch (error) {
    next(error);
  }
});

router.get('/members', async (request, response, next) => {
  try {
    const { churchId } = request.query;
    const filter = getChurchFilter(request.user, churchId);
    const members = await Member.find(filter).lean();
    const activeMembers = members.filter((member) => member.status === 'Active').length;
    const inactiveMembers = members.length - activeMembers;
    const joinedThisMonth = members.filter((member) => {
      const now = new Date();
      const dateRegistered = new Date(member.dateRegistered);
      return dateRegistered.getFullYear() === now.getFullYear() && dateRegistered.getMonth() === now.getMonth();
    }).length;

    response.json({ members: { total: members.length, active: activeMembers, inactive: inactiveMembers, newThisMonth: joinedThisMonth } });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (request, response, next) => {
  try {
    const chapels = await Chapel.find().lean();
    const summary = chapels.map((chapel) => {
      const weeklyTotals = chapel.reports.map((report) => report.donation);
      return {
        chapelId: chapel.chapelId,
        name: chapel.name,
        color: chapel.color,
        totalDonations: weeklyTotals.reduce((sum, amount) => sum + amount, 0),
        totalMembers: chapel.reports.reduce((sum, report) => sum + (report.members || 0), 0),
        weekSeries: chapel.reports.map((report) => report.donation),
      };
    });

    response.json({ summary });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics', async (request, response, next) => {
  try {
    console.log('GET /api/reports/analytics called by', request.user?.username ?? request.user?.label ?? request.user?.id, 'query:', request.query);
    const { churchId, range = 'weekly' } = request.query;
    const chapel = await Chapel.findOne(churchId ? { chapelId: churchId } : {}).lean();
    const members = await Member.find(churchId ? { churchId } : {}).lean();

    if (!chapel) {
      return response.status(404).json({ message: 'Chapel not found.' });
    }

    const donations = await getDonationsForChapel(chapel.chapelId);
    const reports = mapDonationsToReports(donations);
    const analytics = buildAnalyticsPayload({ chapel, reports, members, range });
    response.json({ analytics });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/all', async (request, response, next) => {
  try {
    console.log('GET /api/reports/analytics/all called by', request.user?.username ?? request.user?.label ?? request.user?.id, 'query:', request.query);
    const range = String(request.query.range || 'weekly');
    const chapels = await Chapel.find().lean();
    const members = await Member.find().lean();
    const analytics = await Promise.all(chapels.map(async (chapel) => {
      const chapelMembers = members.filter((member) => member.churchId === chapel.chapelId);
      const donations = await getDonationsForChapel(chapel.chapelId);
      const reports = mapDonationsToReports(donations);
      return buildAnalyticsPayload({ chapel, reports, members: chapelMembers, range });
    }));

    response.json({ analytics });
  } catch (error) {
    next(error);
  }
});

// Server-Sent Events stream for real-time updates (donations)
router.get('/stream', async (request, response, next) => {
  try {
    // accept token via query for EventSource (or Authorization header)
    const token = request.query.token || (request.headers.authorization ? String(request.headers.authorization).split(' ')[1] : null);
    const jwtSecret = process.env.JWT_SECRET ?? 'kaloob-secret';

    if (!token) {
      return response.status(401).json({ message: 'Missing token for stream' });
    }

    try {
      request.user = jwt.verify(String(token), jwtSecret);
    } catch (err) {
      return response.status(401).json({ message: 'Invalid or expired token' });
    }

    // Setup SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(': connected\n\n');

    const onDonation = (payload) => {
      try {
        console.log('SSE: sending donation event to stream user', request.user?.username ?? request.user?.label ?? request.user?.id, payload.chapelId || payload.chapelId);
        response.write(`event: donation\n`);
        response.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        // ignore
      }
    };

    emitter.on('donation-created', onDonation);

    // keep connection alive with a ping
    const keepAlive = setInterval(() => response.write(': ping\n\n'), 20000);

    request.on('close', () => {
      clearInterval(keepAlive);
      emitter.off('donation-created', onDonation);
    });
  } catch (error) {
    next(error);
  }
});

export default router;
