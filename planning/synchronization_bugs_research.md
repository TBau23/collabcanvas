# CollabCanvas Synchronization Bugs Research

**Date:** October 18, 2025  
**Focus:** Real-time synchronization issues, particularly deletion propagation for AI-generated shapes

---

## Executive Summary

This document analyzes critical synchronization bugs in the CollabCanvas application, with emphasis on a reproducible deletion propagation failure. The primary bug causes AI-generated shapes to persist in the creator's browser even after other users delete them, breaking the fundamental contract of collaborative editing.

**Severity:** 🔴 CRITICAL - Breaks core collaborative functionality

---

## Bug #1: Deletion Propagation Failure for Shape Creator (CRITICAL)

### Reproduction Steps

1. **User A** opens browser and uses AI to generate shapes (e.g., "create a 3x3 grid of squares")
2. **User B** opens separate browser, sees the AI-generated shapes appear
3. **User B** selects and deletes one or more of the AI-generated shapes
4. **Expected:** Shapes disappear from both browsers
5. **Actual:** Shapes disappear from User B's browser but remain visible in User A's browser (the creator)

**Critical Detail:** If User A (creator) deletes the shapes, the deletion DOES propagate to User B correctly. The bug is unidirectional - it only affects deletions by non-creators.

### Root Cause Analysis

**Location:** `Canvas.jsx`, lines 148-196 (subscribeToShapes effect)

**Problematic Code:**
```javascript
// Line 164-166
const existingShapes = currentShapes.filter(shape => 
  remoteShapeIds.has(shape.id) || shape.updatedBy === user.uid
);
```

**The Problem:**
The merge logic uses `shape.updatedBy === user.uid` to preserve shapes created by the current user. This was designed to protect optimistic updates (like during dragging), but it has a fatal flaw: it prevents deletion propagation.

**Execution Flow:**

1. **AI creates shapes** (`aiService.js`, `createMultipleShapes`, lines 321-361):
   - Shapes are batch-written to Firestore with `updatedBy: userId` (User A's ID)
   - Shapes contain: `{ id, type, x, y, fill, updatedBy: userA.uid, updatedAt: timestamp }`

2. **User A's listener receives the shapes** (`Canvas.jsx`, lines 148-196):
   - Firestore `onSnapshot` fires with new shapes
   - Shapes are merged into local state via `setShapes((currentShapes) => {...})`
   - Shapes now live in User A's local state with `updatedBy: userA.uid`

3. **User B deletes a shape** (`Canvas.jsx`, lines 266-279):
   - User B presses Delete/Backspace
   - Shape is removed from User B's local state (optimistic): `setShapes(shapes.filter(shape => shape.id !== selectedId))`
   - `deleteShape(selectedId)` called → Firestore document deleted

4. **User B's listener receives deletion:**
   - Firestore snapshot no longer includes the deleted shape
   - Merge logic: `remoteShapeIds.has(shape.id)` is false → shape removed ✅
   - User B's local state is updated correctly

5. **User A's listener receives deletion** (🐛 THIS IS WHERE IT BREAKS):
   - Firestore snapshot no longer includes the deleted shape
   - Merge logic enters functional update: `setShapes((currentShapes) => {...})`
   - Line 164-166: `existingShapes = currentShapes.filter(shape => remoteShapeIds.has(shape.id) || shape.updatedBy === user.uid)`
   - For the deleted shape:
     - `remoteShapeIds.has(shape.id)` → **false** (shape deleted in Firestore)
     - `shape.updatedBy === user.uid` → **true** (User A created it via AI)
     - Result: Shape is kept in `existingShapes` ❌
   - Deleted shape persists in User A's local state

**Why this logic exists:**
The `shape.updatedBy === user.uid` condition was likely added to handle optimistic updates during drag operations. When User A drags a shape:
1. Local state updates immediately (optimistic)
2. Firestore update happens async
3. When Firestore snapshot arrives, it might have stale data
4. The logic preserves local changes to prevent flickering

**Why it breaks:**
The logic cannot distinguish between:
- Legitimate local optimistic updates (should be preserved)
- Remote deletions (should be honored)

### Impact Assessment

**User Experience:**
- Breaks trust in collaborative editing
- Creates "ghost objects" visible only to creator
- Causes confusion: User B thinks shapes are deleted, User A sees them still there
- Worsens over long editing sessions as ghost objects accumulate

**Data Consistency:**
- Firestore is correct (shape is deleted)
- User A's local state is stale (shape persists)
- Different users see different canvas states (catastrophic for collaboration)

**Rubric Impact:**
- **Conflict Resolution & State Management:** Fails "No ghost objects" criterion (Excellent requires 8-9 points)
- **Persistence & Reconnection:** If User A refreshes, shape will disappear (proving Firestore is correct)
- Likely score: **Poor (0-3 points)** for "Different users see different canvas states"

---

## Bug #2: Race Condition Between Optimistic Updates and Firestore Sync

### Description

The current merge logic attempts to handle optimistic updates by preserving local changes when they're newer than remote changes (line 179):

```javascript
if (remoteShape.updatedAt > (localShape.updatedAt || 0)) {
  return remoteShape;
}
return localShape;
```

**Problem:** This creates a race condition for rapid edits.

### Scenario

1. User A drags shape to position (100, 100) at timestamp T1
   - Local state updates: `{ x: 100, y: 100, updatedAt: T1 }`
   - Firestore write starts (200-300ms latency)

2. User B drags same shape to position (200, 200) at timestamp T2 (T2 > T1)
   - User B's local state: `{ x: 200, y: 200, updatedAt: T2 }`
   - User B's Firestore write starts

3. User A's Firestore write completes at T3
   - User B's listener receives update with `updatedAt: T1`
   - User B's merge logic: T1 < T2 → keeps local version (200, 200) ✅

4. User B's Firestore write completes at T4
   - User A's listener receives update with `updatedAt: T2`
   - User A's merge logic: T2 > T1 → uses remote version (200, 200) ✅

**This works correctly!**

### But what about this scenario?

1. User A drags shape at T1 → local update, Firestore write starts
2. User A drags same shape again at T2 → local update, Firestore write starts
3. Firestore write from T1 completes and arrives back at User A at T3
4. User A's merge logic: 
   - `remoteShape.updatedAt` (T1) vs `localShape.updatedAt` (T2)
   - T1 < T2 → keeps local version ✅
5. Firestore write from T2 completes → all clients eventually consistent ✅

**This also works correctly!**

### Actual Problem: Stale Local State After Network Issues

If a user loses network connection:
1. Makes local edits (optimistic updates accumulate)
2. Reconnects
3. Firestore snapshot arrives with newer data from other users
4. But local edits have high timestamps → they override remote changes

**Impact:** Medium severity - only affects users with intermittent connectivity

---

## Bug #3: LocalOnlyShapes Logic Causes Duplicate Shapes

### Location

`Canvas.jsx`, lines 187-191:

```javascript
const localOnlyShapes = existingShapes.filter(shape => 
  !remoteShapeIds.has(shape.id) && shape.updatedBy === user.uid
);

return [...mergedShapes, ...localOnlyShapes];
```

### Problem

This logic creates a separate category of "local-only shapes" that exist in local state but not in Firestore. These are shapes created by the user that haven't synced yet.

**Intended Use Case:**
Optimistic creation - user clicks to create shape, shape appears immediately, Firestore write happens async.

**Bug Scenario:**

1. User A creates shape with ID `shape-123` at T1
   - Optimistic: Added to local state immediately
   - `localOnlyShapes` will include it (not in remote yet, `updatedBy === userA.uid`)
   - Firestore write starts

2. Firestore write completes, snapshot arrives at T2
   - Remote shapes now include `shape-123`
   - Merge logic:
     - `mergedShapes` includes `shape-123` (from remote)
     - `localOnlyShapes` also includes `shape-123` (if it hasn't been filtered yet)
   - Result: `[...mergedShapes, ...localOnlyShapes]` potentially includes `shape-123` TWICE

**Why this might not happen often:**
The functional update `setShapes` may execute fast enough that by the time Firestore snapshot arrives, the shape is already in `currentShapes` with matching ID, so the filter removes duplicates.

**Why it COULD happen:**
If there's a slight delay or if React batches state updates, you could get:
- Firestore snapshot arrives at same time as local creation
- Both code paths think they own the shape
- Two instances added to array

**Evidence Needed:** Console logging to verify if duplicate shape IDs ever exist in shapes array

### Impact

**Severity:** Low-Medium (rare, but creates visual duplicates)

---

## Bug #4: Batch Creation Doesn't Update Local State Optimistically

### Location

`aiService.js`, lines 321-361 (`createMultipleShapes`)

### Problem

When AI creates multiple shapes using batch writes:

```javascript
const batch = writeBatch(db);
for (const shape of args.shapes) {
  const shapeData = { /* ... */ };
  const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
  batch.set(shapeRef, shapeData);
  createdShapes.push(shapeData);
}
await batch.commit();
```

**What happens:**
1. Shapes are sent to Firestore (batch commit)
2. Function returns `{ success: true, data: createdShapes }`
3. Canvas waits for Firestore `onSnapshot` to receive the shapes
4. User sees shapes appear with 200-300ms delay

**What SHOULD happen:**
1. Shapes immediately added to Canvas local state (optimistic)
2. Shapes sent to Firestore
3. Firestore snapshot confirms creation
4. User sees shapes appear instantly (0ms delay)

**Why it matters:**
This violates the optimistic update pattern used everywhere else. Manual shape creation (clicking to add a rectangle) updates local state immediately, but AI creation does not.

### Impact

**User Experience:**
- Noticeable delay for AI commands (200-300ms before shapes appear)
- Inconsistent behavior (manual creation is instant, AI is delayed)

**Rubric Impact:**
- **AI Performance:** "Sub-2 second responses" includes render time
- Adds 200-300ms to perceived AI latency

**Severity:** Low (UX issue, not a correctness issue)

---

## Bug #5: Transformer Not Updated During Remote Dragging

### Location

`Canvas.jsx`, lines 814-849 (shape rendering)

### Problem

When a shape is being dragged by another user:
- Remote dragging data updates the shape's displayed position via `remoteDragging` (lines 818-826)
- Shape renders at new position with orange outline (line 846-847)
- BUT: If the local user has that shape selected, the Transformer component doesn't update

**Scenario:**
1. User A selects a shape (Transformer appears with resize handles)
2. User B starts dragging the same shape
3. Shape moves on User A's screen (remote dragging works ✅)
4. Transformer stays at original position (not following the shape ❌)

**Why it happens:**
The Transformer is attached via `transformerRef.current.nodes([shapeRefs.current[selectedId]])` (lines 239-241). This happens in a `useEffect` that only triggers when `selectedId` or `shapes` changes. Remote dragging updates `remoteDragging` state, not `shapes`, so the Transformer isn't notified.

### Impact

**Severity:** Low (edge case, unlikely scenario)

**Likelihood:** Very low - two users rarely select the same shape simultaneously

---

## Bug #6: Text Editing Doesn't Lock Shape for Others

### Location

`Canvas.jsx`, lines 634-676 (text editing)

### Problem

When a user double-clicks text to edit it:
1. Shape is deselected locally (line 647)
2. Inline textarea appears for editing (lines 938-971)
3. BUT: No signal sent to other users that this shape is being edited

**Scenario:**
1. User A double-clicks text, starts editing "Hello"
2. User B doesn't see any indication that User A is editing
3. User B can select, move, or delete the shape while User A types
4. User A saves edit → changes propagate
5. But the shape might be in a different position or deleted by User B

**Missing Feature:**
Need to track "editing locks" in RTDB (similar to dragging state):

```javascript
// Should exist in rtdbService.js
export const setShapeEditing = async (userId, shapeId) => {
  const editingRef = ref(rtdb, `sessions/${CANVAS_ID}/editing/${shapeId}`);
  await set(editingRef, { userId, startedAt: Date.now() });
};
```

### Impact

**Severity:** Medium (affects multi-user text editing)

**Rubric Impact:**
- **Conflict Resolution:** "User A edits object while User B moves it" scenario fails

---

## Bug #7: Optimistic Deletion Doesn't Handle Firestore Write Failure

### Location

`Canvas.jsx`, lines 266-279 (Delete key handler)

### Problem

When a user deletes a shape:

```javascript
// Delete from local state immediately (optimistic)
setShapes(shapes.filter(shape => shape.id !== selectedId));

// Clear selection
setSelectedId(null);

// Delete from Firestore
deleteShape(selectedId);
```

If `deleteShape()` fails (network error, permissions issue):
1. Shape disappears from local state
2. Firestore deletion fails silently (error logged to console)
3. Shape reappears when Firestore snapshot next fires
4. User is confused: "I deleted it, why did it come back?"

**No Error Handling:**
```javascript
// canvasService.js, lines 54-61
export const deleteShape = async (shapeId) => {
  try {
    const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
    await deleteDoc(shapeRef);
  } catch (error) {
    console.error('Error deleting shape:', error);
    // ⚠️ NO USER FEEDBACK!
  }
};
```

### Impact

**Severity:** Medium (only affects users with network issues)

**Fix:** Show error toast and restore shape to local state on failure

---

## Bug #8: Z-Index Not Persisted Across Users

### Location

`Canvas.jsx`, lines 699-730 (bring to front / send to back)

### Current Behavior

Shape z-index (render order) is determined by array position in local state. When a user clicks "Bring to Front":

```javascript
const newShapes = [
  ...shapes.filter(s => s.id !== selectedId),
  { ...selectedShape, updatedBy: user.uid, updatedAt: Date.now() }
];
setShapes(newShapes);
```

**Problem:** This only reorders the local array. There's no z-index field in Firestore.

**Result:**
- User A brings shape to front → sees it on top locally
- User B receives no update (z-index not synced)
- When User B refreshes, Firestore returns shapes in arbitrary order
- Everyone sees different z-order

### Impact

**Severity:** Low-Medium (collaboration feature doesn't work)

**Note:** Code comment acknowledges this (lines 713-714)

---

## Proposed Solutions

### Fix for Bug #1 (CRITICAL): Deletion Propagation

**Strategy:** Distinguish between optimistic updates and remote deletions

**Option A: Timestamp Window Approach**
```javascript
const OPTIMISTIC_WINDOW_MS = 5000; // 5 seconds

const existingShapes = currentShapes.filter(shape => {
  if (remoteShapeIds.has(shape.id)) return true;
  
  // Only preserve user's shapes if they're recent (likely optimistic)
  if (shape.updatedBy === user.uid) {
    const age = Date.now() - shape.updatedAt;
    return age < OPTIMISTIC_WINDOW_MS;
  }
  
  return false;
});
```

**Pros:** Simple, preserves optimistic updates for active editing
**Cons:** Shapes deleted within 5s window still broken, arbitrary timeout

**Option B: Explicit Optimistic Flag**
```javascript
// When creating shape locally (before Firestore confirms)
const newShape = {
  id: crypto.randomUUID(),
  /* ... */,
  _optimistic: true, // Flag for optimistic update
};

// In merge logic
const existingShapes = currentShapes.filter(shape => {
  if (remoteShapeIds.has(shape.id)) return true;
  if (shape._optimistic && shape.updatedBy === user.uid) return true;
  return false;
});

// Remove flag when Firestore confirms
const mergedShapes = remoteShapes.map((remoteShape) => {
  const localShape = currentShapesMap.get(remoteShape.id);
  if (localShape && localShape._optimistic) {
    // Firestore confirmed, remove flag
    return { ...remoteShape, _optimistic: false };
  }
  return remoteShape;
});
```

**Pros:** Precise, only protects actual optimistic updates
**Cons:** More complex, requires tracking optimistic state lifecycle

**Option C: Remove the Problematic Logic (RECOMMENDED)**
```javascript
// Simply trust Firestore as source of truth
const existingShapes = currentShapes.filter(shape => 
  remoteShapeIds.has(shape.id)
);

// For optimistic updates during drag, use separate dragging state
const displayShapes = shapes.map(shape => {
  const remoteDrag = remoteDragging.find(d => d.shapeId === shape.id);
  if (remoteDrag) {
    return { ...shape, x: remoteDrag.x, y: remoteDrag.y };
  }
  return shape;
});
```

**Pros:** Simplest, Firestore is always source of truth, existing RTDB dragging handles real-time updates
**Cons:** Might cause brief flicker if Firestore update is slow (acceptable trade-off)

### Fix for Bug #4: Optimistic AI Creation

**Solution:** Add callback to AIModal that receives created shapes immediately

```javascript
// In aiService.js - return created shapes before Firestore confirms
return {
  success: true,
  aiResponse: aiMessage.content || 'Done!',
  toolCalls: toolResults,
  createdShapes: createdShapes, // NEW: shapes created by AI
  usage
};

// In Canvas.jsx - AIModal receives shapes and updates local state
<AIModal 
  isOpen={isAIModalOpen}
  onClose={() => setIsAIModalOpen(false)}
  currentShapes={shapes}
  onShapesCreated={(newShapes) => {
    // Optimistic update - add shapes immediately
    setShapes([...shapes, ...newShapes.map(s => ({ ...s, _optimistic: true }))]);
  }}
/>
```

### Fix for Bug #7: Delete Error Handling

```javascript
// In Canvas.jsx
try {
  await deleteShape(selectedId);
} catch (error) {
  // Restore shape on failure
  setShapes([...shapes, deletedShape]);
  
  // Show error to user
  showErrorToast('Failed to delete shape. Please try again.');
}
```

---

## Testing Plan

### Critical Path Testing

1. **Deletion Propagation Test:**
   - Two browsers, different users
   - User A: Create shape via AI
   - User B: Delete shape
   - Verify: Shape disappears from both browsers within 500ms
   - Verify: No "ghost objects" persist after 5 seconds

2. **Simultaneous Edit Test:**
   - Two browsers, different users
   - Both users create shapes simultaneously
   - Both users delete different shapes simultaneously
   - Verify: Final state is consistent across browsers

3. **Network Failure Test:**
   - Single browser
   - Throttle network to 0
   - Create 3 shapes
   - Delete 1 shape
   - Restore network
   - Verify: Firestore state matches local state within 2 seconds

4. **AI Batch Creation Test:**
   - Two browsers
   - User A: "Create a 5x5 grid of squares" (25 shapes)
   - Measure time from command sent to shapes appearing on User B's screen
   - Target: < 1 second

### Edge Cases

1. Shape deleted during drag
2. Shape deleted during transform
3. Shape deleted while text editing
4. 100+ shapes, rapid multi-user edits
5. All users disconnect simultaneously, then reconnect

---

## Performance Implications

### Current State

- **Cursor latency:** 30-50ms (RTDB) ✅
- **Shape update latency:** 200-300ms (Firestore) ✅
- **Deletion latency:** 200-300ms, but fails to propagate to creator ❌

### With Proposed Fixes

**Option C (Remove problematic logic):**
- Deletion latency: 200-300ms, propagates correctly ✅
- Optimistic updates still work via RTDB dragging state ✅
- No performance degradation
- Simpler code, easier to maintain

**Potential flicker:**
- During drag, very brief flicker possible if Firestore update arrives while dragging
- Mitigated by 300ms delay before clearing RTDB dragging state (line 521-523)

---

## Conclusion

### Critical Blocker

**Bug #1** (Deletion Propagation Failure) is a **critical blocker** for production deployment. It breaks the fundamental contract of collaborative editing: all users must see the same canvas state.

**Recommended Fix:** Option C (Remove `shape.updatedBy === user.uid` logic)
- Simplest solution
- Most reliable (Firestore as single source of truth)
- Existing RTDB dragging state already handles real-time updates
- Acceptable trade-off (minor flicker vs. correctness)

### Priority Order

1. **🔴 CRITICAL:** Fix Bug #1 (deletion propagation)
2. **🟠 HIGH:** Add error handling for Bug #7 (delete failures)
3. **🟡 MEDIUM:** Implement text editing locks (Bug #6)
4. **🟢 LOW:** Optimize AI creation (Bug #4) - UX improvement, not correctness issue
5. **🟢 LOW:** Fix z-index persistence (Bug #8) - nice-to-have

### Rubric Impact

**Current State (with bugs):**
- Conflict Resolution: **Poor (0-3 points)** - Different users see different states
- Total potential loss: 6-9 points

**After Fixes:**
- Conflict Resolution: **Good-Excellent (6-9 points)** - Consistent state, proper conflict handling
- Total potential gain: 6-9 points

**Net Effect:** Fixing these bugs is worth **~8 points** on the rubric, potentially moving from B/C grade to A grade.

