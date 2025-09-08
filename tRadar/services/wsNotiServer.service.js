// tRadar websocket server for sending alerts as nofifications 
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 10001 });

wss.on('connection', (socket) => {
  console.log('Analyst dashboard connected');

  socket.on('close', () => console.log('Analyst dashboard disconnected'));
  socket.on('error', (err) => console.error('WS error:', err));
});

// function for the alert broadcasting
function broadcastToAnalysts(alert) {
  const msg = JSON.stringify(alert);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

module.exports = { broadcastToAnalysts };
