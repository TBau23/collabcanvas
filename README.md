# CollabCanvas MVP 🎨

A real-time collaborative design canvas with multiplayer capabilities. Built in 24 hours.

## 🚀 Live Demo

**Deployment URL:** _Will be added after deployment_

## ✨ Features

### Completed MVP Features
- ✅ **Authentication** - Email/password registration and login
- ✅ **Canvas** - Infinite canvas with smooth pan and zoom
- ✅ **Shape Creation** - Click-to-place rectangles
- ✅ **Shape Manipulation** - Drag and drop shapes
- ✅ **Real-Time Sync** - Shapes sync across all users in <200ms
- ✅ **Multiplayer Cursors** - See other users' cursors with names in real-time
- ✅ **Presence Awareness** - Google Docs-style presence panel showing who's online
- ✅ **State Persistence** - All work saved to Firestore, survives refresh and session end

## 🏗️ Tech Stack

- **Frontend:** React 19 + Vite
- **Canvas:** Konva.js + react-konva
- **Backend:** Firebase (Authentication + Firestore)
- **State Management:** React Context + useState
- **Hosting:** Firebase Hosting

## 📦 Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- Firebase account
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd figma_clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   Create `.env.local` file in the root directory:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   
   App will be available at `http://localhost:5173`

## 🚢 Deployment

### Deploy to Firebase Hosting

1. **Build for production**
   ```bash
   npm run build
   ```

2. **Deploy Firestore rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Deploy to hosting**
   ```bash
   firebase deploy --only hosting
   ```

## 🎯 How It Works

### Data Model

All data is stored in Firestore under a single `main-canvas` document:

```
/canvases/main-canvas/
  ├── cursors/{userId} - Real-time cursor positions
  ├── objects/{shapeId} - Canvas shapes (rectangles)
  └── presence/{userId} - Online user presence
```

### Key Features

**Optimistic Updates:**
- Local UI updates immediately
- Background sync to Firestore
- Conflict resolution via last-write-wins

**Real-Time Sync:**
- Firestore onSnapshot listeners for live updates
- Cursor updates throttled to 100ms
- Presence heartbeat every 10 seconds

**Multiplayer:**
- Each user gets a unique color (hashed from userId)
- Cursors sync across all clients
- Presence shows who's viewing (even if idle)

## 🧪 Testing

### Manual Test Checklist

1. **Authentication**
   - [ ] Register new user
   - [ ] Login with existing user
   - [ ] Session persists on refresh

2. **Canvas Basics**
   - [ ] Pan canvas by dragging background
   - [ ] Zoom with mouse wheel
   - [ ] Create rectangles with Rectangle tool
   - [ ] Select and drag rectangles

3. **Real-Time Collaboration** (2+ browser windows)
   - [ ] Create shape in window 1 → appears in window 2
   - [ ] Move shape in window 2 → updates in window 1
   - [ ] See each other's cursors with names
   - [ ] Presence panel shows all online users

4. **Persistence**
   - [ ] Create shapes → refresh → shapes remain
   - [ ] Close all windows → reopen → shapes still there

## 📁 Project Structure

```
src/
├── components/
│   ├── Auth/ - Login and registration
│   ├── Canvas/ - Main canvas with Konva
│   ├── Cursors/ - Multiplayer cursor rendering
│   └── Presence/ - Online users panel
├── services/
│   ├── firebase.js - Firebase initialization
│   ├── authService.js - Auth operations
│   ├── canvasService.js - Shape CRUD + sync
│   ├── cursorService.js - Cursor tracking
│   └── presenceService.js - Presence tracking
└── context/
    └── AuthContext.jsx - Auth state management
```

## 🎨 Architecture Highlights

- **Single Canvas:** Everyone sees `main-canvas` (multi-room support is post-MVP)
- **Separate Subcollections:** Cursors, shapes, and presence in separate collections to avoid write contention
- **Optimistic Updates:** UI feels instant, Firestore syncs in background
- **Heartbeat Pattern:** Presence updates every 10s to keep users "online" even when idle
- **Stale Filtering:** Cursors/presence disappear after 30s of inactivity

## 🔐 Security

Firestore security rules ensure:
- Only authenticated users can access data
- Users can only update their own cursors and presence
- All users can create/update shapes (collaborative editing)

## 🐛 Known Limitations (MVP)

- Only rectangles supported (circles, text coming in post-MVP)
- No shape deletion UI (delete key support coming)
- No shape resizing (drag handles coming)
- No undo/redo
- Single canvas only (no rooms/projects)
- Firestore-based cursors (~100-200ms latency, will migrate to Realtime DB for <50ms)

## 🚀 Post-MVP Roadmap

### Performance (Days 2-3)
- Migrate cursors to Firebase Realtime DB (<50ms latency)
- Viewport culling for large canvases
- Shape layering and z-index

### Features (Days 4-5)
- Additional shapes (circles, text, lines)
- Shape properties (color, size, rotation)
- Delete shapes (UI + backend)
- Undo/redo
- Keyboard shortcuts
- Export canvas to image

### Polish (Day 5+)
- Cursor interpolation (smooth movement)
- Better visual design
- Minimap
- Grid and snap-to-grid
- Comments and annotations

npm run build                           # Build production bundle
firebase deploy --only firestore:rules  # Deploy security rules
firebase deploy --only hosting          # Deploy static site

## 📝 License

MIT

## 👏 Acknowledgments

Built as an MVP proof-of-concept for real-time collaborative editing.

Inspired by Figma, Miro, and Google Docs.
