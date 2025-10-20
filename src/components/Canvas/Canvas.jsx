import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Circle, Text, Rect, Ellipse, Transformer, Line, Shape } from 'react-konva';
import { useAuth } from '../../context/AuthContext';
import { createShape, updateShape, deleteShape, subscribeToShapes, createShapeBatch, updateShapeBatch, deleteShapeBatch } from '../../services/canvasService';
import { 
  updateCursorRTDB, 
  subscribeToCursorsRTDB, 
  setupCursorCleanup,
  setUserOnlineRTDB, 
  subscribeToPresenceRTDB,
  updateDraggingPosition,
  subscribeToDragging,
  clearDraggingPosition,
  setupDraggingCleanup,
  updateTransformState,
  updateSelection,
  subscribeToSelections,
  setupSelectionCleanup,
  subscribeToConnectionState
} from '../../services/rtdbService';
import CanvasToolbar from './CanvasToolbar';
import PresencePanel from '../Presence/PresencePanel';
import LayerPanel from '../LayerPanel/LayerPanel';
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
  const [remoteSelections, setRemoteSelections] = useState([]); // Track shapes selected by others
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 60,
  });
  
  // Tool and shape state
  const [currentTool, setCurrentTool] = useState('select');
  const [currentColor, setCurrentColor] = useState('#4A90E2');
  const [currentFontSize, setCurrentFontSize] = useState(24);
  const [currentFontFamily, setCurrentFontFamily] = useState('Arial');
  const [shapes, setShapes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  
  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState(null);
  const hasDragged = useRef(false); // Track if user has dragged (vs clicked)
  const justFinishedMarquee = useRef(false); // Prevent click event after marquee
  
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
  
  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState([]);

  // Calculate bounding box for multiple selected shapes (accounting for rotation)
  const getSelectionBounds = (shapes, selectedIds) => {
    if (selectedIds.length === 0) return null;
    
    const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));
    if (selectedShapes.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    selectedShapes.forEach(shape => {
      const width = shape.width || (shape.type === 'ellipse' ? 120 : 200);
      const height = shape.height || (shape.type === 'ellipse' ? 80 : 50);
      const rotation = shape.rotation || 0;
      
      if (rotation === 0) {
        // No rotation - simple case
        minX = Math.min(minX, shape.x);
        minY = Math.min(minY, shape.y);
        maxX = Math.max(maxX, shape.x + width);
        maxY = Math.max(maxY, shape.y + height);
      } else {
        // Rotation - calculate rotated corners and find axis-aligned bounding box
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // Four corners of the shape (before rotation)
        const corners = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ];
        
        // Rotate each corner and translate to shape position
        corners.forEach(corner => {
          const rotatedX = corner.x * cos - corner.y * sin + shape.x;
          const rotatedY = corner.x * sin + corner.y * cos + shape.y;
          
          minX = Math.min(minX, rotatedX);
          minY = Math.min(minY, rotatedY);
          maxX = Math.max(maxX, rotatedX);
          maxY = Math.max(maxY, rotatedY);
        });
      }
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // Viewport culling helper - only render shapes in view (plus selected/dragging/transforming)
  const getVisibleShapes = (shapes, selectedIds, isDragging, isTransforming) => {
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
      // ALWAYS render selected shapes (critical for Transformer)
      if (selectedIds.includes(shape.id)) return true;
      
      // ALWAYS render shape being dragged or transformed
      if ((isDragging || isTransforming) && selectedIds.includes(shape.id)) return true;
      
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
    const timestamp = new Date().toISOString();
    console.log(`[CANVAS-DIAG ${timestamp}] ===== CURSOR SUBSCRIPTION EFFECT TRIGGERED =====`);
    
    if (!user) {
      console.log(`[CANVAS-DIAG ${timestamp}] No user, skipping cursor setup`);
      return;
    }

    console.log(`[CANVAS-DIAG ${timestamp}] Setting up cursor cleanup for user: ${user.uid}`);
    // Setup automatic cursor cleanup on disconnect (waits for connection internally)
    setupCursorCleanup(user.uid);

    console.log(`[CANVAS-DIAG ${timestamp}] Subscribing to cursor updates...`);
    const unsubscribe = subscribeToCursorsRTDB((remoteCursors) => {
      const otherCursors = remoteCursors.filter((c) => c.userId !== user.uid);
      setCursors(otherCursors);
    });

    return () => {
      const cleanupTimestamp = new Date().toISOString();
      console.log(`[CANVAS-DIAG ${cleanupTimestamp}] Unsubscribing from cursor updates`);
      unsubscribe();
    };
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

        // Sort shapes by zIndex for proper rendering order
        // Shapes without zIndex default to 0 (backward compatibility)
        return mergedShapes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
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

  // Subscribe to remote selection updates
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[CANVAS-DIAG ${timestamp}] ===== SELECTION SUBSCRIPTION EFFECT TRIGGERED =====`);
    
    if (!user) {
      console.log(`[CANVAS-DIAG ${timestamp}] No user, skipping selection setup`);
      return;
    }

    console.log(`[CANVAS-DIAG ${timestamp}] Setting up selection cleanup for user: ${user.uid}`);
    // Setup automatic selection cleanup on disconnect (waits for connection internally)
    setupSelectionCleanup(user.uid);

    console.log(`[CANVAS-DIAG ${timestamp}] Subscribing to selection updates...`);
    const unsubscribe = subscribeToSelections((selections) => {
      // Filter out our own selection
      const otherSelections = selections.filter(sel => sel.userId !== user.uid);
      setRemoteSelections(otherSelections);
    });

    return () => {
      const cleanupTimestamp = new Date().toISOString();
      console.log(`[CANVAS-DIAG ${cleanupTimestamp}] Unsubscribing from selection updates`);
      unsubscribe();
    };
  }, [user]);

  // Initialize presence and handle reconnection
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[CANVAS-DIAG ${timestamp}] ===== PRESENCE EFFECT TRIGGERED =====`);
    
    if (!user) {
      console.log(`[CANVAS-DIAG ${timestamp}] No user, skipping presence setup`);
      return;
    }

    const userName = user.displayName || user.email;
    console.log(`[CANVAS-DIAG ${timestamp}] Setting up presence for: ${userName} (${user.uid})`);

    // Set user online (waits for connection internally)
    console.log(`[CANVAS-DIAG ${timestamp}] Calling setUserOnlineRTDB()...`);
    setUserOnlineRTDB(user.uid, userName);

    // Subscribe to connection state to handle reconnection
    console.log(`[CANVAS-DIAG ${timestamp}] Subscribing to connection state changes...`);
    const unsubscribe = subscribeToConnectionState((connected) => {
      const innerTimestamp = new Date().toISOString();
      if (connected) {
        console.log(`[CANVAS-DIAG ${innerTimestamp}] 🟢 RTDB CONNECTED - re-registering presence and cleanup handlers`);
        // Re-register all onDisconnect handlers when reconnecting
        setUserOnlineRTDB(user.uid, userName);
        setupCursorCleanup(user.uid);
        setupSelectionCleanup(user.uid);
      } else {
        console.log(`[CANVAS-DIAG ${innerTimestamp}] 🔴 RTDB DISCONNECTED`);
      }
    });

    // Cleanup on unmount
    return () => {
      const cleanupTimestamp = new Date().toISOString();
      console.log(`[CANVAS-DIAG ${cleanupTimestamp}] ===== PRESENCE EFFECT CLEANUP (Component Unmounting) =====`);
      console.log(`[CANVAS-DIAG ${cleanupTimestamp}] Unsubscribing from connection state...`);
      unsubscribe();
      // NOTE: Manual cleanup is now handled in authService.logout() BEFORE signing out
      // This ensures auth token is still valid when cleaning up RTDB data
      // onDisconnect handlers will still fire for tab close/crash scenarios
    };
  }, [user]);

  // Update Transformer and property selectors when selection changes
  useEffect(() => {
    if (selectedIds.length > 0 && transformerRef.current) {
      // For now, attach transformer to first selected shape
      // Feature 2 will handle group transformations
      const firstSelectedId = selectedIds[0];
      if (shapeRefs.current[firstSelectedId]) {
        transformerRef.current.nodes([shapeRefs.current[firstSelectedId]]);
        transformerRef.current.getLayer().batchDraw();
        
        // Update property selectors to match first selected shape
        const selectedShape = shapes.find(s => s.id === firstSelectedId);
        if (selectedShape) {
          setCurrentColor(selectedShape.fill);
          
          // Update font properties if it's a text shape
          if (selectedShape.type === 'text') {
            setCurrentFontSize(selectedShape.fontSize || 24);
            setCurrentFontFamily(selectedShape.fontFamily || 'Arial');
          }
        }
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedIds, shapes]);

  // Broadcast selection state to other users
  useEffect(() => {
    if (!user) return;

    const userName = user.displayName || user.email;
    
    // Update RTDB with current selection (or clear if empty array)
    updateSelection(user.uid, userName, selectedIds);
  }, [selectedIds, user]);

  // Handle keyboard shortcuts (Delete, Copy, Paste, Cut, AI)
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
      
      // Cmd+C or Ctrl+C to copy
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        const selectedShapes = shapes.filter(shape => selectedIds.includes(shape.id));
        setClipboard(selectedShapes);
        console.log(`[Copy] Copied ${selectedShapes.length} shape(s) to clipboard`);
        return;
      }
      
      // Cmd+V or Ctrl+V to paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        
        // Calculate zIndex - pasted shapes go on top
        const maxZIndex = shapes.reduce((max, s) => Math.max(max, s.zIndex || 0), 0);
        
        // Create new shapes with offset positions and new IDs
        const pasteOffset = 50; // Offset by 50px in both directions
        const newShapes = clipboard.map((shape, index) => ({
          ...shape,
          id: crypto.randomUUID(), // New unique ID
          x: shape.x + pasteOffset,
          y: shape.y + pasteOffset,
          zIndex: maxZIndex + 1 + index, // Maintain relative z-order
          updatedBy: user.uid,
          updatedAt: Date.now(),
        }));
        
        // Add to local state immediately (optimistic)
        setShapes([...shapes, ...newShapes]);
        
        // Select the newly pasted shapes
        setSelectedIds(newShapes.map(s => s.id));
        
        // Save to Firestore using batch operation (single atomic transaction)
        createShapeBatch(user.uid, newShapes);
        
        console.log(`[Paste] Pasted ${newShapes.length} shape(s)`);
        return;
      }
      
      // Cmd+X or Ctrl+X to cut
      if ((e.metaKey || e.ctrlKey) && e.key === 'x' && selectedIds.length > 0) {
        e.preventDefault();
        
        // Copy to clipboard
        const selectedShapes = shapes.filter(shape => selectedIds.includes(shape.id));
        setClipboard(selectedShapes);
        
        // Delete from local state immediately (optimistic)
        setShapes(shapes.filter(shape => !selectedIds.includes(shape.id)));
        
        // Clear selection
        setSelectedIds([]);
        
        // Delete from Firestore using batch operation (single atomic transaction)
        deleteShapeBatch(selectedIds);
        
        console.log(`[Cut] Cut ${selectedShapes.length} shape(s) to clipboard`);
        return;
      }
      
      // Delete or Backspace key
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        // Prevent default behavior (like browser back navigation on Backspace)
        e.preventDefault();
        
        // Delete all selected shapes from local state immediately (optimistic)
        setShapes(shapes.filter(shape => !selectedIds.includes(shape.id)));
        
        // Clear selection
        setSelectedIds([]);
        
        // Delete from Firestore using batch operation (single atomic transaction)
        deleteShapeBatch(selectedIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIds, shapes, editingText, clipboard, user]);

  // Note: beforeunload cleanup removed - it's unreliable and often fails
  // Instead, we rely on:
  // 1. onDisconnect handlers (registered in RTDB) - fires on tab close/crash
  // 2. Manual cleanup in authService.logout() - fires on explicit logout button
  // This dual approach ensures cleanup happens in both scenarios

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

  // Handle stage mouse down (for panning or marquee selection)
  const handleStageMouseDown = (e) => {
    // Only handle if clicking on the stage itself (not a shape)
    if (e.target === e.target.getStage()) {
      hasDragged.current = false; // Reset drag tracking
      justFinishedMarquee.current = false; // Reset marquee flag
      
      if (currentTool === 'hand') {
        // Hand tool: Pan the canvas
        isPanning.current = true;
      } else if (currentTool === 'select') {
        // Select tool: Start marquee selection
        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        const transform = stage.getAbsoluteTransform().copy().invert();
        const canvasPos = transform.point(pointerPos);
        
        setIsMarqueeSelecting(true);
        setMarqueeStart(canvasPos);
        setMarqueeCurrent(canvasPos);
      }
    }
  };

  // Handle stage mouse up
  const handleStageMouseUp = () => {
    isPanning.current = false;
    
    // Finish marquee selection
    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      justFinishedMarquee.current = true; // Mark that we just finished marquee
      
      // Calculate marquee bounds
      if (marqueeStart && marqueeCurrent) {
        const minX = Math.min(marqueeStart.x, marqueeCurrent.x);
        const maxX = Math.max(marqueeStart.x, marqueeCurrent.x);
        const minY = Math.min(marqueeStart.y, marqueeCurrent.y);
        const maxY = Math.max(marqueeStart.y, marqueeCurrent.y);
        
        // Find shapes within marquee (handles different shape types correctly)
        const selectedShapes = shapes.filter(shape => {
          let shapeLeft, shapeRight, shapeTop, shapeBottom;
          
          if (shape.type === 'ellipse') {
            // For ellipses, x/y is the CENTER, and we have width/height (which are diameters)
            const radiusX = (shape.width || 120) / 2;
            const radiusY = (shape.height || 80) / 2;
            shapeLeft = shape.x - radiusX;
            shapeRight = shape.x + radiusX;
            shapeTop = shape.y - radiusY;
            shapeBottom = shape.y + radiusY;
          } else {
            // For rectangles and text, x/y is top-left corner
            shapeLeft = shape.x;
            shapeRight = shape.x + (shape.width || 200);
            shapeTop = shape.y;
            shapeBottom = shape.y + (shape.height || 50);
          }
          
          // Check if shape intersects marquee box (any overlap counts)
          const intersects = !(
            shapeRight < minX ||   // Shape is completely to the left
            shapeLeft > maxX ||    // Shape is completely to the right
            shapeBottom < minY ||  // Shape is completely above
            shapeTop > maxY        // Shape is completely below
          );
          
          return intersects;
        });
        
        console.log(`[Marquee] Selected ${selectedShapes.length} shapes:`, selectedShapes.map(s => s.id));
        setSelectedIds(selectedShapes.map(s => s.id));
      }
      
      setMarqueeStart(null);
      setMarqueeCurrent(null);
    }
  };

  // Handle stage mouse move (for panning or marquee selection)
  const handleStageMouseMove = (e) => {
    // Handle cursor tracking
    handleMouseMove(e);

    // Mark that user has dragged (not just clicked)
    if (isMarqueeSelecting || isPanning.current) {
      hasDragged.current = true;
    }

    // Handle marquee selection
    if (isMarqueeSelecting) {
      const stage = stageRef.current;
      const pointerPos = stage.getPointerPosition();
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(pointerPos);
      setMarqueeCurrent(canvasPos);
      return;
    }

    // Handle panning (only with hand tool)
    if (isPanning.current && currentTool === 'hand') {
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
    // Don't handle click if we just finished a marquee selection
    if (justFinishedMarquee.current) {
      justFinishedMarquee.current = false;
      return;
    }
    
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

        // Calculate zIndex - new shapes go on top
        const maxZIndex = shapes.reduce((max, s) => Math.max(max, s.zIndex || 0), 0);

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
          zIndex: maxZIndex + 1, // Always create on top
          ...(currentTool === 'text' && { 
            text: 'Double-click to edit',
            fontSize: currentFontSize,
            fontFamily: currentFontFamily
          }),
          updatedBy: user.uid,
          updatedAt: Date.now(),
        };

        // Optimistic update: Add to local state immediately
        setShapes([...shapes, newShape]);
        setSelectedIds([newShape.id]);
        setCurrentTool('select'); // Auto-switch back to select mode

        // Save to Firestore
        createShape(user.uid, newShape);
      } else if (currentTool === 'select' && !hasDragged.current) {
        // Only deselect if user clicked (not dragged for marquee)
        setSelectedIds([]);
      }
      // Hand tool clicks do nothing
    }
  };

  // Handle shape selection with modifier keys
  const handleShapeClick = (e, shapeId) => {
    e.cancelBubble = true; // Prevent stage click from firing
    
    // Check if shape is locked
    const shape = shapes.find(s => s.id === shapeId);
    if (shape && shape.locked) {
      return; // Can't select locked shapes
    }
    
    if (currentTool === 'select') {
      const isShiftKey = e.evt.shiftKey;
      const isMetaKey = e.evt.metaKey || e.evt.ctrlKey; // Cmd on Mac, Ctrl on Windows
      
      if (isShiftKey || isMetaKey) {
        // Add/remove from selection
        if (selectedIds.includes(shapeId)) {
          // Remove from selection
          setSelectedIds(selectedIds.filter(id => id !== shapeId));
        } else {
          // Add to selection
          setSelectedIds([...selectedIds, shapeId]);
        }
      } else {
        // Replace selection with this shape
        setSelectedIds([shapeId]);
      }
    }
  };

  // Handle shape drag start
  const handleShapeDragStart = (e, shapeId) => {
    // Prevent panning when dragging a shape
    isPanning.current = false;
    setIsDragging(true);
    
    // If clicking on an unselected shape, select just that shape
    if (!selectedIds.includes(shapeId)) {
      setSelectedIds([shapeId]);
    }
    
    // Store initial positions of all selected shapes for group drag
    const draggedShape = shapes.find(s => s.id === shapeId);
    if (draggedShape && selectedIds.includes(shapeId)) {
      // Store relative offsets from the dragged shape to all other selected shapes
      const offsets = {};
      selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        if (shape) {
          offsets[id] = {
            dx: shape.x - draggedShape.x,
            dy: shape.y - draggedShape.y,
          };
        }
      });
      // Store in ref so we can access during drag
      e.target.groupDragOffsets = offsets;
      e.target.draggedShapeId = shapeId;
    }
    
    // Setup automatic cleanup on disconnect for all shapes
    selectedIds.forEach(id => setupDraggingCleanup(id));
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
    
    // Group drag: If multiple shapes are selected, move them all together
    if (selectedIds.length > 1 && selectedIds.includes(shapeId)) {
      const offsets = node.groupDragOffsets;
      if (offsets) {
        const newX = node.x();
        const newY = node.y();
        
        // Update positions of all selected shapes in local state
        setShapes(prevShapes => prevShapes.map(s => {
          if (selectedIds.includes(s.id)) {
            const offset = offsets[s.id] || { dx: 0, dy: 0 };
            const updatedShape = {
              ...s,
              x: newX + offset.dx,
              y: newY + offset.dy,
              updatedBy: user.uid,
              updatedAt: Date.now(),
            };
            
            // Broadcast transform state to RTDB for live preview
            updateTransformState(user.uid, s.id, {
              x: updatedShape.x,
              y: updatedShape.y,
              width: s.width || 200,
              height: s.height || 50,
              rotation: s.rotation || 0,
            });
            
            return updatedShape;
          }
          return s;
        }));
      }
    } else {
      // Single shape drag (existing behavior)
      updateTransformState(user.uid, shapeId, {
        x: node.x(),
        y: node.y(),
        width: shape.width || 200,
        height: shape.height || 50,
        rotation: shape.rotation || 0,
      });
    }
  };

  // Handle shape drag end
  const handleShapeDragEnd = (shapeId, e) => {
    setIsDragging(false);
    
    const node = e.target;
    const stage = node.getStage();

    // Update cursor position at drop point
    const stagePos = stage.getPointerPosition();
    if (stagePos) {
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(stagePos);
      updateCursorRTDB(user.uid, user.displayName || user.email, canvasPos.x, canvasPos.y);
    }

    // Group drag: Save all selected shapes to Firestore
    if (selectedIds.length > 1 && selectedIds.includes(shapeId)) {
      const offsets = node.groupDragOffsets;
      if (offsets) {
        const newX = node.x();
        const newY = node.y();
        
        // Prepare batch update for all selected shapes
        const updates = selectedIds.map(id => {
          const offset = offsets[id] || { dx: 0, dy: 0 };
          const finalX = newX + offset.dx;
          const finalY = newY + offset.dy;
          
          return {
            shapeId: id,
            data: { x: finalX, y: finalY }
          };
        });
        
        // Save to Firestore using batch operation (single atomic transaction)
        updateShapeBatch(user.uid, updates);
        
        // Clear all live dragging states after delay
        setTimeout(() => {
          selectedIds.forEach(id => {
            clearDraggingPosition(id);
          });
        }, 300);
        
        // Note: Local state already updated in handleShapeDragMove
      }
    } else {
      // Single shape drag (existing behavior)
      const newX = node.x();
      const newY = node.y();
      
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
      setTimeout(() => {
        clearDraggingPosition(shapeId);
      }, 300);
    }
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
      setSelectedIds([]);
    }
  };

  // Handle color change
  const handleColorChange = (color) => {
    setCurrentColor(color);
    
    // If shapes are selected, update their color immediately
    if (selectedIds.length > 0) {
      const newShapes = shapes.map((shape) => {
        if (selectedIds.includes(shape.id)) {
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
      
      // Save to Firestore (batch operation)
      selectedIds.forEach(id => updateShape(user.uid, id, { fill: color }));
    }
  };

  // Handle font size change
  const handleFontSizeChange = (fontSize) => {
    setCurrentFontSize(fontSize);
    
    // If text shapes are selected, update their font size immediately
    if (selectedIds.length > 0) {
      const newShapes = shapes.map((shape) => {
        if (selectedIds.includes(shape.id) && shape.type === 'text') {
          return {
            ...shape,
            fontSize: fontSize,
            updatedBy: user.uid,
            updatedAt: Date.now(),
          };
        }
        return shape;
      });
      setShapes(newShapes);
      
      // Save to Firestore (batch operation - only text shapes)
      selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        if (shape && shape.type === 'text') {
          updateShape(user.uid, id, { fontSize: fontSize });
        }
      });
    }
  };

  // Handle font family change
  const handleFontFamilyChange = (fontFamily) => {
    setCurrentFontFamily(fontFamily);
    
    // If text shapes are selected, update their font family immediately
    if (selectedIds.length > 0) {
      const newShapes = shapes.map((shape) => {
        if (selectedIds.includes(shape.id) && shape.type === 'text') {
          return {
            ...shape,
            fontFamily: fontFamily,
            updatedBy: user.uid,
            updatedAt: Date.now(),
          };
        }
        return shape;
      });
      setShapes(newShapes);
      
      // Save to Firestore (batch operation - only text shapes)
      selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        if (shape && shape.type === 'text') {
          updateShape(user.uid, id, { fontFamily: fontFamily });
        }
      });
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

    // Deselect shapes while editing
    setSelectedIds([]);
    
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

  // Bring selected shapes to front
  const handleBringToFront = () => {
    if (selectedIds.length === 0) return;
    
    // Calculate new zIndex - bring to top
    const maxZIndex = shapes.reduce((max, s) => Math.max(max, s.zIndex || 0), 0);
    
    // Update selected shapes with new zIndex values
    const updatedShapes = shapes.map(s => {
      if (selectedIds.includes(s.id)) {
        const newZIndex = maxZIndex + 1 + selectedIds.indexOf(s.id);
        return { ...s, zIndex: newZIndex, updatedBy: user.uid, updatedAt: Date.now() };
      }
      return s;
    });
    
    // Sort by zIndex and update local state
    setShapes(updatedShapes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)));
    
    // Save zIndex to Firestore for persistence
    selectedIds.forEach((id, index) => {
      updateShape(user.uid, id, { zIndex: maxZIndex + 1 + index });
    });
  };

  // Send selected shapes to back
  const handleSendToBack = () => {
    if (selectedIds.length === 0) return;
    
    // Find the minimum zIndex (bottom of stack)
    const minZIndex = shapes.reduce((min, s) => Math.min(min, s.zIndex || 0), 0);
    
    // Set selected shapes to zIndex values below current minimum
    const updatedShapes = shapes.map(s => {
      if (selectedIds.includes(s.id)) {
        const newZIndex = minZIndex - selectedIds.length + selectedIds.indexOf(s.id);
        return { ...s, zIndex: newZIndex, updatedBy: user.uid, updatedAt: Date.now() };
      }
      return s;
    });
    
    // Sort by zIndex and update local state
    setShapes(updatedShapes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)));
    
    // Save zIndex to Firestore for persistence
    selectedIds.forEach((id, index) => {
      updateShape(user.uid, id, { zIndex: minZIndex - selectedIds.length + index });
    });
  };

  return (
    <div className="canvas-container">
      <CanvasToolbar 
        currentTool={currentTool} 
        currentColor={currentColor}
        currentFontSize={currentFontSize}
        currentFontFamily={currentFontFamily}
        onToolChange={handleToolChange} 
        onColorChange={handleColorChange}
        onFontSizeChange={handleFontSizeChange}
        onFontFamilyChange={handleFontFamilyChange}
        onExport={handleExport}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        hasSelection={selectedIds.length > 0}
        hasTextSelection={selectedIds.length > 0 && shapes.some(s => selectedIds.includes(s.id) && s.type === 'text')}
      />
      <PresencePanel users={onlineUsers} currentUser={user} />
      <LayerPanel 
        shapes={shapes}
        selectedIds={selectedIds}
        onSelectShape={setSelectedIds}
        remoteSelections={remoteSelections}
        user={user}
      />
      
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
          {getVisibleShapes(shapes, selectedIds, isDragging, isTransforming)
            .filter(shape => shape.visible !== false) // Don't render hidden shapes
            .map((shape) => {
            const isSelected = selectedIds.includes(shape.id);
            const isLocked = shape.locked === true;
            
            // Check if this shape is being dragged/transformed by another user
            const remoteTransform = remoteDragging.find(drag => drag.shapeId === shape.id);
            
            // Check if this shape is selected by another user (handle both array and string)
            const remoteSelection = remoteSelections.find(sel => {
              // Support both old (shapeId) and new (shapeIds) format
              if (sel.shapeIds) {
                return sel.shapeIds.includes(shape.id);
              } else if (sel.shapeId) {
                return sel.shapeId === shape.id;
              }
              return false;
            });
            
            // Use remote transform data if available, otherwise use shape's data
            // Handle partial transform data gracefully
            const displayX = remoteTransform?.x ?? shape.x;
            const displayY = remoteTransform?.y ?? shape.y;
            const displayWidth = remoteTransform?.width ?? shape.width;
            const displayHeight = remoteTransform?.height ?? shape.height;
            const displayRotation = remoteTransform?.rotation ?? shape.rotation;
            
            // Determine outline color and width based on selection/transform state
            // Priority: Local selection > Remote transform > Remote selection
            let outlineColor = undefined;
            let outlineWidth = 0;
            let shapeOpacity = 1;
            
            if (isSelected) {
              // Local user has this shape selected
              outlineColor = '#0066FF';
              outlineWidth = 3;
            } else if (remoteTransform) {
              // Another user is actively dragging/transforming this shape
              outlineColor = '#FFA500';
              outlineWidth = 2;
              shapeOpacity = 0.7;
            } else if (remoteSelection) {
              // Another user has this shape selected (not actively transforming)
              outlineColor = remoteSelection.color;
              outlineWidth = 3;
            }
            
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
              draggable: currentTool === 'select' && !isLocked, // Can't drag locked shapes
              onClick: (e) => handleShapeClick(e, shape.id),
              onDragStart: (e) => handleShapeDragStart(e, shape.id),
              onDragMove: (e) => handleShapeDragMove(shape.id, e),
              onDragEnd: (e) => handleShapeDragEnd(shape.id, e),
              onTransformStart: () => handleShapeTransformStart(shape.id),
              onTransform: (e) => handleShapeTransformMove(shape.id, e.target),
              onTransformEnd: (e) => handleShapeTransformEnd(shape.id, e.target),
              stroke: outlineColor,
              strokeWidth: outlineWidth,
              opacity: isLocked ? shapeOpacity * 0.7 : shapeOpacity, // Locked shapes slightly faded
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
          
          {/* Marquee selection box */}
          {isMarqueeSelecting && marqueeStart && marqueeCurrent && (
            <Rect
              x={Math.min(marqueeStart.x, marqueeCurrent.x)}
              y={Math.min(marqueeStart.y, marqueeCurrent.y)}
              width={Math.abs(marqueeCurrent.x - marqueeStart.x)}
              height={Math.abs(marqueeCurrent.y - marqueeStart.y)}
              stroke="#0066FF"
              strokeWidth={2}
              dash={[5, 5]}
              fill="rgba(0, 102, 255, 0.1)"
              listening={false}
            />
          )}
          
          {/* Selection bounding box for multiple selections */}
          {selectedIds.length > 1 && (() => {
            const bounds = getSelectionBounds(shapes, selectedIds);
            return bounds ? (
              <Rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                stroke="#0066FF"
                strokeWidth={2}
                dash={[10, 5]}
                listening={false}
              />
            ) : null;
          })()}
          
          {/* Remote user selection indicators - always show bounding box with username tag */}
          {remoteSelections.map((selection) => {
            const { userId, userName, color, shapeIds } = selection;
            
            if (!shapeIds || shapeIds.length === 0) return null;
            
            // Helper function to get shape position (live drag position if available, otherwise stored position)
            const getShapeDisplayPosition = (shape) => {
              const remoteTransform = remoteDragging.find(drag => drag.shapeId === shape.id && drag.userId === userId);
              return {
                x: remoteTransform?.x ?? shape.x,
                y: remoteTransform?.y ?? shape.y,
                width: remoteTransform?.width ?? shape.width,
                height: remoteTransform?.height ?? shape.height,
                rotation: remoteTransform?.rotation ?? shape.rotation,
              };
            };
            
            // Calculate bounding box for all selected shapes (single or multiple)
            const selectedShapes = shapes.filter(s => shapeIds.includes(s.id));
            if (selectedShapes.length === 0) return null;
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            selectedShapes.forEach(shape => {
              const displayPos = getShapeDisplayPosition(shape);
              const width = displayPos.width || (shape.type === 'ellipse' ? 120 : 200);
              const height = displayPos.height || (shape.type === 'ellipse' ? 80 : 50);
              const rotation = displayPos.rotation || 0;
              
              if (rotation === 0) {
                // No rotation - simple case
                minX = Math.min(minX, displayPos.x);
                minY = Math.min(minY, displayPos.y);
                maxX = Math.max(maxX, displayPos.x + width);
                maxY = Math.max(maxY, displayPos.y + height);
              } else {
                // Rotation - calculate rotated corners and find axis-aligned bounding box
                const rad = (rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                
                // Four corners of the shape (before rotation)
                const corners = [
                  { x: 0, y: 0 },
                  { x: width, y: 0 },
                  { x: width, y: height },
                  { x: 0, y: height },
                ];
                
                // Rotate each corner and translate to shape position
                corners.forEach(corner => {
                  const rotatedX = corner.x * cos - corner.y * sin + displayPos.x;
                  const rotatedY = corner.x * sin + corner.y * cos + displayPos.y;
                  
                  minX = Math.min(minX, rotatedX);
                  minY = Math.min(minY, rotatedY);
                  maxX = Math.max(maxX, rotatedX);
                  maxY = Math.max(maxY, rotatedY);
                });
              }
            });
            
            const bounds = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };
            
            const tagWidth = userName.length * 7 + 12;
            const tagHeight = 20;
            
            return (
              <React.Fragment key={`selection-box-${userId}`}>
                {/* Bounding box */}
                <Rect
                  x={bounds.x}
                  y={bounds.y}
                  width={bounds.width}
                  height={bounds.height}
                  stroke={color}
                  strokeWidth={2}
                  dash={[10, 5]}
                  listening={false}
                />
                {/* Username tag at top of bounding box */}
                <Rect
                  x={bounds.x}
                  y={bounds.y - tagHeight - 4}
                  width={tagWidth}
                  height={tagHeight}
                  fill={color}
                  cornerRadius={3}
                  listening={false}
                />
                <Text
                  x={bounds.x + 6}
                  y={bounds.y - tagHeight - 1}
                  text={userName}
                  fontSize={12}
                  fill="white"
                  fontStyle="bold"
                  listening={false}
                />
              </React.Fragment>
            );
          })}
          
          {/* Transformer for resize and rotate handles (single selection only) */}
          {selectedIds.length === 1 && (
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
          )}
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
        onShapesCreated={(newShapes) => {
          // Optimistic update: Add AI-generated shapes immediately to local state
          // Firestore will confirm in background (200-300ms), but user sees instant feedback
          console.log(`[Canvas] Optimistically adding ${newShapes.length} AI-generated shapes`);
          setShapes([...shapes, ...newShapes]);
        }}
      />
    </div>
  );
};

export default Canvas;
