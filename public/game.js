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

// Game state
let players = {};
let myPlayerId = null;

// Check for existing session
const savedNickname = localStorage.getItem('gameNickname');
if (savedNickname) {
    nicknameInput.value = savedNickname;
    joinButton.click();
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

// Update players list
function updatePlayersList() {
    playersListContent.innerHTML = '';
    Object.values(players).forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span>${player.emoji}</span>
            <span>${player.nickname}</span>
        `;
        playersListContent.appendChild(playerItem);
    });
}

// Handle join button click
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (nickname) {
        // Save nickname to localStorage
        localStorage.setItem('gameNickname', nickname);
        socket.emit('join', nickname);
    }
});

// Handle logout
logoutButton.addEventListener('click', () => {
    // Clear session
    localStorage.removeItem('gameNickname');
    
    // Reset UI
    loginScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    nicknameInput.value = '';
    
    // Clear game state
    players = {};
    myPlayerId = null;
    
    // Disconnect and reconnect socket
    socket.disconnect();
    socket.connect();
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
socket.on('init', (player) => {
    myPlayerId = player.id;
    players[player.id] = player;
    
    // Update UI
    playerEmoji.textContent = player.emoji;
    playerNickname.textContent = player.nickname;
    
    // Switch to game screen
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Create grid
    createGrid();
    
    // Position player
    updatePlayerPosition(player);
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

socket.on('playerLeft', (playerId) => {
    const playerElement = document.getElementById(`player-${playerId}`);
    if (playerElement) {
        playerElement.remove();
    }
    delete players[playerId];
    updatePlayersList();
});

// Add enter key support for the nickname input
nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        joinButton.click();
    }
}); 