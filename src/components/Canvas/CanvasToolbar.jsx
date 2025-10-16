import React from 'react';
import './CanvasToolbar.css';

const CanvasToolbar = ({ 
  currentTool, 
  currentColor, 
  onToolChange, 
  onColorChange,
  onExport,
  onBringToFront,
  onSendToBack,
  hasSelection
}) => {
  const colors = [
    '#4A90E2', // Blue (default)
    '#E74C3C', // Red
    '#2ECC71', // Green
    '#F39C12', // Orange
    '#9B59B6', // Purple
    '#1ABC9C', // Teal
    '#34495E', // Dark Gray
    '#ECF0F1', // Light Gray
    '#FFFFFF', // White
    '#000000', // Black
    '#FF69B4', // Pink
    '#FFD700', // Gold
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
              style={{ 
                backgroundColor: color,
                border: color === '#FFFFFF' ? '1px solid #ddd' : 'none'
              }}
              onClick={() => onColorChange(color)}
              title={color}
            />
          ))}
          {/* Custom color input */}
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="color-input"
            title="Custom color"
          />
        </div>
      </div>

      {/* Layer Controls */}
      <div className="toolbar-section">
        <div className="toolbar-label">Layer</div>
        <div className="layer-controls">
          <button
            className="tool-button small"
            onClick={onBringToFront}
            disabled={!hasSelection}
            title="Bring to Front"
          >
            <span className="tool-icon">⬆</span>
            <span className="tool-label-small">Front</span>
          </button>
          <button
            className="tool-button small"
            onClick={onSendToBack}
            disabled={!hasSelection}
            title="Send to Back"
          >
            <span className="tool-icon">⬇</span>
            <span className="tool-label-small">Back</span>
          </button>
        </div>
      </div>

      {/* Export */}
      <div className="toolbar-section">
        <button
          className="tool-button export-button"
          onClick={onExport}
          title="Export to PNG"
        >
          <span className="tool-icon">💾</span>
          <span className="tool-label">Export PNG</span>
        </button>
      </div>
    </div>
  );
};

export default CanvasToolbar;
