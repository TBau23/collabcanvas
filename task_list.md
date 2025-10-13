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

---

## MVP Task Breakdown (24 Hours)

### PR #1: Setup + Authentication (3-4 hours)
**Goal:** Project running with Firebase auth working

#### Tasks:
- [ ] Initialize Vite + React project
- [ ] Install dependencies: `react`, `react-dom`, `vite`, `firebase`, `konva`, `react-konva`
- [ ] Create Firebase project in console
- [ ] Enable Firebase Authentication (Email/Password)
- [ ] Enable Firestore Database
- [ ] Copy Firebase config to `.env.local`
- [ ] Create `src/services/firebase.js` - Initialize Firebase SDK
- [ ] Create `src/services/authService.js` - register, login, logout functions
- [ ] Create `src/context/AuthContext.jsx` - Auth state with Context API
- [ ] Create `src/components/Auth/Login.jsx` - Login form
- [ ] Create `src/components/Auth/Register.jsx` - Registration form
- [ ] Add basic styling to auth forms
- [ ] Create `src/App.jsx` - Conditional rendering (logged in → canvas, logged out → auth)
- [ ] Test registration flow manually
- [ ] Test login flow manually
- [ ] Test logout flow manually
- [ ] Test session persistence on refresh

#### Files Created:
- `package.json`
- `vite.config.js`
- `.env.local`
- `.gitignore`
- `src/main.jsx`
- `src/App.jsx`
- `src/App.css`
- `src/services/firebase.js`
- `src/services/authService.js`
- `src/context/AuthContext.jsx`
- `src/components/Auth/Login.jsx`
- `src/components/Auth/Register.jsx`
- `src/components/Auth/Auth.css`
- `README.md`

#### Acceptance Criteria:
- [ ] `npm run dev` starts app without errors
- [ ] Can register a new user
- [ ] Can log in with email/password
- [ ] Auth state persists on page refresh
- [ ] Logged-in users see different UI than logged-out users

#### Time Estimate: 3-4 hours

---

### PR #2: Canvas + Shapes (4-5 hours)
**Goal:** Interactive canvas with rectangles (local state only, no database yet)

#### Tasks:
- [ ] Install Konva: `npm install konva react-konva`
- [ ] Create `src/components/Canvas/Canvas.jsx`
- [ ] Set up Konva Stage (5000x5000 virtual space)
- [ ] Implement pan functionality (drag background)
- [ ] Implement zoom functionality (mouse wheel)
- [ ] Add zoom limits (min: 0.1, max: 3)
- [ ] Create `src/components/Canvas/CanvasToolbar.jsx` - "Add Rectangle" button
- [ ] Implement rectangle creation on button click
- [ ] Generate unique IDs for shapes (use `crypto.randomUUID()`)
- [ ] Store shapes in local React state (array of objects)
- [ ] Render rectangles from state
- [ ] Implement rectangle selection (click to select)
- [ ] Add visual feedback for selected shape (border/highlight)
- [ ] Implement rectangle drag-and-drop
- [ ] Update shape position in state on drag
- [ ] Add basic styling to toolbar
- [ ] Test: Create 5+ rectangles
- [ ] Test: Move rectangles around
- [ ] Test: Pan and zoom with shapes visible
- [ ] Test: Selection behavior

#### Files Created:
- `src/components/Canvas/Canvas.jsx`
- `src/components/Canvas/CanvasToolbar.jsx`
- `src/components/Canvas/Canvas.css`
- `src/utils/constants.js`

#### Files Modified:
- `src/App.jsx` (add Canvas component for logged-in users)

#### Shape Data Structure:
```javascript
{
  id: "uuid",
  type: "rectangle",
  x: 100,
  y: 100,
  width: 150,
  height: 100,
  fill: "#4A90E2",
  rotation: 0,
  updatedBy: "userId",
  updatedAt: timestamp
}
```

#### Acceptance Criteria:
- [ ] Canvas renders full screen when logged in
- [ ] Pan works smoothly (drag background)
- [ ] Zoom works with mouse wheel
- [ ] Can create rectangles via toolbar button
- [ ] Rectangles appear on canvas at default position
- [ ] Can select a rectangle (visual feedback)
- [ ] Can drag rectangles to new positions
- [ ] Multiple rectangles work independently

#### Time Estimate: 4-5 hours

---

### PR #3: Firestore Sync - Real-Time Shapes (4-5 hours) ⚠️ CRITICAL
**Goal:** Shapes sync across all users in real-time

#### Tasks:
- [ ] Design Firestore data model for canvas
- [ ] Create `src/services/canvasService.js`
- [ ] Implement `createShape(canvasId, shapeData)` - Add to Firestore
- [ ] Implement `updateShape(canvasId, shapeId, updates)` - Update Firestore doc
- [ ] Implement `deleteShape(canvasId, shapeId)` - Delete from Firestore
- [ ] Implement `subscribeToCanvas(canvasId, callback)` - Real-time listener
- [ ] Connect shape creation to Firestore (save on create)
- [ ] Implement optimistic updates (update local state immediately)
- [ ] Connect shape drag to Firestore (save on drag end)
- [ ] Set up Firestore listener in Canvas component
- [ ] Handle incoming shape CREATE events from other users
- [ ] Handle incoming shape UPDATE events from other users
- [ ] Handle incoming shape DELETE events from other users
- [ ] Prevent duplicate updates from self (check updatedBy === currentUserId)
- [ ] Add timestamps to all shape operations
- [ ] Implement last-write-wins conflict resolution (compare timestamps)
- [ ] Add error handling for Firestore operations
- [ ] Test: Open 2 browser windows (different users)
- [ ] Test: Create shape in window 1, verify appears in window 2
- [ ] Test: Move shape in window 2, verify updates in window 1
- [ ] Test: Create 5 shapes rapidly in both windows
- [ ] Test: Refresh window 1, verify shapes persist
- [ ] Test: Close all windows, reopen, verify shapes persist

#### Firestore Data Model:
```
/canvases/{canvasId}
  - metadata: { createdAt, updatedAt, createdBy }
  
/canvases/{canvasId}/objects/{objectId}
  - type: "rectangle"
  - x, y, width, height
  - fill, rotation
  - updatedBy: "userId"
  - updatedAt: timestamp
```

#### Files Created:
- `src/services/canvasService.js`

#### Files Modified:
- `src/components/Canvas/Canvas.jsx` (integrate Firestore sync)

#### Acceptance Criteria:
- [ ] Shapes save to Firestore on creation
- [ ] Shape updates save to Firestore on drag end
- [ ] Changes from other users appear within ~200ms
- [ ] Two users can create shapes simultaneously without crashes
- [ ] Two users can move shapes simultaneously
- [ ] No duplicate shapes appear
- [ ] State remains consistent across rapid edits
- [ ] Refreshing browser preserves all shapes
- [ ] All users disconnect and reconnect → shapes persist

#### Time Estimate: 4-5 hours (MOST IMPORTANT - BUDGET EXTRA TIME)

---

### PR #4: Multiplayer Cursors (3-4 hours)
**Goal:** See other users' cursors with name labels in real-time

#### Tasks:
- [ ] Create `src/services/cursorService.js`
- [ ] Implement cursor throttling utility (update max every 100ms)
- [ ] Implement `updateCursorPosition(canvasId, userId, x, y, userName)` - Save to Firestore
- [ ] Implement `subscribeToCursors(canvasId, callback)` - Listen to cursor updates
- [ ] Create `src/components/Cursors/CursorLayer.jsx`
- [ ] Track mouse position in Canvas component
- [ ] Convert mouse position to canvas coordinates (account for pan/zoom)
- [ ] Broadcast cursor position to Firestore (throttled)
- [ ] Subscribe to cursor updates from other users
- [ ] Render other users' cursors on canvas
- [ ] Display username label near each cursor
- [ ] Assign unique color to each user (hash userId to color)
- [ ] Filter out own cursor from display
- [ ] Handle cursor cleanup (remove after 5 seconds of inactivity)
- [ ] Test: 2 users see each other's cursors
- [ ] Test: Cursor names are visible
- [ ] Test: Cursors move in real-time
- [ ] Test: Own cursor not duplicated

#### Firestore Data Model:
```
/canvases/{canvasId}/cursors/{userId}
  - x, y
  - userName
  - color
  - updatedAt: timestamp
```

**Note:** Using Firestore for MVP. Will migrate to Realtime DB in post-MVP for <50ms latency.

#### Files Created:
- `src/services/cursorService.js`
- `src/components/Cursors/CursorLayer.jsx`

#### Files Modified:
- `src/components/Canvas/Canvas.jsx` (add cursor tracking and CursorLayer)

#### Acceptance Criteria:
- [ ] User sees other users' cursors in real-time
- [ ] Each cursor has visible username label
- [ ] Own cursor is not duplicated on screen
- [ ] Cursors update reasonably smoothly (~100-200ms acceptable for MVP)
- [ ] Cursors have different colors per user

#### Time Estimate: 3-4 hours

---

### PR #5: Presence Awareness (2-3 hours)
**Goal:** Display list of currently online users

#### Tasks:
- [ ] Create `src/services/presenceService.js`
- [ ] Implement `setUserOnline(canvasId, userId, userName)` - Mark user online
- [ ] Implement `setUserOffline(canvasId, userId)` - Mark user offline
- [ ] Implement `subscribeToPresence(canvasId, callback)` - Listen to online users
- [ ] Set up presence on user login/canvas join
- [ ] Use Firestore document with timestamp approach
- [ ] Create `src/components/Presence/PresencePanel.jsx`
- [ ] Display list of online users (names + avatars/initials)
- [ ] Update presence when user connects
- [ ] Clean up presence on window close/tab close (beforeunload event)
- [ ] Implement stale presence cleanup (remove users inactive > 30 seconds)
- [ ] Add user count display
- [ ] Style presence panel (fixed sidebar or floating panel)
- [ ] Test: 2 users join, both appear in list
- [ ] Test: User leaves, removed from list
- [ ] Test: User closes tab, removed from list

#### Firestore Data Model:
```
/canvases/{canvasId}/presence/{userId}
  - userName
  - online: true
  - lastSeen: timestamp
```

**Note:** Firestore doesn't have native onDisconnect like Realtime DB. Use timestamp + cleanup strategy. Will improve in post-MVP.

#### Files Created:
- `src/services/presenceService.js`
- `src/components/Presence/PresencePanel.jsx`

#### Files Modified:
- `src/App.jsx` or `src/components/Canvas/Canvas.jsx` (initialize presence)
- `src/components/Layout/Header.jsx` (add presence panel)

#### Acceptance Criteria:
- [ ] Panel shows all currently online users
- [ ] User appears when they join
- [ ] User disappears when they leave (within 30 seconds)
- [ ] User count is accurate
- [ ] Works with 5+ concurrent users

#### Time Estimate: 2-3 hours

---

### PR #6: Deployment + Final Testing (2-3 hours)
**Goal:** App is publicly accessible and all MVP requirements validated

#### Tasks:
- [ ] Create Firestore security rules (start permissive, can tighten later)
- [ ] Test security rules locally
- [ ] Set up Firebase Hosting
- [ ] Run `firebase init hosting`
- [ ] Configure build output directory (`dist`)
- [ ] Create production build: `npm run build`
- [ ] Deploy to Firebase Hosting: `firebase deploy`
- [ ] Test deployed app URL
- [ ] Create 3 test accounts
- [ ] Run full MVP test scenario on deployed app:
  - [ ] Register and login works
  - [ ] Canvas renders with pan/zoom
  - [ ] Can create rectangles
  - [ ] Can move rectangles
  - [ ] Open 3 browser windows (different users)
  - [ ] All users see each other's cursors with names
  - [ ] All users see each other's shape changes in real-time
  - [ ] Presence list shows all online users
  - [ ] Refresh a browser mid-edit, work persists
  - [ ] All users close browsers, reopen, work persists
- [ ] Test on mobile browser (bonus)
- [ ] Verify HTTPS is enabled
- [ ] Update README with:
  - [ ] Deployment URL
  - [ ] Setup instructions
  - [ ] Test credentials
  - [ ] Known limitations
- [ ] Celebrate MVP completion 🎉

#### Example Firestore Rules (Permissive MVP):
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

#### Files Created:
- `firebase.json`
- `.firebaserc`
- `firestore.rules`

#### Files Modified:
- `README.md`
- `package.json` (add build/deploy scripts)

#### Acceptance Criteria:
- [ ] Application is publicly accessible via HTTPS URL
- [ ] All 8 MVP requirements work on deployed version:
  - [ ] ✅ Authentication
  - [ ] ✅ Canvas with pan/zoom
  - [ ] ✅ Shape creation & movement
  - [ ] ✅ Real-time sync
  - [ ] ✅ Multiplayer cursors
  - [ ] ✅ Presence awareness
  - [ ] ✅ State persistence
  - [ ] ✅ Deployment (stable for 5+ users)
- [ ] No critical console errors
- [ ] 5+ concurrent users can connect without crashes

#### Time Estimate: 2-3 hours

---

## MVP Testing Checklist (Manual - Run After Each PR)

After each PR, quickly verify:
- [ ] App starts without errors (`npm run dev`)
- [ ] No console errors in browser
- [ ] Login still works
- [ ] Canvas still renders
- [ ] Previously working features still work

---

## Final MVP Validation (PR #6)

Run this complete test scenario before considering MVP done:

### Test Scenario 1: Basic Functionality
1. [ ] Register new user
2. [ ] Login successfully
3. [ ] Canvas renders with pan and zoom working
4. [ ] Create 3 rectangles
5. [ ] Move rectangles around
6. [ ] Rectangles stay where you put them

### Test Scenario 2: Real-Time Sync
1. [ ] Open 2 browser windows (incognito for 2nd user)
2. [ ] Register/login different users in each window
3. [ ] Create rectangle in window 1 → appears in window 2 within 1 second
4. [ ] Move rectangle in window 2 → updates in window 1 within 1 second
5. [ ] Create shapes rapidly in both windows → no crashes, all appear

### Test Scenario 3: Multiplayer Features
1. [ ] 2 users online, both see each other's cursors
2. [ ] Usernames visible on cursors
3. [ ] Cursors move when users move mouse
4. [ ] Presence panel shows both users
5. [ ] Close window 2 → user disappears from presence (within 30 sec)

### Test Scenario 4: Persistence
1. [ ] Create 5 shapes
2. [ ] Refresh browser (F5)
3. [ ] All 5 shapes still present
4. [ ] Close all browser windows
5. [ ] Open new browser window, login
6. [ ] All 5 shapes still present

### Test Scenario 5: Multi-User Load
1. [ ] Open 5 browser windows (5 different users)
2. [ ] All users create shapes simultaneously
3. [ ] All users see all shapes
4. [ ] No crashes or major lag

---

## POST-MVP Enhancement Roadmap (Days 2-5)

Once MVP is validated and deployed, you can enhance:

### Phase 2A: Performance - Realtime DB Migration (Day 2, ~4 hours)
**Goal:** Migrate cursors and presence to Realtime DB for <50ms latency

#### Tasks:
- [ ] Enable Firebase Realtime Database in console
- [ ] Update `src/services/firebase.js` - Add Realtime DB initialization
- [ ] Refactor `cursorService.js` to use Realtime DB instead of Firestore
- [ ] Use Realtime DB structure: `/sessions/{canvasId}/cursors/{userId}`
- [ ] Refactor `presenceService.js` to use Realtime DB
- [ ] Use Realtime DB onDisconnect for automatic cleanup
- [ ] Test cursor smoothness improvement
- [ ] Update security rules for Realtime DB
- [ ] Deploy updated version

**Result:** Cursors now update at 30-50ms instead of 100-200ms. Much smoother experience.

**Keep in Firestore:** Canvas shapes (don't need <50ms, benefit from Firestore's query capabilities)

---

### Phase 2B: Additional Shape Types (Day 2-3, ~3 hours)
- [ ] Add Circle shape component
- [ ] Add Text shape component
- [ ] Update toolbar with shape type selector
- [ ] Update canvasService to handle multiple types
- [ ] Add shape properties panel (color, size)

---

### Phase 2C: Shape Manipulation (Day 3, ~3 hours)
- [ ] Add delete shape functionality (Delete key)
- [ ] Add shape resize handles
- [ ] Add shape rotation handles
- [ ] Add color picker for shapes
- [ ] Add shape layering (bring to front/send to back)

---

### Phase 2D: Better Conflict Resolution (Day 4, ~4 hours)
- [ ] Research operational transformation (OT) or CRDT
- [ ] Implement basic OT for shape updates
- [ ] Add shape locking (lock while being edited)
- [ ] Add visual indicator for locked shapes

---

### Phase 2E: UI/UX Polish (Day 4-5, ~4 hours)
- [ ] Cursor interpolation (smooth movement between updates)
- [ ] Better visual design (modern UI)
- [ ] Keyboard shortcuts
- [ ] Grid/snap to grid
- [ ] Minimap (optional)
- [ ] Export canvas to image

---

### Phase 2F: Performance Optimizations (Day 5, ~3 hours)
- [ ] Viewport culling (don't render off-screen shapes)
- [ ] Throttle shape update broadcasts (batch updates)
- [ ] Use Konva layers for static vs dynamic content
- [ ] Optimize cursor throttling (adaptive based on movement)
- [ ] Add loading states and skeletons

---

### Phase 2G: Testing Infrastructure (Day 5, ~3 hours)
**Now that features are stable, add automated tests:**
- [ ] Set up Vitest + React Testing Library
- [ ] Write auth service tests
- [ ] Write canvas service tests
- [ ] Write integration test for real-time sync
- [ ] Add CI/CD with GitHub Actions

---

### Phase 2H: Production Hardening (Day 5, ~2 hours)
- [ ] Tighten Firestore security rules (proper read/write rules)
- [ ] Add rate limiting to prevent abuse
- [ ] Add error boundaries in React
- [ ] Add analytics (Firebase Analytics)
- [ ] Add error logging (Sentry)
- [ ] Set up monitoring

---

## Time Budget Summary

### MVP (24 Hours):
- PR #1: Setup + Auth → 3-4 hours
- PR #2: Canvas + Shapes → 4-5 hours
- PR #3: Firestore Sync (CRITICAL) → 4-5 hours
- PR #4: Cursors → 3-4 hours
- PR #5: Presence → 2-3 hours
- PR #6: Deploy + Test → 2-3 hours
- **Buffer for debugging:** 4 hours
- **Total: 24 hours**

### Post-MVP (5 Days):
- Day 2: Realtime DB migration + Additional shapes → 7 hours
- Day 3: Shape manipulation → 3 hours
- Day 4: Better conflict resolution + UI polish → 8 hours
- Day 5: Performance + Testing + Production hardening → 8 hours
- **Total: ~26 hours** across 5 days

---

## Critical Success Factors

### For MVP (Tomorrow):
1. **De-risk early:** Test Firestore real-time listeners in PR #3 thoroughly
2. **Stay simple:** Don't add features beyond the 8 MVP requirements
3. **Manual testing:** Skip automated tests, focus on working features
4. **One database:** Firestore only for MVP
5. **Time management:** If a PR is taking too long, cut scope aggressively

### For Post-MVP (Days 2-5):
1. **Realtime DB first:** Biggest performance win
2. **User feedback:** Get people using it, prioritize their pain points
3. **Add tests:** Now that APIs are stable
4. **Polish incrementally:** Don't try to do everything at once

---

## When Things Go Wrong

### If Running Behind Schedule:
**Cut from MVP (in order):**
1. Presence panel (keep cursors, drop user list) - Saves 2 hours
2. Pan functionality (keep zoom) - Saves 30 minutes
3. Selection visual feedback - Saves 30 minutes

**Don't cut these (hard MVP requirements):**
- Authentication
- Basic canvas + shapes
- Real-time sync
- Multiplayer cursors (even basic ones)

### If Firestore Sync is Too Hard:
**Fallback:** Use Firestore polling (query every 2 seconds instead of listeners)
- Not ideal, but proves the concept
- Can add real-time listeners post-MVP

### If Cursors Are Laggy:
**Accept it for MVP:** 200ms latency is fine to prove multiplayer works
- Migrate to Realtime DB in post-MVP for smooth experience

---

## Success Metrics

### MVP Gate (Tomorrow):
- [ ] All 8 PRD requirements met
- [ ] App is deployed and accessible
- [ ] 5 people can use it simultaneously
- [ ] No critical crashes during testing

### Post-MVP Success (Days 2-5):
- [ ] Cursors feel smooth (<50ms with Realtime DB)
- [ ] Can create circles and text, not just rectangles
- [ ] Can delete shapes
- [ ] Has automated test coverage for critical paths
- [ ] Production-ready security rules

---

Good luck! Focus on getting MVP done first. Everything else can wait. 🚀
