# CollabCanvas MVP - Product Requirements Document

## Project Overview
Build a real-time collaborative design canvas with multiplayer capabilities in 24 hours. This MVP focuses on proving the collaborative infrastructure is solid before adding advanced features.

**Hard Deadline:** Tuesday (24 hours from start)

---

## User Stories

### As a Designer (Primary User)
- I want to create an account and log in so that my work is associated with my identity
- I want to see a large canvas workspace so that I have room to design
- I want to pan and zoom smoothly so that I can navigate my design space comfortably
- I want to create basic shapes (rectangles, circles, or text) so that I can start designing
- I want to move objects around the canvas so that I can arrange my design
- I want to see other users' cursors with their names so that I know who is working where
- I want to see who else is currently online so that I know who I'm collaborating with
- I want my changes to appear instantly for other users so that we can work together seamlessly
- I want to see other users' changes in real-time so that I stay synchronized with the team
- I want my work to persist when I disconnect so that I don't lose progress
- I want to return to my canvas and see my previous work so that I can continue where I left off

### As a Collaborator
- I want to join a shared canvas session so that I can work with teammates
- I want to see exactly what others are doing in real-time so that we can coordinate our work
- I want my edits to not conflict with others' work so that we don't overwrite each other

### As a Returning User
- I want the canvas to remember all objects when everyone disconnects so that work persists across sessions
- I want to refresh my browser mid-edit without losing work so that network issues don't destroy progress

---

## MVP Feature Requirements

### 1. Authentication System
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- User registration and login
- Unique user identifiers
- Display names for presence awareness
- Session management

**Acceptance Criteria:**
- Users can create accounts
- Users can log in and be identified
- User identity persists across sessions

### 2. Canvas Workspace
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Large workspace (minimum 5000x5000px virtual space)
- Smooth pan functionality (click-and-drag)
- Smooth zoom functionality (mouse wheel or pinch)
- Reasonable performance during interactions (optimization is post-MVP)

**Acceptance Criteria:**
- Canvas renders and is usable
- Pan works and feels responsive
- Zoom maintains center point and functions correctly
- No critical performance blockers that prevent testing

### 3. Shape Creation & Manipulation
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Support at least ONE shape type (rectangle, circle, OR text)
- Create new shapes via toolbar or shortcut
- Move shapes by click-and-drag
- Basic visual feedback (selection indicator)

**Acceptance Criteria:**
- User can create shapes
- User can move shapes smoothly
- Selected shapes have visual indication
- Operations feel responsive

### 4. Real-Time Synchronization
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Object changes sync across all users < 100ms
- All CRUD operations broadcast (Create, Update, Delete)
- Conflict resolution strategy (last-write-wins acceptable)
- State consistency across clients

**Acceptance Criteria:**
- Changes appear on all connected clients within 100ms
- Two users can edit simultaneously without crashes
- Rapid edits don't cause state divergence
- Test passes: 2 users, multiple rapid shape operations

### 5. Multiplayer Cursors
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Display all connected users' cursor positions
- Show user name label near cursor
- Real-time cursor updates
- Smooth cursor movement (interpolation nice-to-have)

**Acceptance Criteria:**
- All user cursors visible in real-time
- Names clearly readable
- Cursors move without major jitter
- Basic functionality works with multiple users

### 6. Presence Awareness
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Display list of currently online users
- Show user status (online/offline)
- Update presence in real-time
- Handle connect/disconnect events

**Acceptance Criteria:**
- User list updates when people join/leave
- Clear visual indication of who's online
- No ghost users after disconnect

### 7. State Persistence
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Save canvas state to database
- Load canvas state on connection
- Handle user disconnects gracefully
- Persist state when all users disconnect

**Acceptance Criteria:**
- Test passes: User refreshes mid-edit, work remains
- Test passes: All users leave, return later, work remains
- No data loss during normal disconnects

### 8. Deployment
**Priority:** Critical (Hard Gate Requirement)

**Requirements:**
- Publicly accessible URL
- Supports 5+ concurrent users
- Stable under load
- HTTPS enabled

**Acceptance Criteria:**
- App is accessible via public URL
- 5 users can connect simultaneously without degradation
- No crashes during MVP testing scenario

---

## Technology Stack

### Frontend Recommendation

**React + Konva.js**

**Rationale:**
- **React:** Component-based architecture, easy state management, huge ecosystem
- **Konva.js:** Canvas abstraction built on HTML5 Canvas, handles shapes/transforms elegantly, good performance, events system works well for interactivity

**Alternatives Considered:**
- **Fabric.js:** Similar to Konva, slightly older API
- **PixiJS:** Overkill for MVP, better for game-like graphics
- **Raw Canvas:** Too low-level for 24 hours, would slow development

**Potential Pitfalls:**
- Konva requires careful memory management (destroy unused nodes)
- React re-renders can impact canvas performance if not optimized
- Need to bridge React state with Konva imperative API

### Backend Recommendation

**Firebase (Firestore + Realtime Database + Auth)**

**Rationale:**
- **Firestore:** Document-based, real-time subscriptions, offline support
- **Realtime Database:** Better for high-frequency updates (cursors), lower latency
- **Auth:** Drop-in authentication, integrates seamlessly
- **Hosting:** One-click deployment
- **Free tier:** Generous limits for MVP

**Architecture:**
- **Firestore:** Canvas state (shapes, properties) - updates < 100ms acceptable
- **Realtime Database:** Cursor positions, presence - updates < 50ms required
- **Auth:** User management

**Alternatives Considered:**
- **Supabase:** Postgres-based, real-time via websockets, would work but slightly more setup
- **Custom WebSocket Server:** Full control but requires server management, deployment complexity, more code
- **AWS (DynamoDB + API Gateway + WebSockets):** Overkill for MVP, harder to deploy quickly

**Potential Pitfalls:**
- **Firestore has write limits** (1 write/second per document) - mitigate by using subcollections for objects
- **Realtime DB is JSON-based** - structure data carefully, avoid deep nesting
- **Cost can scale quickly** - monitor usage, optimize queries
- **Offline behavior** - Firebase caches locally, can cause confusion during testing
- **Security rules** - must configure properly before deployment

### Recommended Data Model

```
Firestore:
/canvases/{canvasId}
  - metadata: { createdAt, updatedAt }
  
/canvases/{canvasId}/objects/{objectId}
  - type: "rectangle" | "circle" | "text"
  - x, y, width, height
  - color, rotation, etc.
  - updatedBy, updatedAt

Realtime Database:
/sessions/{canvasId}/cursors/{userId}
  - x, y
  - name
  - color
  - lastUpdate (timestamp)

/sessions/{canvasId}/presence/{userId}
  - online: true/false
  - name
  - lastSeen
```

### State Management

**Zustand or React Context**

**Rationale:**
- Lightweight, easy to integrate
- Less boilerplate than Redux
- Good enough for MVP scope

**Potential Pitfalls:**
- Need to separate canvas state from UI state
- Avoid storing entire canvas in React state (performance killer)
- Use refs for Konva stage/layer instances

---

## Technical Architecture

### Data Flow
1. User performs action (create/move shape)
2. Update local Konva canvas immediately (optimistic update)
3. Broadcast change to Firebase
4. Firebase triggers update to all other clients
5. Other clients update their Konva canvases

### Conflict Resolution Strategy
**Last-Write-Wins (LWW)** with timestamp-based ordering

**Rationale:**
- Simple to implement for MVP
- Acceptable for 24-hour deadline
- Document this choice clearly

**Future Consideration:**
- Operational Transformation (OT) or CRDT for production

### Performance Optimization Strategy (Post-MVP)
These are good practices to keep in mind but NOT required for MVP:
- Throttle cursor updates to 20-30 FPS (30-50ms intervals)
- Batch object updates when possible
- Use Konva layers to separate static/dynamic content
- Implement viewport culling (don't render off-screen objects)

**MVP Approach:** Get it working first, optimize later

---

## MVP Testing Checklist

### Functional Tests (Hard Requirements)
- [ ] User can register and log in
- [ ] Canvas renders with pan/zoom
- [ ] User can create at least one shape type
- [ ] User can move shapes
- [ ] Two users see each other's cursors with names
- [ ] Two users see each other's shape changes in real-time
- [ ] Presence list shows online users
- [ ] User refresh preserves canvas state
- [ ] All users disconnect and reconnect, work persists

### Performance Tests (Post-MVP Goals)
These are goals for the full project but NOT required for MVP gate:
- [ ] 60 FPS during pan/zoom with 10+ objects
- [ ] Object sync < 100ms between users
- [ ] Cursor sync < 50ms between users
- [ ] 5+ concurrent users without degradation
- [ ] 500+ objects render without FPS drop

**MVP Focus:** Functionality and correctness over performance optimization

### Load Test Scenario (MVP Required)
1. Open 2 browser windows, different users
2. Create shapes in window 1
3. Move shapes in window 2
4. Refresh window 1 mid-edit
5. Verify all shapes persist and sync correctly

---

## Risk Mitigation

### High-Risk Areas
1. **Real-time sync functionality** - Test early and often with multiple devices
2. **Firebase write limits** - Structure data to avoid document contention
3. **State consistency** - Implement clear conflict resolution early
4. **Authentication integration** - Ensure auth works before building on it

### Mitigation Strategies
- Build sync first, features second
- Test with real network conditions (throttle in DevTools)
- Use Firebase emulator for local testing
- Have rollback plan (revert to simpler approach if needed)
- Don't over-optimize prematurely - focus on working functionality