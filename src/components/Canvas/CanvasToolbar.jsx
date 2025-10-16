import React from 'react';
import './CanvasToolbar.css';

const CanvasToolbar = ({ currentTool, currentColor, onToolChange, onColorChange }) => {
  const colors = [
    '#4A90E2', // Blue (default)
    '#E74C3C', // Red
    '#2ECC71', // Green
    '#F39C12', // Orange
    '#9B59B6', // Purple
    '#1ABC9C', // Teal
    '#34495E', // Dark Gray
    '#ECF0F1', // Light Gray
  ];

  return (
    <div className="canvas-toolbar">
      {/* Tool Buttons */}
      <div className="toolbar-section">
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
        <button
          className={`tool-button ${currentTool === 'ellipse' ? 'active' : ''}`}
          onClick={() => onToolChange('ellipse')}
          title="Ellipse Tool"
        >
          <span className="tool-icon">⬭</span>
          <span className="tool-label">Ellipse</span>
        </button>
        <button
          className={`tool-button ${currentTool === 'text' ? 'active' : ''}`}
          onClick={() => onToolChange('text')}
          title="Text Tool"
        >
          <span className="tool-icon">T</span>
          <span className="tool-label">Text</span>
        </button>
      </div>

      {/* Color Picker */}
      <div className="toolbar-section">
        <div className="toolbar-label">Color</div>
        <div className="color-picker">
          {colors.map((color) => (
            <button
              key={color}
              className={`color-swatch ${currentColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onColorChange(color)}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CanvasToolbar;
