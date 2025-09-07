const WebSocket = require('ws'),
    risksService = require('./risks.service'),
    alertsService = require('./alerts.service'),
    serverPort = 4000;

module.exports = function connectToXBank() {
    const socket = new WebSocket(`ws://localhost:${serverPort}`);

    socket.on("open", () => {
        console.log("Connected to xBank WebSocket");
    });

    // Getting and parsing the msg
    socket.on("message", async (msg) => {
        const data = JSON.parse(msg);
        const alertData = await risksService.checkRiskMatch(data);
        if (alertData) await alertsService.createAlert(alertData);
    });

    socket.on("close", () => setTimeout(connectToXBank, 5000));
    socket.on("error", err => console.error(err));
};


