import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot, writeBatch } from 'firebase/firestore';

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
    const updateData = {
      ...updates,
      updatedBy: userId,
      updatedAt: Date.now(),
    };
    await setDoc(
      shapeRef,
      updateData,
      { merge: true }
    );

  } catch (error) {
    console.error('Error updating shape:', error);
    throw error;
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

/**
 * Create multiple shapes in a single batch transaction
 * @param {string} userId - User ID who created the shapes
 * @param {Array<object>} shapesArray - Array of shape data objects
 */
export const createShapeBatch = async (userId, shapesArray) => {
  try {
    const batch = writeBatch(db);
    const timestamp = Date.now();
    
    shapesArray.forEach(shapeData => {
      const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeData.id);
      batch.set(shapeRef, {
        ...shapeData,
        updatedBy: userId,
        updatedAt: timestamp,
      });
    });
    
    await batch.commit();
    console.log(`[Batch] Created ${shapesArray.length} shapes in single transaction`);
  } catch (error) {
    console.error('Error creating shapes batch:', error);
    throw error;
  }
};

/**
 * Update multiple shapes in a single batch transaction
 * @param {string} userId - User ID who updated the shapes
 * @param {Array<{shapeId: string, data: object}>} updates - Array of shape updates
 */
export const updateShapeBatch = async (userId, updates) => {
  try {
    const batch = writeBatch(db);
    const timestamp = Date.now();
    
    updates.forEach(({ shapeId, data }) => {
      const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
      batch.update(shapeRef, {
        ...data,
        updatedBy: userId,
        updatedAt: timestamp,
      });
    });
    
    await batch.commit();
    console.log(`[Batch] Updated ${updates.length} shapes in single transaction`);
  } catch (error) {
    console.error('Error updating shapes batch:', error);
    throw error;
  }
};

/**
 * Delete multiple shapes in a single batch transaction
 * @param {Array<string>} shapeIds - Array of shape IDs to delete
 */
export const deleteShapeBatch = async (shapeIds) => {
  try {
    const batch = writeBatch(db);
    
    shapeIds.forEach(shapeId => {
      const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
      batch.delete(shapeRef);
    });
    
    await batch.commit();
    console.log(`[Batch] Deleted ${shapeIds.length} shapes in single transaction`);
  } catch (error) {
    console.error('Error deleting shapes batch:', error);
    throw error;
  }
};

