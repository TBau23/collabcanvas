import React, { useState, useEffect } from 'react';
import { subscribeToConnectionState } from '../../services/rtdbService';
import './ConnectionIndicator.css';

const ConnectionIndicator = () => {
  const [isConnected, setIsConnected] = useState(true);
  
  useEffect(() => {
    const unsubscribe = subscribeToConnectionState((connected) => {
      setIsConnected(connected);
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <div className="connection-indicator">
      <span 
        className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}
        title={isConnected ? 'Connected' : 'Reconnecting...'}
      />
      {!isConnected && <span className="connection-text">Reconnecting...</span>}
    </div>
  );
};

export default ConnectionIndicator;

