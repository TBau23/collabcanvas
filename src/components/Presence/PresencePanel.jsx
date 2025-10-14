import React from 'react';
import './PresencePanel.css';

const PresencePanel = ({ users, currentUser }) => {
  // Filter out current user and get initials for each user
  const otherUsers = users.filter((u) => u.userId !== currentUser.uid);
  
  const getInitials = (userName) => {
    if (!userName) return '?';
    const parts = userName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  const totalUsers = otherUsers.length + 1; // +1 for current user

  return (
    <div className="presence-panel">
      <div className="presence-count">
        {totalUsers} {totalUsers === 1 ? 'user' : 'users'} online
      </div>
      <div className="presence-avatars">
        {/* Current user */}
        <div
          className="presence-avatar current-user"
          style={{ backgroundColor: '#667eea' }}
          title={`${currentUser.displayName || currentUser.email} (you)`}
        >
          {getInitials(currentUser.displayName || currentUser.email)}
        </div>
        
        {/* Other users */}
        {otherUsers.map((user) => (
          <div
            key={user.userId}
            className="presence-avatar"
            style={{ backgroundColor: user.color }}
            title={user.userName}
          >
            {getInitials(user.userName)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PresencePanel;

