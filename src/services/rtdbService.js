import { rtdb } from './firebase';
import { ref, set, remove, onValue, onDisconnect } from 'firebase/database';

const CANVAS_ID = 'main-canvas';
const CURSOR_THROTTLE_MS = 50; // Reduced from 100ms for lower latency
const DRAG_THROTTLE_MS = 50; // Same as cursor for smooth dragging
let lastCursorUpdate = 0;
let lastDragUpdate = 0;

// Connection state tracking
let isConnected = false;
let connectionListeners = [];
let connectionChangeCount = 0;

// Initialize connection monitoring
const connectedRef = ref(rtdb, '.info/connected');
onValue(connectedRef, (snapshot) => {
  const previousState = isConnected;
  isConnected = snapshot.val() === true;
  connectionChangeCount++;
  
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] Connection state change #${connectionChangeCount}: ${previousState ? 'CONNECTED' : 'DISCONNECTED'} → ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  console.log(`[RTDB-DIAG ${timestamp}] Active connection listeners: ${connectionListeners.length}`);
  
  // Notify all listeners of connection state change
  connectionListeners.forEach((callback, index) => {
    console.log(`[RTDB-DIAG ${timestamp}] Notifying listener #${index} of connection state: ${isConnected}`);
    callback(isConnected);
  });
});

/**
 * Wait for RTDB connection to be established
 * @returns {Promise<void>} Resolves when connected
 */
const waitForConnection = () => {
  const timestamp = new Date().toISOString();
  
  if (isConnected) {
    console.log(`[RTDB-DIAG ${timestamp}] waitForConnection() - Already connected, returning immediately`);
    return Promise.resolve();
  }
  
  console.log(`[RTDB-DIAG ${timestamp}] waitForConnection() - NOT connected, waiting for connection...`);
  
  return new Promise((resolve) => {
    const listener = (connected) => {
      const innerTimestamp = new Date().toISOString();
      console.log(`[RTDB-DIAG ${innerTimestamp}] waitForConnection listener triggered - connected: ${connected}`);
      
      if (connected) {
        console.log(`[RTDB-DIAG ${innerTimestamp}] waitForConnection - Connection established! Resolving promise and removing listener`);
        // Remove this listener once connected
        connectionListeners = connectionListeners.filter(l => l !== listener);
        resolve();
      }
    };
    connectionListeners.push(listener);
    console.log(`[RTDB-DIAG ${timestamp}] waitForConnection() - Added listener, total listeners: ${connectionListeners.length}`);
  });
};

/**
 * Get current connection state
 * @returns {boolean} True if connected to RTDB
 */
export const isRTDBConnected = () => isConnected;

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
 * IMPORTANT: Only call this after connection is established
 * @param {string} userId - User ID
 */
export const setupCursorCleanup = async (userId) => {
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] ===== setupCursorCleanup() called for user: ${userId} =====`);
  console.log(`[RTDB-DIAG ${timestamp}] Current connection state: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    // Wait for connection before registering onDisconnect
    console.log(`[RTDB-DIAG ${timestamp}] Calling waitForConnection()...`);
    await waitForConnection();
    console.log(`[RTDB-DIAG ${timestamp}] waitForConnection() resolved! Connection is now: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    const cursorRef = ref(rtdb, `sessions/${CANVAS_ID}/cursors/${userId}`);
    console.log(`[RTDB-DIAG ${timestamp}] Cursor ref created: sessions/${CANVAS_ID}/cursors/${userId}`);
    
    // Setup automatic removal on disconnect
    console.log(`[RTDB-DIAG ${timestamp}] Registering onDisconnect().remove() handler...`);
    const disconnectRef = onDisconnect(cursorRef);
    await disconnectRef.remove();
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Cursor cleanup onDisconnect handler REGISTERED for user ${userId}`);
  } catch (error) {
    console.error(`[RTDB-DIAG ${timestamp}] ❌ ERROR setting up cursor cleanup:`, error);
    console.error(`[RTDB-DIAG ${timestamp}] Error stack:`, error.stack);
  }
};

/**
 * Delete cursor from RTDB (manual cleanup)
 * @param {string} userId - User ID
 */
export const deleteCursorRTDB = async (userId) => {
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] ===== deleteCursorRTDB() called for user: ${userId} =====`);
  console.log(`[RTDB-DIAG ${timestamp}] Current connection state: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    const cursorRef = ref(rtdb, `sessions/${CANVAS_ID}/cursors/${userId}`);
    console.log(`[RTDB-DIAG ${timestamp}] Manually removing cursor...`);
    await remove(cursorRef);
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Successfully removed cursor manually`);
  } catch (error) {
    console.error(`[RTDB-DIAG ${timestamp}] ❌ ERROR deleting cursor:`, error);
    console.error(`[RTDB-DIAG ${timestamp}] Error stack:`, error.stack);
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
// SELECTION OPERATIONS
// ============================================

/**
 * Update selected shape for a user (broadcast selection state)
 * @param {string} userId - User ID
 * @param {string} userName - Display name
 * @param {string} shapeId - Shape ID that is selected (null to clear)
 */
export const updateSelection = async (userId, userName, shapeId) => {
  try {
    const selectionRef = ref(rtdb, `sessions/${CANVAS_ID}/selections/${userId}`);
    
    if (shapeId) {
      await set(selectionRef, {
        shapeId,
        userName,
        color: getUserColor(userId),
        updatedAt: Date.now(),
      });
    } else {
      // Clear selection
      await remove(selectionRef);
    }
  } catch (error) {
    console.error('Error updating selection:', error);
  }
};

/**
 * Subscribe to selection updates from all users
 * @param {Function} callback - Called with array of selection objects
 * @returns {Function} Unsubscribe function
 */
export const subscribeToSelections = (callback) => {
  const selectionsRef = ref(rtdb, `sessions/${CANVAS_ID}/selections`);
  
  return onValue(selectionsRef, (snapshot) => {
    const selections = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        selections.push({
          userId: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
    
    callback(selections);
  }, (error) => {
    console.error('Error subscribing to selections:', error);
  });
};

/**
 * Setup automatic cleanup of selection state on disconnect
 * IMPORTANT: Only call this after connection is established
 * @param {string} userId - User ID
 */
export const setupSelectionCleanup = async (userId) => {
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] ===== setupSelectionCleanup() called for user: ${userId} =====`);
  console.log(`[RTDB-DIAG ${timestamp}] Current connection state: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    console.log(`[RTDB-DIAG ${timestamp}] Calling waitForConnection()...`);
    await waitForConnection();
    console.log(`[RTDB-DIAG ${timestamp}] waitForConnection() resolved! Connection is now: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    const selectionRef = ref(rtdb, `sessions/${CANVAS_ID}/selections/${userId}`);
    console.log(`[RTDB-DIAG ${timestamp}] Selection ref created: sessions/${CANVAS_ID}/selections/${userId}`);
    
    console.log(`[RTDB-DIAG ${timestamp}] Registering onDisconnect().remove() handler...`);
    const disconnectRef = onDisconnect(selectionRef);
    await disconnectRef.remove();
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Selection cleanup onDisconnect handler REGISTERED for user ${userId}`);
  } catch (error) {
    console.error(`[RTDB-DIAG ${timestamp}] ❌ ERROR setting up selection cleanup:`, error);
    console.error(`[RTDB-DIAG ${timestamp}] Error stack:`, error.stack);
  }
};

/**
 * Clear selection for a user (manual cleanup)
 * @param {string} userId - User ID
 */
export const clearSelection = async (userId) => {
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] ===== clearSelection() called for user: ${userId} =====`);
  console.log(`[RTDB-DIAG ${timestamp}] Current connection state: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    const selectionRef = ref(rtdb, `sessions/${CANVAS_ID}/selections/${userId}`);
    console.log(`[RTDB-DIAG ${timestamp}] Manually removing selection...`);
    await remove(selectionRef);
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Successfully removed selection manually`);
  } catch (error) {
    console.error(`[RTDB-DIAG ${timestamp}] ❌ ERROR clearing selection:`, error);
    console.error(`[RTDB-DIAG ${timestamp}] Error stack:`, error.stack);
  }
};

// ============================================
// PRESENCE OPERATIONS
// ============================================

/**
 * Set user as online and setup automatic offline on disconnect
 * IMPORTANT: Waits for connection before registering onDisconnect handler
 * @param {string} userId - User ID
 * @param {string} userName - Display name
 */
export const setUserOnlineRTDB = async (userId, userName) => {
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] ===== setUserOnlineRTDB() called for: ${userName} (${userId}) =====`);
  console.log(`[RTDB-DIAG ${timestamp}] Current connection state: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    // Wait for connection before doing anything
    console.log(`[RTDB-DIAG ${timestamp}] Calling waitForConnection()...`);
    await waitForConnection();
    console.log(`[RTDB-DIAG ${timestamp}] waitForConnection() resolved! Connection is now: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    const presenceRef = ref(rtdb, `sessions/${CANVAS_ID}/presence/${userId}`);
    console.log(`[RTDB-DIAG ${timestamp}] Presence ref created: sessions/${CANVAS_ID}/presence/${userId}`);
    
    // Set user online
    console.log(`[RTDB-DIAG ${timestamp}] Writing online: true to RTDB...`);
    await set(presenceRef, {
      userName,
      online: true,
      color: getUserColor(userId),
      lastSeen: Date.now(),
    });
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Successfully wrote online: true`);
    
    // Setup automatic removal on disconnect (recommended Firebase pattern)
    // This MUST be called while connected, otherwise it silently fails
    console.log(`[RTDB-DIAG ${timestamp}] Registering onDisconnect().remove() handler for presence...`);
    const disconnectRef = onDisconnect(presenceRef);
    await disconnectRef.remove();
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Presence onDisconnect handler REGISTERED for ${userName} (${userId})`);
    console.log(`[RTDB-DIAG ${timestamp}] When this client disconnects, presence entry will be REMOVED`);
  } catch (error) {
    console.error(`[RTDB-DIAG ${timestamp}] ❌ ERROR setting user online:`, error);
    console.error(`[RTDB-DIAG ${timestamp}] Error stack:`, error.stack);
  }
};

/**
 * Subscribe to presence updates
 * Now checks for existence rather than online:true since we remove entries on disconnect
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
          // All entries in presence are considered online (removed on disconnect)
          users.push({
            userId: childSnapshot.key,
            ...data,
            online: true, // Always true since we remove offline users
          });
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
 * Using remove() instead of set() to match onDisconnect behavior
 * @param {string} userId - User ID
 */
export const setUserOfflineRTDB = async (userId) => {
  const timestamp = new Date().toISOString();
  console.log(`[RTDB-DIAG ${timestamp}] ===== setUserOfflineRTDB() called for user: ${userId} =====`);
  console.log(`[RTDB-DIAG ${timestamp}] Current connection state: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  try {
    const presenceRef = ref(rtdb, `sessions/${CANVAS_ID}/presence/${userId}`);
    
    console.log(`[RTDB-DIAG ${timestamp}] Manually removing presence entry...`);
    await remove(presenceRef);
    console.log(`[RTDB-DIAG ${timestamp}] ✅ Successfully removed presence entry manually`);
  } catch (error) {
    console.error(`[RTDB-DIAG ${timestamp}] ❌ ERROR removing presence:`, error);
    console.error(`[RTDB-DIAG ${timestamp}] Error stack:`, error.stack);
  }
};

// ============================================
// CONNECTION MONITORING
// ============================================

/**
 * Subscribe to connection state changes
 * @param {Function} callback - Called with boolean (true = connected, false = disconnected)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToConnectionState = (callback) => {
  // Add listener to internal connection state
  connectionListeners.push(callback);
  
  // Call immediately with current state
  callback(isConnected);
  
  // Return unsubscribe function
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== callback);
  };
};

