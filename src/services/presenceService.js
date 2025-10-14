import { db } from './firebase';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';
const STALE_THRESHOLD = 15000; // 15 seconds to account for browser tab throttling 

/**
 * Hash userId to a consistent color (reuse from cursor colors)
 */
const getUserColor = (userId) => {
  // Generate a hash from the userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash to generate HSL values for better color distribution
  const hue = Math.abs(hash) % 360; // 0-359 degrees
  const saturation = 65 + (Math.abs(hash >> 8) % 25); // 65-90% for vibrant colors
  const lightness = 45 + (Math.abs(hash >> 16) % 20); // 45-65% for good contrast
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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
 * Filters out users who haven't updated in last STALE_THRESHOLD seconds
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

