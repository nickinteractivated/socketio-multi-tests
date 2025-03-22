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
                <div>
                    {entries.map((entry, index) => (
                        <div
                            key={entry.username}
                        >
                            <div>
                                <span>
                                    {index + 1}
                                </span>
                                <span>{entry.username}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 