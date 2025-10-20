import React from 'react';
import './CanvasToolbar.css';

const CanvasToolbar = ({ 
  currentTool, 
  currentColor,
  currentFontSize,
  currentFontFamily,
  onToolChange, 
  onColorChange,
  onFontSizeChange,
  onFontFamilyChange,
  onExport,
  onBringToFront,
  onSendToBack,
  hasSelection,
  hasTextSelection
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

  const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];
  
  const fontFamilies = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Trebuchet MS',
    'Comic Sans MS',
    'Impact',
  ];

  return (
    <div className="canvas-toolbar">
      {/* Tool Buttons */}
      <div className="toolbar-section">
        <button
          className={`tool-button ${currentTool === 'select' ? 'active' : ''}`}
          onClick={() => onToolChange('select')}
          title="Select Tool (V)"
        >
          <span className="tool-icon">↖</span>
          <span className="tool-label">Select</span>
        </button>
        <button
          className={`tool-button ${currentTool === 'hand' ? 'active' : ''}`}
          onClick={() => onToolChange('hand')}
          title="Hand Tool (H) - Pan Canvas"
        >
          <span className="tool-icon">✋</span>
          <span className="tool-label">Hand</span>
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

      {/* Font Controls - only show when text is selected */}
      {hasTextSelection && (
        <>
          <div className="toolbar-section">
            <div className="toolbar-label">Font Size</div>
            <select
              className="font-selector"
              value={currentFontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
            >
              {fontSizes.map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>

          <div className="toolbar-section">
            <div className="toolbar-label">Font Family</div>
            <select
              className="font-selector"
              value={currentFontFamily}
              onChange={(e) => onFontFamilyChange(e.target.value)}
            >
              {fontFamilies.map(font => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

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
