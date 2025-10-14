import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';
const THROTTLE_MS = 100;
let lastUpdate = 0;

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

/**
 * Update cursor position in Firestore (throttled)
 * @param {string} userId - User ID
 * @param {string} userName - Display name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export const updateCursor = async (userId, userName, x, y) => {
  const now = Date.now();
  
  // Throttle updates to max 1 per THROTTLE_MS
  if (now - lastUpdate < THROTTLE_MS) return;
  lastUpdate = now;
  
  try {
    const cursorRef = doc(db, 'canvases', CANVAS_ID, 'cursors', userId);
    await setDoc(cursorRef, {
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
 * Filters out stale cursors (not updated in last 30 seconds)
 * @param {Function} callback - Called with array of cursor objects
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCursors = (callback) => {
  const cursorsRef = collection(db, 'canvases', CANVAS_ID, 'cursors');
  const STALE_THRESHOLD = 30000; // 30 seconds
  
  return onSnapshot(cursorsRef, (snapshot) => {
    const now = Date.now();
    const cursors = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Only include cursors updated in the last 10 seconds
      if (data.updatedAt && (now - data.updatedAt) < STALE_THRESHOLD) {
        cursors.push({ 
          userId: doc.id, 
          ...data 
        });
      }
    });
    
    callback(cursors);
  }, (error) => {
    console.error('Error subscribing to cursors:', error);
  });
};

/**
 * Delete cursor from Firestore (on disconnect/logout)
 * @param {string} userId - User ID
 */
export const deleteCursor = async (userId) => {
  try {
    const cursorRef = doc(db, 'canvases', CANVAS_ID, 'cursors', userId);
    await deleteDoc(cursorRef);
  } catch (error) {
    console.error('Error deleting cursor:', error);
  }
};

