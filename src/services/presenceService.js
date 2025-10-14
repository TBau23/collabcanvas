import { db } from './firebase';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';
const STALE_THRESHOLD = 30000; // 30 seconds

/**
 * Hash userId to a consistent color (reuse from cursor colors)
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
 * Set user as online (called on mount and via heartbeat)
 * @param {string} userId - User ID
 * @param {string} userName - Display name
 */
export const setUserOnline = async (userId, userName) => {
  try {
    const presenceRef = doc(db, 'canvases', CANVAS_ID, 'presence', userId);
    await setDoc(presenceRef, {
      userName,
      online: true,
      color: getUserColor(userId),
      lastSeen: Date.now(),
    });
  } catch (error) {
    console.error('Error setting user online:', error);
  }
};

/**
 * Subscribe to presence updates
 * Filters out users who haven't updated in last 30 seconds
 * @param {Function} callback - Called with array of online user objects
 * @returns {Function} Unsubscribe function
 */
export const subscribeToPresence = (callback) => {
  const presenceRef = collection(db, 'canvases', CANVAS_ID, 'presence');

  return onSnapshot(
    presenceRef,
    (snapshot) => {
      const now = Date.now();
      const users = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include users who are online and have updated recently
        if (
          data.online &&
          data.lastSeen &&
          now - data.lastSeen < STALE_THRESHOLD
        ) {
          users.push({
            userId: doc.id,
            ...data,
          });
        }
      });

      callback(users);
    },
    (error) => {
      console.error('Error subscribing to presence:', error);
    }
  );
};

/**
 * Set user as offline (called on unmount/beforeunload)
 * @param {string} userId - User ID
 */
export const setUserOffline = async (userId) => {
  try {
    const presenceRef = doc(db, 'canvases', CANVAS_ID, 'presence', userId);
    await setDoc(
      presenceRef,
      {
        online: false,
        lastSeen: Date.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error setting user offline:', error);
  }
};

