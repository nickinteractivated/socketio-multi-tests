import { LeaderboardEntry } from '../types/GameTypes';

interface LeaderboardProps {
    entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
    // Get only the top 10 players
    const topPlayers = entries.slice(0, 10);
    
    return (
        <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-xl font-bold text-white mb-4">Top Players</h3>

            {entries.length === 0 ? (
                <p className="text-gray-400 text-center">No players yet</p>
            ) : (
                <div>
                    {topPlayers.map((entry, index) => (
                        <div
                            key={entry.username}
                            className="flex justify-between items-center mb-2 p-2 bg-gray-700 rounded"
                        >
                            <div className="flex items-center">
                                <span className="text-gray-400 mr-2 w-6 text-center">
                                    {index + 1}
                                </span>
                                <span className="text-white">{entry.username}</span>
                            </div>
                            <span className="text-green-400 font-bold">{entry.score}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 