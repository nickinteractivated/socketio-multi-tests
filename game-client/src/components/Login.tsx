import { useState, useEffect } from 'react';

interface LoginProps {
  onLogin: (username: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for saved username in local storage when component mounts
  useEffect(() => {
    const savedUsername = localStorage.getItem('gameUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      // Auto-login with saved username
      handleLogin(savedUsername);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate username must not be empty
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    // Validate username length
    if (username.length > 30) {
      setError('Username must be 30 characters or less');
      return;
    }
    
    // Validate username characters
    const validUsernamePattern = /^[a-zA-Z0-9_\-. ]+$/;
    if (!validUsernamePattern.test(username)) {
      setError('Username can only contain letters, numbers, underscores, hyphens, periods, and spaces');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    // Submit the username
    handleLogin(username);
  };

  const handleLogin = (username: string) => {
    // Save username to local storage
    localStorage.setItem('gameUsername', username);
    
    // Call the onLogin callback
    onLogin(username);
  };

  return (
    <div className="login-container">
      <div>
        <h1 className="login-title">⚡️ Computation Hunter</h1>
        <h2 className="login-subtitle">A Multiplayer Resource Collection Game</h2>
        
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="input-container">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="Enter your username (max 30 chars)"
              className="login-input"
              maxLength={30}
              disabled={isSubmitting}
            />
          </div>
          <button 
            type="submit" 
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Connecting...' : 'Play Now'}
          </button>
        </form>
      </div>
    </div>
  );
} 