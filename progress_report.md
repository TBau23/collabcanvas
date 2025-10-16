# CollabCanvas - Progress Report

## Technical Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Konva.js + react-konva** - HTML5 Canvas library for shape rendering and manipulation
- **CSS3** - Styling (no UI framework, custom styles)

### Backend
- **Firebase Authentication** - User login/registration/session management
- **Cloud Firestore** - NoSQL real-time database for all data (shapes, cursors, presence)
- **Firebase Hosting** - Static site hosting and CDN

### Key Libraries
- `firebase` - Firebase SDK (v10+)
- `konva` + `react-konva` - Canvas manipulation
- `react-router-dom` - Client-side routing (minimal usage)

---

## Architecture Overview

### Data Model

**Firestore Structure:**
```
/canvases/
  └─ main-canvas/
      ├─ cursors/
      │   └─ {userId}
      │       { x, y, userName, color, updatedAt }
      │
      ├─ objects/
      │   └─ {shapeId}
      │       { type, x, y, width, height, fill, rotation, 
      │         lastModifiedBy, lastModifiedAt }
      │
      └─ presence/
          └─ {userId}
              { userName, color, status, lastSeen }
```

### Service Layer Pattern

All real-time features follow the same architecture:
```
Component (React)
    ↓
Service Layer (cursorService/canvasService/presenceService)
    ↓
Firestore (via onSnapshot listeners)
    ↓
Real-time sync to all connected clients
```

**Three core services:**
1. `cursorService.js` - Cursor position tracking and display
2. `canvasService.js` - Shape CRUD operations and sync
3. `presenceService.js` - Online/offline user status with heartbeat

---

## Feature Implementation

### 1. Authentication System ✅

**What we built:**
- Email/password registration and login
- Session persistence across browser refreshes
- Protected routing (canvas only accessible when logged in)
- Header with user name and logout button

**How it works:**
- `AuthContext` wraps the app and provides global auth state
- `onAuthStateChanged` listener keeps state in sync with Firebase
- Login/Register forms with validation and error handling
- Beautiful centered UI with responsive design

**Key files:**
- `src/services/authService.js` - Auth operations
- `src/context/AuthContext.jsx` - Global state management
- `src/components/Auth/Login.jsx` & `Register.jsx` - UI forms

---

### 2. Real-Time Multiplayer Cursors ✅

**What we built:**
- Live cursor position tracking for all users
- Each user gets a unique color (consistent hash from userId)
- Cursor shows username label
- Stale cursor cleanup (30s threshold)
- Instant removal on disconnect/refresh

**How it works:**
- Mouse movement throttled to 100ms intervals
- Cursor positions written to Firestore subcollection
- `onSnapshot` listener provides real-time updates to all clients
- `beforeunload` event handler deletes cursor on tab close
- Cursors older than 30 seconds filtered out client-side

**Performance:**
- ~10 writes/second per active user (due to 100ms throttle)
- Sub-200ms latency for cursor updates across clients

**Key files:**
- `src/services/cursorService.js` - Update/subscribe/delete operations
- `src/components/Canvas/Canvas.jsx` - Render cursors as Konva nodes

---

### 3. Canvas with Pan/Zoom ✅

**What we built:**
- 5000x5000 pixel virtual canvas (larger than viewport)
- Smooth pan by dragging background
- Zoom with mouse wheel (0.1x to 5x range)
- Zoom centered on mouse position

**How it works:**
- Konva Stage with dynamic `scale` and `position` state
- Manual pan implementation using mouse events (`onMouseDown/Move/Up`)
- Panning disabled when dragging shapes (via `isPanning` ref)
- Zoom calculations adjust position to keep mouse point fixed

**Key files:**
- `src/components/Canvas/Canvas.jsx` - Pan/zoom logic in event handlers

---

### 4. Shape Creation & Manipulation ✅

**What we built:**
- Toolbar with tools: Select, Rectangle, Ellipse
- Color picker with 8 preset colors + custom color input
- Click-to-place shape creation (spawns at cursor, not default position)
- Drag shapes to move
- Resize handles with min/max constraints (20px - 2000px)
- Delete selected shape with Delete/Backspace key
- Update shape color by selecting it + picking new color

**How it works:**
- Current tool and color stored in React state
- Click on canvas spawns shape at that position
- Tool auto-switches to "Select" after creating shape
- Konva `Transformer` provides resize/rotate handles
- Shape updates use **optimistic UI updates** (instant local render, then Firestore sync)
- Last Write Wins (LWW) conflict resolution using timestamps

**UX decisions:**
- No separate circle/square shapes - users create via resizing rect/ellipse
- Color picker snaps to selected shape's color
- Selecting a shape + changing color applies to that shape
- Creating a new shape uses current picker color

**Key files:**
- `src/components/Canvas/Canvas.jsx` - Shape creation, selection, manipulation
- `src/components/Canvas/CanvasToolbar.jsx` - Tool/color picker UI
- `src/services/canvasService.js` - Shape CRUD operations

---

### 5. Real-Time Shape Synchronization ✅

**What we built:**
- All shape changes (create/move/resize/delete/recolor) sync instantly across users
- Optimistic updates for snappy local UX
- Conflict resolution when multiple users edit same shape

**How it works:**
1. User performs action (e.g., drags shape)
2. Local state updates immediately (optimistic)
3. Firestore write happens in background
4. All other users receive update via `onSnapshot` listener
5. Their local state updates and UI re-renders

**Conflict resolution:**
- Last Write Wins strategy
- Firestore `lastModifiedAt` timestamp determines winner
- If two users move same shape, last update wins
- Simple but effective for MVP

**Performance:**
- Shape dragging throttled to reduce writes
- `onSnapshot` delivers updates in 50-200ms typically

**Key files:**
- `src/services/canvasService.js` - Firestore operations
- `src/components/Canvas/Canvas.jsx` - Subscription and render logic

---

### 6. Presence System (Who's Online) ✅

**What we built:**
- Floating panel in top-right showing online users
- User count indicator
- User avatars with initials + unique colors
- Heartbeat system to track active users
- Fast disconnect detection with browser tab throttling handling

**How it works:**
- Every 2 seconds, active tab writes heartbeat to Firestore presence collection
- `lastSeen` timestamp tracks last activity
- `subscribeToPresence` filters users with `lastSeen > 15s` ago
- Browser tab throttling handled with generous stale threshold (15 seconds)
- `beforeunload` sets `status: 'offline'` for instant disconnect

**Why separate from cursors:**
- **Cursors** = ephemeral position tracking (deleted on disconnect)
- **Presence** = "who's viewing" even if not actively moving/editing
- Allows users to see who's online even if cursors are hidden
- Different stale thresholds (30s for cursors, 15s for presence)

**Tuning for responsiveness:**
- Originally 10s heartbeat + 30s threshold (too slow)
- Adjusted to 2s heartbeat + 15s threshold (accounts for tab throttling)
- Prevents flickering in background tabs
- Not commited to our approach here, we can change it later if needed

**Key files:**
- `src/services/presenceService.js` - Heartbeat and presence operations
- `src/components/Presence/PresencePanel.jsx` - UI component
- `src/components/Canvas/Canvas.jsx` - Heartbeat interval and cleanup

---

## Key Design Decisions & Tradeoffs

### 1. Firestore Only (No Realtime Database)
**Decision:** Use Cloud Firestore exclusively for MVP  
**Rationale:**
- Simpler architecture (one database)
- Firestore's `onSnapshot` provides real-time updates
- Document structure maps well to canvas objects
- Sufficient performance for MVP scale

**Tradeoff:**
- Firestore has no native `onDisconnect` handler (unlike Realtime DB)
- Workaround: heartbeat + stale threshold + `beforeunload` cleanup

**Future:** Could add Realtime DB for cursor positions in post-MVP phase

---

### 2. Optimistic Updates
**Decision:** Update local UI immediately, then sync to Firestore  
**Rationale:**
- Eliminates perceived lag for local user
- Feels instant and responsive
- Network latency hidden from user

**Implementation:**
- Create/move/resize shape → update React state immediately
- Fire Firestore write in background
- Other users receive update via real-time listener

---

### 3. Throttling Strategy
**Decision:** Throttle cursor updates to 100ms, no throttling on shapes  
**Rationale:**
- **Cursors:** High-frequency updates (every mouse move), need throttling to limit writes
- **Shapes:** Discrete actions (drag end, resize end), no throttling needed

**Firestore write costs:**
- Cursor: ~10 writes/sec per active user (acceptable)
- Shapes: ~1-5 writes/sec across all users (very low)

---

### 4. Last Write Wins Conflict Resolution
**Decision:** Use timestamps, last update wins  
**Rationale:**
- Simplest strategy for MVP
- No complex Operational Transformation (OT) or CRDTs needed
- Good enough for low-conflict scenarios (users rarely edit same shape simultaneously)

**Tradeoff:**
- If two users drag same shape, one person's change gets overwritten
- Acceptable for MVP, can improve with locking in v2

---

### 5. Separate Collections for Cursors/Shapes/Presence
**Decision:** Three subcollections under `/canvases/main-canvas/`  
**Rationale:**
- Clear separation of concerns
- Different lifecycle (cursors deleted, shapes persist, presence has heartbeat)
- Easier to write granular security rules
- Easier to query and filter

**Security:**
- Users can only write their own cursor/presence
- Users can write any shape (collaborative!)

---

### 6. Single Hardcoded Canvas
**Decision:** All users share `main-canvas` (no multi-canvas support)  
**Rationale:**
- MVP scope - prove real-time sync first
- Simplifies routing and state management
- Easy to extend to multi-canvas later (already structured for it)

---

## Technical Challenges & Solutions

### Challenge 1: Shape Drag Conflicts with Pan
**Problem:** Dragging shapes would trigger canvas panning  
**Solution:**
- Removed `draggable` from Konva Stage
- Implemented manual pan with mouse events
- Added `isPanning` ref to disable shape interactions during pan
- Used `e.cancelBubble = true` to stop event propagation from shapes to stage


### Challenge 2: Presence Disconnect Detection
**Problem:** Firestore has no native disconnect detection  
**Solution:**
- Heartbeat every 2 seconds writes `lastSeen` timestamp
- Client-side filtering: users with `lastSeen > 15s` marked offline
- `beforeunload` event sets `status: 'offline'` for instant disconnect
- 15s threshold handles browser tab throttling (background tabs delay timers)

### Challenge 5: Cursor Event Blocking
**Problem:** Cursors (rendered as Konva nodes) were blocking clicks on shapes  
**Solution:** Added `listening={false}` to cursor Circle and Text components

## Current State

### What's Working ✅
- ✅ User authentication (register, login, logout, session persistence)
- ✅ Real-time multiplayer cursors with unique colors
- ✅ Canvas pan and zoom
- ✅ Shape creation (rectangles and ellipses)
- ✅ Shape manipulation (drag, resize, delete, recolor)
- ✅ Real-time shape synchronization across users
- ✅ Presence system (who's online)
- ✅ Optimistic UI updates
- ✅ Responsive design (desktop and mobile)
- ✅ Firebase security rules
- ✅ Deployed to Firebase Hosting

### Known Limitations (MVP Scope)
- Single hardcoded canvas (no multi-canvas support)
- No shape rotation (Transformer supports it, just not exposed in UI)
- No undo/redo
- No text shapes
- No layers or z-index control
- No collaborative selection (can't see what shape another user has selected)
- No comments or annotations
- No export (PNG/SVG/JSON)
- Last Write Wins (no advanced conflict resolution)

---

## File Structure

```
figma_clone/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.jsx          # Login form
│   │   │   ├── Register.jsx       # Registration form
│   │   │   └── Auth.css           # Auth form styles
│   │   ├── Canvas/
│   │   │   ├── Canvas.jsx         # Main canvas component (Konva Stage/Layer)
│   │   │   ├── Canvas.css         # Canvas styles
│   │   │   ├── CanvasToolbar.jsx  # Toolbar (tools + color picker)
│   │   │   └── CanvasToolbar.css  # Toolbar styles
│   │   ├── Layout/
│   │   │   ├── Header.jsx         # Top navigation (user + logout)
│   │   │   └── Header.css         # Header styles
│   │   └── Presence/
│   │       ├── PresencePanel.jsx  # Online users panel
│   │       └── PresencePanel.css  # Presence panel styles
│   ├── context/
│   │   └── AuthContext.jsx        # Auth state management
│   ├── services/
│   │   ├── firebase.js            # Firebase initialization
│   │   ├── authService.js         # Auth operations
│   │   ├── cursorService.js       # Cursor CRUD + real-time subscription
│   │   ├── canvasService.js       # Shape CRUD + real-time subscription
│   │   └── presenceService.js     # Presence heartbeat + subscription
│   ├── App.jsx                    # Root component + routing
│   ├── App.css                    # App-level styles
│   ├── index.css                  # Global styles
│   └── main.jsx                   # React entry point
├── public/                        # Static assets
├── .env.local                     # Firebase config (gitignored)
├── .gitignore                     # Git ignore rules
├── firebase.json                  # Firebase hosting config
├── firestore.rules                # Firestore security rules
├── package.json                   # Dependencies
├── vite.config.js                 # Vite configuration
├── PRD.md                         # Original product requirements
├── task_list.md                   # Development task breakdown
└── architecture_diagram.mermaid   # System architecture diagram
```
---