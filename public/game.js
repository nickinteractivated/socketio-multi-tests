// Connect to the server
const socket = io();

// DOM elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const nicknameInput = document.getElementById('nickname-input');
const joinButton = document.getElementById('join-button');
const logoutButton = document.getElementById('logout-button');
const playerEmoji = document.getElementById('player-emoji');
const playerNickname = document.getElementById('player-nickname');
const gameGrid = document.getElementById('game-grid');
const playersListContent = document.getElementById('players-list-content');

// Stats elements
const totalScore = document.getElementById('total-score');
const totalStrawberries = document.getElementById('total-strawberries');
const totalGolden = document.getElementById('total-golden');

// Competition elements
const timeLeft = document.getElementById('time-left');
const currentLeader = document.getElementById('current-leader');

// Leaderboard element
const leaderboardContent = document.getElementById('leaderboard-content');

// Challenge elements
const createGameButton = document.getElementById('create-game-button');
const joinUrlContainer = document.getElementById('join-url-container');
const gameUrl = document.getElementById('game-url');
const copyUrlButton = document.getElementById('copy-url-button');
const challengeButton = document.getElementById('challenge-button');
const challengeUrlContainer = document.getElementById('challenge-url-container');
const challengeUrl = document.getElementById('challenge-url');
const copyChallengeButton = document.getElementById('copy-challenge-button');

// Game state
let players = {};
let myPlayerId = null;
let strawberries = [];
let currentRoom = 'main';
let playerStats = null;

// Get room ID from URL if present (for challenges)
const urlParams = new URLSearchParams(window.location.search);
const roomIdFromUrl = window.location.pathname.match(/\/play\/([^\/]+)/);
if (roomIdFromUrl && roomIdFromUrl[1]) {
    currentRoom = roomIdFromUrl[1];
}

// Check for existing session
const savedNickname = localStorage.getItem('gameNickname');
if (savedNickname) {
    nicknameInput.value = savedNickname;
    // Don't auto-join as we need to handle room joining first
}

// Format time (mm:ss)
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Create the grid
function createGrid() {
    gameGrid.innerHTML = '';
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            gameGrid.appendChild(cell);
        }
    }
}

// Update player position on the grid
function updatePlayerPosition(player) {
    // Remove player from current position if exists
    const existingPlayer = document.getElementById(`player-${player.id}`);
    if (existingPlayer) {
        existingPlayer.remove();
    }
    
    // Add player to new position
    const cell = document.querySelector(`.cell[data-x="${player.x}"][data-y="${player.y}"]`);
    if (cell) {
        const playerElement = document.createElement('div');
        playerElement.className = 'player';
        playerElement.id = `player-${player.id}`;
        
        const emojiElement = document.createElement('span');
        emojiElement.textContent = player.emoji;
        
        const nameElement = document.createElement('span');
        nameElement.className = 'player-name';
        nameElement.textContent = player.nickname;
        
        playerElement.appendChild(emojiElement);
        playerElement.appendChild(nameElement);
        cell.appendChild(playerElement);
    }
}

// Update strawberries on the grid
function renderStrawberries() {
    // Remove all existing strawberry elements
    document.querySelectorAll('.strawberry').forEach(el => el.remove());
    
    // Add strawberries to the grid
    strawberries.forEach(strawberry => {
        const cell = document.querySelector(`.cell[data-x="${strawberry.x}"][data-y="${strawberry.y}"]`);
        if (cell) {
            const strawberryElement = document.createElement('div');
            strawberryElement.className = strawberry.isGolden ? 'strawberry golden-strawberry' : 'strawberry';
            strawberryElement.id = `strawberry-${strawberry.id}`;
            strawberryElement.textContent = '🍓';
            cell.appendChild(strawberryElement);
        }
    });
}

// Update players list
function updatePlayersList() {
    playersListContent.innerHTML = '';
    Object.values(players).forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = player.isCrowned ? 'player-item crowned-player' : 'player-item';
        playerItem.innerHTML = `
            <span>${player.emoji}</span>
            <span>${player.nickname}</span>
            <span class="player-score">🍓 ${player.score || 0}</span>
        `;
        playersListContent.appendChild(playerItem);
    });
}

// Update leaderboard
function updateLeaderboard(leaderboardData) {
    leaderboardContent.innerHTML = '';
    leaderboardData.forEach((player, index) => {
        const leaderboardItem = document.createElement('div');
        leaderboardItem.className = 'leaderboard-item';
        leaderboardItem.innerHTML = `
            <span class="leaderboard-rank">${index + 1}</span>
            <span class="leaderboard-name">${player.nickname}</span>
            <span class="leaderboard-score">${player.totalScore} pts</span>
        `;
        leaderboardContent.appendChild(leaderboardItem);
    });
}

// Update competition timer
function updateCompetitionTimer(timeLeftMs) {
    timeLeft.textContent = formatTime(timeLeftMs);
}

// Update player stats
function updatePlayerStats(stats) {
    if (!stats) return;
    
    totalScore.textContent = stats.totalScore;
    totalStrawberries.textContent = stats.totalStrawberries;
    totalGolden.textContent = stats.totalGoldenStrawberries;
}

// Create a score popup
function createScorePopup(x, y, points, isGolden) {
    const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
    if (cell) {
        const popup = document.createElement('div');
        popup.className = isGolden ? 'score-popup golden-score' : 'score-popup';
        popup.textContent = `+${points}`;
        cell.appendChild(popup);
        
        // Remove popup after animation completes
        setTimeout(() => {
            popup.remove();
        }, 1000);
    }
}

// Copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Generate game URL
function generateGameUrl(roomId) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/play/${roomId}`;
}

// Join game with current nickname and room
function joinGame() {
    const nickname = nicknameInput.value.trim();
    if (nickname) {
        // Save nickname to localStorage
        localStorage.setItem('gameNickname', nickname);
        
        // Join with nickname and room
        socket.emit('join', {
            nickname: nickname,
            roomId: currentRoom
        });
    }
}

// Handle join button click
joinButton.addEventListener('click', () => {
    joinGame();
});

// Handle create game button click
createGameButton.addEventListener('click', () => {
    socket.emit('createGame');
});

// Handle challenge button click (in-game)
challengeButton.addEventListener('click', () => {
    socket.emit('createGame');
});

// Handle copy URL buttons
copyUrlButton.addEventListener('click', () => {
    copyToClipboard(gameUrl.value);
});

copyChallengeButton.addEventListener('click', () => {
    copyToClipboard(challengeUrl.value);
});

// Handle logout
logoutButton.addEventListener('click', () => {
    // Clear session
    localStorage.removeItem('gameNickname');
    
    // Reset UI
    loginScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    nicknameInput.value = '';
    joinUrlContainer.classList.add('hidden');
    
    // Clear game state
    players = {};
    myPlayerId = null;
    strawberries = [];
    
    // Disconnect and reconnect socket
    socket.disconnect();
    socket.connect();
    
    // Reset to main room
    currentRoom = 'main';
    
    // Redirect to main page if on a room URL
    if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
    }
});

// Handle key presses for movement
document.addEventListener('keydown', (e) => {
    if (!myPlayerId) return;
    
    const key = e.key.toUpperCase();
    if (['W', 'A', 'S', 'D'].includes(key)) {
        socket.emit('move', key);
    }
});

// Socket event handlers
socket.on('init', (data) => {
    myPlayerId = data.player.id;
    players[data.player.id] = data.player;
    strawberries = data.strawberries;
    playerStats = data.stats;
    
    // Update UI
    playerEmoji.textContent = data.player.emoji;
    playerNickname.textContent = data.player.nickname;
    
    // Update player stats
    updatePlayerStats(data.stats);
    
    // Update leaderboard
    if (data.leaderboard) {
        updateLeaderboard(data.leaderboard);
    }
    
    // Update hourly competition
    if (data.hourlyCompetition) {
        updateCompetitionTimer(data.hourlyCompetition.timeLeft);
        if (data.hourlyCompetition.currentWinner) {
            currentLeader.textContent = `${data.hourlyCompetition.currentWinner.nickname} (${data.hourlyCompetition.currentWinner.score})`;
        } else {
            currentLeader.textContent = 'None';
        }
    }
    
    // Switch to game screen
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Create grid
    createGrid();
    
    // Render strawberries
    renderStrawberries();
    
    // Position player
    updatePlayerPosition(data.player);
    updatePlayersList();
});

socket.on('playerJoined', (player) => {
    players[player.id] = player;
    updatePlayerPosition(player);
    updatePlayersList();
});

socket.on('playerMoved', (data) => {
    if (players[data.id]) {
        players[data.id].x = data.x;
        players[data.id].y = data.y;
        updatePlayerPosition(players[data.id]);
    }
});

socket.on('strawberrySpawned', (strawberry) => {
    strawberries.push(strawberry);
    renderStrawberries();
});

socket.on('strawberryRemoved', (strawberryId) => {
    // Remove from list without animation
    strawberries = strawberries.filter(s => s.id !== strawberryId);
    renderStrawberries();
});

socket.on('strawberryCollected', (data) => {
    // Find strawberry element and animate it before removing
    const strawberryElement = document.getElementById(`strawberry-${data.strawberryId}`);
    if (strawberryElement) {
        // Add collection animation class
        strawberryElement.classList.add('strawberry-collected');
        
        // Show score popup
        const strawberry = strawberries.find(s => s.id === data.strawberryId);
        if (strawberry) {
            createScorePopup(strawberry.x, strawberry.y, data.isGolden ? 3 : 1, data.isGolden);
        }
        
        // Remove after animation completes
        setTimeout(() => {
            // Remove from list
            strawberries = strawberries.filter(s => s.id !== data.strawberryId);
            // Re-render all strawberries
            renderStrawberries();
        }, 500); // Animation duration
    } else {
        // Fallback if element not found
        strawberries = strawberries.filter(s => s.id !== data.strawberryId);
        renderStrawberries();
    }
    
    // Update player score
    if (players[data.playerId]) {
        players[data.playerId].score = data.newScore;
        updatePlayersList();
    }
    
    // Update player stats if it was our collection
    if (data.playerId === myPlayerId && playerStats) {
        if (data.isGolden) {
            playerStats.totalGoldenStrawberries++;
            playerStats.totalScore += 3;
        } else {
            playerStats.totalStrawberries++;
            playerStats.totalScore += 1;
        }
        updatePlayerStats(playerStats);
    }
});

socket.on('playerLeft', (playerId) => {
    const playerElement = document.getElementById(`player-${playerId}`);
    if (playerElement) {
        playerElement.remove();
    }
    delete players[playerId];
    updatePlayersList();
});

socket.on('leaderboardUpdate', (leaderboard) => {
    updateLeaderboard(leaderboard);
});

socket.on('hourlyUpdate', (data) => {
    updateCompetitionTimer(data.timeLeft);
    if (data.currentWinner) {
        currentLeader.textContent = `${data.currentWinner.nickname} (${data.currentWinner.score})`;
    } else {
        currentLeader.textContent = 'None';
    }
});

socket.on('hourlyWinner', (data) => {
    if (data.nickname) {
        alert(`🏆 ${data.nickname} won the hourly competition with ${data.score} points! 🏆`);
        
        // Update crowned status
        Object.values(players).forEach(player => {
            player.isCrowned = player.nickname === data.nickname;
        });
        updatePlayersList();
    }
});

socket.on('gameCreated', (data) => {
    const url = generateGameUrl(data.roomId);
    
    // Update UI based on which button was clicked
    if (gameScreen.classList.contains('hidden')) {
        // If we're on the login screen
        gameUrl.value = url;
        joinUrlContainer.classList.remove('hidden');
    } else {
        // If we're in-game creating a challenge
        challengeUrl.value = url;
        challengeUrlContainer.classList.remove('hidden');
    }
    
    // Update currentRoom (but don't join yet)
    currentRoom = data.roomId;
});

// Add enter key support for the nickname input
nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        joinButton.click();
    }
});

// Auto-join if we have a saved nickname and are in a specific room
if (savedNickname && currentRoom !== 'main') {
    joinGame();
} else if (savedNickname) {
    // Auto-join main room if we have a nickname and no specific room
    joinButton.click();
} 