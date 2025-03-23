import { useRef, useEffect, useMemo } from 'react';
import { Tile, Player, Position, ResourceType } from '../types/GameTypes';

interface GameMapProps {
    map: Tile[][];
    players: Record<string, Player>;
    currentPlayerId: string;
    onMove: (position: Position) => void;
}

export default function GameMap({ map, players, currentPlayerId, onMove }: GameMapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tileSize = 22; // Size of each tile in pixels

    // Get current player position
    const currentPlayer = players[currentPlayerId];

    // Calculate canvas dimensions using useMemo to prevent unnecessary recalculations
    const { mapWidth, mapHeight, canvasWidth, canvasHeight } = useMemo(() => {
        const width = map[0]?.length || 0;
        const height = map.length || 0;
        return {
            mapWidth: width,
            mapHeight: height,
            canvasWidth: width * tileSize,
            canvasHeight: height * tileSize
        };
    }, [map, tileSize]);

    // Handle keyboard movement
    useEffect(() => {
        if (!currentPlayer) return;

        // Track which keys are currently pressed
        const pressedKeys = new Set<string>();
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!currentPlayer) return;
            
            // Prevent default behavior (e.g., scrolling)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
                e.preventDefault();
            }
            
            // Add key to pressed keys
            pressedKeys.add(e.key);
            
            // Only process if we don't already have a movement key pressed
            if (pressedKeys.size === 1) {
                const currentX = currentPlayer.position.x;
                const currentY = currentPlayer.position.y;
                let newX = currentX;
                let newY = currentY;

                // Handle different key controls - only allow orthogonal movement
                switch (e.key) {
                    // Arrow keys
                    case 'ArrowUp':
                        newY = currentY - 1;
                        break;
                    case 'ArrowDown':
                        newY = currentY + 1;
                        break;
                    case 'ArrowLeft':
                        newX = currentX - 1;
                        break;
                    case 'ArrowRight':
                        newX = currentX + 1;
                        break;

                    // WASD keys
                    case 'w':
                    case 'W':
                        newY = currentY - 1;
                        break;
                    case 's':
                    case 'S':
                        newY = currentY + 1;
                        break;
                    case 'a':
                    case 'A':
                        newX = currentX - 1;
                        break;
                    case 'd':
                    case 'D':
                        newX = currentX + 1;
                        break;
                    default:
                        return; // If not a movement key, exit early
                }

                // Validate movement within map boundaries
                if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
                    onMove({ x: newX, y: newY });
                }
            }
        };
        
        const handleKeyUp = (e: KeyboardEvent) => {
            // Remove key from pressed keys
            pressedKeys.delete(e.key);
        };

        // Add event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [currentPlayer, mapWidth, mapHeight, onMove]);

    // Optimize rendering with useMemo to avoid excessive re-renders
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !map.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Clear only the size we're actually using
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Create a separate drawing function that is carefully optimized
        const drawMap = () => {
            // Draw tiles
            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    const tile = map[y][x];
                    
                    if (!tile) continue; // Skip if tile doesn't exist

                    if (!tile.discovered) {
                        // Draw fog of war
                        ctx.fillStyle = '#111111';
                        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    } else {
                        // Draw discovered tile
                        ctx.fillStyle = '#285e45'; // Base tile color (grass)
                        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

                        // Draw tile border
                        ctx.strokeStyle = '#193324';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);

                        // Draw tree if present
                        if (tile.hasTree) {
                            // Draw tree trunk (brown rectangle)
                            ctx.fillStyle = '#6b4226'; // Tree trunk brown
                            ctx.fillRect(
                                x * tileSize + tileSize / 2 - 2, 
                                y * tileSize + tileSize / 2, 
                                4, 
                                tileSize / 2 - 2
                            );
                            
                            // Draw tree foliage (green circle)
                            ctx.fillStyle = '#1d4120'; // Dark green for leaves
                            ctx.beginPath();
                            ctx.arc(
                                x * tileSize + tileSize / 2,
                                y * tileSize + tileSize / 3,
                                tileSize / 3, // Radius
                                0,
                                2 * Math.PI
                            );
                            ctx.fill();
                            
                            // Add some lighter green highlights
                            ctx.fillStyle = '#2a5a2a'; // Lighter green
                            ctx.beginPath();
                            ctx.arc(
                                x * tileSize + tileSize / 2 - 2,
                                y * tileSize + tileSize / 3 - 2,
                                tileSize / 5, // Smaller radius
                                0,
                                2 * Math.PI
                            );
                            ctx.fill();
                        }

                        // Draw resource if present
                        if (tile.resource) {
                            let resourceColor;
                            switch (tile.resource) {
                                case ResourceType.COAL:
                                    resourceColor = '#333333'; // Dark gray for coal
                                    break;
                                case ResourceType.GAS:
                                    resourceColor = '#8cc9c9'; // Light blue for gas
                                    break;
                                case ResourceType.OIL:
                                    resourceColor = '#111111'; // Black for oil
                                    break;
                                case ResourceType.GOLD:
                                    resourceColor = '#FFD700'; // Gold color
                                    break;
                                default:
                                    resourceColor = '#ffffff';
                            }

                            // Draw resource icon
                            ctx.fillStyle = resourceColor;
                            ctx.beginPath();
                            
                            // Make gold resources slightly larger than other resources
                            const radius = tile.resource === ResourceType.GOLD ? 
                                tileSize / 3.5 : // Larger radius for gold
                                tileSize / 4;    // Regular radius for other resources
                                
                            ctx.arc(
                                x * tileSize + tileSize / 2,
                                y * tileSize + tileSize / 2,
                                radius,
                                0,
                                2 * Math.PI
                            );
                            ctx.fill();
                            
                            // Add a simple border for gold resources instead of complex effects
                            if (tile.resource === ResourceType.GOLD) {
                                ctx.strokeStyle = '#FFA500'; // Orange border
                                ctx.lineWidth = 2;
                                ctx.stroke();
                            }
                        }
                    }
                }
            }
        };

        // Draw the map
        drawMap();

        // Draw players - moved after map so players are always on top
        Object.values(players).forEach(player => {
            const { x, y } = player.position;
            
            // Skip drawing players that are outside visible area (happens during regeneration)
            if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return;

            // Draw player circle
            ctx.fillStyle = player.id === currentPlayerId ? '#ff6b6b' : '#4dabf7';
            ctx.beginPath();
            ctx.arc(
                x * tileSize + tileSize / 2,
                y * tileSize + tileSize / 2,
                tileSize / 3, // Radius
                0,
                2 * Math.PI
            );
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw player name
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.username, x * tileSize + tileSize / 2, y * tileSize - 5);
        });
    }, [map, players, currentPlayerId, canvasWidth, canvasHeight, mapWidth, mapHeight]);

    // Handle canvas click for player movement
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!currentPlayer) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        const tileX = Math.floor(clickX / tileSize);
        const tileY = Math.floor(clickY / tileSize);

        // Check if movement is valid (adjacent tile)
        const currentX = currentPlayer.position.x;
        const currentY = currentPlayer.position.y;

        const isAdjacent =
            (Math.abs(tileX - currentX) <= 1 && Math.abs(tileY - currentY) <= 1) &&
            (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight);

        if (isAdjacent) {
            onMove({ x: tileX, y: tileY });
        }
    };

    return (
        <div className="">
            <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onClick={handleCanvasClick}
                className="game-map-canvas"
                tabIndex={0} // Make canvas focusable for keyboard events
            />
        </div>
    );
} 