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
