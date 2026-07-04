import { Router } from 'express';
import { Donation } from '../models/donation.model.js';
import { Member } from '../models/member.model.js';
import { AuditLog } from '../models/audit.model.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { emitter } from '../events.js';

const router = Router();
router.use(verifyToken);

function getChurchFilter(user, queryChurchId) {
  if (user.role === 'admin') {
    return queryChurchId ? { churchId: queryChurchId } : {};
  }
  return { churchId: user.churchId };
}

async function writeAudit(user, action, entity, entityId, details, churchId) {
  await AuditLog.create({ action, entity, entityId, userId: user.id, userLabel: user.label, churchId, details });
}

router.get('/', async (request, response, next) => {
  try {
    const { churchId, memberName, weekNumber, fromDate, toDate } = request.query;
    const filter = getChurchFilter(request.user, churchId);

    if (memberName) {
      filter.memberName = { $regex: String(memberName), $options: 'i' };
    }
    if (weekNumber) {
      filter.weekNumber = Number(weekNumber);
    }
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) {
        filter.date.$gte = new Date(String(fromDate));
      }
      if (toDate) {
        filter.date.$lte = new Date(String(toDate));
      }
    }

    const donations = await Donation.find(filter).sort({ date: -1 }).lean();
    response.json({ donations });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    console.log('POST /api/donations payload:', request.body);
    const { memberId, memberName, date, weekNumber, amount, notes, trackingNumber, churchId: requestChurchId } = request.body ?? {};
    const churchId = request.user.role === 'admin' ? requestChurchId : request.user.churchId;

    if (!churchId || !memberName || !date || !weekNumber || !amount) {
      return response.status(400).json({ message: 'churchId, memberName, date, weekNumber, and amount are required.' });
    }

    const normalizedTracking = trackingNumber || `KLB-DON-${Date.now()}`;
    const donation = await Donation.create({
      trackingNumber: normalizedTracking,
      memberId,
      memberName,
      churchId,
      date: new Date(date),
      weekNumber,
      amount,
      notes: notes ?? '',
      createdBy: request.user.label,
    });

    await writeAudit(request.user, 'create', 'donation', donation._id.toString(), `Created donation record for ${memberName}`, churchId);
    // emit donation-created for realtime listeners
    try {
      emitter.emit('donation-created', {
        chapelId: churchId,
        donation: {
          _id: donation._id,
          memberId: donation.memberId,
          memberName: donation.memberName,
          amount: donation.amount,
          date: donation.date,
          weekNumber: donation.weekNumber,
          trackingNumber: donation.trackingNumber,
        },
      });
      console.log('Emitted donation-created for', churchId, donation._id.toString());
    } catch (e) {
      // non-fatal
      console.error('Failed to emit donation-created event', e);
    }
    response.status(201).json({ donation });
  } catch (error) {
    console.error('Donation POST error:', error);
    next(error);
  }
});

router.put('/:donationId', async (request, response, next) => {
  try {
    const { donationId } = request.params;
    const updates = request.body ?? {};
    const donation = await Donation.findById(donationId);
    if (!donation) {
      return response.status(404).json({ message: 'Donation not found.' });
    }
    if (request.user.role !== 'admin' && donation.churchId !== request.user.churchId) {
      return response.status(403).json({ message: 'Forbidden' });
    }

    Object.assign(donation, updates);
    await donation.save();
    await writeAudit(request.user, 'update', 'donation', donation._id.toString(), `Updated donation ${donation.trackingNumber}`, donation.churchId);
    response.json({ donation });
  } catch (error) {
    next(error);
  }
});

router.delete('/:donationId', async (request, response, next) => {
  try {
    const { donationId } = request.params;
    const donation = await Donation.findById(donationId);
    if (!donation) {
      return response.status(404).json({ message: 'Donation not found.' });
    }
    if (request.user.role !== 'admin' && donation.churchId !== request.user.churchId) {
      return response.status(403).json({ message: 'Forbidden' });
    }

    await Donation.deleteOne({ _id: donationId });
    await writeAudit(request.user, 'delete', 'donation', donation._id.toString(), `Deleted donation ${donation.trackingNumber}`, donation.churchId);
    response.json({ message: 'Donation deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
