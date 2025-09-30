try {
  const { io } = require('socket.io-client');

  const socket = io('http://localhost:3001', { transports: ['websocket'], autoConnect: true, reconnectionAttempts: 2 });

  socket.on('connect', () => {
    console.log('test-client connected', socket.id);
    // Emit create
    const payload = { name: 'test-lobby', type: 'publico', creatorId: 'test-user-1', creatorUsername: 'tester' };
    console.log('emitting lobby:create', payload);
    socket.emit('lobby:create', payload);
  });

  socket.on('connect_error', (err) => {
    console.error('connect_error', err);
  });

  socket.on('lobby:created', (data) => {
    console.log('lobby:created', data);
  });

  socket.on('lobby:left', (data) => {
    console.log('lobby:left', data);
  });

  socket.on('lobby:cancelled', (data) => {
    console.log('lobby:cancelled', data);
  });

  socket.on('lobby:updated', (data) => {
    console.log('lobby:updated', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('test-client disconnected', reason);
  });

  // after 5s exit
  setTimeout(() => {
    console.log('test-client done, disconnecting');
    try { socket.disconnect(); } catch(e) {}
    process.exit(0);
  }, 5000);
} catch (err) {
  console.error('test-client fatal error', err);
  process.exit(1);
}
