# Simple Multiplayer Emoji Game

A simple multiplayer game where users can join with a nickname, get assigned an emoji, and move around a 16x16 grid.

## Features

- Join with a nickname
- Get assigned a random emoji (car-themed)
- Move around a 16x16 grid using WASD keys
- See other players in real-time
- All players are in a single global instance

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed
2. Clone this repository
3. Install dependencies:
   ```
   npm install
   ```

## Running the Game

Start the server:

```
npm start
```

The game will be available at http://localhost:3000

## Development

For development with auto-restart:

```
npm install nodemon -g
npm run dev
```

## How to Play

1. Open the game in your browser
2. Enter your nickname
3. Click "Join Game" or press Enter
4. Use WASD keys to move around
5. See other players moving in real-time

## Technologies Used

- Node.js & Express for the server
- Socket.IO for real-time communication
- Plain JavaScript, HTML, and CSS for the frontend 