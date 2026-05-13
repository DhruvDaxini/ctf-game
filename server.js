require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const FLAG = process.env.FLAG;
if (!FLAG) {
  console.error('FATAL: FLAG environment variable is not set. Add it to .env');
  process.exit(1);
}
const FLAG_BUF = Buffer.from(FLAG);

const MAX_WINNERS = 100;
const NAME_MAX_LEN = 32;

function flagsEqual(submitted) {
  const subBuf = Buffer.from(submitted);
  if (subBuf.length !== FLAG_BUF.length) {
    crypto.timingSafeEqual(FLAG_BUF, FLAG_BUF);
    return false;
  }
  return crypto.timingSafeEqual(subBuf, FLAG_BUF);
}

function validateName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length === 0 || name.length > NAME_MAX_LEN) return null;
  if (/[\x00-\x1f\x7f<>]/.test(name)) return null;
  return name;
}

// --- Middleware ---
// Behind a single reverse proxy in production; harmless if none.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1kb' }));

const flagLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Slow down, hacker! 🐢' },
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(path.join(__dirname, 'public', 'files')));

// --- Routes ---

app.get('/hidden-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hidden-admin.html'));
});

app.get('/api/hint', (req, res) => {
  res.json({
    message: "Looks like something got left running in production.",
    trace: "Check /api/internal/debug — devs never cleaned it up."
  });
});

app.get('/api/internal/debug', (req, res) => {
  res.type('text/plain').send(
`[DEBUG] Internal config dump — DO NOT expose in production
--------------------------------------------------------------
env          : production
node_version : ${process.version}
uptime       : ${Math.floor(process.uptime())}s
admin_panel  : /hidden-admin
status       : active
--------------------------------------------------------------
-- THIS ROUTE SHOULD HAVE BEEN REMOVED BEFORE DEPLOY --`
  );
});

app.post('/api/submit-flag', flagLimiter, (req, res) => {
  const { flag } = req.body;

  if (!flag || typeof flag !== 'string') {
    return res.status(400).json({ success: false, message: 'No flag provided.' });
  }

  if (flagsEqual(flag.trim())) {
    console.log(`[${new Date().toISOString()}] CORRECT FLAG submitted from ${req.ip}`);
    return res.json({
      success: true,
      message: '🎉 Congratulations! You cracked it!',
      flag: FLAG,
      badge: 'BRUTEFORCE_MASTER'
    });
  }

  res.json({ success: false, message: '❌ Wrong flag. Keep trying!' });
});

const winners = [];
app.post('/api/winner', flagLimiter, (req, res) => {
  const { name: rawName, flag } = req.body || {};

  if (typeof flag !== 'string' || !flagsEqual(flag.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid.' });
  }

  const name = validateName(rawName);
  if (!name) {
    return res.status(400).json({ success: false, message: 'Invalid name.' });
  }

  const exists = winners.some(w => w.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    if (winners.length >= MAX_WINNERS) {
      winners.shift();
    }
    winners.push({ name, time: new Date().toISOString() });
  }
  res.json({ success: true, winners });
});

app.get('/api/scoreboard', (req, res) => {
  res.json({ winners });
});

// Catch-all: HTML clients get the landing page, everyone else gets a real 404.
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`\n🚩 CTF Game server running at http://localhost:${PORT}`);
  console.log(`🔍 Hidden admin panel: http://localhost:${PORT}/hidden-admin`);
  console.log(`📦 Files served at:    http://localhost:${PORT}/files/\n`);
});
