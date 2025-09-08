const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('../db/pool');

const router = express.Router();
const __dirnameResolved = path.resolve();

// GET /dashboard.html (protected)
router.get('/dashboard.html', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'Analyst') {
    return res.redirect('/login.html');
  }
  return res.sendFile(path.join(__dirnameResolved, 'public', 'dashboard.html'));
});

// POST /login  (Analyst only, positional placeholders)
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const conn = await pool.getConnection();
  try {
    const sql = `
      SELECT u.uID, u.uRole, u.uEmail, u.uHashedPass
      FROM tRadar_user u
      JOIN Analyst a ON a.aID = u.uID
      WHERE u.uEmail = ? AND u.uRole = 'Analyst'
      LIMIT 1
    `;
    const [rows] = await conn.execute(sql, [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.uHashedPass || '');
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // xBank-style session payload
    req.session.user = { uID: user.uID, role: 'Analyst', uEmail: user.uEmail };

    return res.json({ message: 'Login successful', role: 'Analyst' });
  } catch (err) {
    console.error('LOGIN_ERROR:', err);
    return res.status(500).json({ message: 'Server error during login' });
  } finally {
    conn.release();
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

module.exports = router;
