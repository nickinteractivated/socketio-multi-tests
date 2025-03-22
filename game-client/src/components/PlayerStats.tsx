import { Player } from '../types/GameTypes';

interface PlayerStatsProps {
    player: Player | null;
}

export default function PlayerStats({ player }: PlayerStatsProps) {
    if (!player) {
        return <div>Not connected</div>
    }

    return (
        <div>
            <div>
                <h3>Welcome, {player.username}!</h3>
                <p>X:{player.position.x} — Y:{player.position.y}</p>
            </div>
            <div>
                <h4>Resources:</h4>
                <div>
                    <div>Coal — {player.resources.coal}</div>
                    <div>Gas — {player.resources.gas}</div>
                    <div>Oil — {player.resources.oil}</div>
                </div>
            </div>
        </div>
    );
} 