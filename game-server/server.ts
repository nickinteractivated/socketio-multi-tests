import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import {
  Player,
  Position,
  Resources,
  Tile,
  ResourceType,
  GameState,
  LeaderboardEntry,
  SocketEvents
} from './src/types/GameTypes';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());

// Game Constants
const MAP_WIDTH = 30;
const MAP_HEIGHT = 30;
const RESOURCE_DENSITY = 0.1; // 10% of tiles will have resources

// Game State
let gameState: GameState = {
  players: {},
  map: initializeMap(),
  leaderboard: []
};

// Initialize the map with random resources
function initializeMap(): Tile[][] {
  const map: Tile[][] = [];
  
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const hasResource = Math.random() < RESOURCE_DENSITY;
      let resource = null;
      
      if (hasResource) {
        const resourceRoll = Math.random();
        if (resourceRoll < 0.33) {
          resource = ResourceType.COAL;
        } else if (resourceRoll < 0.66) {
          resource = ResourceType.GAS;
        } else {
          resource = ResourceType.OIL;
        }
      }
      
      row.push({
        x,
        y,
        discovered: false,
        resource
      });
    }
    map.push(row);
  }
  
  return map;
}

// Database operations
const DB_FILE = path.join(__dirname, 'data', 'database.json');

function saveToDatabase() {
  const dataToSave = {
    leaderboard: generateLeaderboard()
  };
  
  fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2));
}

function loadFromDatabase(): LeaderboardEntry[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsedData = JSON.parse(data);
      return parsedData.leaderboard || [];
    }
  } catch (error) {
    console.error('Error loading database:', error);
  }
  return [];
}

// Initialize leaderboard from database
gameState.leaderboard = loadFromDatabase();

// Generate leaderboard from current players
function generateLeaderboard(): LeaderboardEntry[] {
  const entries = Object.values(gameState.players).map(player => ({
    username: player.username,
    score: player.score
  }));
  
  return entries.sort((a, b) => b.score - a.score);
}

// Update the leaderboard and save to database
function updateLeaderboard() {
  gameState.leaderboard = generateLeaderboard();
  saveToDatabase();
  io.emit(SocketEvents.UPDATE_LEADERBOARD, gameState.leaderboard);
}

// Handle discovering tiles around a player
function discoverTilesAroundPlayer(position: Position) {
  const radius = 2; // How many tiles around the player are discovered
  
  for (let y = Math.max(0, position.y - radius); y <= Math.min(MAP_HEIGHT - 1, position.y + radius); y++) {
    for (let x = Math.max(0, position.x - radius); x <= Math.min(MAP_WIDTH - 1, position.x + radius); x++) {
      if (!gameState.map[y][x].discovered) {
        gameState.map[y][x].discovered = true;
      }
    }
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Player joins the game
  socket.on(SocketEvents.JOIN_GAME, (username: string) => {
    // Create random starting position
    const position: Position = {
      x: Math.floor(Math.random() * MAP_WIDTH),
      y: Math.floor(Math.random() * MAP_HEIGHT)
    };
    
    // Initialize player
    const player: Player = {
      id: socket.id,
      username,
      position,
      score: 0,
      resources: {
        coal: 0,
        gas: 0,
        oil: 0
      }
    };
    
    // Add player to game state
    gameState.players[socket.id] = player;
    
    // Discover tiles around player
    discoverTilesAroundPlayer(position);
    
    // Update leaderboard
    updateLeaderboard();
    
    // Send current game state to the new player
    socket.emit(SocketEvents.GAME_STATE_UPDATE, gameState);
    
    // Notify all clients about the new player
    io.emit(SocketEvents.GAME_STATE_UPDATE, {
      players: gameState.players,
      map: gameState.map,
      leaderboard: gameState.leaderboard
    });
  });
  
  // Player moves
  socket.on(SocketEvents.PLAYER_MOVED, (newPosition: Position) => {
    if (!gameState.players[socket.id]) return;
    
    // Validate movement (prevent cheating)
    const currentPosition = gameState.players[socket.id].position;
    const isValidMove = Math.abs(newPosition.x - currentPosition.x) <= 1 && 
                       Math.abs(newPosition.y - currentPosition.y) <= 1 &&
                       newPosition.x >= 0 && newPosition.x < MAP_WIDTH &&
                       newPosition.y >= 0 && newPosition.y < MAP_HEIGHT;
    
    if (isValidMove) {
      // Update player position
      gameState.players[socket.id].position = newPosition;
      
      // Discover tiles around new position
      discoverTilesAroundPlayer(newPosition);
      
      // Check if player is on a resource tile
      const tile = gameState.map[newPosition.y][newPosition.x];
      if (tile.resource) {
        // Player collects resource
        const player = gameState.players[socket.id];
        
        switch (tile.resource) {
          case ResourceType.COAL:
            player.resources.coal += 1;
            player.score += 1;
            break;
          case ResourceType.GAS:
            player.resources.gas += 1;
            player.score += 2;
            break;
          case ResourceType.OIL:
            player.resources.oil += 1;
            player.score += 3;
            break;
        }
        
        // Remove resource from the map
        tile.resource = null;
        
        // Update leaderboard
        updateLeaderboard();
        
        // Notify player about resource collection
        socket.emit(SocketEvents.COLLECT_RESOURCE, {
          position: newPosition,
          player: gameState.players[socket.id]
        });
      }
      
      // Broadcast updated game state to all clients
      io.emit(SocketEvents.GAME_STATE_UPDATE, {
        players: gameState.players,
        map: gameState.map,
        leaderboard: gameState.leaderboard
      });
    }
  });
  
  // Player disconnects
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    if (gameState.players[socket.id]) {
      // Remove player from game state
      delete gameState.players[socket.id];
      
      // Update leaderboard
      updateLeaderboard();
      
      // Notify all clients about the disconnected player
      io.emit(SocketEvents.PLAYER_DISCONNECT, socket.id);
      io.emit(SocketEvents.GAME_STATE_UPDATE, {
        players: gameState.players,
        map: gameState.map,
        leaderboard: gameState.leaderboard
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 