// socket.js — Socket.IO singleton
// Usage in routes: const { getIO } = require('../lib/socket');
//                  getIO().emit('event', data);

let io;

const init = (httpServer) => {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
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
