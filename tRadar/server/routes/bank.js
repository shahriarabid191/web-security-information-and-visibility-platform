const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const router = express.Router();

// POST /api/bank/signup
router.post('/bank/signup', async (req, res) => {
  const bName = String(req.body.bName || '').trim();
  const bLocation = String(req.body.bLocation || '').trim() || null;
  const bEstablishedDate = String(req.body.bEstablishedDate || '').trim() || null;
  const email = String(req.body.email || '').trim();
  const phone = String(req.body.phone || '').trim() || null;
  const password = String(req.body.password || '');

  if (!bName || !email || !password) {
    return res.status(400).json({ message: 'bName, email, and password are required' });
  }

  const hash = await bcrypt.hash(password, 10);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [uRes] = await conn.execute(
      `INSERT INTO tRadar_user (uRole, uEmail, uPhone, uHashedPass)
       VALUES ('Bank', ?, ?, ?)`,
      [email, phone, hash]
    );
    const newUID = uRes.insertId;

    await conn.execute(
      `INSERT INTO Bank (bankID, bName, bLocation, bEstablishedDate)
       VALUES (?, ?, ?, ?)`,
      [newUID, bName, bLocation, bEstablishedDate]
    );

    await conn.commit();
    return res.status(201).json({ message: 'Bank account created' });
  } catch (err) {
    await conn.rollback();
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email or phone already in use' });
    }
    console.error('BANK_SIGNUP_ERROR:', err);
    return res.status(500).json({ message: 'Server error during bank signup' });
  } finally {
    conn.release();
  }
});

module.exports = router;
