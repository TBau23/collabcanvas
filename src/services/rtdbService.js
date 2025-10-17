import { rtdb } from './firebase';
import { ref, set, remove, onValue, onDisconnect } from 'firebase/database';

const CANVAS_ID = 'main-canvas';
const CURSOR_THROTTLE_MS = 50; // Reduced from 100ms for lower latency
const DRAG_THROTTLE_MS = 50; // Same as cursor for smooth dragging
let lastCursorUpdate = 0;
let lastDragUpdate = 0;

/**
 * Hash userId to a consistent color
 */
const getUserColor = (userId) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#E74C3C', '#3498DB',
    '#9B59B6', '#1ABC9C', '#F39C12', '#E67E22'
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// ============================================
// CURSOR OPERATIONS
// ============================================

/**
 * Update cursor position in RTDB (throttled)
 * @param {string} userId - User ID
 * @param {string} userName - Display name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export const updateCursorRTDB = async (userId, userName, x, y) => {
  const now = Date.now();
  
  // Throttle updates to max 1 per CURSOR_THROTTLE_MS
  if (now - lastCursorUpdate < CURSOR_THROTTLE_MS) return;
  lastCursorUpdate = now;
  
  try {
    const cursorRef = ref(rtdb, `sessions/${CANVAS_ID}/cursors/${userId}`);
    await set(cursorRef, {
      x,
      y,
      userName,
      color: getUserColor(userId),
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error updating cursor:', error);
  }
};

/**
 * Subscribe to cursor updates from all users
 * @param {Function} callback - Called with array of cursor objects
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCursorsRTDB = (callback) => {
  const cursorsRef = ref(rtdb, `sessions/${CANVAS_ID}/cursors`);
  
  return onValue(cursorsRef, (snapshot) => {
    const cursors = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        cursors.push({
          userId: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
    
    callback(cursors);
  }, (error) => {
    console.error('Error subscribing to cursors:', error);
  });
};

/**
 * Delete cursor and set up automatic cleanup on disconnect
 * @param {string} userId - User ID
 */
export const setupCursorCleanup = (userId) => {
  try {
    const cursorRef = ref(rtdb, `sessions/${CANVAS_ID}/cursors/${userId}`);
    
    // Setup automatic removal on disconnect
    onDisconnect(cursorRef).remove();
  } catch (error) {
    console.error('Error setting up cursor cleanup:', error);
  }
};

/**
 * Delete cursor from RTDB (manual cleanup)
 * @param {string} userId - User ID
 */
export const deleteCursorRTDB = async (userId) => {
  try {
    const cursorRef = ref(rtdb, `sessions/${CANVAS_ID}/cursors/${userId}`);
    await remove(cursorRef);
  } catch (error) {
    console.error('Error deleting cursor:', error);
  }
};

// ============================================
// LIVE DRAGGING OPERATIONS
// ============================================

/**
 * Update shape position during drag (real-time sync)
 * @param {string} userId - User ID
 * @param {string} shapeId - Shape ID being dragged
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export const updateDraggingPosition = async (userId, shapeId, x, y) => {
  const now = Date.now();
  
  // Throttle updates
  if (now - lastDragUpdate < DRAG_THROTTLE_MS) return;
  lastDragUpdate = now;
  
  try {
    const dragRef = ref(rtdb, `sessions/${CANVAS_ID}/dragging/${shapeId}`);
    await set(dragRef, {
      userId,
      x,
      y,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error updating drag position:', error);
  }
};

/**
 * Update shape transform during resize/rotate (real-time sync)
 * @param {string} userId - User ID
 * @param {string} shapeId - Shape ID being transformed
 * @param {object} transform - { x, y, width, height, rotation }
 */
export const updateTransformState = async (userId, shapeId, transform) => {
  const now = Date.now();
  
  // Throttle updates (same as drag)
  if (now - lastDragUpdate < DRAG_THROTTLE_MS) return;
  lastDragUpdate = now;
  
  try {
    const transformRef = ref(rtdb, `sessions/${CANVAS_ID}/dragging/${shapeId}`);
    await set(transformRef, {
      userId,
      ...transform,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error updating transform state:', error);
  }
};

/**
 * Subscribe to live dragging updates
 * @param {Function} callback - Called with object { shapeId, userId, x, y }
 * @returns {Function} Unsubscribe function
 */
export const subscribeToDragging = (callback) => {
  const draggingRef = ref(rtdb, `sessions/${CANVAS_ID}/dragging`);
  
  return onValue(draggingRef, (snapshot) => {
    const draggingShapes = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        draggingShapes.push({
          shapeId: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
    
    callback(draggingShapes);
  }, (error) => {
    console.error('Error subscribing to dragging:', error);
  });
};

/**
 * Clear dragging state for a shape (on drag end)
 * @param {string} shapeId - Shape ID
 */
export const clearDraggingPosition = async (shapeId) => {
  try {
    const dragRef = ref(rtdb, `sessions/${CANVAS_ID}/dragging/${shapeId}`);
    await remove(dragRef);
  } catch (error) {
    console.error('Error clearing drag position:', error);
  }
};

/**
 * Setup automatic cleanup of dragging state on disconnect
 * @param {string} shapeId - Shape ID being dragged
 */
export const setupDraggingCleanup = (shapeId) => {
  try {
    const dragRef = ref(rtdb, `sessions/${CANVAS_ID}/dragging/${shapeId}`);
    onDisconnect(dragRef).remove();
  } catch (error) {
    console.error('Error setting up dragging cleanup:', error);
  }
};

// ============================================
// PRESENCE OPERATIONS
// ============================================

/**
 * Set user as online and setup automatic offline on disconnect
 * @param {string} userId - User ID
 * @param {string} userName - Display name
 */
export const setUserOnlineRTDB = async (userId, userName) => {
  try {
    const presenceRef = ref(rtdb, `sessions/${CANVAS_ID}/presence/${userId}`);
    
    // Set user online
    await set(presenceRef, {
      userName,
      online: true,
      color: getUserColor(userId),
      lastSeen: Date.now(),
    });
    
    // Setup automatic offline status on disconnect
    onDisconnect(presenceRef).set({
      userName,
      online: false,
      color: getUserColor(userId),
      lastSeen: Date.now(),
    });
  } catch (error) {
    console.error('Error setting user online:', error);
  }
};

/**
 * Subscribe to presence updates
 * @param {Function} callback - Called with array of online user objects
 * @returns {Function} Unsubscribe function
 */
export const subscribeToPresenceRTDB = (callback) => {
  const presenceRef = ref(rtdb, `sessions/${CANVAS_ID}/presence`);

  return onValue(
    presenceRef,
    (snapshot) => {
      const users = [];

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          // Only include users who are online
          if (data.online) {
            users.push({
              userId: childSnapshot.key,
              ...data,
            });
          }
        });
      }

      callback(users);
    },
    (error) => {
      console.error('Error subscribing to presence:', error);
    }
  );
};

/**
 * Set user as offline (manual cleanup on logout)
 * @param {string} userId - User ID
 */
export const setUserOfflineRTDB = async (userId) => {
  try {
    const presenceRef = ref(rtdb, `sessions/${CANVAS_ID}/presence/${userId}`);
    const userName = ''; // We don't have userName here, but it's ok
    
    await set(presenceRef, {
      userName,
      online: false,
      color: getUserColor(userId),
      lastSeen: Date.now(),
    });
  } catch (error) {
    console.error('Error setting user offline:', error);
  }
};

// ============================================
// CONNECTION MONITORING
// ============================================

/**
 * Subscribe to connection state
 * @param {Function} callback - Called with boolean (true = connected, false = disconnected)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToConnectionState = (callback) => {
  const connectedRef = ref(rtdb, '.info/connected');
  
  return onValue(connectedRef, (snapshot) => {
    const isConnected = snapshot.val() === true;
    callback(isConnected);
  });
};

