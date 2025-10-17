# Phase 1: Hybrid Database Migration

Migrate cursors and presence from Firestore to Firebase Realtime Database for <50ms sync latency.

---

## RTDB Data Structure

```javascript
/sessions/
  └─ {canvasId}/
      ├─ cursors/
      │   └─ {userId}: { x, y, color, userName, updatedAt }
      │
      └─ presence/
          └─ {userId}: { userName, online, color, lastSeen }
```

---

## Tasks

### 1. Project Setup
1. Enable RTDB in Firebase console
2. Add RTDB to `src/services/firebase.js`:
   ```javascript
   import { getDatabase } from 'firebase/database';
   export const rtdb = getDatabase(app);
   ```
3. Connect RTDB emulator for local development
4. Verify connection with basic read/write test

**Files Modified:**
- `src/services/firebase.js`

---

### 2. Create RTDB Service Layer
1. Create `src/services/rtdbService.js`
2. Add helper utilities:
   - `getUserColor(userId)` - color hashing
   - Path constants for RTDB structure
3. Implement connection monitoring:
   ```javascript
   import { ref, onValue } from 'firebase/database';
   const connectedRef = ref(rtdb, '.info/connected');
   onValue(connectedRef, (snap) => {
     const isConnected = snap.val();
     // Update connection state
   });
   ```

**Files Created:**
- `src/services/rtdbService.js`

---

### 3. Migrate Cursors to RTDB
1. Add cursor functions to `rtdbService.js`:
   ```javascript
   export const updateCursorRTDB = (canvasId, userId, userName, x, y) => {
     const cursorRef = ref(rtdb, `sessions/${canvasId}/cursors/${userId}`);
     set(cursorRef, { x, y, userName, color: getUserColor(userId), updatedAt: Date.now() });
   };
   
   export const subscribeToCursorsRTDB = (canvasId, callback) => {
     const cursorsRef = ref(rtdb, `sessions/${canvasId}/cursors`);
     return onValue(cursorsRef, (snapshot) => {
       const cursors = [];
       snapshot.forEach((child) => {
         cursors.push({ userId: child.key, ...child.val() });
       });
       callback(cursors);
     });
   };
   
   export const deleteCursorRTDB = (canvasId, userId) => {
     const cursorRef = ref(rtdb, `sessions/${canvasId}/cursors/${userId}`);
     remove(cursorRef);
   };
   ```

2. Implement `onDisconnect()` for automatic cleanup:
   ```javascript
   import { onDisconnect } from 'firebase/database';
   const cursorRef = ref(rtdb, `sessions/${canvasId}/cursors/${userId}`);
   onDisconnect(cursorRef).remove();
   ```

3. Update `Canvas.jsx`:
   - Replace `updateCursor` with `updateCursorRTDB`
   - Replace `subscribeToCursors` with `subscribeToCursorsRTDB`
   - Replace `deleteCursor` with `deleteCursorRTDB`
   - Reduce throttle to 50ms

4. Test cursor sync latency (target: <50ms)

**Files Modified:**
- `src/services/rtdbService.js`
- `src/components/Canvas/Canvas.jsx`

---

### 4. Migrate Presence to RTDB
1. Add presence functions to `rtdbService.js`:
   ```javascript
   export const setUserOnlineRTDB = (canvasId, userId, userName) => {
     const presenceRef = ref(rtdb, `sessions/${canvasId}/presence/${userId}`);
     set(presenceRef, {
       userName,
       online: true,
       color: getUserColor(userId),
       lastSeen: Date.now()
     });
     
     // Auto cleanup on disconnect
     onDisconnect(presenceRef).set({
       userName,
       online: false,
       color: getUserColor(userId),
       lastSeen: Date.now()
     });
   };
   
   export const subscribeToPresenceRTDB = (canvasId, callback) => {
     const presenceRef = ref(rtdb, `sessions/${canvasId}/presence`);
     return onValue(presenceRef, (snapshot) => {
       const users = [];
       snapshot.forEach((child) => {
         const data = child.val();
         if (data.online) {
           users.push({ userId: child.key, ...data });
         }
       });
       callback(users);
     });
   };
   ```

2. Update `Canvas.jsx`:
   - Replace `setUserOnline` with `setUserOnlineRTDB`
   - Replace `subscribeToPresence` with `subscribeToPresenceRTDB`
   - **Remove heartbeat interval** (replaced by onDisconnect)
   - Keep `beforeunload` handler as backup

**Files Modified:**
- `src/services/rtdbService.js`
- `src/components/Canvas/Canvas.jsx`

---

### 5. Connection State Indicator
1. Create `src/components/Connection/ConnectionIndicator.jsx`:
   ```javascript
   const ConnectionIndicator = () => {
     const [isConnected, setIsConnected] = useState(true);
     
     useEffect(() => {
       const connectedRef = ref(rtdb, '.info/connected');
       return onValue(connectedRef, (snap) => {
         setIsConnected(snap.val());
       });
     }, []);
     
     return (
       <div className="connection-indicator">
         <span className={isConnected ? 'connected' : 'disconnected'} />
         {!isConnected && <span>Reconnecting...</span>}
       </div>
     );
   };
   ```

2. Add to `Header.jsx` or `CanvasToolbar.jsx`

**Files Created:**
- `src/components/Connection/ConnectionIndicator.jsx`
- `src/components/Connection/ConnectionIndicator.css`

**Files Modified:**
- `src/components/Layout/Header.jsx` or `src/components/Canvas/CanvasToolbar.jsx`

---

### 6. RTDB Security Rules
1. Create `rtdb.rules.json`:
   ```json
   {
     "rules": {
       "sessions": {
         "$canvasId": {
           "cursors": {
             "$userId": {
               ".read": "auth != null",
               ".write": "auth.uid === $userId"
             }
           },
           "presence": {
             "$userId": {
               ".read": "auth != null",
               ".write": "auth.uid === $userId"
             }
           }
         }
       }
     }
   }
   ```

2. Test rules with emulator
3. Deploy to production

**Files Created:**
- `rtdb.rules.json`

---

### 7. Performance Testing
Test scenarios:
- [ ] Cursor latency < 50ms (2 users)
- [ ] Cursor latency < 50ms (5 users)
- [ ] Presence updates real-time
- [ ] onDisconnect cleanup working
- [ ] Network reconnection smooth
- [ ] No memory leaks (30min session)

---

### 8. Cleanup
1. Delete or deprecate:
   - `src/services/cursorService.js`
   - `src/services/presenceService.js`
2. Update `progress_report.md` with Phase 1 completion
3. Remove debug console.log statements

**Files Deleted:**
- `src/services/cursorService.js`
- `src/services/presenceService.js`

**Files Modified:**
- `progress_report.md`

---

## Success Criteria
- ✅ Cursors syncing via RTDB with <50ms latency
- ✅ Presence using onDisconnect (no heartbeat)
- ✅ Connection indicator visible
- ✅ Security rules deployed
- ✅ No regressions in existing functionality
