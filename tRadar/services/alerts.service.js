const db = require('../server/db/pool'); 
const { broadcastToAnalysts } = require('../services/wsNotiServer.service'); 

async function createAlert(alert) {
    if (!alert || !alert.riskID) return;

    const cID = alert.cID || null;
    const status = alert.alertStatus || 'NEW';

    try {
        // inserting alert into DB
        await db.execute(
            `INSERT INTO Alert (riskID, cID, alertStatus, createdAt)
             VALUES (?, ?, ?, NOW())`,
            [alert.riskID, cID, status]
        );

        console.log('[ALERT] Alert created:', alert);

        // broadcasting to all connected analyst dashboards
        broadcastToAnalysts(alert);

    } catch (err) {
        console.error('[ALERT] Failed to create alert:', err);
    }
}

module.exports = { createAlert };
