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
                <p>X:{player.position.x}, Y:{player.position.y}</p>
            </div>
            <div>
                <h4>Resources:</h4>
                <div>
                    <div className='flex items-center'>Coal <div className='coal-circle'></div> — {player.resources.coal} ({player.resources.coal * 1} points)</div>
                    <div className='flex items-center'>Gas <div className='gas-circle'></div> — {player.resources.gas} ({player.resources.gas * 2} points)</div>
                    <div className='flex items-center'>Oil <div className='oil-circle'></div> — {player.resources.oil} ({player.resources.oil * 3} points)</div>
                    <div className='flex items-center'>Gold <div className='gold-circle'></div> — {player.resources.gold} ({player.resources.gold * 5} points)</div>
                </div>
            </div>
        </div>
    );
} 