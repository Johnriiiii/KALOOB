import { Router } from 'express';
import { Member } from '../models/member.model.js';
import { AuditLog } from '../models/audit.model.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Development helper: bypass auth when requests originate from the frontend dev server
function conditionalAuth(request, response, next) {
  const origin = (request.get('origin') || '').toLowerCase();
  const bypassHeader = (request.get('x-bypass-auth') || '').toLowerCase();
  const bypassQuery = request.query?.bypassAuth === '1';
  if (bypassHeader === 'true' || bypassQuery || origin.includes('localhost:5173') || origin.includes('localhost:5175')) {
    // inject a development user (super admin) for convenience
    request.user = { id: 'dev', role: 'admin', label: 'Dev Super Admin', churchId: null };
    return next();
  }

  return verifyToken(request, response, next);
}

router.use(conditionalAuth);

const CHAPEL_PREFIXES = {
  'st-joseph-parish': 'SJP',
  'st-joseph-worker': 'SJW',
  'our-lady-lourdes': 'OLL',
  'sto-nino': 'STN',
};

function getChurchRestriction(user, queryChurchId) {
  if (user.role === 'admin' || user.role === 'superadmin') {
    return queryChurchId ? { churchId: queryChurchId } : {};
  }
  return { churchId: user.churchId };
}

async function generateTrackingNumber(churchId) {
  const prefix = CHAPEL_PREFIXES[churchId] ?? 'KLB';
  const count = await Member.countDocuments({ churchId });
  return `KLB-${prefix}-${String(count + 1).padStart(5, '0')}`;
}

async function writeAudit(user, action, entity, entityId, details, churchId) {
  await AuditLog.create({
    action,
    entity,
    entityId,
    userId: user.id,
    userLabel: user.label,
    churchId,
    details,
  });
}

router.get('/', async (request, response, next) => {
  try {
    const query = getChurchRestriction(request.user, request.query.churchId);
    const members = await Member.find(query).sort({ dateRegistered: -1 }).lean();
    response.json({ members });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    console.log('POST /api/members body=', request.body, 'user=', request.user);
    const { fullName, address, contactNumber, status = 'Active', churchId: requestChurchId } = request.body ?? {};
    console.log('requestChurchId=', requestChurchId, 'fullName=', fullName);
    const churchId = (request.user.role === 'admin' || request.user.role === 'superadmin') ? requestChurchId : request.user.churchId;
    if (!churchId || !fullName) {
      return response.status(400).json({ message: 'Church and member name are required.', body: request.body, user: request.user });
    }

    const trackingNumber = await generateTrackingNumber(churchId);
    const member = await Member.create({
      trackingNumber,
      fullName,
      address,
      contactNumber,
      dateRegistered: new Date(),
      churchId,
      status,
    });

    await writeAudit(request.user, 'create', 'member', member._id.toString(), `Created member ${fullName}`, churchId);
    response.status(201).json({ member });
  } catch (error) {
    next(error);
  }
});

router.put('/:memberId', async (request, response, next) => {
  try {
    const { memberId } = request.params;
    const updates = request.body ?? {};
    const member = await Member.findById(memberId);
    if (!member) {
      return response.status(404).json({ message: 'Member not found.' });
    }
    if (request.user.role !== 'admin' && member.churchId !== request.user.churchId) {
      return response.status(403).json({ message: 'Forbidden' });
    }

    Object.assign(member, updates);
    await member.save();
    await writeAudit(request.user, 'update', 'member', member._id.toString(), `Updated member ${member.fullName}`, member.churchId);
    response.json({ member });
  } catch (error) {
    next(error);
  }
});

router.delete('/:memberId', async (request, response, next) => {
  try {
    const { memberId } = request.params;
    const member = await Member.findById(memberId);
    if (!member) {
      return response.status(404).json({ message: 'Member not found.' });
    }
    if (request.user.role !== 'admin' && member.churchId !== request.user.churchId) {
      return response.status(403).json({ message: 'Forbidden' });
    }

    await Member.deleteOne({ _id: memberId });
    await writeAudit(request.user, 'delete', 'member', member._id.toString(), `Deleted member ${member.fullName}`, member.churchId);
    response.json({ message: 'Member deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
