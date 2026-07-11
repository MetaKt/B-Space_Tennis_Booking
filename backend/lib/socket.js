// socket.js — Socket.IO singleton
// Usage in routes: const { getIO } = require('../lib/socket');
//                  getIO().emit('event', data);

let io;

// Same origin policy as the REST API's CORS config in server.js: in dev, allow
// localhost + any private-LAN origin (so a phone on the same Wi-Fi can connect);
// in production, only the deployed frontend origin.
const allowedOrigins = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:3001', 'http://127.0.0.1:3001',
];
const isPrivateLanOrigin = (origin) =>
  /^https?:\/\/(10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})(:\d+)?$/.test(origin);

const init = (httpServer) => {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV === 'production') {
          if (origin === process.env.FRONTEND_URL) return callback(null, true);
        } else if (allowedOrigins.includes(origin) || isPrivateLanOrigin(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Socket.IO CORS: origin ${origin} not allowed`));
      },
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    // Client can join a room per court+date for targeted updates
    socket.on('join:court', ({ courtId, date }) => {
      socket.join(`court:${courtId}:${date}`);
    });

    socket.on('leave:court', ({ courtId, date }) => {
      socket.leave(`court:${courtId}:${date}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

module.exports = { init, getIO };
