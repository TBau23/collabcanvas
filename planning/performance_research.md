# CollabCanvas Performance Research

## Current State Analysis

### Architecture Overview
- **Rendering**: React-Konva with HTML5 Canvas (5000x5000px bounded area)
- **Database**: Firebase Firestore for all data (shapes, cursors, presence)
- **Sync Pattern**: `onSnapshot` listeners + optimistic updates
- **Conflict Resolution**: Last-write-wins with timestamps
- **Data Flow**: Component → Service Layer → Firestore → All clients

### Current Performance Characteristics
**Strengths:**
- Optimistic updates provide instant local feedback
- Cursor throttling (100ms) limits write frequency
- Functional state updates prevent race conditions
- React-Konva provides hardware-accelerated canvas rendering

**Measured Behavior (2-3 users, <100 objects):**
- Cursor sync: ~100-150ms (throttled writes)
- Shape updates: ~200-300ms (Firestore round-trip)
- Smooth 60fps rendering at current scale

---

## Rubric Performance Requirements

### Section 1: Real-Time Synchronization (12 points)
**Target:** Sub-100ms object sync, Sub-50ms cursor sync

**Current Status:** ⚠️ NEEDS IMPROVEMENT
- Cursor sync: 100-150ms (failing 50ms target)
- Object sync: 200-300ms (failing 100ms target)
- Firestore latency is the bottleneck

### Section 2: Performance & Scalability (12 points)
**Targets:**
- Excellent (11-12 pts): 500+ objects, 5+ users, no degradation
- Good (9-10 pts): 300+ objects, 4-5 users, minor slowdown

**Current Status:** ⚠️ UNTESTED AT SCALE
- Manual testing only up to ~50 objects, 3 users
- No virtual rendering for large object counts
- Grid renders 200+ individual Line components
- No progressive loading strategy

---

## Critical Performance Bottlenecks

### 1. Firestore for High-Frequency Ephemeral Data
**Problem:** Firestore optimized for consistency, not speed
- **Cursor updates:** 100ms throttle still produces ~200ms round-trips
- **Active dragging:** Not currently synced during drag (only on drag-end)
- **Write costs:** Acceptable, but latency is poor

**Impact:** Failing sub-50ms cursor and sub-100ms object targets

### 2. No Rendering Optimization at Scale
**Problems:**
- All shapes rendered every frame regardless of viewport
- Grid renders 200+ Line components (5000px / 25px = 200 lines)
- No object pooling or virtualization
- Transform calculations on every render

**Impact:** Will fail 500+ object performance target

### 3. No Batching for Bulk Operations
**Problems:**
- AI creates shapes sequentially in a loop (not batched)
- Each shape = separate Firestore write
- No batch write API usage
- No optimistic bulk updates

**Impact:** Poor UX for complex AI commands, unnecessary write amplification

### 4. Presence Heartbeat Overhead
**Current:** 2-second interval per user = 0.5 writes/sec/user
- With 5 users: 2.5 presence writes/sec
- With 10 users: 5 presence writes/sec
- Acceptable cost but could be optimized

---

## Optimization Strategy

### Tier 1: Critical (Required for Excellent Rating)

#### 1.1 Hybrid Database Architecture ✅ AGREE WITH USER
**Implement Firebase Realtime Database + Firestore split:**

**Realtime Database (RTDB) - Ephemeral, High-Frequency:**
- Cursor positions (target: <50ms sync)
- Active user presence (who's online)
- Live dragging positions (sync during drag, not just on drag-end)
- Active selections (who's editing what)
- Temporary collaborative state

**Firestore - Persistent, Structured:**
- Final shape states (created/updated/deleted)
- Project metadata
- User accounts
- Version history (future)
- Comments (future)

**Rationale:**
- RTDB has lower latency (~30-50ms vs 150-300ms)
- RTDB has automatic `onDisconnect()` handlers (cleaner presence)
- RTDB optimized for high-frequency updates
- Firestore better for querying, complex permissions, structured data
- This is industry-standard pattern (Figma uses similar approach)

**Implementation:**
```javascript
// RTDB paths
/sessions/{canvasId}/
  ├─ cursors/{userId}: { x, y, color, userName }
  ├─ presence/{userId}: { online, lastSeen, color }
  ├─ dragging/{shapeId}: { x, y, userId } // NEW
  └─ selections/{userId}: { shapeId } // NEW

// Firestore paths (unchanged)
/canvases/{canvasId}/
  └─ objects/{shapeId}: { type, x, y, ... }
```

**Expected Gains:**
- Cursor sync: 100-150ms → 30-50ms ✅ Meets target
- Presence: Automatic cleanup via onDisconnect()
- Live dragging: Real-time positional updates during drag

#### 1.2 Implement Live Dragging Sync
**Current:** Only sync on drag-end
**Target:** Sync position every 50-100ms during drag

```javascript
// In Canvas.jsx
const handleShapeDrag = throttle((shapeId, x, y) => {
  // Update RTDB dragging state
  updateDraggingPosition(shapeId, x, y, user.uid);
}, 50); // 50ms throttle = 20 updates/sec
```

**Expected Gain:** Smooth real-time dragging visible to all users

#### 1.3 Canvas Rendering Optimizations
**A. Virtual Rendering for Shapes**
- Only render shapes within viewport + margin
- Use spatial indexing (quadtree or R-tree)
- Estimated 10x performance gain with 500+ objects

**B. Optimize Grid Rendering**
- Render grid as single cached bitmap or using Konva.Shape with custom draw
- Current: 200 React components → Target: 1 component
- Expected: 5-10ms → <1ms per frame

**C. Layer Baking**
- Use Konva's layer caching for static elements
- Cache grid layer, only redraw on zoom/pan

**Implementation Priority:**
1. Grid optimization (quick win, big impact)
2. Viewport culling (moderate effort, critical for 500+ objects)
3. Layer caching (low effort, modest gain)

---

### Tier 2: High-Value Improvements

#### 2.1 Batch Operations
**Implement Firestore batch writes:**
```javascript
// In aiService.js - createMultipleShapes
const batch = writeBatch(db);
shapes.forEach(shape => {
  const ref = doc(db, 'canvases', CANVAS_ID, 'objects', shape.id);
  batch.set(ref, shape);
});
await batch.commit(); // Single round-trip vs N round-trips
```

**Expected Gain:** AI commands 3-5x faster, better UX

#### 2.2 Connection State Management
**Implement explicit connection monitoring:**
- Visual indicator for online/offline state
- Queue operations during disconnect
- Auto-replay on reconnect
- Use RTDB `.info/connected` for real-time status

**Rubric Impact:** Addresses "Persistence & Reconnection" (9 points)

#### 2.3 Optimize Presence Heartbeat
**Current:** 2-second interval
**Optimization:** 
- Use RTDB onDisconnect() to eliminate heartbeat entirely
- Or increase interval to 5-10 seconds (stale threshold: 15-20s)

**Expected Gain:** 60% reduction in presence writes

---

### Tier 3: Scale Optimizations

#### 3.1 Progressive Shape Loading
For canvases with 1000+ objects:
- Load visible shapes first
- Lazy-load off-viewport shapes
- Implement pagination or spatial queries

#### 3.2 Memoization & React Optimization
```javascript
// Memoize expensive shape renders
const MemoizedShape = React.memo(Shape, (prev, next) => {
  return prev.x === next.x && 
         prev.y === next.y && 
         prev.fill === next.fill // ... etc
});
```

#### 3.3 WebWorker for Sync Logic
- Move Firestore sync processing to WebWorker
- Keep main thread free for rendering
- Advanced optimization, may not be necessary

---

## Implementation Roadmap

### Phase 1: Hybrid Database (Highest Priority)
**Effort:** 2-3 days  
**Impact:** Meets sub-50ms cursor, sub-100ms object targets

1. Add Firebase Realtime Database to project
2. Create `rtdbService.js` for RTDB operations
3. Migrate cursors to RTDB
4. Migrate presence to RTDB (use onDisconnect)
5. Keep shapes in Firestore
6. Test sync latency

### Phase 2: Rendering Optimizations
**Effort:** 2-3 days  
**Impact:** Enables 500+ object target

1. Optimize grid rendering (quick win)
2. Implement viewport culling for shapes
3. Add layer caching
4. Load test with 500+ objects

### Phase 3: Live Dragging & Batching
**Effort:** 1-2 days  
**Impact:** Smoother collaboration, better AI performance

1. Implement live drag sync via RTDB
2. Add batch writes for AI operations
3. Add connection state indicators

### Phase 4: Scale Testing & Polish
**Effort:** 2-3 days  
**Impact:** Validate targets, fix edge cases

1. Load testing with 5+ users
2. Load testing with 500+ objects
3. Performance profiling
4. Fix identified bottlenecks

---

## Expected Performance After Optimization

### Sync Latency
- Cursor sync: **30-50ms** (RTDB) ✅ Excellent
- Shape updates: **80-120ms** (Firestore) ✅ Good-Excellent
- Live dragging: **50-100ms** (RTDB) ✅ Excellent

### Scalability
- **500+ objects:** 60fps with viewport culling ✅ Excellent
- **5+ users:** No degradation with RTDB for ephemeral state ✅ Excellent
- **Concurrent edits:** Last-write-wins handles gracefully ✅ Good

### Rubric Score Projection
- Real-Time Synchronization: 11-12 / 12 (Excellent)
- Performance & Scalability: 11-12 / 12 (Excellent)
- Total: 22-24 / 24 performance points

---

## Technical Considerations

### Firebase Realtime Database Setup
**Pros:**
- Lower latency (30-50ms typical)
- Automatic onDisconnect() handlers
- Optimized for high-frequency updates
- Simple JSON structure
- WebSocket-based (persistent connection)

**Cons:**
- Less structured than Firestore
- Weaker querying capabilities
- Security rules are more complex
- No offline persistence by default

**Recommendation:** Use RTDB for ephemeral state only, keep Firestore as source of truth for persistent canvas data.

### Firestore Optimization
Even without RTDB, Firestore can be optimized:
- Use `setDoc` with `{merge: false}` when possible (faster)
- Batch writes for bulk operations
- Index optimization for queries
- Connection pooling (already handled by SDK)

### React-Konva Optimization
- Use `listening={false}` on non-interactive elements (already done for grid)
- Implement `shouldComponentUpdate` or `React.memo` for shape components
- Use Konva's built-in caching (`cache()` method)
- Consider `pixelRatio` tuning for performance vs quality

---

## Risk Assessment

### Low Risk
- Grid optimization (isolated change)
- Batch writes (additive feature)
- Viewport culling (can be feature-flagged)

### Medium Risk
- RTDB migration (requires careful data sync design)
- Live dragging (adds complexity to drag handlers)
- Connection state management (edge cases with offline mode)

### Mitigation Strategy
- Feature flags for new optimizations
- Incremental rollout (test with small user group)
- Comprehensive load testing before considering complete
- Fallback to Firestore-only mode if RTDB issues arise

---

## Conclusion

**Current MVP is solid foundation** but won't meet Excellent rating on performance criteria without optimization.

**Critical Path:**
1. **Hybrid Database** (RTDB + Firestore) → Meets latency targets
2. **Rendering Optimization** → Enables 500+ object target
3. **Load Testing** → Validates performance claims


