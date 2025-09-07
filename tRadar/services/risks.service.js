const db = require('../models/db')

module.exports.getAllRisks = async () => {
    const [rows] = await db.query("SELECT * FROM Risk")
    return rows;
}

// Get a risk by its ID
module.exports.getRiskByID = async (id) => {
    const [[row]] = await db.query("SELECT * FROM Risk WHERE riskID = ?", [id])
    return row;
}

// Get filtered risks
module.exports.getFilteredRisks = async (min, max) => {
    const [rows] = await db.query("SELECT * FROM Risk WHERE riskSeverity BETWEEN ? AND ?", [min, max]);
    return rows;
}

// Delete a risk
module.exports.deleteRisk = async (id) => {
    const [response] = await db.query("DELETE FROM Risk WHERE riskID = ?", [id])
    return response.affectedRows;
}

// Add a risk
module.exports.addOrEditRisk = async (obj, id = 0) => {
    const [data] = await db.query("CALL usp_risk_add_or_edit(?, ?, ?, ?)", 
        [id, obj.riskName, obj.riskDes, obj.riskSeverity])
    return data[0][0].affectedRows;
}


// checking if risk matches with event data from socket
module.exports.checkRiskMatch = async (event) => {
    if (!event || !event.eventName) return null; 

    // matching the eventName with riskName in Risk table
    const [risks] = await db.query(
        "SELECT * FROM Risk WHERE riskName = ?",
        [event.eventName]
    );

    if (risks.length > 0) {
        return {
            riskID: risks[0].riskID,
            message: `Triggered by xBank event: ${event.eventName}, txnID: ${event.txnID || 'N/A'}, description: ${event.description || 'No description'}`
        };
    }

    return null; // if no matching risk found
};
