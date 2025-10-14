import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Circle, Text, Rect, Ellipse, Transformer } from 'react-konva';
import { useAuth } from '../../context/AuthContext';
import { updateCursor, subscribeToCursors, deleteCursor } from '../../services/cursorService';
import { createShape, updateShape, subscribeToShapes } from '../../services/canvasService';
import { setUserOnline, subscribeToPresence, setUserOffline } from '../../services/presenceService';
import CanvasToolbar from './CanvasToolbar';
import PresencePanel from '../Presence/PresencePanel';
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
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 60,
  });
  
  // Tool and shape state
  const [currentTool, setCurrentTool] = useState('select');
  const [currentColor, setCurrentColor] = useState('#4A90E2');
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // Pan and zoom state
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

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

    const unsubscribe = subscribeToCursors((remoteCursors) => {
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

        // Merge remote shapes with local shapes
        const mergedShapes = remoteShapes.map((remoteShape) => {
          const localShape = currentShapesMap.get(remoteShape.id);

          // If shape doesn't exist locally, add it
          if (!localShape) {
            return remoteShape;
          }

          // If remote shape is newer, use it
          // Otherwise keep local version (for optimistic updates)
          if (
            remoteShape.updatedAt > (localShape.updatedAt || 0) &&
            remoteShape.updatedBy !== user.uid
          ) {
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

    const unsubscribe = subscribeToPresence((users) => {
      setOnlineUsers(users);
    });

    return unsubscribe;
  }, [user]);

  // Initialize presence and set up heartbeat
  useEffect(() => {
    if (!user) return;

    const userName = user.displayName || user.email;

    // Set user online immediately
    setUserOnline(user.uid, userName);

    // Set up heartbeat to keep presence alive (every 5 seconds for quicker updates)
    const heartbeatInterval = setInterval(() => {
      setUserOnline(user.uid, userName);
    }, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      setUserOffline(user.uid);
    };
  }, [user]);

  // Update Transformer when selection changes
  useEffect(() => {
    if (selectedId && transformerRef.current && shapeRefs.current[selectedId]) {
      transformerRef.current.nodes([shapeRefs.current[selectedId]]);
      transformerRef.current.getLayer().batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId]);

  // Clean up cursor and presence on window close/refresh
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = () => {
      deleteCursor(user.uid);
      setUserOffline(user.uid);
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
    const pos = stage.getPointerPosition();
    
    if (pos) {
      updateCursor(user.uid, user.displayName || user.email, pos.x, pos.y);
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
      if (currentTool === 'rectangle' || currentTool === 'ellipse') {
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
        };

        const newShape = {
          id: crypto.randomUUID(),
          type: currentTool,
          x: clickPos.x,
          y: clickPos.y,
          ...shapeDefaults[currentTool],
          fill: currentColor,
          rotation: 0,
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
  const handleShapeDragStart = (e) => {
    // Prevent panning when dragging a shape
    isPanning.current = false;
  };

  // Handle shape drag end
  const handleShapeDragEnd = (shapeId, e) => {
    const newX = e.target.x();
    const newY = e.target.y();

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

    // Save to Firestore
    updateShape(user.uid, shapeId, { x: newX, y: newY });
  };

  // Handle shape transform (resize)
  const handleShapeTransform = (shapeId, node) => {
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

    // Save to Firestore
    updateShape(user.uid, shapeId, {
      x: node.x(),
      y: node.y(),
      width: constrainedWidth,
      height: constrainedHeight,
      rotation: node.rotation(),
    });
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
  };

  return (
    <div className="canvas-container">
      <CanvasToolbar 
        currentTool={currentTool} 
        currentColor={currentColor}
        onToolChange={handleToolChange} 
        onColorChange={handleColorChange}
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
        {/* Shapes layer */}
        <Layer>
          {shapes.map((shape) => {
            const isSelected = selectedId === shape.id;
            const commonProps = {
              key: shape.id,
              ref: (node) => {
                if (node) {
                  shapeRefs.current[shape.id] = node;
                }
              },
              x: shape.x,
              y: shape.y,
              fill: shape.fill,
              rotation: shape.rotation,
              draggable: currentTool === 'select',
              onClick: (e) => handleShapeClick(e, shape.id),
              onDragStart: handleShapeDragStart,
              onDragEnd: (e) => handleShapeDragEnd(shape.id, e),
              onTransformEnd: (e) => handleShapeTransform(shape.id, e.target),
              stroke: isSelected ? '#0066FF' : undefined,
              strokeWidth: isSelected ? 3 : 0,
            };

            if (shape.type === 'rectangle') {
              return (
                <Rect
                  {...commonProps}
                  width={shape.width}
                  height={shape.height}
                />
              );
            } else if (shape.type === 'ellipse') {
              return (
                <Ellipse
                  {...commonProps}
                  radiusX={shape.width / 2}
                  radiusY={shape.height / 2}
                  offsetX={-shape.width / 2}
                  offsetY={-shape.height / 2}
                />
              );
            }
            return null;
          })}
          
          {/* Transformer for resize handles */}
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
            rotateEnabled={false}
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
    </div>
  );
};

export default Canvas;
