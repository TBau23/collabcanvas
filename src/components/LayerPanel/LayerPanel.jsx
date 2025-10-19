import React, { useState } from 'react';
import { updateShape } from '../../services/canvasService';
import './LayerPanel.css';

const LayerPanel = ({ 
  shapes, 
  selectedIds, 
  onSelectShape, 
  remoteSelections,
  user 
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Sort shapes by zIndex (descending) so top layers show first
  const sortedShapes = [...shapes].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  // Get shape display name
  const getShapeName = (shape) => {
    if (shape.type === 'text') {
      return shape.text || 'Text';
    }
    return shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
  };

  // Get shape icon
  const getShapeIcon = (shape) => {
    switch (shape.type) {
      case 'rectangle':
        return '▭';
      case 'ellipse':
        return '⬭';
      case 'text':
        return 'T';
      default:
        return '◻';
    }
  };

  // Check if shape is selected by remote user
  const getRemoteSelection = (shapeId) => {
    return remoteSelections.find(sel => {
      if (sel.shapeIds) {
        return sel.shapeIds.includes(shapeId);
      } else if (sel.shapeId) {
        return sel.shapeId === shapeId;
      }
      return false;
    });
  };

  // Handle layer click
  const handleLayerClick = (e, shapeId) => {
    const isShiftKey = e.shiftKey;
    const isMetaKey = e.metaKey || e.ctrlKey;
    
    if (isShiftKey || isMetaKey) {
      // Add/remove from selection
      if (selectedIds.includes(shapeId)) {
        onSelectShape(selectedIds.filter(id => id !== shapeId));
      } else {
        onSelectShape([...selectedIds, shapeId]);
      }
    } else {
      // Replace selection
      onSelectShape([shapeId]);
    }
  };

  // Handle lock/unlock
  const handleToggleLock = (e, shape) => {
    e.stopPropagation();
    const newLocked = !shape.locked;
    updateShape(user.uid, shape.id, { locked: newLocked });
  };

  // Handle hide/show
  const handleToggleVisibility = (e, shape) => {
    e.stopPropagation();
    const newVisible = shape.visible === false ? true : false;
    updateShape(user.uid, shape.id, { visible: newVisible });
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Get the dragged and target shapes
    const draggedShape = sortedShapes[draggedIndex];
    const targetShape = sortedShapes[dropIndex];

    // Calculate new zIndex based on drop position
    let newZIndex;
    if (dropIndex === 0) {
      // Dropped at top - get highest zIndex + 1
      const maxZIndex = Math.max(...sortedShapes.map(s => s.zIndex || 0));
      newZIndex = maxZIndex + 1;
    } else if (dropIndex === sortedShapes.length - 1) {
      // Dropped at bottom - get lowest zIndex - 1
      const minZIndex = Math.min(...sortedShapes.map(s => s.zIndex || 0));
      newZIndex = minZIndex - 1;
    } else {
      // Dropped in middle - average of neighbors
      const aboveShape = sortedShapes[dropIndex - 1];
      const belowShape = sortedShapes[dropIndex];
      newZIndex = Math.floor(((aboveShape.zIndex || 0) + (belowShape.zIndex || 0)) / 2);
      
      // If rounding causes collision, increment
      if (newZIndex === (belowShape.zIndex || 0)) {
        newZIndex = (belowShape.zIndex || 0) + 1;
      }
    }

    // Update zIndex in Firestore
    updateShape(user.uid, draggedShape.id, { zIndex: newZIndex });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (collapsed) {
    return (
      <>
        <button 
          className="collapse-toggle-btn"
          onClick={() => setCollapsed(false)}
          title="Show Layers"
        >
          📋
        </button>
      </>
    );
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span>Layers</span>
        <button 
          className="layer-panel-toggle"
          onClick={() => setCollapsed(true)}
          title="Collapse Panel"
        >
          ›
        </button>
      </div>
      
      <div className="layer-panel-content">
        {sortedShapes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
            No shapes yet
          </div>
        ) : (
          sortedShapes.map((shape, index) => {
            const isSelected = selectedIds.includes(shape.id);
            const remoteSelection = getRemoteSelection(shape.id);
            const isHidden = shape.visible === false;
            const isLocked = shape.locked === true;
            
            return (
              <div
                key={shape.id}
                className={`layer-item ${isSelected ? 'selected' : ''} ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                onClick={(e) => handleLayerClick(e, shape.id)}
                draggable={!isLocked}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{ opacity: isHidden ? 0.5 : 1 }}
              >
                <div className={`layer-icon ${shape.type}`}>
                  {getShapeIcon(shape)}
                </div>
                
                <div className="layer-name" title={getShapeName(shape)}>
                  {getShapeName(shape)}
                </div>
                
                {remoteSelection && (
                  <div 
                    className="remote-selection-indicator"
                    style={{ backgroundColor: remoteSelection.color }}
                    title={`Selected by ${remoteSelection.userName}`}
                  />
                )}
                
                <div className="layer-controls">
                  <button
                    className={`layer-control-btn ${isLocked ? 'locked' : ''}`}
                    onClick={(e) => handleToggleLock(e, shape)}
                    title={isLocked ? 'Unlock' : 'Lock'}
                  >
                    {isLocked ? '🔒' : '🔓'}
                  </button>
                  
                  <button
                    className={`layer-control-btn ${isHidden ? 'hidden' : ''}`}
                    onClick={(e) => handleToggleVisibility(e, shape)}
                    title={isHidden ? 'Show' : 'Hide'}
                  >
                    {isHidden ? '👁️' : '👁️'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LayerPanel;

