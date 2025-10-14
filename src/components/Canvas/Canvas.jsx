import React, { useEffect, useState } from 'react';
import { Stage, Layer, Circle, Text } from 'react-konva';
import { useAuth } from '../../context/AuthContext';
import { updateCursor, subscribeToCursors, deleteCursor } from '../../services/cursorService';
import './Canvas.css';

const Canvas = () => {
  const { user } = useAuth();
  const [cursors, setCursors] = useState([]);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 60, // Account for header height (~60px)
  });

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
      // Filter out own cursor
      const otherCursors = remoteCursors.filter((c) => c.userId !== user.uid);
      setCursors(otherCursors);
    });

    return unsubscribe;
  }, [user]);

  // Clean up cursor on window close/refresh
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = () => {
      // Delete cursor when user closes window/tab
      deleteCursor(user.uid);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also delete on component unmount
      deleteCursor(user.uid);
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

  return (
    <div className="canvas-container">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
      >
        <Layer>
          {/* Render remote cursors */}
          {cursors.map((cursor) => (
            <React.Fragment key={cursor.userId}>
              <Circle
                x={cursor.x}
                y={cursor.y}
                radius={8}
                fill={cursor.color}
              />
              <Text
                x={cursor.x + 12}
                y={cursor.y - 5}
                text={cursor.userName}
                fontSize={14}
                fill={cursor.color}
                fontStyle="bold"
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;

