# CollabCanvas MVP - Simplified Task List (24 Hour Focus)

## Philosophy

**MVP Goal:** Prove that real-time collaborative editing works. Get all 8 MVP requirements working by tomorrow.

**Post-MVP Goal:** Polish performance, add features, improve architecture over the following days.

**Key Simplifications:**
- ✅ Firestore only (add Realtime DB in post-MVP for performance)
- ✅ No automated testing (manual testing checklist instead)
- ✅ Simpler architecture (fewer abstraction layers)
- ✅ Fewer files (combine related components)
- ✅ Get it working, then make it better

---

## Simplified Project File Structure

```
collabcanvas/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Auth.css
│   │   ├── Canvas/
│   │   │   ├── Canvas.jsx
│   │   │   ├── CanvasToolbar.jsx
│   │   │   └── Canvas.css
│   │   ├── Cursors/
│   │   │   └── CursorLayer.jsx
│   │   ├── Presence/
│   │   │   └── PresencePanel.jsx
│   │   └── Layout/
│   │       └── Header.jsx
│   ├── services/
│   │   ├── firebase.js
│   │   ├── authService.js
│   │   ├── canvasService.js
│   │   ├── cursorService.js
│   │   └── presenceService.js
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── utils/
│   │   └── constants.js
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── .env.local
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

**Note:** Simpler structure - React Context instead of Zustand initially, no separate hooks layer, fewer files.



# CollabCanvas MVP - Final Task List

## Status: PR #1 Complete ✅

Authentication is done. Users can register, login, and session persists.

---

## MVP Strategy: Sync First, Features Second

**New Approach:**
1. ✅ Auth works (DONE)
2. 🎯 Prove multiplayer sync works (cursors)
3. Add canvas + shapes locally
4. Sync shapes (reuse cursor pattern)
5. Add presence
6. Deploy

**Key Philosophy:** Once cursor sync works, you've de-risked the entire project. Shapes are just "another event" using the same pattern.

---

## Firestore Data Model

### Single Shared Canvas for Everyone

**canvasId:** `"main-canvas"` (hardcoded for MVP)

Everyone who logs in sees the same canvas. No room selection, no canvas creation - just one universal shared space.

### Data Structure

```
/canvases/main-canvas (document)
  createdAt: timestamp
  name: "Main Canvas"

/canvases/main-canvas/cursors/{userId} (subcollection)
  x: number
  y: number
  userName: string
  color: string (hex)
  updatedAt: timestamp

/canvases/main-canvas/objects/{shapeId} (subcollection)
  type: "rectangle"
  x: number
  y: number
  width: number
  height: number
  fill: string (hex)
  rotation: number
  updatedBy: userId
  updatedAt: timestamp

/canvases/main-canvas/presence/{userId} (subcollection)
  userName: string
  online: boolean
  lastSeen: timestamp
```

**Why separate collections?**
- Cursors update 10-20x/sec - need own documents to avoid write contention
- Shapes update less frequently - permanent data
- Separate listeners = cursors don't trigger shape re-renders
- Each cursor/shape as its own document = no 1MB document limit issues

---

## PR #2: Multiplayer Cursors (Prove Sync Works) 🎯

**Goal:** Two logged-in users see each other's cursors moving in real-time on a Konva canvas

**Why this first:** Proves Firestore real-time sync works. Once this works, shapes are just copying the same pattern.

### Tasks:

#### Part A: Basic Canvas Setup
- [ ] Create `src/components/Canvas/Canvas.jsx`
- [ ] Import Konva: `import { Stage, Layer, Circle, Text } from 'react-konva'`
- [ ] Create Konva Stage (full window: `window.innerWidth` x `window.innerHeight`)
- [ ] Create one Layer (for cursors)
- [ ] Render stage in App.jsx when user is logged in
- [ ] Test: Canvas renders full screen

#### Part B: Cursor Service
- [ ] Create `src/services/cursorService.js`
- [ ] Add constant: `const CANVAS_ID = 'main-canvas'`
- [ ] Implement `updateCursor(userId, userName, x, y)`:
  - Takes cursor position
  - Throttles to max 1 update per 100ms
  - Saves to Firestore: `canvases/main-canvas/cursors/{userId}`
  - Document fields: `{ x, y, userName, color, updatedAt }`
- [ ] Implement `subscribeToCursors(callback)`:
  - Listens to `canvases/main-canvas/cursors` collection
  - Calls callback with array of cursor objects
  - Returns unsubscribe function
- [ ] Implement `getUserColor(userId)` helper:
  - Hash userId to consistent color
  - Return one of 5-6 distinct colors
- [ ] Test: Service functions exist without errors

#### Part C: Track Mouse Position
- [ ] In Canvas.jsx, add `onMouseMove` handler to Stage
- [ ] Get pointer position: `stage.getPointerPosition()`
- [ ] Import `useAuth` to get current user
- [ ] Call `updateCursor(user.uid, user.displayName || user.email, x, y)` on mouse move
- [ ] Test: Open Firestore console, see cursor document updating as you move mouse

#### Part D: Subscribe to Remote Cursors
- [ ] In Canvas.jsx, add state: `const [cursors, setCursors] = useState([])`
- [ ] In `useEffect`, subscribe to cursors: `subscribeToCursors((remoteCursors) => { setCursors(remoteCursors) })`
- [ ] Filter out own cursor: `remoteCursors.filter(c => c.userId !== user.uid)`
- [ ] Return unsubscribe on cleanup
- [ ] Test: console.log cursors array, should update as other users move

#### Part E: Render Remote Cursors
- [ ] Create `CursorMarker` component (or inline):
  - Renders Konva `Circle` at x, y position
  - Renders Konva `Text` with userName next to cursor
  - Uses cursor color prop
- [ ] Map over cursors array in Layer: `{cursors.map(cursor => <CursorMarker key={cursor.userId} {...cursor} />)}`
- [ ] Test: Open 2 browser windows (different users), see each other's cursors move

#### Part F: Testing
- [ ] Open 2 browser windows
- [ ] Login as different users in each
- [ ] Move mouse in window 1 → cursor appears in window 2
- [ ] Move mouse in window 2 → cursor appears in window 1
- [ ] Verify usernames are visible
- [ ] Verify cursors have different colors
- [ ] Verify own cursor is NOT duplicated

### Files Created:
- `src/components/Canvas/Canvas.jsx`
- `src/services/cursorService.js`

### Files Modified:
- `src/App.jsx` (add Canvas component for logged-in users)

### Implementation Details:

**cursorService.js structure:**
```javascript
import { db } from './firebase';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';
const THROTTLE_MS = 100;
let lastUpdate = 0;

export const updateCursor = async (userId, userName, x, y) => {
  const now = Date.now();
  if (now - lastUpdate < THROTTLE_MS) return;
  lastUpdate = now;
  
  const cursorRef = doc(db, 'canvases', CANVAS_ID, 'cursors', userId);
  await setDoc(cursorRef, {
    x,
    y,
    userName,
    color: getUserColor(userId),
    updatedAt: now
  });
};

export const subscribeToCursors = (callback) => {
  const cursorsRef = collection(db, 'canvases', CANVAS_ID, 'cursors');
  return onSnapshot(cursorsRef, (snapshot) => {
    const cursors = [];
    snapshot.forEach(doc => {
      cursors.push({ userId: doc.id, ...doc.data() });
    });
    callback(cursors);
  });
};

const getUserColor = (userId) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
```

**Canvas.jsx structure:**
```javascript
import { Stage, Layer, Circle, Text } from 'react-konva';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateCursor, subscribeToCursors } from '../services/cursorService';

export default function Canvas() {
  const { user } = useAuth();
  const [cursors, setCursors] = useState([]);
  
  useEffect(() => {
    const unsubscribe = subscribeToCursors((remoteCursors) => {
      const otherCursors = remoteCursors.filter(c => c.userId !== user.uid);
      setCursors(otherCursors);
    });
    return unsubscribe;
  }, [user.uid]);
  
  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    updateCursor(user.uid, user.displayName || user.email, pos.x, pos.y);
  };
  
  return (
    <Stage 
      width={window.innerWidth} 
      height={window.innerHeight}
      onMouseMove={handleMouseMove}
    >
      <Layer>
        {cursors.map(cursor => (
          <g key={cursor.userId}>
            <Circle 
              x={cursor.x} 
              y={cursor.y} 
              radius={8} 
              fill={cursor.color} 
            />
            <Text 
              x={cursor.x + 12} 
              y={cursor.y - 5} 
              text={cursor.userName} 
              fontSize={14} 
              fill={cursor.color} 
            />
          </g>
        ))}
      </Layer>
    </Stage>
  );
}
```

### Acceptance Criteria:
- [ ] Canvas renders full screen
- [ ] Two users see each other's cursors in real-time
- [ ] Usernames appear next to cursors
- [ ] Cursors have different colors per user
- [ ] Own cursor is not duplicated
- [ ] Cursors update within ~200ms (acceptable for MVP)

**🎉 Once this works, you've proven Firestore sync works. The hard part is done!**

---

## PR #3: Shapes - Local State Only

**Goal:** Add rectangles to canvas with pan/zoom (NOT synced yet)

**Why separate from sync:** Get comfortable with Konva shapes and interactions before adding sync complexity.

### Tasks:

#### Part A: Pan and Zoom
- [ ] Add state for stage position: `const [stagePos, setStagePos] = useState({ x: 0, y: 0 })`
- [ ] Add state for stage scale: `const [stageScale, setStageScale] = useState(1)`
- [ ] Add `onWheel` handler to Stage for zoom:
  - Prevent default
  - Calculate new scale (scale * 1.1 for zoom in, scale / 1.1 for zoom out)
  - Clamp scale between 0.1 and 3
  - Update zoom center point (mouse position)
- [ ] Make Stage draggable: `draggable={true}`
- [ ] Add `onDragEnd` handler to update stagePos
- [ ] Apply `x`, `y`, `scaleX`, `scaleY` props to Stage
- [ ] Test: Can pan (drag background) and zoom (mouse wheel)

#### Part B: Create Rectangles
- [ ] Add state: `const [shapes, setShapes] = useState([])`
- [ ] Create `src/components/Canvas/CanvasToolbar.jsx`:
  - onClick handler passed from parent
- [ ] In Canvas.jsx, add `handleAddRectangle`:
  - Generate unique ID: `crypto.randomUUID()`
  - Create shape object: `{ id, type: 'rectangle', x: 100, y: 100, width: 150, height: 100, fill: '#4A90E2', rotation: 0 }`
  - Add to shapes array
- [ ] Render toolbar in Canvas
- [ ] Test: Click button, shape object added to state

#### Part C: Render Rectangles
- [ ] Create new Layer for shapes (separate from cursor layer)
- [ ] Map over shapes array
- [ ] Render Konva `Rect` for each shape:
  - Props: x, y, width, height, fill, rotation
  - key={shape.id}
- [ ] Test: Rectangles appear on canvas

#### Part D: Select and Move Shapes
- [ ] Add state: `const [selectedId, setSelectedId] = useState(null)`
- [ ] Add `onClick` handler to each Rect → `setSelectedId(shape.id)`
- [ ] Add visual feedback for selected shape:
  - If `selectedId === shape.id`, add stroke: `stroke="#0066FF"` and `strokeWidth={2}`
- [ ] Make Rects draggable: `draggable={true}`
- [ ] Add `onDragEnd` handler to Rect:
  - Get new position from event
  - Update shape in shapes array with new x, y
- [ ] Test: Can click to select (blue border), drag to move

#### Part E: Click Background to Deselect
- [ ] Add `onClick` handler to Stage (background)
- [ ] Check if click target is Stage itself (not a shape)
- [ ] If so, `setSelectedId(null)`
- [ ] Test: Click empty space deselects shape

### Files Created:
- `src/components/Canvas/CanvasToolbar.jsx`

### Files Modified:
- `src/components/Canvas/Canvas.jsx` (add shapes, pan/zoom, toolbar)

### Acceptance Criteria:
- [ ] Can pan canvas by dragging background
- [ ] Can zoom canvas with mouse wheel
- [ ] Can create rectangles via toolbar button
- [ ] Rectangles appear on canvas
- [ ] Can select rectangle (visual feedback)
- [ ] Can drag rectangle to new position
- [ ] Can deselect by clicking background
- [ ] Multiple rectangles work independently

**Note:** Shapes are LOCAL only at this point. Not synced across users yet.

---

## PR #4: Sync Shapes (Copy Cursor Pattern)

**Goal:** Shapes sync across all users in real-time

**Why this is easy now:** You already did this for cursors. Just copy the pattern.

### Tasks:

#### Part A: Canvas Service
- [ ] Create `src/services/canvasService.js`
- [ ] Add constant: `const CANVAS_ID = 'main-canvas'`
- [ ] Implement `createShape(shapeData)`:
  - Add `updatedBy: userId` and `updatedAt: timestamp` to shapeData
  - Save to Firestore: `canvases/main-canvas/objects/{shapeId}`
  - Use shapeId from shapeData (client-generated UUID)
- [ ] Implement `updateShape(shapeId, updates)`:
  - Add `updatedBy` and `updatedAt` to updates
  - Update Firestore document
- [ ] Implement `deleteShape(shapeId)`:
  - Delete Firestore document
- [ ] Implement `subscribeToShapes(callback)`:
  - Listen to `canvases/main-canvas/objects` collection
  - Call callback with array of shape objects
  - Return unsubscribe function

#### Part B: Optimistic Updates
- [ ] In `handleAddRectangle`:
  - Add shape to local state immediately (optimistic)
  - Call `createShape(shapeData)` to save to Firestore
  - Don't wait for response
- [ ] On rectangle drag end:
  - Update local state immediately
  - Call `updateShape(shapeId, { x, y, updatedBy, updatedAt })`

#### Part C: Subscribe to Remote Shapes
- [ ] In Canvas.jsx, subscribe to shapes in `useEffect`
- [ ] Call `subscribeToShapes((remoteShapes) => { ... })`
- [ ] Handle incoming shapes:
  - For each remote shape, check if it exists locally
  - If new shape from another user, add to state
  - If updated shape from another user, update in state
  - Prevent updating shapes you just modified (check `updatedBy !== currentUserId` OR compare `updatedAt`)
- [ ] Return unsubscribe on cleanup

#### Part D: Conflict Resolution
- [ ] When receiving shape update from Firestore:
  - Check if `remoteShape.updatedAt > localShape.updatedAt`
  - If so, apply remote update
  - If not, ignore (your update is newer)
- [ ] This implements "last-write-wins"

#### Part E: Testing
- [ ] Open 2 browser windows (different users)
- [ ] Create shape in window 1 → appears in window 2
- [ ] Move shape in window 2 → updates in window 1
- [ ] Create 5 shapes rapidly in both windows
- [ ] Verify no duplicate shapes
- [ ] Verify no shapes disappear
- [ ] Refresh window 1 → all shapes still present
- [ ] Close all windows, reopen → all shapes persist

### Files Created:
- `src/services/canvasService.js`

### Files Modified:
- `src/components/Canvas/Canvas.jsx` (integrate shape sync)

### Implementation Hint:

**canvasService.js is almost identical to cursorService.js:**
```javascript
import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';

export const createShape = async (userId, shapeData) => {
  const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeData.id);
  await setDoc(shapeRef, {
    ...shapeData,
    updatedBy: userId,
    updatedAt: Date.now()
  });
};

export const updateShape = async (userId, shapeId, updates) => {
  const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
  await setDoc(shapeRef, {
    ...updates,
    updatedBy: userId,
    updatedAt: Date.now()
  }, { merge: true });
};

export const deleteShape = async (shapeId) => {
  const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
  await deleteDoc(shapeRef);
};

export const subscribeToShapes = (callback) => {
  const objectsRef = collection(db, 'canvases', CANVAS_ID, 'objects');
  return onSnapshot(objectsRef, (snapshot) => {
    const shapes = [];
    snapshot.forEach(doc => {
      shapes.push({ id: doc.id, ...doc.data() });
    });
    callback(shapes);
  });
};
```

### Acceptance Criteria:
- [ ] Shapes save to Firestore on creation
- [ ] Shape updates save to Firestore on drag end
- [ ] Changes from other users appear within ~200ms
- [ ] Two users can create shapes simultaneously
- [ ] Two users can move shapes simultaneously
- [ ] No duplicate shapes appear
- [ ] Refreshing browser preserves all shapes
- [ ] All users disconnect and reconnect → shapes persist
- [ ] No console errors

---

## PR #5: Presence Panel

**Goal:** Show list of currently online users

**Why this is easy:** Copy cursor service pattern again, just different data.

### Tasks:

#### Part A: Presence Service
- [ ] Create `src/services/presenceService.js`
- [ ] Add constant: `const CANVAS_ID = 'main-canvas'`
- [ ] Implement `setUserOnline(userId, userName)`:
  - Save to Firestore: `canvases/main-canvas/presence/{userId}`
  - Document: `{ userName, online: true, lastSeen: Date.now() }`
- [ ] Implement `setUserOffline(userId)`:
  - Update document: `{ online: false, lastSeen: Date.now() }`
- [ ] Implement `subscribeToPresence(callback)`:
  - Listen to `canvases/main-canvas/presence` collection
  - Filter to only online users: `filter(u => u.online && Date.now() - u.lastSeen < 30000)`
  - Call callback with array of online users
  - Return unsubscribe function
- [ ] Implement heartbeat: Update `lastSeen` every 10 seconds while user is active

#### Part B: Presence Panel UI
- [ ] Create `src/components/Presence/PresencePanel.jsx`
- [ ] Simple UI: Fixed sidebar or floating panel
- [ ] Show list of online users (names)
- [ ] Show user count: "3 users online"
- [ ] Optional: Show user avatars (initials in colored circles)
- [ ] Add basic CSS styling

#### Part C: Integration
- [ ] In Canvas.jsx (or App.jsx), call `setUserOnline` when user logs in
- [ ] Subscribe to presence in `useEffect`
- [ ] Set up heartbeat interval (update every 10 seconds)
- [ ] On component unmount (user closes tab), call `setUserOffline`
- [ ] Add `window.addEventListener('beforeunload', setUserOffline)` for cleanup
- [ ] Render PresencePanel in Canvas or Header

#### Part D: Testing
- [ ] Open 2 browser windows (different users)
- [ ] Both users appear in presence list
- [ ] User count is correct
- [ ] Close window 1 → after ~30 seconds, user removed from list
- [ ] Test with 5 users

### Files Created:
- `src/services/presenceService.js`
- `src/components/Presence/PresencePanel.jsx`

### Files Modified:
- `src/components/Canvas/Canvas.jsx` or `src/App.jsx` (initialize presence)

### Acceptance Criteria:
- [ ] Panel shows all currently online users
- [ ] User count is accurate
- [ ] Users appear when they join
- [ ] Users disappear when they leave (within 30 seconds)
- [ ] Works with 5+ concurrent users

---

## PR #6: Deployment + Final Testing

**Goal:** App is publicly accessible and all MVP requirements validated

### Tasks:

#### Part A: Firestore Security Rules
- [ ] Create `firestore.rules` file
- [ ] Start with permissive rules (authenticated users can read/write):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /canvases/{canvasId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
- [ ] Deploy rules: `firebase deploy --only firestore:rules`
- [ ] Test: Logged-in users can access data, logged-out users cannot

#### Part B: Production Build
- [ ] Test production build locally: `npm run build`
- [ ] Verify no build errors
- [ ] Test built app: `npm run preview`
- [ ] Fix any build warnings

#### Part C: Firebase Hosting Setup
- [ ] Run `firebase init hosting`
- [ ] Select project
- [ ] Set public directory: `dist`
- [ ] Configure as single-page app: Yes
- [ ] Don't overwrite index.html
- [ ] Deploy: `firebase deploy --only hosting`
- [ ] Copy deployed URL


### Files Created:
- `firestore.rules`
- `firebase.json` (if not already exists)
- `.firebaserc` (if not already exists)

### Files Modified:
- `README.md`

### Acceptance Criteria:
- [ ] App is publicly accessible via HTTPS URL
- [ ] All 8 MVP requirements work on deployed version:
  - ✅ User authentication
  - ✅ Canvas with pan/zoom
  - ✅ Shape creation & movement (rectangles)
  - ✅ Real-time sync
  - ✅ Multiplayer cursors with names
  - ✅ Presence awareness (who's online)
  - ✅ State persistence
  - ✅ Deployed and stable for 5+ users
- [ ] No critical console errors
- [ ] 5+ concurrent users can connect without crashes
- [ ] HTTPS is enabled
- [ ] Firebase security rules configured


-
## Key Reminders

**Single Canvas for MVP:**
- Everyone who logs in sees the same canvas
- canvasId = "main-canvas" (hardcoded)
- No room selection needed
- Multi-room comes post-MVP

**Data Model:**
- Separate subcollections for cursors, shapes, presence
- Each cursor/shape is its own document (avoids write contention)
- Last-write-wins conflict resolution (compare timestamps)
