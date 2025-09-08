// server/routes/customer.js
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireAuth, requireCustomer } = require('../utils/middleware');

const router = express.Router();

/* ---------------- helpers ---------------- */
async function assertCustomerExists(conn, cID) {
  const [rows] = await conn.execute('SELECT cID FROM Customer WHERE cID = ?', [cID]);
  return rows.length > 0;
}
async function ensureDefaultAccount(conn, cID) {
  const [accs] = await conn.execute(
    'SELECT accountNo, accountType, balance FROM Account WHERE cID = ? ORDER BY accountNo ASC LIMIT 1',
    [cID]
  );
  if (accs.length > 0) return accs[0];
  const [ins] = await conn.execute(
    'INSERT INTO Account (cID, accountType, balance) VALUES (?, ?, ?)',
    [cID, 'savings', 0.00]
  );
  return { accountNo: ins.insertId, accountType: 'savings', balance: 0.00 };
}

/* ---------------- overview ---------------- */
router.get('/overview', requireAuth, requireCustomer, async (req, res) => {
  const uID = req.session.user.uID; const cID = uID;
  const conn = await pool.getConnection();
  try {
    const exists = await assertCustomerExists(conn, cID);
    if (!exists) return res.status(500).json({ message: 'Customer profile not found.' });
    const account = await ensureDefaultAccount(conn, cID);
    res.json({ user: { fName: req.session.user.fName, lName: req.session.user.lName, uID, role: 'customer' }, account });
  } catch (err) {
    console.error('overview error:', err);
    res.status(500).json({ message: 'Server error while loading account' });
  } finally { conn.release(); }
});

/* ---------------- account info ---------------- */
router.get('/account-info', requireAuth, requireCustomer, async (req, res) => {
  const uID = req.session.user.uID; const cID = uID;
  const conn = await pool.getConnection();
  try {
    const exists = await assertCustomerExists(conn, cID);
    if (!exists) return res.status(400).json({ message: 'Customer profile missing' });
    const account = await ensureDefaultAccount(conn, cID);
    const [[row]] = await conn.execute(
      `SELECT u.fName, u.lName, u.uEmail, u.uPhone,
              c.cAddress, c.cNID, c.cAccStatus, c.cRiskScore
         FROM xBank_user u
         JOIN Customer c ON c.cID = u.uID
        WHERE u.uID = ?`, [uID]
    );
    res.json({ account, profile: row });
  } catch (err) {
    console.error('account-info error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
});

/* ---------------- DEPOSIT ---------------- */
router.post('/deposit', requireAuth, requireCustomer, async (req, res) => {
  const uID = req.session.user.uID; const cID = uID;
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Amount must be a positive number' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const exists = await assertCustomerExists(conn, cID);
    if (!exists) { await conn.rollback(); return res.status(400).json({ message: 'Customer profile missing' }); }

    const account = await ensureDefaultAccount(conn, cID);

    const [txnRes] = await conn.execute(
      "INSERT INTO `transaction_tbl` (`accountNo`, `date`, `amount`, `txnType`) VALUES (?, NOW(), ?, 'deposit')",
      [account.accountNo, amount]
    );
    const txnID = txnRes.insertId;

    await conn.execute(`UPDATE Account SET balance = balance + ? WHERE accountNo = ?`, [amount, account.accountNo]);

    const eventData = { type: 'deposit', uID, cID, accountNo: account.accountNo, txnID, amount, trxnTime: new Date().toISOString() };
    await conn.execute(
      `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
       VALUES (?, ?, ?, NOW(), NOW(), ?)`,
      [txnID, cID, uID, JSON.stringify(eventData)]
    );

    await conn.commit();

    const [[accRow]] = await conn.execute(`SELECT balance FROM Account WHERE accountNo = ?`, [account.accountNo]);
    res.json({ message: 'Deposit successful', txnID, balance: accRow.balance });
  } catch (err) {
    await conn.rollback(); console.error('deposit error:', err);
    res.status(500).json({ message: 'Server error during deposit' });
  } finally { conn.release(); }
});

/* ---------------- WITHDRAW ---------------- */
router.post('/withdraw', requireAuth, requireCustomer, async (req, res) => {
  const uID = req.session.user.uID; const cID = uID;
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Amount must be a positive number' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const exists = await assertCustomerExists(conn, cID);
    if (!exists) { await conn.rollback(); return res.status(400).json({ message: 'Customer profile missing' }); }

    const account = await ensureDefaultAccount(conn, cID);
    const [[accRow]] = await conn.execute(`SELECT balance FROM Account WHERE accountNo = ? FOR UPDATE`, [account.accountNo]);
    const currentBalance = Number(accRow?.balance ?? 0);

    if (!accRow || currentBalance < amount) {
      const eventData = {
        type: 'withdraw_failed', reason: 'insufficient_funds', uID, cID,
        accountNo: account.accountNo, requestedAmount: amount, availableBalance: currentBalance, at: new Date().toISOString()
      };
      await conn.execute(
        `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
         VALUES (NULL, ?, ?, NOW(), NULL, ?)`,
        [cID, uID, JSON.stringify(eventData)]
      );
      await conn.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const [txnRes] = await conn.execute(
      "INSERT INTO `transaction_tbl` (`accountNo`, `date`, `amount`, `txnType`) VALUES (?, NOW(), ?, 'withdraw')",
      [account.accountNo, amount]
    );
    const txnID = txnRes.insertId;

    await conn.execute(`UPDATE Account SET balance = balance - ? WHERE accountNo = ?`, [amount, account.accountNo]);

    const eventData = { type: 'withdraw', uID, cID, accountNo: account.accountNo, txnID, amount, trxnTime: new Date().toISOString() };
    await conn.execute(
      `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
       VALUES (?, ?, ?, NOW(), NOW(), ?)`,
      [txnID, cID, uID, JSON.stringify(eventData)]
    );

    await conn.commit();

    const [[accNew]] = await conn.execute(`SELECT balance FROM Account WHERE accountNo = ?`, [account.accountNo]);
    res.json({ message: 'Withdraw successful', txnID, balance: accNew.balance });
  } catch (err) {
    await conn.rollback(); console.error('withdraw error:', err);
    res.status(500).json({ message: 'Server error during withdraw' });
  } finally { conn.release(); }
});

/* ---------------- update password ONLY ---------------- */
router.patch('/password', requireAuth, requireCustomer, async (req, res) => {
  const uID = req.session.user.uID;
  const currentPassword = (req.body.currentPassword || '').toString();
  const newPassword = (req.body.newPassword || '').toString();
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'Provide currentPassword and newPassword (>=8 chars)' });
  }

  const conn = await pool.getConnection();
  try {
    const [[user]] = await conn.execute(`SELECT uHashedPass FROM xBank_user WHERE uID = ?`, [uID]);
    if (!user) return res.status(400).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.uHashedPass);
    if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await conn.execute(`UPDATE xBank_user SET uHashedPass = ?, uPLastUpdate = NOW() WHERE uID = ?`, [hashed, uID]);

    const eventData = { type: 'update_password', uID, cID: uID, updatedFields: ['password'], at: new Date().toISOString() };
    await conn.execute(
      `INSERT INTO Event (txnID, cID, uID, uActionTime, trxnTime, eventData)
       VALUES (NULL, ?, ?, NOW(), NULL, ?)`,
      [uID, uID, JSON.stringify(eventData)]
    );

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('password update error:', err);
    res.status(500).json({ message: 'Server error during password update' });
  } finally { conn.release(); }
});

module.exports = router;
