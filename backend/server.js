// server.js — migrated from Mongoose/MongoDB to Prisma/PostgreSQL
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const { init: initSocket } = require('./lib/socket');
const aliasId = require('./middleware/aliasId');
const { isCloudStorage, getSignedUrl } = require('./lib/storage');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookingRoutes = require('./routes/bookings');
const courtRoutes = require('./routes/courts');
const coachRoutes = require('./routes/coaches');
const adminRoutes = require('./routes/admin');
const settingRoutes = require('./routes/settings');

const app = express();

// Connect to PostgreSQL via Prisma
connectDB();

// ─── Security: HTTP headers ───────────────────────────────────────────────────
app.use(helmet());

// ─── Security: CORS ───────────────────────────────────────────────────────────
// Development: allow localhost + any private-LAN origin (so a phone on the same
// Wi-Fi can reach the dev server regardless of the PC's current DHCP-assigned IP).
// Production: only the deployed frontend origin.
const allowedOrigins = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:3001', 'http://127.0.0.1:3001',
];
// RFC 1918 private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x — any port.
const isPrivateLanOrigin = (origin) =>
  /^https?:\/\/(10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})(:\d+)?$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === 'production') {
      if (origin === process.env.FRONTEND_URL) return callback(null, true);
    } else if (allowedOrigins.includes(origin) || isPrivateLanOrigin(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Security: Global rate limit ─────────────────────────────────────────────
// 200 requests per 15 minutes per IP — blocks bots and scrapers
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,   // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Note: express-mongo-sanitize removed (MongoDB-specific, not needed with PostgreSQL + Prisma)

// Static files (uploads)
// Mark as cross-origin so the frontend dev server (different port/origin) can load
// images (payment slips). Helmet's default
// Cross-Origin-Resource-Policy is "same-origin", which otherwise blocks <img> loads.
//
// Local disk mode (default, no Supabase env vars set): serve straight from disk.
// Cloud mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): the file isn't on
// this server at all — redirect to a freshly generated Supabase signed URL.
// Either way the DB-stored path is the same `/uploads/<folder>/<filename>`
// shape, so nothing else in the app needs to know which mode is active.
if (isCloudStorage) {
  app.get('/uploads/:folder/:filename', async (req, res) => {
    try {
      const url = await getSignedUrl(req.params.folder, req.params.filename);
      // Same reasoning as the local-disk branch below: without this, Helmet's
      // default same-origin CORP header blocks the <img> load from a
      // different-origin frontend (and the redirect response itself is
      // subject to the CORP check, not just the final Supabase response).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.redirect(url);
    } catch (error) {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  });
} else {
  app.use(
    '/uploads',
    (req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.join(__dirname, 'uploads'))
  );

  // Ensure upload directories exist (local disk mode only)
  ['uploads/payments'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// _id alias — adds _id = id to all response objects for frontend compatibility
app.use(aliasId);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'postgresql', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Prisma unique constraint violation (replaces MongoDB code 11000)
  if (err.code === 'P2002') {
    return res.status(400).json({ success: false, message: 'Duplicate value — record already exists' });
  }

  // Prisma record not found (replaces Mongoose CastError on bad ObjectId)
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  // Multer errors
  if (err.name === 'MulterError' || err.message?.includes('Only images')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(500).json({ success: false, message: 'Server Error' });
});

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: PostgreSQL (Prisma)`);
  console.log(`Socket.IO: enabled`);
});
