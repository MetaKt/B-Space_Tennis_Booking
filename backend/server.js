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
// Development: allow localhost. Production: only the deployed frontend origin.
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// _id alias — adds _id = id to all response objects for frontend compatibility
app.use(aliasId);

// Ensure upload directories exist
['uploads/avatars', 'uploads/payments', 'uploads/coaches'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
