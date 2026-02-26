require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const { connect: connectDB } = require('./services/db');
const gmail = require('./services/gmail');
// Disabled for demo — no real email sending
// const emailPoller = require('./cron/email-poller');
// const billingCycle = require('./cron/billing-cycle');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Caddy)
const PORT = process.env.APP_PORT || 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-eval removed — prod React build doesn't need it
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'self'"],
      connectSrc: ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Stricter limit on uploads
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Upload limit exceeded. Try again in 5 minutes.' }
});
app.use('/api/timesheets/upload', uploadLimiter);

// Middleware
app.use(cors({
  origin: [
    'https://staffing-agency-demo.fltechadventures.com',
    'https://fltechadventures.com',
    /^http:\/\/localhost(:\d+)?$/  // dev only
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB (demo)
  abortOnLimit: true,
  useTempFiles: false
}));

// Sanitize inputs against NoSQL injection
app.use(require('./middleware/sanitize'));

// API Routes
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/bug-reports', require('./routes/bug-reports'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gmail: gmail.getStatus()
  });
});

// Serve static frontend build
const DIST_DIR = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      status: 'running',
      message: 'Frontend not built. Run: npm run build',
      api: '/api/health'
    });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[Express]', err.message);
  res.status(500).json({ error: err.message });
});

async function main() {
  try {
    console.log('[Boot] Connecting to MongoDB...');
    await connectDB();

    console.log('[Boot] Initializing Gmail service...');
    await gmail.init();

    // Cron jobs disabled for demo
    // emailPoller.start();
    // billingCycle.start();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Boot] Server running on http://0.0.0.0:${PORT}`);
      console.log(`[Boot] Gmail mode: ${gmail.getStatus().mode}`);
    });
  } catch (err) {
    console.error('[Boot] Fatal error:', err.message);
    process.exit(1);
  }
}

main();
