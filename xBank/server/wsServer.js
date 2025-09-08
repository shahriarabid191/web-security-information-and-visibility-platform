// xBank WS server for sending event data
const WebSocket = require('ws');

const PORT = 10000; // WS server port
const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`xBank WS server running on ws://localhost:${PORT}`);
});

// broadcasting to all connected clients
wss.broadcast = (data) => {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
};

module.exports = wss;
