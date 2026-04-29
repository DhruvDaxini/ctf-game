require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const FLAG = process.env.FLAG || 'FLAG{bruteforce_master_2026}';

// --- Simple in-memory rate limiter ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // max flag submissions per minute per IP

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - record.start > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.start = now;
  } else {
    record.count++;
  }

  rateLimitMap.set(ip, record);

  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, message: 'Too many attempts. Slow down, hacker! 🐢' });
  }

  next();
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve challenge files (zip, wordlist, etc.)
app.use('/files', express.static(path.join(__dirname, 'public', 'files')));

// --- Routes ---

// Hidden admin panel — players must discover this URL
app.get('/hidden-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hidden-admin.html'));
});

// Hint endpoint
app.get('/api/hint', (req, res) => {
  res.json({
    hint: "Not everything is on the surface. Try exploring the server — some paths aren't linked.",
    tip: "Developers sometimes leave panels they forgot to hide. Check the source code of this page."
  });
});

// Flag submission with rate limiting
app.post('/api/submit-flag', rateLimit, (req, res) => {
  const { flag } = req.body;

  if (!flag || typeof flag !== 'string') {
    return res.status(400).json({ success: false, message: 'No flag provided.' });
  }

  if (flag.trim() === FLAG) {
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

// Scoreboard (fun extra — stores winners in memory)
const winners = [];
app.post('/api/winner', rateLimit, (req, res) => {
  const { name, flag } = req.body;
  if (flag && flag.trim() === FLAG && name) {
    if (!winners.find(w => w.name === name)) {
      winners.push({ name, time: new Date().toISOString() });
    }
    return res.json({ success: true, winners });
  }
  res.status(400).json({ success: false, message: 'Invalid.' });
});

app.get('/api/scoreboard', (req, res) => {
  res.json({ winners });
});

// Catch-all: serve index.html for unknown routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚩 CTF Game server running at http://localhost:${PORT}`);
  console.log(`🔍 Hidden admin panel: http://localhost:${PORT}/hidden-admin`);
  console.log(`📦 Files served at:    http://localhost:${PORT}/files/\n`);
});
