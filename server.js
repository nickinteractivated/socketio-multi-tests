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
const strawberries = [];
const GRID_SIZE = 16;
const MAX_STRAWBERRIES = 5;

// Initialize strawberries
function spawnStrawberry() {
    if (strawberries.length >= MAX_STRAWBERRIES) return;
    
    // Find an empty position
    let x, y, isOccupied;
    do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
        
        // Check if position is occupied by a player or another strawberry
        isOccupied = Object.values(players).some(player => player.x === x && player.y === y) ||
                     strawberries.some(berry => berry.x === x && berry.y === y);
    } while (isOccupied);
    
    const strawberry = { x, y, id: Date.now() };
    strawberries.push(strawberry);
    
    // Broadcast new strawberry to all players
    io.emit('strawberrySpawned', strawberry);
}

// Spawn initial strawberries and keep spawning
function initializeStrawberries() {
    // Spawn initial strawberries
    for (let i = 0; i < MAX_STRAWBERRIES; i++) {
        spawnStrawberry();
    }
}

// Check if a player collected a strawberry
function checkStrawberryCollection(player) {
    for (let i = 0; i < strawberries.length; i++) {
        if (strawberries[i].x === player.x && strawberries[i].y === player.y) {
            // Remove the strawberry
            const collectedStrawberry = strawberries.splice(i, 1)[0];
            
            // Increment player's score
            player.score++;
            
            // Broadcast strawberry collection and updated score
            io.emit('strawberryCollected', {
                strawberryId: collectedStrawberry.id,
                playerId: player.id,
                newScore: player.score
            });
            
            // Spawn a new strawberry
            setTimeout(spawnStrawberry, 1000);
            
            return true;
        }
    }
    return false;
}

// Initialize game
initializeStrawberries();

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Handle player joining
    socket.on('join', (nickname) => {
        // Assign random emoji
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        // Random position on 16x16 grid
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        
        // Add player to game state
        players[socket.id] = {
            id: socket.id,
            nickname,
            emoji,
            x,
            y,
            score: 0
        };
        
        // Send player their initial state
        socket.emit('init', {
            player: players[socket.id],
            strawberries: strawberries
        });
        
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
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player) return;
        
        // Update position based on direction
        switch (data.direction) {
            case 'W':
                if (player.y > 0) player.y -= 1;
                break;
            case 'A':
                if (player.x > 0) player.x -= 1;
                break;
            case 'S':
                if (player.y < GRID_SIZE - 1) player.y += 1;
                break;
            case 'D':
                if (player.x < GRID_SIZE - 1) player.x += 1;
                break;
        }
        
        // Check if player collected a strawberry
        checkStrawberryCollection(player);
        
        // Broadcast updated position to all players
        io.emit('playerMoved', {
            id: socket.id,
            x: player.x,
            y: player.y,
            moveId: data.moveId // Send back the move ID for client-side prediction
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