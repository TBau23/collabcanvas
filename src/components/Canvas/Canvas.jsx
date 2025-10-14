import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Circle, Text, Rect } from 'react-konva';
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

    // Set up heartbeat to keep presence alive (every 10 seconds)
    const heartbeatInterval = setInterval(() => {
      setUserOnline(user.uid, userName);
    }, 10000);

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      setUserOffline(user.uid);
    };
  }, [user]);

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

  // Handle stage click (for creating rectangles or deselecting)
  const handleStageClick = (e) => {
    // Only handle if clicked on stage itself (not a shape)
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (clickedOnEmpty) {
      if (currentTool === 'rectangle') {
        // Create rectangle at click position
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        
        // Account for stage transform (pan/zoom)
        const transform = stage.getAbsoluteTransform().copy().invert();
        const clickPos = transform.point(pos);

        const newShape = {
          id: crypto.randomUUID(),
          type: 'rectangle',
          x: clickPos.x,
          y: clickPos.y,
          width: 150,
          height: 100,
          fill: '#4A90E2',
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

  // Handle tool change
  const handleToolChange = (tool) => {
    setCurrentTool(tool);
    if (tool !== 'select') {
      setSelectedId(null);
    }
  };

  return (
    <div className="canvas-container">
      <CanvasToolbar currentTool={currentTool} onToolChange={handleToolChange} />
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
          {shapes.map((shape) => (
            <Rect
              key={shape.id}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill={shape.fill}
              rotation={shape.rotation}
              draggable={currentTool === 'select'}
              onClick={(e) => handleShapeClick(e, shape.id)}
              onDragStart={handleShapeDragStart}
              onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
              // Visual feedback for selected shape
              stroke={selectedId === shape.id ? '#0066FF' : undefined}
              strokeWidth={selectedId === shape.id ? 3 : 0}
            />
          ))}
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
