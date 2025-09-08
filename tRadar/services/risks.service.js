const db = require('../server/db/pool');

// get all risks
module.exports.getAllRisks = async () => {
    const [rows] = await db.query("SELECT * FROM Risk");
    return rows;
}

// get a risk by ID
module.exports.getRiskByID = async (id) => {
    const [[row]] = await db.query("SELECT * FROM Risk WHERE riskID = ?", [id]);
    return row;
}

// getfiltered risks
module.exports.getFilteredRisks = async (min, max) => {
    const [rows] = await db.query("SELECT * FROM Risk WHERE riskSeverity BETWEEN ? AND ?", [min, max]);
    return rows;
}

// delete a risk
module.exports.deleteRisk = async (id) => {
    const [response] = await db.query("DELETE FROM Risk WHERE riskID = ?", [id]);
    return response.affectedRows;
}

// add or update a risk
module.exports.addOrEditRisk = async (obj, id = 0) => {
    const [data] = await db.query("CALL usp_risk_add_or_edit(?, ?, ?, ?)", 
        [id, obj.riskName, obj.riskDes, obj.riskSeverity]);
    return data[0][0].affectedRows;
}

// matching event type with risk name
module.exports.checkRiskMatch = async (event) => {
    if (!event || !event.type) return null;

    try {
        const [risks] = await db.execute(
            'SELECT * FROM Risk WHERE riskName = ?',
            [event.type]
        );

        if (risks.length > 0) {
            return {
                riskID: risks[0].riskID,
                cID: event.cID || null,
                alertStatus: 'NEW',
                message: `An xBank customer has triggered an alert due to : ${event.type}, with uID: ${event.uID || 'N/A'}, description: ${event.description || 'No Description'}`
            };
        }
    } catch (err) {
        console.error('[RISK] Error checking risk match:', err);
    }

    return null;
}
