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
  GAME_STATE_UPDATE = 'gameStateUpdate',
  COLLECT_RESOURCE = 'collectResource',
  PLAYER_DISCONNECT = 'playerDisconnect',
  UPDATE_LEADERBOARD = 'updateLeaderboard',
  RESOURCE_REGENERATION = 'resourceRegenerationAnnouncement',
  WORLD_CYCLE_UPDATE = 'worldCycleUpdate',
  ANNOUNCEMENT = 'announcement',
  PLAYER_UPDATE = 'playerUpdate',
  MAP_UPDATE = 'mapUpdate',
  MOVEMENT_BLOCKED = 'movementBlocked',
  BLOCK_MOVEMENT = 'blockMovement'
}

export interface WorldCycleData {
  cycle: number;
  timestamp: number;
} 