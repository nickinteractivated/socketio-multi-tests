import { Player } from '../types/GameTypes';

interface PlayerStatsProps {
  player: Player | null;
}

export default function PlayerStats({ player }: PlayerStatsProps) {
  if (!player) {
    return <div className="p-4 bg-gray-800 rounded-lg">Not connected</div>;
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <div className="mb-2">
        <h3 className="text-xl font-bold">{player.username}</h3>
        <p className="text-sm text-gray-400">ID: {player.id.slice(0, 8)}...</p>
        <p className="mt-1 text-sm text-gray-300">Position: ({player.position.x}, {player.position.y})</p>
      </div>
      
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-1">Score: {player.score}</h3>
        
        <div className="mt-3">
          <h4 className="text-md font-medium mb-2">Resources:</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center p-2 bg-gray-700 rounded">
              <div className="w-6 h-6 bg-gray-900 rounded-full mb-1 flex items-center justify-center">
                <span className="block w-4 h-4 bg-[#333333] rounded-full"></span>
              </div>
              <span className="text-xs">Coal: {player.resources.coal}</span>
            </div>
            
            <div className="flex flex-col items-center p-2 bg-gray-700 rounded">
              <div className="w-6 h-6 bg-gray-900 rounded-full mb-1 flex items-center justify-center">
                <span className="block w-4 h-4 bg-[#8cc9c9] rounded-full"></span>
              </div>
              <span className="text-xs">Gas: {player.resources.gas}</span>
            </div>
            
            <div className="flex flex-col items-center p-2 bg-gray-700 rounded">
              <div className="w-6 h-6 bg-gray-900 rounded-full mb-1 flex items-center justify-center">
                <span className="block w-4 h-4 bg-[#2d2d2d] rounded-full"></span>
              </div>
              <span className="text-xs">Oil: {player.resources.oil}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 