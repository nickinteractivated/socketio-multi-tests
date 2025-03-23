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
    origin: ["https://socketio-multi-tests.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  // Force WebSocket transport for better performance
  transports: ['websocket'],
  // Reduce ping timeout for faster reconnections
  pingTimeout: 10000,
  // Increase ping interval for more frequent connection checks
  pingInterval: 5000,
  // Performance options
  perMessageDeflate: {
    threshold: 1024 // Only compress messages larger than 1KB
  }
});

// Configure Express CORS middleware with the same settings
app.use(cors({
  origin: ["https://socketio-multi-tests.vercel.app", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Add preflight handler for OPTIONS requests
app.options('*', cors({
  origin: ["https://socketio-multi-tests.vercel.app", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Game Constants
const MAP_WIDTH = 30;
const MAP_HEIGHT = 30;
const RESOURCE_DENSITY = 0.15; // Increased from 0.1 to 0.15 (15% of tiles will have resources)
const TREE_DENSITY = 0.09; // 9% of tiles will have trees
const REGENERATION_ANNOUNCEMENT_DELAY = 3000; // 3 seconds delay before regeneration

// Game State
let gameState: GameState = {
  players: {},
  map: [], // Initialize with empty array first
  leaderboard: []
};

// World cycle data
let worldCycle = {
  cycle: 1,
  timestamp: Date.now()
};

// Flag to track regeneration state
let regenerationInProgress = false;

// Initialize the map
gameState.map = initializeMap();
console.log('Initial map generated');

// Initialize the map with random resources
function initializeMap(): Tile[][] {
  console.log('Initializing map with resources and trees...');
  const map: Tile[][] = [];
  let resourceCount = 0;
  let treeCount = 0;
  let resourceTypeCount = {
    coal: 0,
    gas: 0,
    oil: 0,
    gold: 0
  };
  
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const hasResource = Math.random() < RESOURCE_DENSITY;
      const hasTree = !hasResource && Math.random() < TREE_DENSITY; // Only place trees on tiles without resources
      let resource = null;
      
      if (hasResource) {
        // Updated resource distribution: Coal 40%, Gas 30%, Oil 25%, Gold 5%
        const resourceRoll = Math.random() * 100; // Roll 0-100
        
        if (resourceRoll < 40) {
          // 40% chance of coal
          resource = ResourceType.COAL;
          resourceTypeCount.coal++;
        } else if (resourceRoll < 70) {
          // 30% chance of gas (40% + 30% = 70%)
          resource = ResourceType.GAS;
          resourceTypeCount.gas++;
        } else if (resourceRoll < 95) {
          // 25% chance of oil (70% + 25% = 95%)
          resource = ResourceType.OIL;
          resourceTypeCount.oil++;
        } else {
          // 5% chance of gold (95% + 5% = 100%)
          resource = ResourceType.GOLD;
          resourceTypeCount.gold++;
        }
        
        resourceCount++;
      }
      
      if (hasTree) {
        treeCount++;
      }
      
      row.push({
        x,
        y,
        discovered: false,
        resource,
        hasTree: hasTree
      });
    }
    map.push(row);
  }
  
  console.log(`Map initialized with ${resourceCount} resources and ${treeCount} trees`);
  console.log(`Resource distribution: Coal: ${resourceTypeCount.coal}, Gas: ${resourceTypeCount.gas}, Oil: ${resourceTypeCount.oil}, Gold: ${resourceTypeCount.gold}`);
  return map;
}

// Check if all resources are depleted
function areAllResourcesDepleted(): boolean {
  console.log('Checking if all resources are depleted...');
  let resourceCount = 0;
  
  // Check every tile in the map
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (gameState.map[y][x].resource !== null) {
        resourceCount++;
      }
    }
  }
  
  console.log(`Resource check complete: ${resourceCount} resources found on map`);
  return resourceCount === 0; // No resources found
}

// Regenerate resources on the map
function regenerateResources(): void {
  console.log('Regenerating resources on the map!');
  
  // Set regeneration flag to block movement
  regenerationInProgress = true;
  
  // Notify all players that movement is temporarily blocked
  io.emit(SocketEvents.ANNOUNCEMENT, {
    message: `World regeneration in progress. Movement temporarily disabled...`
  });
  
  // Increment world cycle
  worldCycle = {
    cycle: worldCycle.cycle + 1,
    timestamp: Date.now()
  };
  
  console.log(`World Cycle incremented to: Cycle #${worldCycle.cycle}`);
  
  // Store player positions temporarily
  const playerPositions: Record<string, Position> = {};
  Object.keys(gameState.players).forEach(socketId => {
    const player = gameState.players[socketId];
    // Make sure we're accessing position correctly
    if (player && player.position) {
      playerPositions[socketId] = { 
        x: player.position.x, 
        y: player.position.y 
      };
      
      // Temporarily move players off-map to hide them
      player.position.x = -100;
      player.position.y = -100;
    }
  });
  
  // Emit player updates to hide them
  Object.keys(gameState.players).forEach(socketId => {
    io.emit(SocketEvents.PLAYER_UPDATE, gameState.players[socketId]);
  });
  
  // Completely regenerate the map (including trees)
  gameState.map = initializeMap();
  
  let totalResourcesAdded = countResources();
  console.log(`Resources regenerated: ${totalResourcesAdded} resources added to map`);
  
  // Save the updated world cycle to the database
  saveToDatabase();
  
  // Notify all clients about the world cycle update
  io.emit(SocketEvents.WORLD_CYCLE_UPDATE, {
    cycle: worldCycle.cycle,
    timestamp: worldCycle.timestamp
  });
  
  // Notify all clients about the map update
  io.emit(SocketEvents.MAP_UPDATE, gameState.map);
  
  console.log('Map regenerated and clients notified');
  
  // After a short delay, restore player positions and enable movement
  setTimeout(() => {
    // Restore player positions
    Object.keys(gameState.players).forEach(socketId => {
      if (playerPositions[socketId] && gameState.players[socketId]) {
        const player = gameState.players[socketId];
        // Find a valid position near their original spot
        const pos = findValidPosition(playerPositions[socketId]);
        player.position.x = pos.x;
        player.position.y = pos.y;
        
        // Discover tiles around the player's new position
        discoverTilesAroundPlayer(player.position);
      }
    });
    
    // Re-emit updated player positions
    Object.keys(gameState.players).forEach(socketId => {
      io.emit(SocketEvents.PLAYER_UPDATE, gameState.players[socketId]);
    });
    
    // Allow movement again
    regenerationInProgress = false;
    
    // Announce regeneration complete
    io.emit(SocketEvents.ANNOUNCEMENT, {
      message: `Resource regeneration complete! World Cycle: ${worldCycle.cycle}. Movement enabled.`
    });
    
    console.log('Player positions restored and movement re-enabled');
  }, 3000); // 3 second delay for visual effect
  
  // Verify resources were added
  setTimeout(() => {
    if (areAllResourcesDepleted()) {
      console.log('ERROR: Map is still empty after regeneration!');
    } else {
      console.log('Verification complete: Resources successfully regenerated');
    }
  }, 100);
}

// Announce resource regeneration
function announceResourceRegeneration(): void {
  // Announce to all players that resources will regenerate soon
  io.emit(SocketEvents.RESOURCE_REGENERATION, {
    message: `All resources have been collected! World Cycle ${worldCycle.cycle} is ending. New resources will appear in 3 seconds...`
  });
}

// Database operations
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Ensure database directory exists on startup
ensureDatabaseDirectoryExists();

// Initialize database data
let dbData: DatabaseData = {
  leaderboard: [],
  players: {},
  worldCycle: {
    cycle: 1,
    timestamp: Date.now()
  }
};

// Load initial database data
try {
  const loadedData = loadFromDatabase();
  dbData = {
    leaderboard: loadedData.leaderboard || [],
    players: loadedData.players || {},
    worldCycle: loadedData.worldCycle || { cycle: 1, timestamp: Date.now() }
  };
  
  // Set initial world cycle from database
  if (loadedData.worldCycle) {
    worldCycle = loadedData.worldCycle;
    console.log(`Loaded world cycle from database: Cycle #${worldCycle.cycle}`);
  }
} catch (err) {
  console.error('Error loading initial database data:', err);
}

// Enhanced database structure
interface DatabaseData {
  leaderboard: LeaderboardEntry[];
  players: Record<string, {
    username: string;
    score: number;
    resources: Resources;
    position: Position;
    lastSeen: number;
  }>;
  worldCycle: {
    cycle: number;
    timestamp: number;
  };
}

// Track IP addresses and usernames
const activeIPs = new Map<string, string>(); // IP -> username
const activeUsernames = new Set<string>(); // Set of active usernames

// Initialize world cycle from database
if (dbData.worldCycle) {
  worldCycle = dbData.worldCycle;
  console.log(`World Cycle initialized: Cycle #${worldCycle.cycle}`);
} else {
  console.log('No previous world cycle data found, starting at cycle 1');
}

// Auto-save interval
const AUTO_SAVE_INTERVAL = 30000; // Save every 30 seconds
setInterval(saveToDatabase, AUTO_SAVE_INTERVAL);

// Generate leaderboard from current players
function generateLeaderboard(): LeaderboardEntry[] {
  // Get active players from current game state
  const activePlayers = Object.values(gameState.players).map(player => ({
    username: player.username,
    score: player.score
  }));
  
  // Get saved players from database who aren't currently active
  const savedPlayerUsernames = new Set(Object.keys(dbData.players || {}));
  const activePlayerUsernames = new Set(Object.values(gameState.players).map(p => p.username));
  
  // Find saved players who aren't currently active
  const inactiveSavedPlayers: LeaderboardEntry[] = [];
  savedPlayerUsernames.forEach(username => {
    if (!activePlayerUsernames.has(username)) {
      const savedPlayer = dbData.players[username];
      inactiveSavedPlayers.push({
        username: savedPlayer.username,
        score: savedPlayer.score
      });
    }
  });
  
  // Combine active and inactive players
  const allPlayers = [...activePlayers, ...inactiveSavedPlayers];
  
  // Sort by score (highest first)
  return allPlayers.sort((a, b) => b.score - a.score);
}

// Update the leaderboard and save to database
function updateLeaderboard() {
  // Generate a new leaderboard that includes both active and inactive players
  gameState.leaderboard = generateLeaderboard();
  
  // Save updated data to database
  saveToDatabase();
  
  // Notify all clients about the updated leaderboard
  io.emit(SocketEvents.UPDATE_LEADERBOARD, gameState.leaderboard);
  
}

// Handle discovering tiles around a player
function discoverTilesAroundPlayer(position: Position) {
  const radius = 1; // Reduced from 2 to 1 - now reveals a 3x3 grid instead of 5x5
  
  for (let y = Math.max(0, position.y - radius); y <= Math.min(MAP_HEIGHT - 1, position.y + radius); y++) {
    for (let x = Math.max(0, position.x - radius); x <= Math.min(MAP_WIDTH - 1, position.x + radius); x++) {
      if (!gameState.map[y][x].discovered) {
        gameState.map[y][x].discovered = true;
      }
    }
  }
}

// Helper function to log active connections
function logActiveConnections() {
  console.log(`---- ACTIVE CONNECTIONS ----`);
  console.log(`Total active usernames: ${activeUsernames.size}`);
  console.log(`Active usernames: ${Array.from(activeUsernames).join(', ')}`);
  console.log(`Total IPs mapped: ${activeIPs.size}`);
  activeIPs.forEach((username, ip) => {
    console.log(`IP: ${ip} => Username: ${username}`);
  });
  console.log(`Total players in gameState: ${Object.keys(gameState.players).length}`);
  console.log(`---------------------------`);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connection attempt: ${socket.id} from IP ${socket.handshake.address}`);
  
  // Track the client's IP address
  const clientIP = socket.handshake.address;
  
  // Store IP address in socket data for disconnect handler
  socket.data.clientIP = clientIP;
  
  // Add ping handler to measure and monitor latency
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });
  
  // Player joins the game
  socket.on(SocketEvents.JOIN_GAME, (username: string) => {
    // Validate username (valid VARCHAR, max 30 characters)
    if (!username || username.trim() === '') {
      socket.emit('loginError', { message: 'Username cannot be empty.' });
      return;
    }
    
    if (username.length > 30) {
      socket.emit('loginError', { message: 'Username must be 30 characters or less.' });
      return;
    }
    
    // Ensure username only contains valid VARCHAR characters
    const validUsernamePattern = /^[a-zA-Z0-9_\-. ]+$/;
    if (!validUsernamePattern.test(username)) {
      socket.emit('loginError', { message: 'Username can only contain letters, numbers, underscores, hyphens, periods, and spaces.' });
      return;
    }
    
    // Find existing socket for this username
    let existingSocketId: string | null = null;
    Object.keys(gameState.players).forEach(socketId => {
      if (gameState.players[socketId].username === username) {
        existingSocketId = socketId;
      }
    });
    
    // Handle reconnection scenario (player refreshed page or switched tabs)
    if (existingSocketId) {
      // Get the existing socket
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      
      if (existingSocket) {
        // If this is a different client (not a tab refresh in same browser)
        if (socket.handshake.address !== existingSocket.handshake.address) {
          // Only allow one login per username
          console.log(`Username ${username} is already active from a different IP, rejecting new connection`);
          socket.emit('loginError', { message: 'This username is already logged in. Please choose another one or close the other session.' });
          return;
        } else {
          // Same client refreshed the page or opened a new tab, disconnect the old session
          console.log(`Disconnecting previous session for ${username} due to reconnection`);
          existingSocket.disconnect(true);
          
          // Remove the old socket from active tracking
          delete gameState.players[existingSocketId];
        }
      }
    }
    
    console.log(`Player joined: ${socket.id} as ${username} from ${clientIP}`);
    
    // Try to find existing player data from database
    const savedPlayerData = dbData.players[username];
    console.log(`Looking for saved data for ${username}:`, savedPlayerData ? 'Found' : 'Not found');
    
    // Create starting position - either restore from saved data or generate new
    const position: Position = savedPlayerData ? 
      findValidPosition(savedPlayerData.position) : // Find nearest valid position to saved position
      { 
        x: Math.floor(Math.random() * MAP_WIDTH),
        y: Math.floor(Math.random() * MAP_HEIGHT)
      };
    
    // Initialize player with saved data (ensure all properties are properly restored)
    const player: Player = {
      id: socket.id,
      username,
      position,
      // Make sure score and resources are properly restored from saved data
      score: savedPlayerData ? savedPlayerData.score : 0,
      resources: savedPlayerData ? {
        coal: savedPlayerData.resources.coal || 0,
        gas: savedPlayerData.resources.gas || 0,
        oil: savedPlayerData.resources.oil || 0,
        gold: savedPlayerData.resources.gold || 0
      } : {
        coal: 0,
        gas: 0,
        oil: 0,
        gold: 0
      }
    };
    
    // Debug log saved vs restored data
    if (savedPlayerData) {
      console.log(`DETAILED RESTORE for ${username}:`);
      console.log(`  FROM DB → Score: ${savedPlayerData.score}, Coal: ${savedPlayerData.resources.coal}, Gas: ${savedPlayerData.resources.gas}, Oil: ${savedPlayerData.resources.oil}, Gold: ${savedPlayerData.resources.gold || 0}`);
      console.log(`  TO PLAYER → Score: ${player.score}, Coal: ${player.resources.coal}, Gas: ${player.resources.gas}, Oil: ${player.resources.oil}, Gold: ${player.resources.gold}`);
      
      // Notify player that their data was restored
      socket.emit('dataRestored', {
        message: `Welcome back, ${username}!`,
        score: player.score,
        resources: player.resources
      });
    } else {
      console.log(`New player ${username} created with zero score and resources`);
    }
    
    // Register the player as active
    activeUsernames.add(username);
    activeIPs.set(clientIP, username);
    
    // Add player to game state
    gameState.players[socket.id] = player;
    
    // Log active connections after adding player
    logActiveConnections();
    
    // Discover tiles around player - ensure initial visibility
    discoverTilesAroundPlayer(position);
    console.log(`Discovered initial 3x3 area around player ${username} at (${position.x}, ${position.y})`);
    
    // Update leaderboard to include this player
    updateLeaderboard();
    
    // Immediately save to database to ensure data persistence
    saveToDatabase();
    
    // Send current game state to the new player
    socket.emit(SocketEvents.GAME_STATE_UPDATE, gameState);
    
    // Send world cycle data
    socket.emit(SocketEvents.WORLD_CYCLE_UPDATE, worldCycle);
    
    // Notify all clients about the new player
    io.emit(SocketEvents.GAME_STATE_UPDATE, {
      players: gameState.players,
      leaderboard: gameState.leaderboard
    });
  });
  
  // Player moves - optimized for performance
  socket.on(SocketEvents.PLAYER_MOVED, (newPosition: Position) => {
    if (!gameState.players[socket.id]) return;
    
    // Block movement if regeneration is in progress - early return to avoid processing
    if (regenerationInProgress) {
      socket.emit(SocketEvents.MOVEMENT_BLOCKED, {
        reason: 'regeneration',
        message: "Movement blocked during world regeneration"
      });
      return;
    }
    
    // Validate movement (prevent cheating)
    const currentPosition = gameState.players[socket.id].position;
    
    // Optimize validation with simpler calculations
    const dx = Math.abs(newPosition.x - currentPosition.x);
    const dy = Math.abs(newPosition.y - currentPosition.y);
    
    // Ensure only orthogonal movement (no diagonal)
    const isOrthogonal = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    
    // Quick bounds check
    const isInBounds = 
      newPosition.x >= 0 && newPosition.x < MAP_WIDTH &&
      newPosition.y >= 0 && newPosition.y < MAP_HEIGHT;
    
    // Early return if movement is invalid - avoids unnecessary processing
    if (!isOrthogonal || !isInBounds) return;
    
    // Check if destination has a tree
    const tile = gameState.map[newPosition.y][newPosition.x];
    if (!tile || tile.hasTree) {
      // Inform player they can't move there due to a tree
      socket.emit('movementBlocked', {
        reason: 'tree',
        position: newPosition
      });
      return;
    }
    
    // Update player position
    gameState.players[socket.id].position = newPosition;
    
    // Discover tiles around new position
    discoverTilesAroundPlayer(newPosition);
    
    // Only emit to clients that need this update (performance optimization)
    // 1. Current player receives update for immediate feedback
    socket.emit(SocketEvents.PLAYER_UPDATE, gameState.players[socket.id]);
    
    // 2. Other players receive updates in batches (throttled by room)
    socket.broadcast.emit(SocketEvents.PLAYER_UPDATE, gameState.players[socket.id]);
    
    // Check if player is on a resource tile
    if (tile.resource) {
      // Player collects resource
      const player = gameState.players[socket.id];
      let scoreIncreased = false;
      
      switch (tile.resource) {
        case ResourceType.COAL:
          player.resources.coal += 1;
          player.score += 1;
          scoreIncreased = true;
          break;
        case ResourceType.GAS:
          player.resources.gas += 1;
          player.score += 2;
          scoreIncreased = true;
          break;
        case ResourceType.OIL:
          player.resources.oil += 1;
          player.score += 3;
          scoreIncreased = true;
          break;
        case ResourceType.GOLD:
          player.resources.gold += 1;
          player.score += 5;
          scoreIncreased = true;
          break;
      }
      
      // Remove resource from the map
      tile.resource = null;
      
      // Only update leaderboard occasionally (very expensive operation)
      if (scoreIncreased && (player.score % 10 === 0 || tile.resource === ResourceType.GOLD)) {
        updateLeaderboard();
        
        // Save database even less frequently
        if (player.score % 30 === 0) {
          saveToDatabase();
        }
      }
      
      // Send resource collection notification to the player only
      socket.emit(SocketEvents.COLLECT_RESOURCE, {
        position: newPosition,
        player: player
      });
      
      // Send map update to all players
      const updatedTile = {x: newPosition.x, y: newPosition.y, tile: tile};
      io.emit(SocketEvents.TILE_UPDATE, updatedTile);
      
      // Check if all resources are depleted
      if (areAllResourcesDepleted()) {
        console.log('All resources depleted, scheduling regeneration...');
        // Announce regeneration
        announceResourceRegeneration();
        
        // Schedule resource regeneration after a delay
        setTimeout(() => {
          regenerateResources();
        }, REGENERATION_ANNOUNCEMENT_DELAY);
      }
    }
  });
  
  // Player disconnects
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    if (gameState.players[socket.id]) {
      const username = gameState.players[socket.id].username;
      const clientIP = socket.data.clientIP;
      
      // Save player data on disconnect
      saveToDatabase();
      
      // Remove player from active tracking
      console.log(`Removing ${username} from active users list`);
      activeUsernames.delete(username);
      
      // Only remove from IP map if this IP is associated with this username
      if (activeIPs.get(clientIP) === username) {
        console.log(`Removing IP ${clientIP} from active IPs map`);
        activeIPs.delete(clientIP);
      }
      
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
      
      // Log active connections after removal
      logActiveConnections();
    }
  });
});

// Find a valid position near the saved position (in case there's now a tree there)
function findValidPosition(savedPosition: Position): Position {
  // Check if the exact saved position is valid
  if (isValidTile(savedPosition.x, savedPosition.y)) {
    return savedPosition;
  }
  
  // Otherwise, check in a spiral pattern around the original position
  const maxRadius = 5; // How far to check from the original position
  
  for (let radius = 1; radius <= maxRadius; radius++) {
    // Check in a square around the saved position
    for (let xOffset = -radius; xOffset <= radius; xOffset++) {
      for (let yOffset = -radius; yOffset <= radius; yOffset++) {
        // Skip checking positions we've already checked in smaller radii
        if (Math.abs(xOffset) < radius && Math.abs(yOffset) < radius) continue;
        
        const newX = savedPosition.x + xOffset;
        const newY = savedPosition.y + yOffset;
        
        if (isValidTile(newX, newY)) {
          console.log(`Found valid position at ${newX},${newY} (${radius} away from saved position)`);
          return { x: newX, y: newY };
        }
      }
    }
  }
  
  // If we can't find a valid position nearby, just pick a random one
  console.log(`Couldn't find valid position near ${savedPosition.x},${savedPosition.y}, using random position`);
  return {
    x: Math.floor(Math.random() * MAP_WIDTH),
    y: Math.floor(Math.random() * MAP_HEIGHT)
  };
}

// Helper to check if a tile is valid for a player to stand on
function isValidTile(x: number, y: number): boolean {
  // Check if position is within map bounds
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
    return false;
  }
  
  // Check if there's a tree on the tile
  if (gameState.map[y][x]?.hasTree) {
    return false;
  }
  
  return true;
}

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize leaderboard from saved data when server starts
  initializeLeaderboardFromDatabase();
  
  // Check if resources need to be regenerated on startup
  console.log('Checking resource state on server startup...');
  if (areAllResourcesDepleted()) {
    console.log('Map is empty! Regenerating resources...');
    regenerateResources();
  } else {
    console.log('Map has resources, no regeneration needed');
  }
});

// Function to initialize leaderboard from database
function initializeLeaderboardFromDatabase() {
  console.log('Initializing leaderboard from database...');
  
  // Get all player data from database
  const savedPlayers = Object.values(dbData.players || {});
  
  if (savedPlayers.length > 0) {
    // Create leaderboard entries from saved player data
    const leaderboardFromSavedData = savedPlayers.map(player => ({
      username: player.username,
      score: player.score
    })).sort((a, b) => b.score - a.score);
    
    gameState.leaderboard = leaderboardFromSavedData;
    console.log(`Leaderboard initialized with ${gameState.leaderboard.length} entries`);
  } else {
    console.log('No saved player data found, starting with empty leaderboard');
  }
}

// Add REST endpoints
app.use(express.json());

// Delete user account endpoint
app.post('/api/deleteAccount', (req: any, res: any) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }
  
  try {
    console.log(`Request to delete account for username: ${username}`);
    
    // Find any active socket with this username and disconnect it
    let userSocketId: string | null = null;
    Object.keys(gameState.players).forEach(socketId => {
      if (gameState.players[socketId].username === username) {
        userSocketId = socketId;
      }
    });
    
    if (userSocketId) {
      const socket = io.sockets.sockets.get(userSocketId);
      if (socket) {
        console.log(`Disconnecting active user ${username}`);
        socket.emit('accountDeleted', { message: 'Your account has been deleted.' });
        socket.disconnect(true);
      }
      
      // Remove from game state
      delete gameState.players[userSocketId];
      
      // Remove from active tracking
      activeUsernames.delete(username);
    }
    
    // Remove from database
    if (dbData.players[username]) {
      delete dbData.players[username];
      console.log(`Deleted user ${username} from database`);
      
      // Save changes to database
      saveToDatabase();
      
      // Update leaderboard
      updateLeaderboard();
      
      return res.json({ 
        success: true, 
        message: `Account ${username} successfully deleted` 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: `Account ${username} not found` 
      });
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ success: false, message: 'Server error during account deletion' });
  }
});

// Admin endpoint to reset the game state
app.post('/admin/reset', (req: any, res: any) => {
  const { adminKey } = req.body;
  
  // Simple admin key validation - in production, use a more secure method
  const ADMIN_KEY = 'computation-hunter-admin-2023';
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    console.log('Admin requested reset of game state');
    
    // Disconnect all players
    Object.keys(gameState.players).forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('serverReset', { message: 'Server is resetting. Please refresh the page.' });
        socket.disconnect(true);
      }
    });
    
    // Clear active player tracking
    activeUsernames.clear();
    activeIPs.clear();
    
    // Reset world cycle
    worldCycle = {
      cycle: 1,
      timestamp: Date.now()
    };
    
    // Reset game state
    gameState = {
      players: {},
      map: initializeMap(),
      leaderboard: []
    };
    
    // Clear database or reset it to default state
    const emptyDatabase: DatabaseData = {
      leaderboard: [],
      players: {},
      worldCycle: {
        cycle: 1,
        timestamp: Date.now()
      }
    };
    
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDatabase, null, 2));
    console.log('Database reset to empty state');
    
    return res.json({ 
      success: true, 
      message: 'Game state reset successfully',
      resourceCount: countResources(),
      worldCycle: worldCycle.cycle
    });
  } catch (error) {
    console.error('Error resetting game state:', error);
    return res.status(500).json({ success: false, message: 'Server error during reset' });
  }
});

// Helper function to count resources in the map
function countResources(): number {
  let count = 0;
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (gameState.map[y][x].resource !== null) {
        count++;
      }
    }
  }
  return count;
}

// Make sure database directory exists
function ensureDatabaseDirectoryExists() {
  const dirPath = path.dirname(DB_FILE);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created database directory at ${dirPath}`);
  }
}

function saveToDatabase() {
  // Ensure database directory exists
  ensureDatabaseDirectoryExists();
  
  // Prepare data to save
  const playerData: Record<string, any> = {};
  
  // Save each player's data
  Object.values(gameState.players).forEach(player => {
    playerData[player.username] = {
      username: player.username,
      score: player.score,
      resources: player.resources,
      position: player.position,
      lastSeen: Date.now()
    };
  });
  
  // Also include saved players who aren't currently active
  Object.keys(dbData.players || {}).forEach(username => {
    if (!playerData[username]) {
      // Keep inactive players in the database
      playerData[username] = dbData.players[username];
    }
  });
  
  const dataToSave: DatabaseData = {
    leaderboard: generateLeaderboard(),
    players: playerData,
    worldCycle: worldCycle
  };
  
  try {
    // Create a backup of the previous database file
    if (fs.existsSync(DB_FILE)) {
      const backupFile = `${DB_FILE}.backup`;
      fs.copyFileSync(DB_FILE, backupFile);
    }
    
    // Write the new data
    fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2));
    
    // Update in-memory database copy
    dbData = dataToSave;
    
    console.log(`Database saved with ${Object.keys(playerData).length} players`);
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

function loadFromDatabase(): { 
  leaderboard: LeaderboardEntry[]; 
  players: Record<string, any>;
  worldCycle?: {
    cycle: number;
    timestamp: number;
  };
} {
  try {
    // Ensure database directory exists
    ensureDatabaseDirectoryExists();
    
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      
      if (!data || data.trim() === '') {
        console.log('Database file is empty, starting with fresh data');
        return { leaderboard: [], players: {} };
      }
      
      try {
        const parsedData = JSON.parse(data) as DatabaseData;
        console.log(`Database loaded with ${Object.keys(parsedData.players || {}).length} saved players`);
        return {
          leaderboard: parsedData.leaderboard || [],
          players: parsedData.players || {},
          worldCycle: parsedData.worldCycle
        };
      } catch (parseError) {
        console.error('Error parsing database JSON:', parseError);
        // Create backup of corrupt file
        const backupPath = `${DB_FILE}.backup.${Date.now()}`;
        fs.copyFileSync(DB_FILE, backupPath);
        console.log(`Created backup of corrupt database file at ${backupPath}`);
        return { leaderboard: [], players: {} };
      }
    } else {
      console.log('Database file not found, creating new one');
      // Create an empty database file
      saveToDatabase();
      return { leaderboard: [], players: {} };
    }
  } catch (error) {
    console.error('Error loading database:', error);
  }
  return { leaderboard: [], players: {} };
} 