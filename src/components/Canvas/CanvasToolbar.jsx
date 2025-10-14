import React from 'react';
import './CanvasToolbar.css';

const CanvasToolbar = ({ currentTool, onToolChange }) => {
  return (
    <div className="canvas-toolbar">
      <button
        className={`tool-button ${currentTool === 'select' ? 'active' : ''}`}
        onClick={() => onToolChange('select')}
        title="Select Tool"
      >
        <span className="tool-icon">↖</span>
        <span className="tool-label">Select</span>
      </button>
      <button
        className={`tool-button ${currentTool === 'rectangle' ? 'active' : ''}`}
        onClick={() => onToolChange('rectangle')}
        title="Rectangle Tool"
      >
        <span className="tool-icon">▭</span>
        <span className="tool-label">Rectangle</span>
      </button>
    </div>
  );
};

export default CanvasToolbar;

