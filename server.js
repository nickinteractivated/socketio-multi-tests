const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const players = {};
const emojis = ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜'];

// Handle socket connections
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  // Handle player joining
  socket.on('join', (nickname) => {
    // Assign random emoji
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Random position on 16x16 grid
    const x = Math.floor(Math.random() * 16);
    const y = Math.floor(Math.random() * 16);
    
    // Add player to game state
    players[socket.id] = {
      id: socket.id,
      nickname,
      emoji,
      x,
      y
    };
    
    // Send player their initial state
    socket.emit('init', players[socket.id]);
    
    // Broadcast new player to all others
    socket.broadcast.emit('playerJoined', players[socket.id]);
    
    // Send existing players to new player
    Object.values(players).forEach(player => {
      if (player.id !== socket.id) {
        socket.emit('playerJoined', player);
      }
    });
  });
  
  // Handle player movement
  socket.on('move', (direction) => {
    const player = players[socket.id];
    if (!player) return;
    
    // Update position based on direction
    switch (direction) {
      case 'W':
        if (player.y > 0) player.y -= 1;
        break;
      case 'A':
        if (player.x > 0) player.x -= 1;
        break;
      case 'S':
        if (player.y < 15) player.y += 1;
        break;
      case 'D':
        if (player.x < 15) player.x += 1;
        break;
    }
    
    // Broadcast updated position to all players
    io.emit('playerMoved', {
      id: socket.id,
      x: player.x,
      y: player.y
    });
  });
  
  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (players[socket.id]) {
      // Notify all players about the disconnection
      io.emit('playerLeft', socket.id);
      // Remove from players list
      delete players[socket.id];
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 