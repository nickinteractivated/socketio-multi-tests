import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Position, SocketEvents } from '../types/GameTypes';
import GameMap from './GameMap';
import PlayerStats from './PlayerStats';
import Leaderboard from './Leaderboard';
import PlayerList from './PlayerList';

interface GameProps {
    username: string;
    onLogout: () => void;
}

// Server URL
const SERVER_URL = 'http://localhost:3001';

export default function Game({ username, onLogout }: GameProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<GameState>({
        players: {},
        map: [],
        leaderboard: []
    });
    const [playerId, setPlayerId] = useState<string>('');
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(SERVER_URL);

        // Set up event listeners
        newSocket.on('connect', () => {
            setSocket(newSocket);
            setPlayerId(newSocket.id || '');
            setConnected(true);
            setError(null);

            // Join the game with username
            newSocket.emit(SocketEvents.JOIN_GAME, username);
        });

        newSocket.on('connect_error', () => {
            setError('Failed to connect to server');
            setConnected(false);
        });

        newSocket.on('disconnect', () => {
            setConnected(false);
            setError('Disconnected from server');
        });

        // Game state updates
        newSocket.on(SocketEvents.GAME_STATE_UPDATE, (state: GameState) => {
            setGameState(state);
        });

        // Leaderboard updates
        newSocket.on(SocketEvents.UPDATE_LEADERBOARD, (leaderboard) => {
            setGameState(prev => ({ ...prev, leaderboard }));
        });

        // Cleanup on unmount
        return () => {
            newSocket.disconnect();
        };
    }, [username]);

    // Handle player movement
    const handleMove = (position: Position) => {
        if (socket && connected) {
            socket.emit(SocketEvents.PLAYER_MOVED, position);
        }
    };

    // Handle logout
    const handleLogout = () => {
        if (socket) {
            socket.disconnect();
        }
        onLogout();
    };

    if (error) {
        return (
            <div className="app-container">
                <div className="container">
                    <div className="flex justify-center items-center" style={{ height: '100vh' }}>
                        <div className="bg-gray-900 p-4 rounded-lg text-white" style={{ maxWidth: '400px', textAlign: 'center' }}>
                            <h2 className="text-2xl font-bold mb-4">Connection Error</h2>
                            <p className="mb-6" style={{ color: '#f87171' }}>{error}</p>
                            <button
                                onClick={handleLogout}
                                className="bg-blue-600 p-4 rounded"
                                style={{ cursor: 'pointer' }}
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="">
                {/* Header with logout button */}
                <div className="flex">
                    <span className="game-title">⚡️ Computation Hunter</span>
                    <button
                        onClick={handleLogout}
                        className="logout-button"
                    >
                        Logout
                    </button>
                </div>

                {/* Main game layout - sidebar left, map right */}
                <div className="main-game-layout">
                    {/* Sidebar with stats and info - fixed width */}
                    <div className="">
                        {/* Player stats */}
                        <PlayerStats player={playerId ? gameState.players[playerId] : null} />

                        {/* Leaderboard */}
                        <Leaderboard entries={gameState.leaderboard} />

                        {/* Online players */}
                        <PlayerList players={gameState.players} currentPlayerId={playerId} />
                    </div>

                    {/* Game map - flexible width */}
                    <div className="">
                        <GameMap
                            map={gameState.map}
                            players={gameState.players}
                            currentPlayerId={playerId}
                            onMove={handleMove}
                        />
                    </div>

                    <div>
                        <p className="text-sm text-gray-400">
                            Use <span className="text-white">WASD</span> or <span className="text-white">arrow keys</span> to move.
                            Click on adjacent tiles also works. Collect resources to earn points.
                        </p>

                        <div className="resource-legend">
                            <div className="resource-item">
                                <span className="resource-dot resource-coal"></span>
                                <span>Coal</span>
                            </div>
                            <div className="resource-item">
                                <span className="resource-dot resource-gas"></span>
                                <span>Gas</span>
                            </div>
                            <div className="resource-item">
                                <span className="resource-dot resource-oil"></span>
                                <span>Oil</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 