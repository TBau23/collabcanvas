import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';

/**
 * Create a new shape in Firestore
 * @param {string} userId - User ID who created the shape
 * @param {object} shapeData - Shape data (id, type, x, y, width, height, fill, rotation)
 */
export const createShape = async (userId, shapeData) => {
  try {
    const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeData.id);
    await setDoc(shapeRef, {
      ...shapeData,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error creating shape:', error);
  }
};

/**
 * Update an existing shape in Firestore
 * @param {string} userId - User ID who updated the shape
 * @param {string} shapeId - Shape ID
 * @param {object} updates - Fields to update
 */
export const updateShape = async (userId, shapeId, updates) => {
  try {
    const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
    await setDoc(
      shapeRef,
      {
        ...updates,
        updatedBy: userId,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating shape:', error);
  }
};

/**
 * Delete a shape from Firestore
 * @param {string} shapeId - Shape ID
 */
export const deleteShape = async (shapeId) => {
  try {
    const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
    await deleteDoc(shapeRef);
  } catch (error) {
    console.error('Error deleting shape:', error);
  }
};

/**
 * Subscribe to shape updates from all users
 * @param {Function} callback - Called with array of shape objects
 * @returns {Function} Unsubscribe function
 */
export const subscribeToShapes = (callback) => {
  const objectsRef = collection(db, 'canvases', CANVAS_ID, 'objects');

  return onSnapshot(
    objectsRef,
    (snapshot) => {
      const shapes = [];
      snapshot.forEach((doc) => {
        shapes.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      callback(shapes);
    },
    (error) => {
      console.error('Error subscribing to shapes:', error);
    }
  );
};

