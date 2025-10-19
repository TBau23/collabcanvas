# Concurrent Editing Research: Multi-User Behavior Analysis

**Date**: October 18, 2025  
**Status**: Research Document  
**Purpose**: Document current concurrent editing behavior and identify improvement opportunities

---

## Executive Summary

The collaborative canvas uses a **hybrid database architecture** (RTDB + Firestore) with **optimistic concurrency** and **last-write-wins (LWW) conflict resolution**. This provides excellent performance (<50ms real-time updates) but has clear limitations around concurrent editing of the same shape.

### Key Findings
- ✅ Sub-50ms latency for cursors, selections, and live transforms (RTDB)
- ✅ Viewport culling enables 500+ shapes at 60fps
- ✅ Visual awareness (colored outlines) provides partial conflict mitigation
- ⚠️ Last-write-wins causes silent data loss during simultaneous edits
- ⚠️ No conflict detection, warnings, or undo mechanisms
- ⚠️ "Shape fighting" behavior when multiple users edit same shape

---

## 1. Architecture Overview

### 1.1 Hybrid Database Strategy

**Firebase Realtime Database (RTDB)** - Real-time layer (<50ms):
- Cursor positions: `sessions/{canvasId}/cursors/{userId}`
- User presence: `sessions/{canvasId}/presence/{userId}`
- Live transforms: `sessions/{canvasId}/dragging/{shapeId}`
- Selections: `sessions/{canvasId}/selections/{userId}`

**Firestore** - Persistent layer (100-200ms):
- Shape objects: `canvases/{canvasId}/objects/{shapeId}`
- Source of truth for persistent state
- Merge writes enabled: `{ merge: true }`

### 1.2 Optimistic Update Pattern

Every user action follows this flow:
1. **Local state update** → Instant UI feedback
2. **RTDB broadcast** (if applicable) → Real-time preview for others
3. **Firestore write** → Persistent storage
4. **Firestore listener** → Confirmation/correction from source of truth

This pattern provides instant feedback while maintaining eventual consistency.

---

## 2. Canvas Features

### Shape Operations
- Create (rectangle, ellipse, text), select, drag, resize, rotate, delete
- Color changes, text editing, z-order (local only)
- AI-powered creation and manipulation

### Collaboration Features
- **Live cursors** with user names and colors
- **Selection awareness** via colored outlines
- **Live transform preview** (orange outline, 70% opacity during remote drag/resize)
- **Presence panel** showing online users

### Visual Feedback System
| Outline Color | Meaning | Priority |
|---------------|---------|----------|
| Blue | Local user's selection | Highest |
| Orange | Remote active transform | High |
| User color | Remote static selection | Medium |
| None | Unselected | N/A |

---

## 3. Concurrent Editing Scenarios

### Scenario 1: Two Users Drag Same Shape
**What Happens**:
- Both users write to same RTDB path: `dragging/{shapeId}`
- Updates alternate every 50ms → shape "jitters" between positions
- Both users see their own drag as smooth (local state)
- Remote user sees chaotic movement
- On release: Both write to Firestore → **last write wins**
- Loser's changes completely discarded with no warning

**Data Loss**: Yes - first user's entire drag operation lost

---

### Scenario 2: Drag + Resize Simultaneously
**What Happens**:
- Both operations use same RTDB path and write full transform state
- Even though drag only cares about x/y, it overwrites width/height/rotation
- Shape appears to "fight" between drag and resize states
- On completion: **Last write wins** in Firestore
- One operation completely discarded

**Data Loss**: Yes - one operation lost

---

### Scenario 3: Non-Overlapping Field Updates (Color + Position)
**What Happens**:
- User A: `updateShape(shapeId, { fill: "#FF0000" })`
- User B: `updateShape(shapeId, { x: 1000, y: 1000 })`
- Firestore merge: Both changes preserved!
- Final shape has both new color AND new position

**Data Loss**: No - merge successful ✅

**Why This Works**: Firestore's `{ merge: true }` preserves non-overlapping fields.

---

### Scenario 4: Edit Deleted Shape
**What Happens**:
- User B deletes shape (document removed from Firestore)
- User A completes drag, writes position update
- `setDoc(..., { merge: true })` recreates document with partial data
- Shape reappears with only x/y fields (missing type, width, height, fill)

**Data Loss**: Shape data corruption - "zombie shape" with incomplete schema

**Root Cause**: Should use `updateDoc()` which fails on missing document, not `setDoc()`.

---

### Scenario 5: Multiple Users Select Same Shape
**What Happens**:
- Each user broadcasts selection to RTDB: `selections/{userId}`
- Both users see blue outline locally (their own selection)
- Remote users see colored outline (first selection found)
- **Limitation**: Only one remote selection shown (uses `.find()` which returns first match)

**Data Loss**: No, but visibility is limited

---

### Scenario 6: User Disconnects During Edit
**What Happens**:
- RTDB `onDisconnect()` handlers fire automatically
- Dragging state, cursor, and presence removed from RTDB
- Orange outline disappears, shape returns to last Firestore position
- Cleanup completes within ~200ms

**Data Loss**: Partial - in-progress drag not persisted (expected behavior)

---

## 4. Conflict Resolution Analysis

### 4.1 Current Strategy: Last-Write-Wins

**How It Works**: When multiple writes occur, the write with the latest server timestamp is kept; others are silently discarded.

**Advantages**:
- Simple to implement
- Deterministic outcome
- Works well for non-overlapping field updates
- No blocking or lock management

**Disadvantages**:
- Silent data loss (no user notification)
- Non-intuitive for simultaneous position edits
- No undo for lost changes
- "Shape fighting" during concurrent transforms

### 4.2 Why LWW Fails for Position/Transform

**Problem**: Position (x, y) is a composite value representing a single semantic operation.

Example:
```
Initial: shape at (100, 100)
User A drags to: (200, 100) — move right
User B drags to: (100, 200) — move down

Ideal result: (200, 200) — both movements applied
Actual result: (200, 100) OR (100, 200) — one movement lost
```

**Root Cause**: X and Y treated as independent fields, but represent atomic "move" operation.

### 4.3 Alternative Strategies (Research)

| Strategy | How It Works | Pros | Cons | Complexity |
|----------|--------------|------|------|------------|
| **LWW** (current) | Last timestamp wins | Simple, fast | Data loss | Low |
| **LWW + Detection** | LWW but notify users | Awareness | Still loses data | Medium |
| **Operational Transform** | Merge operations as deltas | No data loss | Complex implementation | High |
| **CRDT** | Math-based auto-merge | No conflicts | Memory overhead | High |
| **Locking** | Exclusive edit access | No conflicts | Blocks collaboration | Medium |

### 4.4 Comparison to Similar Systems

- **Figma**: CRDT-based, no data loss, shows all selections
- **Google Docs**: Operational Transformation, per-user undo
- **Miro**: OT/CRDT (unknown), optional explicit locking
- **Excalidraw**: Yjs CRDT, automatic merging

Current system trades conflict-free guarantees for implementation simplicity.

---

## 5. Known Issues

### High Priority
1. **Shape Resurrection**: Updating deleted shape recreates it with partial data
   - Fix: Use `updateDoc()` instead of `setDoc()`

2. **Z-Index Non-Persistence**: Bring-to-front/send-to-back doesn't sync
   - Code comment acknowledges this (Canvas.jsx:773)

3. **Transform "Fighting"**: Strange resize behavior when dragging across Y-axis
   - Mentioned in NOTES_N_FIXES.md

### Medium Priority
4. **Single Remote Selection Display**: Only shows first selection when multiple users select same shape
5. **Text Limitations**: No font size/family/color controls
6. **No AI Response for Some Delete Commands**: Sequential operations needed

---

## 6. Improvement Opportunities

### Tier 1: High Value, Medium Effort

**1. Conflict Detection Layer**
- Track `lastKnownVersion` per shape on client
- Compare timestamps on Firestore updates
- Show notification: "Your changes were overwritten by [User]"
- Doesn't prevent conflicts, but makes them visible

**2. Z-Index Persistence**
- Add `zIndex` field to Firestore schema
- Sync z-order changes across users
- Simple implementation, high usability impact

**3. Shape Resurrection Bug Fix**
- Replace `setDoc()` with `updateDoc()` for updates
- Prevents zombie shapes from appearing

### Tier 2: High Value, Higher Effort

**4. Soft Locking / Visual Warnings**
- Broadcast "edit intent" when user starts editing
- Show stronger warning: "Alice is editing this shape"
- Don't enforce lock (user can still edit), but make conflict expected
- Reduces accidental conflicts without blocking collaboration

**5. Local Undo System**
- Track operation history in client state
- Cmd+Z applies inverse operation and writes to Firestore
- Works with current architecture (no multi-user undo)
- Standard feature expectation for design tools

**6. Multiple Selection Indicators**
- Show all remote selections (not just first)
- Use layered/offset outlines or user avatars
- Better awareness of multi-user interest

### Tier 3: Research Projects (Long Term)

**7. Operational Transformation for Moves**
- Store position updates as deltas: `move(dx, dy)`
- Merge concurrent moves: `final = initial + deltaA + deltaB`
- Eliminates data loss for position changes
- Requires significant R&D and testing

**8. CRDT Integration**
- Consider Yjs or Automerge for automatic conflict-free merging
- Major architecture change (shape state as CRDT types)
- Proven approach (used by Figma, Excalidraw)

**9. Collaborative Undo**
- Time-travel for entire canvas
- Requires full history storage and complex merge logic
- High implementation and storage cost

---

## 7. Performance Characteristics

| Operation | Latency | Database | Notes |
|-----------|---------|----------|-------|
| Cursor update | <50ms | RTDB | 50ms throttle |
| Selection broadcast | <50ms | RTDB | No throttle |
| Live transform | <50ms | RTDB | 50ms throttle |
| Shape create/update | 100-200ms | Firestore | Source of truth |
| Viewport culling | N/A | Client | Renders ~20 shapes vs 500 |

**Scalability**: Viewport culling is critical for 500+ shapes. Without it:
- 500 shapes: 85ms/frame (12fps) ❌
- With culling: 4ms/frame (250fps) ✅

**AI Performance**: Parallel execution and batch writes provide 10-75x speedup for multi-shape operations.

---

## 8. Recommendations

Based on this research, prioritized next steps:

### Immediate (Next Sprint)
1. **Fix shape resurrection bug** - Data integrity issue, simple fix
2. **Implement conflict detection** - Foundation for all other conflict work
3. **Add z-index persistence** - Currently a glaring omission

### Near Term (Next Quarter)
4. **Soft locking with visual warnings** - Proactive conflict prevention
5. **Local undo system** - Expected feature in design tools
6. **Multiple selection indicators** - Better multi-user awareness

### Future Research
7. Evaluate OT vs CRDT for position merging
8. Consider operational delta storage for history
9. Explore collaborative undo patterns

---

## 9. Conclusion

The current system demonstrates a **pragmatic MVP approach**: fast, simple, and effective for small teams where conflicts are rare. The hybrid architecture delivers excellent performance, and visual awareness features (colored outlines, live previews) partially mitigate the LWW limitations.

For scaling or complex workflows, the system needs evolution:
- **Short term**: Make conflicts visible (detection + warnings)
- **Medium term**: Prevent common conflicts (soft locking + undo)
- **Long term**: Automatic conflict resolution (OT or CRDT)

The codebase is well-structured and provides a solid foundation for these enhancements. The key is to **iterate incrementally** - make conflicts visible before attempting automatic resolution.

---

## References

### Key Technologies
- **Yjs**: CRDT framework for collaborative apps
- **Automerge**: CRDT library with JSON-like API
- **ShareDB**: OT-based collaborative editing framework

### Academic Papers
- "Conflict-Free Replicated Data Types" (Shapiro et al., 2011)
- "Operational Transformation in Real-Time Group Editors" (Ellis & Gibbs, 1989)

### Industry Resources
- "How Figma's Multiplayer Technology Works" (Evan Wallace, 2019)
- Firebase Realtime Database Best Practices


