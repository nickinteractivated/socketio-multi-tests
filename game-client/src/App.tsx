import { useState } from 'react'
import Login from './components/Login'
import Game from './components/Game'
// import './App.css'

function App() {
  const [username, setUsername] = useState<string | null>(() => {
    // Initialize username from localStorage
    return localStorage.getItem('gameUsername')
  })

  const handleLogin = (name: string) => {
    // Save username to localStorage
    localStorage.setItem('gameUsername', name)
    setUsername(name)
  }

  const handleLogout = () => {
    // Clear username from localStorage
    localStorage.removeItem('gameUsername')
    setUsername(null)
  }

  return (
    <div className="app-container">
      {!username ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Game username={username} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
