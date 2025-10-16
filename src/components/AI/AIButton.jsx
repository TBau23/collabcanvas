import React from 'react';
import './AIButton.css';

/**
 * Floating AI button that opens the AI assistant modal
 */
const AIButton = ({ onClick }) => {
  return (
    <button
      className="ai-button"
      onClick={onClick}
      title="Open AI Assistant (Cmd+K)"
      aria-label="Open AI Assistant"
    >
      <span className="ai-button-icon">✨</span>
      <span className="ai-button-text">AI</span>
    </button>
  );
};

export default AIButton;

