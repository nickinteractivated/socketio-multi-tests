import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Position, SocketEvents, Player, Resources, WorldCycleData, Tile } from '../types/GameTypes';
import GameMap from './GameMap';
import PlayerStats from './PlayerStats';
import Leaderboard from './Leaderboard';
import PlayerList from './PlayerList';

interface GameProps {
    username: string;
    onLogout: () => void;
}

// Server URL
const SERVER_URL = 'https://socketio-multi-tests-production.up.railway.app/';

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
    const [regenerationMessage, setRegenerationMessage] = useState<string | null>(null);
    // const [blockMessage, setBlockMessage] = useState<string | null>(null);
    const [restoredMessage, setRestoredMessage] = useState<string | null>(null);
    const [resetMessage, setResetMessage] = useState<string | null>(null);
    const [worldCycle, setWorldCycle] = useState<WorldCycleData>({ cycle: 1, timestamp: Date.now() });
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
    const [lastMovementTime, setLastMovementTime] = useState<number>(0);
    const MOVEMENT_THROTTLE = 100; // Minimum ms between movement requests

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(SERVER_URL, {
            withCredentials: true,
            extraHeaders: {
                "my-custom-header": "value"
            },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000 // Increase connection timeout
        });

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

        // Handle login errors
        newSocket.on('loginError', (data: { message: string }) => {
            setError(data.message);
            // Disconnect and trigger logout after a short delay
            setTimeout(() => {
                newSocket.disconnect();
                onLogout();
            }, 3000);
        });

        // Handle data restoration notification
        newSocket.on('dataRestored', (data: { message: string, score: number, resources: Resources }) => {
            setRestoredMessage(data.message);
            console.log('Player data restored:', data);

            // Clear the message after some time
            setTimeout(() => {
                setRestoredMessage(null);
            }, 5000);
        });

        // Game state updates
        newSocket.on(SocketEvents.GAME_STATE_UPDATE, (state: GameState) => {
            console.log('Received game state update');

            // Check if map was updated with resources
            if (state.map) {
                let resourceCount = 0;
                state.map.forEach(row => {
                    row.forEach(tile => {
                        if (tile.resource) resourceCount++;
                    });
                });
                console.log(`Map update received with ${resourceCount} resources`);
            }

            setGameState(prevState => {
                // If we only got partial state, merge it with existing state
                return {
                    players: state.players || prevState.players,
                    map: state.map || prevState.map,
                    leaderboard: state.leaderboard || prevState.leaderboard
                };
            });
        });

        // Handle resource collection
        newSocket.on(SocketEvents.COLLECT_RESOURCE, (data: { position: Position, player: Player }) => {
            console.log("Resource collected at", data.position);
            // Update the player data
            setGameState(prev => {
                const newPlayers = { ...prev.players };
                newPlayers[data.player.id] = data.player;
                return {
                    ...prev,
                    players: newPlayers
                };
            });
        });

        // Leaderboard updates
        newSocket.on(SocketEvents.UPDATE_LEADERBOARD, (leaderboard) => {
            setGameState(prev => ({ ...prev, leaderboard }));
        });

        // Resource regeneration announcement
        newSocket.on(SocketEvents.RESOURCE_REGENERATION, (data: { message: string }) => {
            setRegenerationMessage(data.message);

            // Clear the message after the regeneration occurs
            setTimeout(() => {
                setRegenerationMessage(null);
            }, 5000); // Show message for 5 seconds
        });

        // Handle announcements
        newSocket.on(SocketEvents.ANNOUNCEMENT, (data: { message: string }) => {
            setRegenerationMessage(data.message);

            // Clear the message after a delay
            setTimeout(() => {
                setRegenerationMessage(null);
            }, 5000);
        });

        // Handle specific map updates
        newSocket.on(SocketEvents.MAP_UPDATE, (map: Tile[][]) => {
            console.log('Received direct map update');
            setGameState(prev => ({
                ...prev,
                map: map
            }));
        });

        // Handle individual tile updates for better performance
        newSocket.on(SocketEvents.TILE_UPDATE, (data: {x: number, y: number, tile: Tile}) => {
            // Update just the single tile instead of the whole map
            setGameState(prev => {
                if (!prev.map || prev.map.length === 0 || !prev.map[data.y] || !prev.map[data.y][data.x]) {
                    return prev;
                }
                
                // Create new map with the updated tile
                const newMap = [...prev.map];
                newMap[data.y] = [...newMap[data.y]];
                newMap[data.y][data.x] = data.tile;
                
                return {
                    ...prev,
                    map: newMap
                };
            });
        });

        // Handle player updates for better performance
        newSocket.on(SocketEvents.PLAYER_UPDATE, (player: Player) => {
            setGameState(prev => {
                const newPlayers = {...prev.players};
                newPlayers[player.id] = player;
                
                return {
                    ...prev,
                    players: newPlayers
                };
            });
        });

        // Handle server reset notification
        newSocket.on('serverReset', (data: { message: string }) => {
            setResetMessage(data.message);

            // Disconnect and redirect to login after a short delay
            setTimeout(() => {
                newSocket.disconnect();
                onLogout();
            }, 3000);
        });

        // Handle world cycle updates
        newSocket.on(SocketEvents.WORLD_CYCLE_UPDATE, (data: WorldCycleData) => {
            console.log(`World Cycle updated to: Cycle #${data.cycle}`);
            setWorldCycle(data);
        });

        // Handle account deleted notification
        newSocket.on('accountDeleted', (data: { message: string }) => {
            setDeleteMessage(data.message);

            // Disconnect and redirect to login after a short delay
            setTimeout(() => {
                newSocket.disconnect();
                onLogout();
            }, 3000);
        });

        // Cleanup on unmount
        return () => {
            newSocket.disconnect();
        };
    }, [username, onLogout]);

    // Handle player movement with throttling to prevent excessive updates
    const handleMove = (position: Position) => {
        if (socket && connected) {
            const now = Date.now();
            // Throttle movement requests to prevent flooding the server
            if (now - lastMovementTime > MOVEMENT_THROTTLE) {
                socket.emit(SocketEvents.PLAYER_MOVED, position);
                setLastMovementTime(now);
                
                // Apply client-side prediction immediately for smoother experience
                if (playerId && gameState.players[playerId]) {
                    const updatedPlayers = {...gameState.players};
                    const player = {...updatedPlayers[playerId]};
                    player.position = position;
                    updatedPlayers[playerId] = player;
                    
                    setGameState(prev => ({
                        ...prev,
                        players: updatedPlayers
                    }));
                }
            }
        }
    };

    // Handle logout
    const handleLogout = () => {
        if (socket) {
            socket.disconnect();
        }
        // Clear the stored username from localStorage
        localStorage.removeItem('gameUsername');
        onLogout();
    };

    // Handle account deletion
    const handleDeleteAccount = async () => {
        if (!username) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/deleteAccount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });

            const data = await response.json();

            if (data.success) {
                setDeleteMessage("Account successfully deleted. Returning to login...");
                setTimeout(() => {
                    if (socket) socket.disconnect();
                    onLogout();
                }, 2000);
            } else {
                setDeleteMessage(`Error: ${data.message}`);
                setTimeout(() => {
                    setDeleteMessage(null);
                }, 3000);
            }
        } catch (error) {
            console.error("Error deleting account:", error);
            setDeleteMessage("Failed to delete account. Server may be unavailable.");
            setTimeout(() => {
                setDeleteMessage(null);
            }, 3000);
        }

        // Close confirmation dialog
        setIsDeleteConfirmOpen(false);
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
                {/* Header with logout button and world cycle */}
                <div className="flex">
                    <span className="game-title">⚡️ Computation Hunter</span>
                    {worldCycle && (
                        <span className="world-cycle">World Cycle: {worldCycle.cycle}</span>
                    )}
                    <button
                        onClick={handleLogout}
                        className="logout-button"
                    >
                        Logout
                    </button>
                    <button
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="delete-account-button"
                    >
                        Delete Account
                    </button>
                </div>

                {/* Delete account confirmation dialog */}
                {isDeleteConfirmOpen && (
                    <div className="delete-confirmation-overlay">
                        <div className="delete-confirmation-dialog">
                            <h3>Delete Account</h3>
                            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
                            <div className="delete-confirmation-buttons">
                                <button
                                    onClick={handleDeleteAccount}
                                    className="confirm-delete-button"
                                >
                                    Yes, Delete My Account
                                </button>
                                <button
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    className="cancel-delete-button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete feedback message */}
                {deleteMessage && (
                    <div className="delete-message">
                        <p>{deleteMessage}</p>
                    </div>
                )}

                {/* Server reset message - highest priority */}
                {resetMessage && (
                    <div className="server-reset-message">
                        <p>{resetMessage}</p>
                    </div>
                )}

                {/* Restored data message */}
                {restoredMessage && !resetMessage && (
                    <div className="data-restored-message">
                        <p>{restoredMessage}</p>
                    </div>
                )}

                {/* Regeneration announcement */}
                {regenerationMessage && !resetMessage && (
                    <div className="regeneration-announcement">
                        <p>{regenerationMessage}</p>
                    </div>
                )}

                {/* Main game layout - sidebar left, map right */}
                <div className="main-game-layout">
                    {/* Sidebar with stats and info - fixed width */}
                    <div className="">
                        <PlayerStats player={playerId ? gameState.players[playerId] : null} />
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
                                {/* <span className="resource-dot resource-coal"></span> */}
                                <span>Coal <div className='coal-circle'></div>1 point</span>
                            </div>
                            <div className="resource-item">
                                {/* <span className="resource-dot resource-gas"></span> */}
                                <span>Gas <div className='gas-circle'></div>2 points</span>
                            </div>
                            <div className="resource-item">
                                <span>Oil <div className='oil-circle'></div> 3 points</span>
                            </div>
                            <div className="resource-item">
                                <span>Gold <div className='gold-circle'></div> 5 points</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 