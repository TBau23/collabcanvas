import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';
import { setUserOfflineRTDB, deleteCursorRTDB, clearSelection } from './rtdbService';

/**
 * Register a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} displayName - User's display name
 * @returns {Promise<User>} Firebase user object
 */
export const register = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update user profile with display name
    await updateProfile(user, {
      displayName: displayName,
    });

    return user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

/**
 * Login existing user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<User>} Firebase user object
 */
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Logout current user
 * IMPORTANT: Cleans up RTDB data BEFORE signing out to ensure auth token is still valid
 * @returns {Promise<void>}
 */
export const logout = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[AUTH-DIAG ${timestamp}] ===== LOGOUT INITIATED =====`);
  
  try {
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      console.log(`[AUTH-DIAG ${timestamp}] Current user: ${currentUser.uid}`);
      console.log(`[AUTH-DIAG ${timestamp}] Cleaning up RTDB data BEFORE signing out...`);
      
      // Clean up RTDB data while still authenticated
      // This ensures auth.uid is still valid for security rules
      await Promise.all([
        setUserOfflineRTDB(currentUser.uid),
        deleteCursorRTDB(currentUser.uid),
        clearSelection(currentUser.uid),
      ]);
      
      console.log(`[AUTH-DIAG ${timestamp}] ✅ RTDB cleanup complete, now signing out...`);
    }
    
    await signOut(auth);
    console.log(`[AUTH-DIAG ${timestamp}] ✅ Sign out complete`);
  } catch (error) {
    console.error(`[AUTH-DIAG ${timestamp}] ❌ Logout error:`, error);
    throw error;
  }
};

