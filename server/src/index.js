import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import chapelRoutes from './routes/chapels.routes.js';
import authRoutes from './routes/auth.routes.js';
import memberRoutes from './routes/members.routes.js';
import donationRoutes from './routes/donations.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import fileRoutes from './routes/files.routes.js';
import reportRoutes from './routes/reports.routes.js';
import { Member } from './models/member.model.js';
import { AuditLog } from './models/audit.model.js';
import { verifyToken } from './middlewares/auth.middleware.js';
import { seedChapels } from './services/seed.js';
import { seedUsers } from './services/seedUsers.js';
import { seedMembers } from './services/seedMembers.js';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI;
const mongoUsername = process.env.MONGODB_USERNAME;
const mongoPassword = process.env.MONGODB_PASSWORD;
const mongoDbName = process.env.MONGODB_DB ?? 'kaloob';

const connectionString = mongoUri
  ? mongoUri
  : mongoUsername && mongoPassword
  ? `mongodb://${encodeURIComponent(mongoUsername)}:${encodeURIComponent(mongoPassword)}@127.0.0.1:27017/${mongoDbName}`
  : null;

const rawBodySaver = (request, _response, buffer, encoding) => {
  if (buffer && buffer.length) {
    request.rawBody = buffer;
  }
};

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '2mb', verify: rawBodySaver }));
app.use('/uploads', express.static('uploads'));

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173';
app.get('/', (_request, response) => {
  response.redirect(frontendOrigin);
});

// Public members endpoint is provided by the members router; remove temporary test route

// ============================================================================
// PUBLIC ENDPOINTS (NO AUTH)
// ============================================================================

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'kaloob-server' });
});

app.post('/upload', upload.array('files', 10), (request, response) => {
  const files = (request.files ?? []).map((file) => ({
    name: file.originalname,
    path: file.path,
    type: file.mimetype,
    size: file.size,
  }));
  response.status(201).json({ files });
});

// ============================================================================
// API ROUTES (MOUNTED ROUTERS)
// ============================================================================

app.use('/api/auth', authRoutes);
app.use('/api/chapels', chapelRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/reports', reportRoutes);

app.get('/payment-success', async (request, response) => {
  const referenceId = String(request.query.ref || '');
  const confirmationPath = `/api/payments/confirm/${encodeURIComponent(referenceId)}`;
  const confirmationUrl = `${request.protocol}://${request.get('host')}${confirmationPath}`;
  const frontendUrl = frontendOrigin;

  try {
    const confirmResponse = await fetch(confirmationUrl);
    const confirmResult = await confirmResponse.json();
    const statusTitle = confirmResult.ok ? 'Donation Recorded' : 'Confirmation Pending';
    const statusMessage = confirmResult.message || 'Donation status could not be verified.';

    response.send(`<!doctype html><html><head><title>Payment Success</title></head><body style="font-family:system-ui,sans-serif;color:#111;background:#f7fff7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><main style="text-align:center;max-width:520px;padding:24px;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.08);"><h1>${statusTitle}</h1><p>${statusMessage}</p><a href="${frontendUrl}" style="display:inline-block;margin-top:22px;padding:12px 22px;background:#2f855a;color:#fff;text-decoration:none;border-radius:8px;">Return to KALOOB</a></main></body></html>`);
  } catch (error) {
    console.error('Payment success confirmation failed:', error);
    response.send(`<!doctype html><html><head><title>Payment Success</title></head><body style="font-family:system-ui,sans-serif;color:#111;background:#fff7f7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><main style="text-align:center;max-width:520px;padding:24px;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.08);"><h1>Confirmation Failed</h1><p>We could not verify your payment record at this time.</p><pre style="white-space:pre-wrap;word-break:break-word;margin-top:16px;color:#a21caf;">${String(error)}</pre><a href="${frontendUrl}" style="display:inline-block;margin-top:22px;padding:12px 22px;background:#2f855a;color:#fff;text-decoration:none;border-radius:8px;">Return to KALOOB</a></main></body></html>`);
  }
});

app.get('/payment-failure', (_request, response) => {
  response.send(`<!doctype html><html><head><title>Payment Failed</title></head><body style="font-family:system-ui,sans-serif;color:#111;background:#fff7f7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><main style="text-align:center;max-width:480px;padding:24px;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.08);"><h1>Payment Failed</h1><p>We could not complete the payment. Please try again or use a different payment method.</p><a href="${frontendOrigin}" style="display:inline-block;margin-top:22px;padding:12px 22px;background:#c53030;color:#fff;text-decoration:none;border-radius:8px;">Return to KALOOB</a></main></body></html>`);
});

// Debug routes removed

// ============================================================================
// ERROR HANDLER (MUST BE LAST)
// ============================================================================

app.use((error, _request, response, _next) => {
  console.error('Unhandled error:', error);
  response.status(500).json({ message: error instanceof Error ? error.message : 'Unexpected server error' });
});

// Fallback 404 handler for unmatched routes
app.use((request, response) => {
  response.status(404).json({ message: 'Not Found' });
});
// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  if (!connectionString) {
    console.error('MongoDB connection failed: MONGODB_URI is not set in the environment.');
    process.exit(1);
  }

  console.log('Using MongoDB connection string:', connectionString.startsWith('mongodb://127.0.0.1') ? 'local fallback' : connectionString.replace(/^(mongodb\+srv:\/\/[^:]+):.*@/, '$1:*****@'));
  
  try {
    await mongoose.connect(connectionString);
    console.log('✓ MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }

  try {
    await seedChapels();
    await seedUsers();
    await seedMembers();
    console.log('✓ Database seeded');
  } catch (err) {
    console.error('Seed failed:', err);
  }

  app.listen(port, () => {
    console.log(`✓ Kaloob server listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start Kaloob server', error);
  process.exit(1);
});
