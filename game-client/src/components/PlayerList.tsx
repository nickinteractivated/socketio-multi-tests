import { Player } from '../types/GameTypes';

interface PlayerListProps {
  players: Record<string, Player>;
  currentPlayerId: string;
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xl font-bold text-white mb-4">Online ({Object.keys(players).length})</h3>
      
      {Object.keys(players).length === 0 ? (
        <p className="text-gray-400 text-center">No players connected</p>
      ) : (
        <div className="space-y-2">
          {Object.values(players).map((player) => (
            <div 
              key={player.id} 
              className={`flex justify-between items-center p-2 rounded ${
                player.id === currentPlayerId ? 'bg-blue-800' : 'bg-gray-700'
              } text-white`}
            >
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span className="font-medium">{player.username}</span>
                {player.id === currentPlayerId && (
                  <span className="ml-2 text-xs bg-blue-600 px-1 rounded"> (You)</span>
                )}
              </div>
              <span className="text-sm text-gray-300">Score: {player.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 