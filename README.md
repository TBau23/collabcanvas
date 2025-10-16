# CollabCanvas 🎨

A real-time collaborative design canvas with multiplayer capabilities and AI-powered shape generation.

## 🚀 Live Demo

**Deployment URL:** _Will be added after deployment_

## ✨ Features

### Core Features
- ✅ **Authentication** - Email/password registration and login
- ✅ **Canvas** - Infinite canvas with smooth pan and zoom
- ✅ **Shape Creation** - Rectangles and ellipses
- ✅ **Shape Manipulation** - Drag, resize, rotate, and recolor shapes
- ✅ **Real-Time Sync** - Shapes sync across all users in <200ms
- ✅ **Multiplayer Cursors** - See other users' cursors with names in real-time
- ✅ **Presence Awareness** - Google Docs-style presence panel showing who's online
- ✅ **State Persistence** - All work saved to Firestore

### 🤖 AI Agent (NEW!)
- ✅ **Natural Language Commands** - "Create a blue rectangle at 500, 500"
- ✅ **Complex Layouts** - "Create a login form with username and password"
- ✅ **Shape Manipulation** - "Move the red circle to the center"
- ✅ **Multi-User AI** - Multiple users can use AI simultaneously
- ✅ **Keyboard Shortcut** - Press `Cmd+K` (or `Ctrl+K`) to open AI assistant

## 🏗️ Tech Stack

- **Frontend:** React 19 + Vite
- **Canvas:** Konva.js + react-konva
- **Backend:** Firebase (Authentication + Firestore + Cloud Functions)
- **AI:** OpenAI GPT-4o-mini with function calling
- **State Management:** React Context + useState
- **Hosting:** Firebase Hosting

## 📦 Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- Java 17+ (for Firebase emulators)
- Firebase account
- OpenAI API key (for AI features)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd figma_clone
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install Cloud Functions dependencies
   cd functions
   npm install
   cd ..
   ```

3. **Install Java (for emulators)**
   ```bash
   # macOS (using Homebrew)
   brew install openjdk@17
   echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   
   # Verify installation
   java -version
   ```

4. **Configure Firebase**
   
   Create `.env.local` file in the root directory:
   ```bash
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

5. **Configure OpenAI API Key**
   
   For local development, create `functions/.env`:
   ```bash
   echo "OPENAI_API_KEY=your-openai-api-key" > functions/.env
   ```
   
   For production, set via Firebase CLI:
   ```bash
   firebase functions:config:set openai.key="your-openai-api-key"
   ```

6. **Initialize Firebase (first time only)**
   ```bash
   firebase login
   firebase use --add  # Select your Firebase project
   ```

### 🚀 Development Workflow

#### Option A: Local Development with Emulators (Recommended)

**Terminal 1 - Start Firebase Emulators:**
```bash
firebase emulators:start
```

This starts:
- Functions emulator on `localhost:5001`
- Firestore emulator on `localhost:8080`
- Auth emulator on `localhost:9099`
- Emulator UI on `localhost:4000`

**Terminal 2 - Start Dev Server:**
```bash
npm run dev
```

App runs at `http://localhost:5173` and auto-connects to emulators.

**Benefits:**
- ✅ Isolated test environment (no production data)
- ✅ Free Firebase usage (only OpenAI costs apply)
- ✅ Faster iteration (instant function reloads)
- ✅ Better debugging (see logs in terminal)

#### Option B: Development with Production Backend

If you prefer to skip emulators:
```bash
npm run dev
```

App connects directly to production Firebase services.

## 🚢 Deployment

### Deploy to Firebase

1. **Ensure OpenAI key is set in production**
   ```bash
   firebase functions:config:set openai.key="your-openai-api-key"
   ```

2. **Build frontend**
   ```bash
   npm run build
   ```

3. **Deploy everything**
   ```bash
   # Deploy all services
   firebase deploy
   
   # Or deploy individually:
   firebase deploy --only functions  # Cloud Functions only
   firebase deploy --only hosting    # Frontend only
   firebase deploy --only firestore  # Firestore rules only
   ```

### Quick Deploy Commands
```bash
# Full deployment
npm run build && firebase deploy

# Functions only (for AI agent updates)
firebase deploy --only functions

# Frontend only (for UI changes)
npm run build && firebase deploy --only hosting
```

## 🤖 Using the AI Agent

### Opening the AI Assistant
- Click the floating **AI button** (✨) in the bottom-right corner
- Or press **`Cmd+K`** (Mac) / **`Ctrl+K`** (Windows/Linux)

### Example Commands

**Create Shapes:**
```
Create a blue rectangle at 1000, 1000
Add a red circle in the center
Make a 300x200 green rectangle
```

**Manipulate Shapes:**
```
Move the blue rectangle to the center
Change the red circle to yellow
Make the green rectangle twice as big
Rotate the rectangle 45 degrees
```

**Complex Layouts:**
```
Create a login form with username and password fields
Build a horizontal navigation bar with 4 items
Create a 3x3 grid of colorful squares
Make a card layout with title and description
```

### How It Works
1. Type natural language command
2. AI (GPT-4o-mini) interprets your request
3. AI calls appropriate canvas functions (create/update/delete shapes)
4. Shapes appear instantly and sync to all users
5. AI provides confirmation message

## 🎯 Architecture

### Data Model

All data is stored in Firestore under a single `main-canvas` document:

```
/canvases/main-canvas/
  ├── cursors/{userId} - Real-time cursor positions
  ├── objects/{shapeId} - Canvas shapes (rectangles, ellipses)
  └── presence/{userId} - Online user presence
```

### AI Architecture

```
Frontend (aiService.js) 
    ↓ [Sends command + canvas state]
Firebase Cloud Function (callAI)
    ↓ [Calls OpenAI API with secure key]
OpenAI GPT-4o-mini
    ↓ [Returns function calls]
Cloud Function
    ↓ [Returns to frontend]
Frontend executes via canvasService
    ↓ [Auto-syncs to Firestore]
All users see updates
```

**Security:** OpenAI API key never exposed to client, stored securely in Firebase Functions config.

### Key Features

**Optimistic Updates:**
- Local UI updates immediately
- Background sync to Firestore
- Conflict resolution via last-write-wins

**Real-Time Sync:**
- Firestore onSnapshot listeners for live updates
- Cursor updates throttled to 100ms
- Presence heartbeat every 2 seconds

**Multiplayer:**
- Each user gets a unique color (hashed from userId)
- Cursors sync across all clients
- Presence shows who's viewing (even if idle)

**AI Integration:**
- Secure Cloud Function proxy protects API key
- Function calling with 5 tools (create, update, delete, getState, createMultiple)
- Works seamlessly with existing sync infrastructure

## 🧪 Testing

### Manual Test Checklist

1. **Authentication**
   - [ ] Register new user
   - [ ] Login with existing user
   - [ ] Session persists on refresh

2. **Canvas Basics**
   - [ ] Pan canvas by dragging background
   - [ ] Zoom with mouse wheel
   - [ ] Create shapes with Rectangle/Ellipse tools
   - [ ] Select and drag shapes
   - [ ] Resize shapes with handles
   - [ ] Change shape colors with color picker
   - [ ] Delete shapes with Delete/Backspace key

3. **AI Agent** (Press `Cmd+K` to open)
   - [ ] "Create a blue rectangle at 500, 500" → shape appears
   - [ ] "Add a red circle in the center" → circle at canvas center
   - [ ] "Move the blue rectangle to 1000, 1000" → shape moves
   - [ ] "Change the red circle to yellow" → color changes
   - [ ] "Create a login form" → multiple shapes arranged vertically
   - [ ] AI works while another user is also using canvas

4. **Real-Time Collaboration** (2+ browser windows)
   - [ ] Create shape in window 1 → appears in window 2
   - [ ] Move shape in window 2 → updates in window 1
   - [ ] AI creates shape → syncs to all users
   - [ ] See each other's cursors with names
   - [ ] Presence panel shows all online users

5. **Persistence**
   - [ ] Create shapes → refresh → shapes remain
   - [ ] Close all windows → reopen → shapes still there

## 📁 Project Structure

```
figma_clone/
├── src/
│   ├── components/
│   │   ├── Auth/ - Login and registration
│   │   ├── Canvas/ - Main canvas with Konva
│   │   ├── AI/ - AI assistant UI
│   │   │   ├── AIButton.jsx - Floating AI button
│   │   │   ├── AIModal.jsx - Chat interface
│   │   │   └── AIModal.css - Modal styles
│   │   └── Presence/ - Online users panel
│   ├── services/
│   │   ├── firebase.js - Firebase initialization + emulator config
│   │   ├── authService.js - Auth operations
│   │   ├── canvasService.js - Shape CRUD + sync
│   │   ├── cursorService.js - Cursor tracking
│   │   ├── presenceService.js - Presence tracking
│   │   └── aiService.js - AI command processing
│   └── context/
│       └── AuthContext.jsx - Auth state management
├── functions/
│   ├── index.js - Cloud Functions (AI proxy)
│   ├── package.json - Functions dependencies
│   └── .env - Local OpenAI key (gitignored)
├── firebase.json - Firebase config
└── .env.local - Firebase credentials (gitignored)
```

## 🎨 Architecture Highlights

- **Single Canvas:** Everyone sees `main-canvas` (multi-room support possible later)
- **Separate Subcollections:** Cursors, shapes, and presence in separate collections to avoid write contention
- **Optimistic Updates:** UI feels instant, Firestore syncs in background
- **Heartbeat Pattern:** Presence updates every 2s to keep users "online"
- **Stale Filtering:** Cursors/presence disappear after 30s of inactivity
- **AI via Cloud Functions:** OpenAI API key secured server-side, never exposed to client
- **Function Calling:** AI uses OpenAI's function calling to execute precise canvas operations

## 🔐 Security

**Firestore Rules:**
- Only authenticated users can access data
- Users can only update their own cursors and presence
- All users can create/update shapes (collaborative editing)

**Cloud Functions:**
- OpenAI API key stored securely in Firebase Functions config
- Auth verification on every AI request
- Rate limiting to prevent abuse (5 max concurrent instances)

## 🐛 Known Limitations

- Single canvas only (no rooms/projects yet)
- No undo/redo
- No text layers (only shapes)
- Firestore-based cursors (~100-200ms latency, could migrate to Realtime DB for <50ms)
- AI costs: Each command uses OpenAI tokens (using gpt-4o-mini for cost efficiency)
- No offline support (requires internet connection)

## 🚀 Future Enhancements

### Performance
- Migrate cursors to Firebase Realtime DB for <50ms latency
- Viewport culling for large canvases (1000+ shapes)
- Cursor interpolation for smoother movement

### Features
- Text layers with formatting
- Undo/redo history
- Export canvas to PNG/SVG
- Comments and annotations
- Multiple canvases/projects
- Layers panel with z-index control
- Alignment and distribution tools
- Snap-to-grid

### AI Enhancements
- Conversational mode (multi-turn dialogue)
- Style suggestions ("make this look more professional")
- Template generation ("create a dashboard wireframe")
- Natural language queries ("how many red shapes are there?")

## 📝 License

MIT

## 👏 Acknowledgments

Built as an MVP proof-of-concept for real-time collaborative editing.

Inspired by Figma, Miro, and Google Docs.
