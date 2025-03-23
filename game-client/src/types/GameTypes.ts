export interface Player {
  id: string;
  username: string;
  position: Position;
  score: number;
  resources: Resources;
}

export interface Position {
  x: number;
  y: number;
}

export interface Resources {
  coal: number;
  gas: number;
  oil: number;
  gold: number;
}

export interface Tile {
  x: number;
  y: number;
  discovered: boolean;
  resource: ResourceType | null;
  hasTree?: boolean;
}

export enum ResourceType {
  COAL = 'COAL',
  GAS = 'GAS',
  OIL = 'OIL',
  GOLD = 'GOLD',
}

export interface GameState {
  players: Record<string, Player>;
  map: Tile[][];
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  username: string;
  score: number;
}

// Socket.io Events
export enum SocketEvents {
  JOIN_GAME = 'joinGame',
  PLAYER_MOVED = 'playerMoved',
  PLAYER_UPDATE = 'playerUpdate',
  PLAYER_DISCONNECT = 'playerDisconnect',
  COLLECT_RESOURCE = 'collectResource',
  GAME_STATE_UPDATE = 'gameStateUpdate',
  UPDATE_LEADERBOARD = 'updateLeaderboard',
  RESOURCE_REGENERATION = 'resourceRegeneration',
  MOVEMENT_BLOCKED = 'movementBlocked',
  ANNOUNCEMENT = 'announcement',
  MAP_UPDATE = 'mapUpdate',
  WORLD_CYCLE_UPDATE = 'worldCycleUpdate',
  TILE_UPDATE = 'tileUpdate'
}

export interface WorldCycleData {
  cycle: number;
  timestamp: number;
} 