// server/routes/it.js
const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireIT } = require('../utils/middleware');

const router = express.Router();

/* -------------------- EVENTS (read-only) -------------------- */
router.get('/events', requireAuth, requireIT, async (req, res) => {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
  const type = (req.query.type || '').trim();

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT eventID, txnID, cID, uID, uActionTime, trxnTime, eventData
         FROM Event
         ORDER BY eventID DESC
         LIMIT ? OFFSET ?`, [limit, offset]
    );

    // Optional in-memory filter by JSON.type
    let data = rows;
    if (type) {
      data = rows.filter(r => {
        try { return String(JSON.parse(r.eventData || '{}').type || '').toLowerCase() === type.toLowerCase(); }
        catch { return false; }
      });
    }
    res.json({ events: data });
  } catch (err) {
    console.error('IT events error:', err);
    res.status(500).json({ message: 'Server error loading events' });
  } finally { conn.release(); }
});

/* -------- Find customer by cID  -------- */
router.get('/customer-by-id', requireAuth, requireIT, async (req, res) => {
  const cID = parseInt(req.query.cID, 10);
  if (!Number.isInteger(cID)) return res.status(400).json({ message: 'Valid cID is required' });

  const conn = await pool.getConnection();
  try {
    const [[row]] = await conn.execute(
      'SELECT cID, cAccStatus, cRiskScore FROM Customer WHERE cID = ?',
      [cID]
    );
    if (!row) return res.status(404).json({ message: 'Customer not found' });
    // Return ONLY cid/status/risk (no sensitive info)
    res.json({ customer: row });
  } catch (err) {
    console.error('IT customer lookup error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
});

/* -------------------- LOCK  -------------------- */
router.post('/lock', requireAuth, requireIT, async (req, res) => {
  const cID = Number(req.body?.cID);
  if (!Number.isInteger(cID)) return res.status(400).json({ message: 'cID is required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.execute('SELECT cAccStatus FROM Customer WHERE cID = ?', [cID]);
    if (!row) { await conn.rollback(); return res.status(404).json({ message: 'Customer not found' }); }
    if (String(row.cAccStatus).toLowerCase() === 'locked') {
      await conn.commit(); return res.json({ message: 'Customer already locked', cID });
    }
    await conn.execute('UPDATE Customer SET cAccStatus = "locked" WHERE cID = ?', [cID]);
    await conn.commit();
    res.json({ message: 'Customer account locked', cID });
  } catch (err) {
    await conn.rollback(); console.error('IT lock error:', err);
    res.status(500).json({ message: 'Server error locking account' });
  } finally { conn.release(); }
});

/* ------------------- UNLOCK ------------------- */
router.post('/unlock', requireAuth, requireIT, async (req, res) => {
  const cID = Number(req.body?.cID);
  if (!Number.isInteger(cID)) return res.status(400).json({ message: 'cID is required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.execute('SELECT cAccStatus FROM Customer WHERE cID = ?', [cID]);
    if (!row) { await conn.rollback(); return res.status(404).json({ message: 'Customer not found' }); }
    if (String(row.cAccStatus).toLowerCase() === 'unlocked') {
      await conn.commit(); return res.json({ message: 'Customer already unlocked', cID });
    }
    await conn.execute('UPDATE Customer SET cAccStatus = "unlocked" WHERE cID = ?', [cID]);
    await conn.commit();
    res.json({ message: 'Customer account unlocked', cID });
  } catch (err) {
    await conn.rollback(); console.error('IT unlock error:', err);
    res.status(500).json({ message: 'Server error unlocking account' });
  } finally { conn.release(); }
});

module.exports = router;
