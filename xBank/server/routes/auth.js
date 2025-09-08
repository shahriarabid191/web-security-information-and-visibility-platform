const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { isNonEmptyString, isEmail, isPassword, isPhone } = require('../utils/validators');
const WebSocket = require('ws');

const router = express.Router();

/* ---------------- WebSocket server ---------------- */
const WS_PORT = 10000;
if (!global.xBankWSServer) {
  const wss = new WebSocket.Server({ port: WS_PORT });
  global.xBankWSServer = wss;

  wss.on('connection', (socket) => {
    console.log('⚡ WebSocket client connected to xBank');
    socket.on('close', () => console.log('WebSocket client disconnected'));
    socket.on('error', (err) => console.error('WebSocket error:', err));
  });

  console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
}

/* ---------------- helpers ---------------- */
function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = xff || req.ip || req.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '').slice(0, 255);
}

/* In-memory failed login counters per customer */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes window
const FAILURE_THRESHOLD = 5;                // after 5 invalid tries -> create one Event
const failedLoginCounters = new Map();      // key: cID, value: { count, firstAt }

/* Reset counter on success or after threshold */
function resetCounter(cID) { failedLoginCounters.delete(cID); }

/* Increment and return updated count (auto-resets if window expired) */
function bumpCounter(cID) {
  const now = Date.now();
  const rec = failedLoginCounters.get(cID);
  if (!rec || (now - rec.firstAt) > FAILURE_WINDOW_MS) {
    failedLoginCounters.set(cID, { count: 1, firstAt: now });
    return 1;
  }
  rec.count += 1;
  return rec.count;
}

/* ---------------- Broadcast over WebSocket ---------------- */
function broadcastEvent(eventData) {
  if (global.xBankWSServer && global.xBankWSServer.clients) {
    const message = JSON.stringify(eventData);
    global.xBankWSServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  }
}

/** ---------------- CUSTOMER SIGNUP ---------------- */
router.post('/signup', async (req, res) => {
  const { fName, lName, email, phone, password, nid, address } = req.body;

  if (!isNonEmptyString(fName) ||
      !isNonEmptyString(lName) ||
      !isEmail(email) ||
      !isPhone(phone) ||
      !isPassword(password) ||
      !isNonEmptyString(nid) ||
      !isNonEmptyString(address)) {
    return res.status(400).json({ message: 'Invalid or missing fields' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingEmail] = await conn.execute('SELECT uID FROM xBank_user WHERE uEmail = ?', [email.trim()]);
    if (existingEmail.length > 0) { await conn.rollback(); return res.status(409).json({ message: 'Email already registered' }); }

    const [existingNid] = await conn.execute('SELECT cID FROM Customer WHERE cNID = ?', [nid.trim()]);
    if (existingNid.length > 0) { await conn.rollback(); return res.status(409).json({ message: 'NID already registered' }); }

    const hashed = await bcrypt.hash(password, 10);
    const now = new Date();

    const [userResult] = await conn.execute(
      `INSERT INTO xBank_user
        (fName, lName, uRole, uEmail, uPhone, uHashedPass, uPLastUpdate, uCreationTime)
       VALUES (?, ?, 'customer', ?, ?, ?, ?, ?)`,
      [fName.trim(), lName.trim(), email.trim(), phone.trim(), hashed, now, now]
    );
    const uID = userResult.insertId;

    await conn.execute(
      `INSERT INTO Customer (cID, cNID, cAddress, cAccStatus, cRiskScore)
       VALUES (?, ?, ?, 'unlocked', 0)`,
      [uID, nid.trim(), address.trim()]
    );

    await conn.commit();
    return res.json({ message: 'Signup successful. Redirecting to login...' });
  } catch (err) {
    await conn.rollback();
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error during signup' });
  } finally {
    conn.release();
  }
});

/** ---------------- LOGIN ---------------- */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!isEmail(email) || !isPassword(password)) {
    return res.status(400).json({ message: 'Invalid email or password format' });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT uID, fName, lName, uRole, uHashedPass FROM xBank_user WHERE uEmail = ?`,
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.uHashedPass);

    if (!ok) {
      if (user.uRole === 'customer') {
        const cID = user.uID;
        const count = bumpCounter(cID);

        const device = String(req.headers['user-agent'] || 'unknown').slice(0, 255);
        const loc = getClientIp(req) || 'unknown';
        const eventData = {
          type: 'Multiple Failed Login Attempts',
          uID: cID,
          cID,
          emailUsed: email.trim(),
          attempts: count,
          windowMinutes: Math.round(FAILURE_WINDOW_MS / 60000),
          device,
          location: loc,
          at: new Date().toISOString()
        };

        if (count >= FAILURE_THRESHOLD) {
          await conn.execute(
            `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
             VALUES (NULL, ?, ?, NOW(), NULL, ?)`,
            [cID, cID, JSON.stringify(eventData)]
          );
          broadcastEvent(eventData); // <-- only broadcast after threshold
          resetCounter(cID);
        }
      }

      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const allowed = ['customer', 'IT_expert'];
    if (!allowed.includes(user.uRole)) {
      return res.status(403).json({ message: 'User role not permitted to log in' });
    }

    if (user.uRole === 'customer') {
      const [[cust]] = await conn.execute(`SELECT cAccStatus FROM Customer WHERE cID = ?`, [user.uID]);
      if (!cust) return res.status(401).json({ message: 'Customer record missing' });

      if (String(cust.cAccStatus).toLowerCase() === 'locked') {
        const device = String(req.headers['user-agent'] || 'unknown').slice(0, 255);
        const loc = getClientIp(req) || 'unknown';
        const eventData = {
          type: 'login_denied_locked',
          uID: user.uID,
          cID: user.uID,
          device,
          location: loc,
          at: new Date().toISOString()
        };
        await conn.execute(
          `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
           VALUES (NULL, ?, ?, NOW(), NULL, ?)`,
          [user.uID, user.uID, JSON.stringify(eventData)]
        );

        broadcastEvent(eventData); // <--- WS broadcast

        return res.status(403).json({ message: 'Account is locked. Contact support.' });
      }
    }

    req.session.user = { uID: user.uID, role: user.uRole, fName: user.fName, lName: user.lName };

    if (user.uRole === 'customer') resetCounter(user.uID);

    if (user.uRole === 'customer') {
      const device = String(req.headers['user-agent'] || 'unknown').slice(0, 255);
      const loc = getClientIp(req) || 'unknown';

      const eventData = {
        type: 'login',
        uID: user.uID,
        cID: user.uID,
        device,
        location: loc,
        userRole: 'customer',
        at: new Date().toISOString()
      };
      await conn.execute(
        `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
         VALUES (NULL, ?, ?, NOW(), NULL, ?)`,
        [user.uID, user.uID, JSON.stringify(eventData)]
      );

      broadcastEvent(eventData); // <--- WS broadcast

      // record device/location
      try { await conn.execute(`INSERT INTO cDevLoggedIn (cID, cDevice) VALUES (?, ?)`, [user.uID, device]); } catch (e) { if (e?.code !== 'ER_DUP_ENTRY') throw e; }
      try { await conn.execute(`INSERT INTO cLocation (cID, cLoc) VALUES (?, ?)`, [user.uID, loc]); } catch (e) { if (e?.code !== 'ER_DUP_ENTRY') throw e; }
    }

    return res.json({ message: 'Login successful', role: user.uRole });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  } finally {
    conn.release();
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

module.exports = router;
