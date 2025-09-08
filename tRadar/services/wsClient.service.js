const WebSocket = require('ws');
const { checkRiskMatch } = require('./risks.service');
const { createAlert } = require('./alerts.service');

const serverPort = 10000;

function connectToXBank() {
    const socket = new WebSocket(`ws://localhost:${serverPort}`);

    socket.on('open', () => console.log('[WS] Connected to xBank WebSocket'));

    socket.on('message', async (msg) => {
        try {
            console.log('[WS] Raw message:', msg.toString());
            const data = JSON.parse(msg);
            console.log('[WS] Parsed event data:', data);

            const alertData = await checkRiskMatch(data); 
            if (alertData) await createAlert(alertData);   
        } catch (err) {
            console.error('[WS] Error parsing message or creating alert:', err);
        }
    });

    socket.on('close', () => {
        console.log('[WS] Connection closed, reconnecting in 5s...');
        setTimeout(connectToXBank, 5000);
    });

    socket.on('error', (err) => console.error('[WS] Socket error:', err));
}

module.exports = { connectToXBank };
