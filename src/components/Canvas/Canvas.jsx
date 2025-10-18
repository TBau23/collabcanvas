import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Circle, Text, Rect, Ellipse, Transformer, Line, Shape } from 'react-konva';
import { useAuth } from '../../context/AuthContext';
import { createShape, updateShape, deleteShape, subscribeToShapes } from '../../services/canvasService';
import { 
  updateCursorRTDB, 
  subscribeToCursorsRTDB, 
  deleteCursorRTDB, 
  setupCursorCleanup,
  setUserOnlineRTDB, 
  subscribeToPresenceRTDB, 
  setUserOfflineRTDB,
  updateDraggingPosition,
  subscribeToDragging,
  clearDraggingPosition,
  setupDraggingCleanup,
  updateTransformState
} from '../../services/rtdbService';
import CanvasToolbar from './CanvasToolbar';
import PresencePanel from '../Presence/PresencePanel';
import AIButton from '../AI/AIButton';
import AIModal from '../AI/AIModal';
import './Canvas.css';

const Canvas = () => {
  const { user } = useAuth();
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const shapeRefs = useRef({});
  const isPanning = useRef(false);
  
  // Canvas state
  const [cursors, setCursors] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [remoteDragging, setRemoteDragging] = useState([]); // Track shapes being dragged by others
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 60,
  });
  
  // Tool and shape state
  const [currentTool, setCurrentTool] = useState('select');
  const [currentColor, setCurrentColor] = useState('#4A90E2');
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  
  // Pan and zoom state - initialize to center of canvas
  const canvasSize = 5000;
  const [stagePos, setStagePos] = useState(() => {
    // Center the 5000x5000 canvas in the viewport
    const centerX = window.innerWidth / 2 - canvasSize / 2;
    const centerY = (window.innerHeight - 60) / 2 - canvasSize / 2;
    return { x: centerX, y: centerY };
  });
  const [stageScale, setStageScale] = useState(1);
  
  // AI modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  
  // Text editing state
  const [editingText, setEditingText] = useState(null);
  const [textEditorValue, setTextEditorValue] = useState('');
  const [textEditorPosition, setTextEditorPosition] = useState({ x: 0, y: 0, width: 200 });

  // Viewport culling helper - only render shapes in view (plus selected/dragging/transforming)
  const getVisibleShapes = (shapes, selectedId, isDragging, isTransforming) => {
    if (!stageRef.current) return shapes;
    
    const stage = stageRef.current;
    
    // Calculate viewport bounds in canvas coordinates
    const viewport = {
      x: -stage.x() / stage.scaleX(),
      y: -stage.y() / stage.scaleY(),
      width: stage.width() / stage.scaleX(),
      height: stage.height() / stage.scaleY(),
    };
    
    // Add margin for smooth scrolling (shapes appear before entering viewport)
    const margin = 200;
    
    const visibleShapes = shapes.filter(shape => {
      // ALWAYS render selected shape (critical for Transformer)
      if (shape.id === selectedId) return true;
      
      // ALWAYS render shape being dragged or transformed
      if ((isDragging || isTransforming) && shape.id === selectedId) return true;
      
      // Get shape bounds (handle text shapes with no initial width/height)
      const shapeWidth = shape.width || 200;
      const shapeHeight = shape.height || 50;
      
      const shapeLeft = shape.x;
      const shapeRight = shape.x + shapeWidth;
      const shapeTop = shape.y;
      const shapeBottom = shape.y + shapeHeight;
      
      // Check if shape intersects viewport (with margin)
      const isVisible = !(
        shapeRight < viewport.x - margin ||
        shapeLeft > viewport.x + viewport.width + margin ||
        shapeBottom < viewport.y - margin ||
        shapeTop > viewport.y + viewport.height + margin
      );
      
      return isVisible;
    });
    
    // Log culling stats occasionally for debugging (remove in production)
    if (shapes.length > 100 && Math.random() < 0.02) { // Log 2% of frames when many shapes
      console.log(`[Viewport Culling] ${visibleShapes.length}/${shapes.length} visible (${Math.round((1 - visibleShapes.length / shapes.length) * 100)}% culled)`);
    }
    
    return visibleShapes;
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 60,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Subscribe to cursor updates from other users
  useEffect(() => {
    if (!user) return;

    // Setup automatic cursor cleanup on disconnect
    setupCursorCleanup(user.uid);

    const unsubscribe = subscribeToCursorsRTDB((remoteCursors) => {
      const otherCursors = remoteCursors.filter((c) => c.userId !== user.uid);
      setCursors(otherCursors);
    });

    return unsubscribe;
  }, [user]);

  // Subscribe to shape updates from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToShapes((remoteShapes) => {
      // Update shapes from Firestore
      // Use functional update to ensure we're working with latest state
      setShapes((currentShapes) => {
        // Create a map of current shapes for easy lookup
        const currentShapesMap = new Map(
          currentShapes.map((shape) => [shape.id, shape])
        );

        // Trust Firestore as source of truth - only keep shapes that exist remotely
        // Real-time position updates during drag/transform are handled by RTDB
        const mergedShapes = remoteShapes.map((remoteShape) => {
          const localShape = currentShapesMap.get(remoteShape.id);

          // If shape doesn't exist locally, add it
          if (!localShape) {
            return remoteShape;
          }

          // If remote shape is newer, use it
          // Otherwise keep local version (for optimistic updates that haven't synced yet)
          if (remoteShape.updatedAt > (localShape.updatedAt || 0)) {
            return remoteShape;
          }

          return localShape;
        });

        return mergedShapes;
      });
    });

    return unsubscribe;
  }, [user]);

  // Subscribe to presence updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToPresenceRTDB((users) => {
      setOnlineUsers(users);
    });

    return unsubscribe;
  }, [user]);

  // Subscribe to live dragging updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToDragging((draggingShapes) => {
      // Filter out our own drags
      const otherDrags = draggingShapes.filter(drag => drag.userId !== user.uid);
      setRemoteDragging(otherDrags);
    });

    return unsubscribe;
  }, [user]);

  // Initialize presence (no heartbeat needed - onDisconnect handles it)
  useEffect(() => {
    if (!user) return;

    const userName = user.displayName || user.email;

    // Set user online immediately (onDisconnect is setup in the service)
    setUserOnlineRTDB(user.uid, userName);

    // Cleanup on unmount
    return () => {
      setUserOfflineRTDB(user.uid);
    };
  }, [user]);

  // Update Transformer and color picker when selection changes
  useEffect(() => {
    if (selectedId && transformerRef.current && shapeRefs.current[selectedId]) {
      transformerRef.current.nodes([shapeRefs.current[selectedId]]);
      transformerRef.current.getLayer().batchDraw();
      
      // Update color picker to match selected shape's color
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape) {
        setCurrentColor(selectedShape.fill);
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, shapes]);

  // Handle keyboard shortcuts (Delete key and Cmd+K for AI)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle keyboard shortcuts while editing text
      if (editingText) return;
      
      // Cmd+K or Ctrl+K to open AI modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsAIModalOpen(true);
        return;
      }
      
      // Delete or Backspace key
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Prevent default behavior (like browser back navigation on Backspace)
        e.preventDefault();
        
        // Delete from local state immediately (optimistic)
        setShapes(shapes.filter(shape => shape.id !== selectedId));
        
        // Clear selection
        setSelectedId(null);
        
        // Delete from Firestore
        deleteShape(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, shapes, editingText]);

  // Clean up cursor and presence on window close/refresh
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = () => {
      deleteCursorRTDB(user.uid);
      setUserOfflineRTDB(user.uid);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Track and broadcast mouse position
  const handleMouseMove = (e) => {
    if (!user) return;

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    
    if (pointerPos) {
      // Transform viewport coordinates to canvas coordinates
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(pointerPos);
      
      updateCursorRTDB(user.uid, user.displayName || user.email, canvasPos.x, canvasPos.y);
    }
  };

  // Handle zoom
  const handleWheel = (e) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    // Calculate new scale
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Clamp scale between 0.1 and 3
    const clampedScale = Math.max(0.1, Math.min(3, newScale));

    // Calculate new position to zoom towards cursor
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setStageScale(clampedScale);
    setStagePos(newPos);
  };

  // Handle stage mouse down (for panning)
  const handleStageMouseDown = (e) => {
    // Only pan if clicking on the stage itself (not a shape)
    if (e.target === e.target.getStage()) {
      isPanning.current = true;
    }
  };

  // Handle stage mouse up
  const handleStageMouseUp = () => {
    isPanning.current = false;
  };

  // Handle stage mouse move (for panning)
  const handleStageMouseMove = (e) => {
    // Handle cursor tracking
    handleMouseMove(e);

    // Handle panning
    if (isPanning.current && currentTool === 'select') {
      const stage = stageRef.current;
      const newPos = {
        x: stagePos.x + e.evt.movementX,
        y: stagePos.y + e.evt.movementY,
      };
      setStagePos(newPos);
      stage.position(newPos);
    }
  };

  // Handle stage click (for creating shapes or deselecting)
  const handleStageClick = (e) => {
    // Only handle if clicked on stage itself (not a shape)
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (clickedOnEmpty) {
      if (currentTool === 'rectangle' || currentTool === 'ellipse' || currentTool === 'text') {
        // Create shape at click position
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        
        // Account for stage transform (pan/zoom)
        const transform = stage.getAbsoluteTransform().copy().invert();
        const clickPos = transform.point(pos);

        // Shape-specific defaults
        const shapeDefaults = {
          rectangle: { width: 150, height: 100 },
          ellipse: { width: 120, height: 80 },
          text: { width: 200, height: 50 },
        };

        const newShape = {
          id: crypto.randomUUID(),
          type: currentTool,
          x: clickPos.x,
          y: clickPos.y,
          ...shapeDefaults[currentTool],
          fill: currentColor,
          rotation: 0,
          ...(currentTool === 'text' && { 
            text: 'Double-click to edit',
            fontSize: 24,
            fontFamily: 'Arial'
          }),
          updatedBy: user.uid,
          updatedAt: Date.now(),
        };

        // Optimistic update: Add to local state immediately
        setShapes([...shapes, newShape]);
        setSelectedId(newShape.id);
        setCurrentTool('select'); // Auto-switch back to select mode

        // Save to Firestore
        createShape(user.uid, newShape);
      } else {
        // Deselect
        setSelectedId(null);
      }
    }
  };

  // Handle shape selection
  const handleShapeClick = (e, shapeId) => {
    e.cancelBubble = true; // Prevent stage click from firing
    
    if (currentTool === 'select') {
      setSelectedId(shapeId);
    }
  };

  // Handle shape drag start
  const handleShapeDragStart = (e, shapeId) => {
    // Prevent panning when dragging a shape
    isPanning.current = false;
    setIsDragging(true);
    
    // Setup automatic cleanup on disconnect
    setupDraggingCleanup(shapeId);
  };

  // Handle shape drag move (real-time position sync)
  const handleShapeDragMove = (shapeId, e) => {
    const node = e.target;
    const stage = node.getStage();
    
    // Get shape data
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;
    
    // Convert shape center to stage coordinates for cursor
    const stagePos = stage.getPointerPosition();
    if (stagePos) {
      // Transform to canvas coordinates
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(stagePos);
      
      // Update cursor to follow pointer during drag
      updateCursorRTDB(user.uid, user.displayName || user.email, canvasPos.x, canvasPos.y);
    }
    
    // Send real-time position update with full transform data
    // (so shape doesn't disappear on other screens)
    updateTransformState(user.uid, shapeId, {
      x: node.x(),
      y: node.y(),
      width: shape.width || 200,
      height: shape.height || 50,
      rotation: shape.rotation || 0,
    });
  };

  // Handle shape drag end
  const handleShapeDragEnd = (shapeId, e) => {
    setIsDragging(false);
    
    const node = e.target;
    const stage = node.getStage();
    const newX = node.x();
    const newY = node.y();

    // Update cursor position at drop point
    const stagePos = stage.getPointerPosition();
    if (stagePos) {
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(stagePos);
      updateCursorRTDB(user.uid, user.displayName || user.email, canvasPos.x, canvasPos.y);
    }

    // Optimistic update: Update local state immediately
    const newShapes = shapes.map((shape) => {
      if (shape.id === shapeId) {
        return {
          ...shape,
          x: newX,
          y: newY,
          updatedBy: user.uid,
          updatedAt: Date.now(),
        };
      }
      return shape;
    });
    setShapes(newShapes);

    // Save to Firestore (persists final position)
    updateShape(user.uid, shapeId, { x: newX, y: newY });

    // Clear live dragging state AFTER a delay to prevent flicker
    // This gives Firestore time to propagate the final position
    setTimeout(() => {
      clearDraggingPosition(shapeId);
    }, 300); // 300ms delay matches typical Firestore propagation
  };

  // Handle shape transform start
  const handleShapeTransformStart = (shapeId) => {
    setIsTransforming(true);
    setupDraggingCleanup(shapeId); // Reuse dragging cleanup
  };

  // Handle shape transform (resize/rotate) - real-time sync
  const handleShapeTransformMove = (shapeId, node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const newWidth = Math.max(20, node.width() * scaleX);
    const newHeight = Math.max(20, node.height() * scaleY);
    
    // Send real-time transform update
    updateTransformState(user.uid, shapeId, {
      x: node.x(),
      y: node.y(),
      width: Math.min(2000, newWidth),
      height: Math.min(2000, newHeight),
      rotation: node.rotation(),
    });
  };

  // Handle shape transform end
  const handleShapeTransformEnd = (shapeId, node) => {
    setIsTransforming(false);
    
    // Get the new dimensions
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const newWidth = Math.max(20, node.width() * scaleX);
    const newHeight = Math.max(20, node.height() * scaleY);
    
    // Constrain max size
    const constrainedWidth = Math.min(2000, newWidth);
    const constrainedHeight = Math.min(2000, newHeight);

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    // Optimistic update
    const newShapes = shapes.map((shape) => {
      if (shape.id === shapeId) {
        return {
          ...shape,
          x: node.x(),
          y: node.y(),
          width: constrainedWidth,
          height: constrainedHeight,
          rotation: node.rotation(),
          updatedBy: user.uid,
          updatedAt: Date.now(),
        };
      }
      return shape;
    });
    setShapes(newShapes);

    // Save to Firestore (persists final state)
    updateShape(user.uid, shapeId, {
      x: node.x(),
      y: node.y(),
      width: constrainedWidth,
      height: constrainedHeight,
      rotation: node.rotation(),
    });

    // Clear transform state after delay (prevent flicker)
    setTimeout(() => {
      clearDraggingPosition(shapeId);
    }, 300);
  };

  // Handle tool change
  const handleToolChange = (tool) => {
    setCurrentTool(tool);
    if (tool !== 'select') {
      setSelectedId(null);
    }
  };

  // Handle color change
  const handleColorChange = (color) => {
    setCurrentColor(color);
    
    // If a shape is selected, update its color immediately
    if (selectedId) {
      const newShapes = shapes.map((shape) => {
        if (shape.id === selectedId) {
          return {
            ...shape,
            fill: color,
            updatedBy: user.uid,
            updatedAt: Date.now(),
          };
        }
        return shape;
      });
      setShapes(newShapes);
      
      // Save to Firestore
      updateShape(user.uid, selectedId, { fill: color });
    }
  };

  // Handle double-click on text to edit inline
  const handleTextEdit = (shape) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Calculate position in screen coordinates
    const textNode = shapeRefs.current[shape.id];
    if (!textNode) return;

    const textPosition = textNode.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    // Deselect shape while editing
    setSelectedId(null);
    
    setEditingText(shape.id);
    setTextEditorValue(shape.text || '');
    setTextEditorPosition({
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
      width: shape.width * stageScale,
      fontSize: (shape.fontSize || 24) * stageScale,
    });
  };

  // Save edited text
  const handleTextSave = () => {
    if (!editingText) return;

    const shape = shapes.find(s => s.id === editingText);
    if (shape && textEditorValue !== shape.text) {
      const updatedShapes = shapes.map(s =>
        s.id === editingText
          ? { ...s, text: textEditorValue, updatedBy: user.uid, updatedAt: Date.now() }
          : s
      );
      setShapes(updatedShapes);
      updateShape(user.uid, editingText, { text: textEditorValue });
    }

    setEditingText(null);
    setTextEditorValue('');
  };

  // Export canvas to PNG - only the defined 5000x5000 canvas area
  const handleExport = () => {
    const stage = stageRef.current;
    if (!stage) return;

    // Export only the bounded canvas area
    const dataURL = stage.toDataURL({ 
      pixelRatio: 2,
      x: 0,
      y: 0,
      width: canvasSize,
      height: canvasSize
    });
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bring selected shape to front
  const handleBringToFront = () => {
    if (!selectedId) return;
    
    const selectedShape = shapes.find(s => s.id === selectedId);
    if (!selectedShape) return;

    // Move to end of array (rendered last = on top)
    const newShapes = [
      ...shapes.filter(s => s.id !== selectedId),
      { ...selectedShape, updatedBy: user.uid, updatedAt: Date.now() }
    ];
    setShapes(newShapes);
    
    // Note: Z-index isn't stored in Firestore, it's determined by array order in local state
    // For multi-user consistency, we'd need to add a z-index field to Firestore
  };

  // Send selected shape to back
  const handleSendToBack = () => {
    if (!selectedId) return;
    
    const selectedShape = shapes.find(s => s.id === selectedId);
    if (!selectedShape) return;

    // Move to start of array (rendered first = on bottom)
    const newShapes = [
      { ...selectedShape, updatedBy: user.uid, updatedAt: Date.now() },
      ...shapes.filter(s => s.id !== selectedId)
    ];
    setShapes(newShapes);
  };

  return (
    <div className="canvas-container">
      <CanvasToolbar 
        currentTool={currentTool} 
        currentColor={currentColor}
        onToolChange={handleToolChange} 
        onColorChange={handleColorChange}
        onExport={handleExport}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        hasSelection={!!selectedId}
      />
      <PresencePanel users={onlineUsers} currentUser={user} />
      
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onMouseMove={handleStageMouseMove}
        onWheel={handleWheel}
        onClick={handleStageClick}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
      >
        {/* Background Layer - Canvas Boundary */}
        <Layer listening={false}>
          {/* Canvas background - white 5000x5000 area */}
          <Rect
            x={0}
            y={0}
            width={canvasSize}
            height={canvasSize}
            fill="#FFFFFF"
            shadowColor="rgba(0, 0, 0, 0.2)"
            shadowBlur={20}
            shadowOffset={{ x: 0, y: 0 }}
            listening={false}
          />
          
          {/* Canvas border - clear boundary */}
          <Rect
            x={0}
            y={0}
            width={canvasSize}
            height={canvasSize}
            stroke="#CCCCCC"
            strokeWidth={2}
            listening={false}
          />
          
          {/* Grid lines - optimized single shape instead of 200 components */}
          <Shape
            sceneFunc={(context, shape) => {
              const gridSize = 50;
              context.strokeStyle = '#E8E8E8';
              context.lineWidth = 1;
              context.beginPath();
              
              // Vertical lines
              for (let i = 0; i <= canvasSize; i += gridSize) {
                context.moveTo(i, 0);
                context.lineTo(i, canvasSize);
              }
              
              // Horizontal lines
              for (let i = 0; i <= canvasSize; i += gridSize) {
                context.moveTo(0, i);
                context.lineTo(canvasSize, i);
              }
              
              context.stroke();
            }}
            listening={false}
          />
        </Layer>

        {/* Shapes layer */}
        <Layer>
          {getVisibleShapes(shapes, selectedId, isDragging, isTransforming).map((shape) => {
            const isSelected = selectedId === shape.id;
            
            // Check if this shape is being dragged/transformed by another user
            const remoteTransform = remoteDragging.find(drag => drag.shapeId === shape.id);
            
            // Use remote transform data if available, otherwise use shape's data
            // Handle partial transform data gracefully
            const displayX = remoteTransform?.x ?? shape.x;
            const displayY = remoteTransform?.y ?? shape.y;
            const displayWidth = remoteTransform?.width ?? shape.width;
            const displayHeight = remoteTransform?.height ?? shape.height;
            const displayRotation = remoteTransform?.rotation ?? shape.rotation;
            
            const commonProps = {
              ref: (node) => {
                if (node) {
                  shapeRefs.current[shape.id] = node;
                }
              },
              x: displayX,
              y: displayY,
              fill: shape.fill,
              rotation: displayRotation,
              draggable: currentTool === 'select',
              onClick: (e) => handleShapeClick(e, shape.id),
              onDragStart: (e) => handleShapeDragStart(e, shape.id),
              onDragMove: (e) => handleShapeDragMove(shape.id, e),
              onDragEnd: (e) => handleShapeDragEnd(shape.id, e),
              onTransformStart: () => handleShapeTransformStart(shape.id),
              onTransform: (e) => handleShapeTransformMove(shape.id, e.target),
              onTransformEnd: (e) => handleShapeTransformEnd(shape.id, e.target),
              stroke: isSelected ? '#0066FF' : (remoteTransform ? '#FFA500' : undefined),
              strokeWidth: isSelected ? 3 : (remoteTransform ? 2 : 0),
              opacity: remoteTransform ? 0.7 : 1,
            };

            if (shape.type === 'rectangle') {
              return (
                <Rect
                  key={shape.id}
                  {...commonProps}
                  width={displayWidth}
                  height={displayHeight}
                />
              );
            } else if (shape.type === 'ellipse') {
              return (
                <Ellipse
                  key={shape.id}
                  {...commonProps}
                  radiusX={displayWidth / 2}
                  radiusY={displayHeight / 2}
                  offsetX={-displayWidth / 2}
                  offsetY={-displayHeight / 2}
                />
              );
            } else if (shape.type === 'text') {
              return (
                <Text
                  key={shape.id}
                  {...commonProps}
                  text={shape.text || 'Text'}
                  fontSize={shape.fontSize || 24}
                  fontFamily={shape.fontFamily || 'Arial'}
                  width={displayWidth}
                  height={displayHeight}
                  visible={editingText !== shape.id}
                  onDblClick={() => handleTextEdit(shape)}
                />
              );
            }
            return null;
          })}
          
          {/* Transformer for resize and rotate handles */}
          <Transformer
            ref={transformerRef}
            enabledAnchors={[
              'top-left',
              'top-right',
              'bottom-left',
              'bottom-right',
              'middle-left',
              'middle-right',
              'top-center',
              'bottom-center',
            ]}
            rotateEnabled={true}
            borderStroke="#0066FF"
            borderStrokeWidth={2}
            anchorStroke="#0066FF"
            anchorFill="white"
            anchorSize={8}
            anchorCornerRadius={2}
          />
        </Layer>

        {/* Cursors layer (on top) */}
        <Layer>
          {cursors.map((cursor) => (
            <React.Fragment key={cursor.userId}>
              <Circle
                x={cursor.x}
                y={cursor.y}
                radius={8}
                fill={cursor.color}
                listening={false}
              />
              <Text
                x={cursor.x + 12}
                y={cursor.y - 5}
                text={cursor.userName}
                fontSize={14}
                fill={cursor.color}
                fontStyle="bold"
                listening={false}
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
      
      {/* Inline Text Editor */}
      {editingText && (
        <textarea
          autoFocus
          value={textEditorValue}
          onChange={(e) => setTextEditorValue(e.target.value)}
          onBlur={handleTextSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleTextSave();
            }
            if (e.key === 'Escape') {
              setEditingText(null);
              setTextEditorValue('');
            }
          }}
          style={{
            position: 'fixed',
            left: textEditorPosition.x + 'px',
            top: textEditorPosition.y + 'px',
            width: textEditorPosition.width + 'px',
            fontSize: textEditorPosition.fontSize + 'px',
            fontFamily: 'Arial',
            border: '2px solid #0066FF',
            outline: 'none',
            padding: '4px',
            resize: 'none',
            overflow: 'hidden',
            background: 'white',
            zIndex: 1500,
            minHeight: '1.5em',
          }}
        />
      )}
      
      {/* AI Assistant */}
      <AIButton onClick={() => setIsAIModalOpen(true)} />
      <AIModal 
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        currentShapes={shapes}
      />
    </div>
  );
};

export default Canvas;
