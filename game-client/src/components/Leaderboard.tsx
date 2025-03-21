import { LeaderboardEntry } from '../types/GameTypes';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xl font-bold text-white mb-4">Top Players</h3>
      
      {entries.length === 0 ? (
        <p className="text-gray-400 text-center">No players yet</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div 
              key={entry.username} 
              className="flex justify-between items-center p-2 rounded bg-gray-700 text-white"
            >
              <div className="flex items-center">
                <span className="bg-blue-600 text-xs w-5 h-5 rounded-full flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="font-medium">{entry.username}</span>
              </div>
              <span className="font-bold">{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 