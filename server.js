const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add route for challenge links
app.get('/play/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Constants
const emojis = ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜'];
const GRID_SIZE = 16;
const MAX_STRAWBERRIES = 5;

// Game state
const rooms = {
    'main': {
        players: {},
        strawberries: [],
        goldenStrawberryTimer: null
    }
};

// Stats tracking
const playerStats = {}; // Stores lifetime stats for players
const leaderboard = []; // Top 10 players by score
const hourlyCompetition = {
    startTime: Date.now(),
    endTime: Date.now() + 3600000, // 1 hour
    scores: {},
    previousWinner: null
};

// Initialize main room
initializeRoom('main');

// Initialize a room
function initializeRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            players: {},
            strawberries: [],
            goldenStrawberryTimer: null
        };
    }
    
    // Clear any existing strawberries
    rooms[roomId].strawberries = [];
    
    // Spawn initial strawberries
    for (let i = 0; i < MAX_STRAWBERRIES; i++) {
        spawnStrawberry(roomId);
    }
    
    // Start golden strawberry timer
    startGoldenStrawberryTimer(roomId);
}

// Initialize strawberries
function spawnStrawberry(roomId) {
    const room = rooms[roomId];
    if (!room || room.strawberries.length >= MAX_STRAWBERRIES) return;
    
    // Find an empty position
    let x, y, isOccupied;
    do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
        
        // Check if position is occupied by a player or another strawberry
        isOccupied = Object.values(room.players).some(player => player.x === x && player.y === y) ||
                     room.strawberries.some(berry => berry.x === x && berry.y === y);
    } while (isOccupied);
    
    const strawberry = { x, y, id: Date.now(), isGolden: false };
    room.strawberries.push(strawberry);
    
    // Broadcast new strawberry to all players in the room
    io.to(roomId).emit('strawberrySpawned', strawberry);
}

// Spawn a golden strawberry
function spawnGoldenStrawberry(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    
    // Find an empty position
    let x, y, isOccupied;
    do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
        
        // Check if position is occupied by a player or another strawberry
        isOccupied = Object.values(room.players).some(player => player.x === x && player.y === y) ||
                     room.strawberries.some(berry => berry.x === x && berry.y === y);
    } while (isOccupied);
    
    const goldenStrawberry = { x, y, id: Date.now(), isGolden: true };
    room.strawberries.push(goldenStrawberry);
    
    // Broadcast new golden strawberry to all players in the room
    io.to(roomId).emit('strawberrySpawned', goldenStrawberry);
}

// Start golden strawberry timer
function startGoldenStrawberryTimer(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    
    // Clear existing timer if any
    if (room.goldenStrawberryTimer) {
        clearInterval(room.goldenStrawberryTimer);
    }
    
    // Spawn a golden strawberry every 20 seconds
    room.goldenStrawberryTimer = setInterval(() => {
        // Remove any existing golden strawberries first
        const goldenIndex = room.strawberries.findIndex(berry => berry.isGolden);
        if (goldenIndex !== -1) {
            const oldGolden = room.strawberries.splice(goldenIndex, 1)[0];
            io.to(roomId).emit('strawberryRemoved', oldGolden.id);
        }
        
        spawnGoldenStrawberry(roomId);
    }, 20000); // 20 seconds
}

// Check if a player collected a strawberry
function checkStrawberryCollection(player, roomId) {
    const room = rooms[roomId];
    if (!room) return false;
    
    for (let i = 0; i < room.strawberries.length; i++) {
        if (room.strawberries[i].x === player.x && room.strawberries[i].y === player.y) {
            // Remove the strawberry
            const collectedStrawberry = room.strawberries.splice(i, 1)[0];
            
            // Points for this strawberry
            const points = collectedStrawberry.isGolden ? 3 : 1;
            
            // Increment player's score
            player.score += points;
            
            // Update player's lifetime stats
            updatePlayerStats(player.nickname, points);
            
            // Update hourly competition
            updateHourlyCompetition(player.nickname, player.score);
            
            // Update leaderboard
            updateLeaderboard();
            
            // Broadcast strawberry collection and updated score
            io.to(roomId).emit('strawberryCollected', {
                strawberryId: collectedStrawberry.id,
                playerId: player.id,
                newScore: player.score,
                isGolden: collectedStrawberry.isGolden
            });
            
            // Spawn a new strawberry if it was a regular one
            if (!collectedStrawberry.isGolden) {
                setTimeout(() => spawnStrawberry(roomId), 1000);
            }
            
            return true;
        }
    }
    return false;
}

// Update player's lifetime stats
function updatePlayerStats(nickname, points) {
    if (!playerStats[nickname]) {
        playerStats[nickname] = {
            totalScore: 0,
            totalStrawberries: 0,
            totalGoldenStrawberries: 0
        };
    }
    
    // Update total score
    playerStats[nickname].totalScore += points;
    
    // Update strawberry count (golden = 3 points, regular = 1 point)
    if (points === 3) {
        playerStats[nickname].totalGoldenStrawberries += 1;
    } else {
        playerStats[nickname].totalStrawberries += 1;
    }
}

// Update hourly competition
function updateHourlyCompetition(nickname, score) {
    const now = Date.now();
    
    // Check if competition has ended
    if (now > hourlyCompetition.endTime) {
        // Find winner
        let highestScore = 0;
        let winner = null;
        
        Object.entries(hourlyCompetition.scores).forEach(([name, score]) => {
            if (score > highestScore) {
                highestScore = score;
                winner = name;
            }
        });
        
        // Save previous winner
        hourlyCompetition.previousWinner = winner;
        
        // Reset competition for next hour
        hourlyCompetition.startTime = now;
        hourlyCompetition.endTime = now + 3600000; // 1 hour
        hourlyCompetition.scores = {};
        
        // Broadcast winner to all players
        io.emit('hourlyWinner', {
            nickname: winner,
            score: highestScore
        });
    }
    
    // Update player's score for current competition
    hourlyCompetition.scores[nickname] = score;
}

// Update global leaderboard
function updateLeaderboard() {
    // Create array from all player stats
    const allPlayers = Object.entries(playerStats).map(([nickname, stats]) => ({
        nickname,
        totalScore: stats.totalScore,
        totalStrawberries: stats.totalStrawberries + stats.totalGoldenStrawberries
    }));
    
    // Sort by total score
    allPlayers.sort((a, b) => b.totalScore - a.totalScore);
    
    // Take top 10
    const newLeaderboard = allPlayers.slice(0, 10);
    
    // Update global leaderboard
    leaderboard.length = 0;
    leaderboard.push(...newLeaderboard);
    
    // Broadcast new leaderboard to all players
    io.emit('leaderboardUpdate', leaderboard);
}

// Create a unique game room
function createGameRoom() {
    const roomId = uuidv4().substring(0, 8); // Generate shorter room ID
    initializeRoom(roomId);
    return roomId;
}

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);
    let currentRoom = 'main'; // Default room

    // Handle player joining
    socket.on('join', (data) => {
        // Check if player is joining a specific room
        if (data.roomId && rooms[data.roomId]) {
            currentRoom = data.roomId;
        }
        
        // Join the socket room
        socket.join(currentRoom);
        
        // Assign random emoji
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        // Random position on 16x16 grid
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        
        // Get lifetime stats or initialize
        const stats = playerStats[data.nickname] || {
            totalScore: 0,
            totalStrawberries: 0,
            totalGoldenStrawberries: 0
        };
        
        // Add player to game state
        rooms[currentRoom].players[socket.id] = {
            id: socket.id,
            nickname: data.nickname,
            emoji,
            x,
            y,
            score: 0,
            isCrowned: hourlyCompetition.previousWinner === data.nickname
        };
        
        // Send player their initial state
        socket.emit('init', {
            player: rooms[currentRoom].players[socket.id],
            strawberries: rooms[currentRoom].strawberries,
            stats: stats,
            leaderboard: leaderboard,
            hourlyCompetition: {
                timeLeft: hourlyCompetition.endTime - Date.now(),
                currentWinner: getHourlyLeader()
            }
        });
        
        // Broadcast new player to all others in the room
        socket.to(currentRoom).emit('playerJoined', rooms[currentRoom].players[socket.id]);
        
        // Send existing players to new player
        Object.values(rooms[currentRoom].players).forEach(player => {
            if (player.id !== socket.id) {
                socket.emit('playerJoined', player);
            }
        });
    });
    
    // Handle player movement
    socket.on('move', (direction) => {
        if (!rooms[currentRoom] || !rooms[currentRoom].players[socket.id]) return;
        
        const player = rooms[currentRoom].players[socket.id];
        
        // Update position based on direction
        switch (direction) {
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
        checkStrawberryCollection(player, currentRoom);
        
        // Broadcast updated position to all players in the room
        io.to(currentRoom).emit('playerMoved', {
            id: socket.id,
            x: player.x,
            y: player.y
        });
    });
    
    // Handle create game request
    socket.on('createGame', () => {
        const roomId = createGameRoom();
        socket.emit('gameCreated', { roomId });
    });
    
    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        if (rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            // Notify all players in the room about the disconnection
            io.to(currentRoom).emit('playerLeft', socket.id);
            // Remove from players list
            delete rooms[currentRoom].players[socket.id];
            
            // Clean up empty custom rooms (but keep main)
            if (currentRoom !== 'main' && Object.keys(rooms[currentRoom].players).length === 0) {
                if (rooms[currentRoom].goldenStrawberryTimer) {
                    clearInterval(rooms[currentRoom].goldenStrawberryTimer);
                }
                delete rooms[currentRoom];
            }
        }
    });
});

// Get current hourly competition leader
function getHourlyLeader() {
    let highestScore = 0;
    let leader = null;
    
    Object.entries(hourlyCompetition.scores).forEach(([name, score]) => {
        if (score > highestScore) {
            highestScore = score;
            leader = name;
        }
    });
    
    return leader ? { nickname: leader, score: highestScore } : null;
}

// Update competition and leaderboards regularly
setInterval(() => {
    updateLeaderboard();
    io.emit('hourlyUpdate', {
        timeLeft: hourlyCompetition.endTime - Date.now(),
        currentWinner: getHourlyLeader()
    });
}, 10000); // Every 10 seconds

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 