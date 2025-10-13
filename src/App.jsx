import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Header from './components/Layout/Header';
import './App.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // If user is logged in, show canvas (placeholder for now)
  if (user) {
    return (
      <div className="app">
        <Header />
        <main className="main-content">
          <div className="canvas-placeholder">
            <h2>Canvas Coming Soon! 🎨</h2>
            <p>Logged in as: {user.displayName || user.email}</p>
            <p>Authentication is working! Canvas will be added in PR #2.</p>
          </div>
        </main>
      </div>
    );
  }

  // If user is not logged in, show auth forms
  return showRegister ? (
    <Register onSwitchToLogin={() => setShowRegister(false)} />
  ) : (
    <Login onSwitchToRegister={() => setShowRegister(true)} />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
