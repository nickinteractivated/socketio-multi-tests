# Resource Hunter Game

A real-time multiplayer resource collection game built with React, Node.js, Socket.io, and TypeScript.

## Features

- Real-time multiplayer gameplay
- Resource collection mechanics
- Live leaderboard
- Interactive 2D map with fog of war
- Player tracking
- Resource gathering and scoring

## Project Structure

- `game-client/` - React frontend application
- `game-server/` - Node.js backend server
- `shared/` - Shared TypeScript types

## Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Server Setup

1. Navigate to the server directory:
   ```
   cd game-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm run dev
   ```

The server will run on http://localhost:3001.

### Client Setup

1. Navigate to the client directory:
   ```
   cd game-client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The client will run on http://localhost:5173 (or another port if 5173 is in use).

## How to Play

1. Enter your username on the login screen.
2. Explore the map by clicking on adjacent tiles to move.
3. Collect resources (Coal, Gas, Oil) by moving onto tiles containing them.
4. Watch your score increase based on the resources you collect.
5. View the leaderboard to see how you compare to other players.

## Resource Values

- Coal: 1 point
- Gas: 2 points
- Oil: 3 points

## License

MIT 