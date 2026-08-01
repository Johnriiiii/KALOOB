import crypto from 'crypto';
import { Router } from 'express';
import { Donation } from '../models/donation.model.js';
import { Chapel } from '../models/chapel.model.js';
import { AuditLog } from '../models/audit.model.js';

const router = Router();
const XENDIT_API_BASE = 'https://api.xendit.co/v2';

function getWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveChurchId(churchName) {
  if (!churchName || typeof churchName !== 'string') {
    return null;
  }

  const trimmedName = churchName.trim();
  if (!trimmedName) {
    return null;
  }

  const exactMatch = await Chapel.findOne({ name: trimmedName });
  if (exactMatch) {
    return exactMatch.chapelId;
  }

  const caseInsensitiveMatch = await Chapel.findOne({ name: new RegExp(`^${escapeRegExp(trimmedName)}$`, 'i') });
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch.chapelId;
  }

  const partialMatch = await Chapel.findOne({ name: new RegExp(escapeRegExp(trimmedName), 'i') });
  if (partialMatch) {
    return partialMatch.chapelId;
  }

  const idMatch = await Chapel.findOne({ chapelId: new RegExp(`^${escapeRegExp(trimmedName)}$`, 'i') });
  if (idMatch) {
    return idMatch.chapelId;
  }

  return trimmedName;
}

function getXenditAuthHeader(secretKey) {
  if (!secretKey) {
    throw new Error('XENDIT_SECRET_KEY is not configured.');
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

async function getInvoiceByExternalId(externalId) {
  const secretKey = process.env.XENDIT_SECRET_KEY;
  const authHeader = getXenditAuthHeader(secretKey);
  const url = `${XENDIT_API_BASE}/invoices?external_id=${encodeURIComponent(externalId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authHeader },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch invoice from Xendit.');
  }

  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  if (Array.isArray(data.data)) {
    return data.data[0] ?? null;
  }
  return data;
}

async function createDonationFromInvoice(invoice) {
  const metadata = invoice.metadata ?? {};
  const churchIdentifier = metadata.chapelId || metadata.churchName || invoice.description || 'KALOOB';
  const anonymous = Boolean(metadata.donateAnonymously);
  const donorName = anonymous ? 'Anonymous' : (metadata.donorName || metadata.donorEmail || 'Anonymous');
  const donorEmail = metadata.donorEmail;
  const donorPhone = metadata.donorPhone;
  const externalId = invoice.external_id || invoice.reference_id || invoice.id;
  const trackingNumber = `XENDIT-${externalId}`;
  const churchId = await resolveChurchId(churchIdentifier);
  const paidAt = invoice.paid_at ? new Date(invoice.paid_at) : new Date();
  const weekNumber = getWeekNumber(paidAt);

  const existingDonation = await Donation.findOne({ trackingNumber });
  if (existingDonation) {
    return { donation: existingDonation, alreadyCreated: true };
  }

  const donation = await Donation.create({
    trackingNumber,
    memberName: donorName,
    churchId,
    date: paidAt,
    weekNumber,
    amount: Number(invoice.amount ?? invoice.amount_paid ?? 0),
    donorEmail: donorEmail ?? '',
    donorPhone: donorPhone ?? '',
    purpose: metadata.purpose ?? '',
    notes: anonymous ? 'Anonymous donation' : `Paid via Xendit invoice ${invoice.id}`,
    createdBy: 'xendit-webhook',
  });

  return { donation, alreadyCreated: false };
}

function verifyXenditSignature(request, secret) {
  const signature = request.header('x-xendit-signature');
  if (!signature) {
    throw new Error('Xendit signature header is missing.');
  }

  const payload = request.rawBody ? request.rawBody.toString('utf8') : JSON.stringify(request.body);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error('Invalid Xendit webhook signature.');
  }
}

router.post('/checkout', async (request, response, next) => {
  try {
    const {
      amount,
      paymentMethod,
      donorName,
      donorEmail,
      donorPhone,
      donateAnonymously,
      churchName,
      purpose,
    } = request.body ?? {};

    const secretKey = process.env.XENDIT_SECRET_KEY;
    if (!secretKey) {
      return response.status(500).json({ message: 'XENDIT_SECRET_KEY is not configured.' });
    }

    if (!amount || !paymentMethod) {
      return response.status(400).json({ message: 'amount and paymentMethod are required.' });
    }

    const referenceID = `kaloob-donation-${Date.now()}`;

    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173';
    const successRedirectURL = process.env.XENDIT_SUCCESS_URL || `http://127.0.0.1:4000/payment-success?ref=${encodeURIComponent(referenceID)}`;
    const failureRedirectURL = process.env.XENDIT_FAILURE_URL || `http://127.0.0.1:4000/payment-failure?ref=${encodeURIComponent(referenceID)}`;

    console.log('Xendit redirect URLs:', {
      successRedirectURL,
      failureRedirectURL,
      successRedirectURL,
      failureRedirectURL,
      host: request.get('host'),
      protocol: request.protocol,
    });

    const normalizedDonorName = (donateAnonymously || !donorName?.trim()) ? 'Anonymous' : donorName?.trim();
    const payload = {
      external_id: referenceID,
      amount,
      payer_email: donorEmail || `donor+${Date.now()}@kaloob.local`,
      description: `Donation to ${churchName ?? 'KALOOB'}`,
      success_redirect_url: successRedirectURL,
      failure_redirect_url: failureRedirectURL,
      metadata: {
        churchName,
        purpose,
        donorName: normalizedDonorName,
        donorEmail,
        donorPhone,
        donateAnonymously: Boolean(donateAnonymously),
        paymentMethod,
      },
    };

    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const xenditResponse = await fetch(`${XENDIT_API_BASE}/invoices`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await xenditResponse.json();
    if (!xenditResponse.ok) {
      const unauthorized = xenditResponse.status === 401 || xenditResponse.status === 403;
      const forbiddenKeyMessage = unauthorized
        ? 'Xendit secret key is invalid or does not have permissions for invoice creation.'
        : 'Xendit checkout creation failed.';

      return response.status(502).json({
        message: responseBody.message || forbiddenKeyMessage,
        details: responseBody,
        xenditStatus: xenditResponse.status,
      });
    }

    const checkoutUrl = responseBody.invoice_url || responseBody.redirect_url;
    if (!checkoutUrl) {
      return response.status(502).json({ message: 'Xendit did not return a checkout URL.', details: responseBody });
    }

    response.json({ checkoutUrl, invoice: responseBody, referenceId: referenceID });
  } catch (error) {
    next(error);
  }
});

router.get('/confirm/:externalId', async (request, response, next) => {
  try {
    const { externalId } = request.params;
    if (!externalId) {
      return response.status(400).json({ message: 'externalId is required.' });
    }

    const invoice = await getInvoiceByExternalId(externalId);
    if (!invoice) {
      return response.status(404).json({ message: 'Invoice not found.' });
    }

    const status = String(invoice.status || invoice.state || '').toUpperCase();
    if (status !== 'PAID') {
      return response.status(200).json({ ok: true, status, message: 'Invoice is not paid yet.' });
    }

    const result = await createDonationFromInvoice(invoice);
    const message = result.alreadyCreated
      ? 'Donation was already recorded.'
      : 'Payment confirmed and donation recorded successfully.';

    response.json({ ok: true, status, message, donation: result.donation });
  } catch (error) {
    next(error);
  }
});

router.post('/webhook', async (request, response, next) => {
  try {
    const webhookSecret = process.env.XENDIT_WEBHOOK_SECRET;
    if (webhookSecret) {
      verifyXenditSignature(request, webhookSecret);
    } else {
      console.warn('XENDIT_WEBHOOK_SECRET is not configured. Webhook signature verification is disabled.');
    }

    const payload = request.body ?? {};
    const invoice = payload.data?.invoice ?? payload.data ?? payload;
    const status = invoice?.status || invoice?.state;
    const amount = Number(invoice?.amount ?? invoice?.amount_paid ?? 0);

    if (!invoice || !invoice.id) {
      return response.status(400).json({ message: 'Invalid webhook payload: missing invoice data.' });
    }

    if (String(status).toUpperCase() !== 'PAID') {
      return response.status(200).json({ ok: true, message: 'Webhook received, payment not completed yet.' });
    }

    const metadata = invoice.metadata ?? {};
    const churchIdentifier = metadata.chapelId || metadata.churchName || invoice.description || 'KALOOB';
    const donorName = metadata.donateAnonymously ? 'Anonymous' : (metadata.donorName || metadata.donorEmail || 'Anonymous');
    const donorEmail = metadata.donorEmail;
    const donorPhone = metadata.donorPhone;
    const anonymous = Boolean(metadata.donateAnonymously);
    const externalId = invoice.external_id || invoice.reference_id || invoice.id;
    const trackingNumber = `XENDIT-${externalId}`;
    const churchId = await resolveChurchId(churchIdentifier);
    const paidAt = invoice.paid_at ? new Date(invoice.paid_at) : new Date();
    const weekNumber = getWeekNumber(paidAt);

    const existingDonation = await Donation.findOne({ trackingNumber });
    if (existingDonation) {
      return response.status(200).json({ ok: true, message: 'Donation already recorded.' });
    }

    const donation = await Donation.create({
      trackingNumber,
      memberName: donorName,
      churchId,
      date: paidAt,
      weekNumber,
      amount,
      donorEmail: donorEmail ?? '',
      donorPhone: donorPhone ?? '',
      purpose: metadata.purpose ?? '',
      notes: `Paid via Xendit invoice ${invoice.id}`,
      createdBy: 'xendit-webhook',
    });

    await AuditLog.create({
      action: 'create',
      entity: 'donation',
      entityId: donation._id.toString(),
      userLabel: 'xendit-webhook',
      churchId,
      details: `Recorded donation from Xendit invoice ${invoice.id}`,
    });

    response.status(201).json({ ok: true, donation });
  } catch (error) {
    next(error);
  }
});

export default router;
