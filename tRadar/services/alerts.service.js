const db = require('../models/db');

module.exports.createAlert = async (alert) => {
    if (!alert || !alert.riskID) return;

    const cID = alert.cID || null;                  
    const status = alert.alertStatus || 'NEW';      

    await db.query(
        "INSERT INTO Alert (riskID, cID, alertStatus, createdAt) VALUES (?, ?, ?, NOW())",
        [alert.riskID, cID, status]
    );

    console.log("Alert created:", alert);

};
