# Collaboration UX Improvements Epic

**Status**: Planning  
**Goal**: Enhance multi-user collaboration experience with better selection, layer management, and visual awareness

---

## Epic Overview

This epic addresses three core UX gaps identified in the concurrent editing research:
1. **Single-object limitation** - Can only select/manipulate one shape at a time
2. **Z-index non-persistence** - Layer order doesn't sync across users
3. **Weak conflict awareness** - Limited visual feedback when others are editing

**Success Criteria**:
- Users can select and manipulate multiple shapes simultaneously
- Layer order persists and syncs across all users
- Clear visual indicators prevent accidental editing conflicts

---

## Feature 1: Multi-Select Foundation

**Description**: Enable selecting multiple shapes and treating them as a group for operations.

**Capabilities**:
- Drag selection box (marquee select) to select multiple shapes
- Click + hold Shift/Cmd to add/remove shapes from selection
- Click empty canvas to deselect all
- Visual: All selected shapes show blue outline (local selection)

**State Changes**:
- Replace `selectedId: string` with `selectedIds: string[]`
- Update all selection-dependent operations (drag, delete, color change)
- Broadcast selection state to RTDB (array instead of single ID)

**Out of Scope** (for this feature):
- Group transformations (resize/rotate multiple shapes together)
- Copy/paste (separate feature)

**Why First**: Foundation for all other multi-shape operations. Must be solid before adding group transformations.

---

## Feature 2: Group Transformations

**Description**: Apply drag, resize, and basic operations to multiple selected shapes simultaneously.

**Capabilities**:
- **Drag**: Move all selected shapes together (maintain relative positions)
- **Delete**: Delete all selected shapes
- **Color change**: Apply color to all selected shapes
- **Bounds**: Show bounding box around entire selection (not individual transformer handles)

**Technical Approach**:
- Calculate selection bounding box from all selected shape bounds
- On drag: Apply same delta (dx, dy) to all shapes
- On delete: Batch delete operation
- Broadcast group transform state to RTDB for live preview

**Conflicts to Consider**:
- What happens if User A selects shapes [1, 2, 3] and User B selects shapes [2, 4]?
- Overlapping selections should show both users' outlines (enhanced visual awareness)

**Why Second**: Natural next step after multi-select. Users expect to manipulate their selection.

---

## Feature 3: Copy & Paste

**Description**: Duplicate selected shapes with standard keyboard shortcuts.

**Capabilities**:
- **Copy** (Cmd+C): Copy selected shapes to clipboard (browser clipboard API or internal state)
- **Paste** (Cmd+V): Create duplicates offset from originals (+50px x/y)
- **Cut** (Cmd+X): Copy + delete selected shapes
- Paste creates new shapes with unique IDs
- All users see pasted shapes (standard Firestore sync)

**Technical Approach**:
- Store selected shapes data in memory (or clipboard if supported)
- On paste: Generate new IDs, offset positions, call `createMultipleShapes`
- Use AI service's batch creation pattern for performance

**Why Third**: Relies on multi-select being stable. Common workflow need.

---

## Feature 4: Z-Index Persistence

**Description**: Make layer order (z-index) persistent across all users.

**Capabilities**:
- Bring to front / Send to back syncs to all users
- New shapes created at top layer (highest z-index)
- Z-order maintained across page refreshes
- Compatible with multi-select (apply z-index change to all selected shapes)

**Data Model Changes**:
- Add `zIndex: number` field to shape schema in Firestore
- On shape creation: Set `zIndex = maxZIndex + 1`
- On "bring to front": Set `zIndex = maxZIndex + 1`
- On "send to back": Set `zIndex = 0`, optionally increment others
- Sort shapes by `zIndex` before rendering

**Conflict Handling**:
- If two users simultaneously "bring to front" different shapes, both get incremented z-index
- Higher timestamp wins for same z-index (rare edge case)
- No data loss, just potential unexpected ordering (acceptable)

**Why Fourth**: Standalone feature that enhances multi-select (apply to groups). Low complexity, high value.

---

## Feature 5: Layer Panel

**Description**: Visual layer management panel showing shape hierarchy.

**Capabilities**:
- Side panel listing all shapes in z-order (top to bottom)
- Show shape type icon + first few chars of text (or "Rectangle", "Ellipse")
- Click layer to select shape (even if off-screen)
- Drag layers to reorder (updates z-index)
- Multi-select in layer panel (click + Shift/Cmd)
- Lock/unlock layers (prevents editing, separate state)
- Hide/show layers (visibility toggle, separate state)

**UI Placement**:
- Right side panel (collapsible)
- Similar to Figma/Photoshop layer panels
- Shows online users' selections with colored indicators

**Data Model Changes**:
- Add optional `locked: boolean` field (default false)
- Add optional `visible: boolean` field (default true)
- Locked shapes: Can't select, drag, or delete (enforce client-side and show lock icon)
- Hidden shapes: Don't render, don't show in cursors/selections

**Why Fifth**: Builds on z-index persistence. Natural UI for managing complex canvases with many shapes.

---

## Feature 6: Enhanced Visual Awareness

**Description**: Stronger visual feedback for remote user activity to prevent conflicts.

**Capabilities**:
- **Multiple selection outlines**: Show all users' selections (not just first), each in their user color
- **Active editing indicator**: Thicker/pulsing outline when user is actively dragging/transforming
- **User avatars on selection**: Small avatar bubble next to selected shape with user initial/photo
- **Hover preview**: When remote user hovers over shape (not selected), show faint outline
- **Edit intent broadcast**: When user clicks shape, immediately broadcast "intent to edit"

**Visual Design**:
- Stacked outlines (3px each, offset by 2px) for multiple remote selections
- Active transform: 4px orange outline + subtle pulse animation
- Avatar: 24px circle with user initial, positioned at top-left of selection bounds
- Hover: 1px dotted outline in user color (low opacity)

**RTDB Structure Changes**:
```
sessions/{canvasId}/
  ├── hovers/{userId} → { shapeId, userName, color }  // NEW
  └── editIntent/{userId} → { shapeId, timestamp }    // NEW
```

**Why Last**: Polish feature that builds on all previous work. Requires stable multi-select and transform system.

---

## Implementation Order Rationale

```
Multi-Select Foundation (Feature 1)
         ↓
Group Transformations (Feature 2) ← Depends on multi-select
         ↓
Copy & Paste (Feature 3) ← Depends on group transformations
         ↓
Z-Index Persistence (Feature 4) ← Independent, can work on shapes or groups
         ↓
Layer Panel (Feature 5) ← Depends on z-index, enhances multi-select
         ↓
Enhanced Visual Awareness (Feature 6) ← Polish on top of all features
```

**Critical Path**: Features 1 & 2 are foundational. Features 4 & 5 are independent but synergistic. Features 3 & 6 are enhancements.

---

## Cross-Cutting Concerns

### Conflict Scenarios to Test
For each feature, verify behavior when:
- Two users select overlapping shape sets
- User A drags group while User B drags individual shape in that group
- User A brings shape to front while User B is dragging it
- User deletes shape while another user has it selected

### Performance Considerations
- Multi-select: Viewport culling still works (filter visible shapes before checking selection)
- Group drag: RTDB should broadcast all shape positions (array) not individual updates
- Layer panel: Debounce rendering updates (only refresh when shapes change, not on every cursor move)

### Backward Compatibility
- Old clients without multi-select will see shapes move normally (single-select still works)
- Z-index field: Old clients will ignore it (render in array order)
- New RTDB paths: Optional, old clients won't subscribe

---

## Out of Scope (Future Work)

The following are explicitly **not** part of this epic:
- Grouping (permanent shape groups that move together)
- Alignment tools (align left, distribute evenly, etc.)
- Snapping (snap to grid, snap to other shapes)
- Advanced layer features (nested groups, folders)
- Operational transformation or CRDT (still last-write-wins)
- Conflict detection/warnings (soft locking via visual awareness only)

---

## Success Metrics

After completing this epic:
- ✅ Users can select and manipulate multiple shapes efficiently
- ✅ Layer order is consistent across all users
- ✅ Visual awareness reduces accidental conflicts by >80% (qualitative)
- ✅ No performance regression (still 60fps with 500+ shapes)
- ✅ Backward compatible with existing data

---

## Next Steps

For each feature, create an implementation plan with:
1. Data model changes (Firestore schema, RTDB paths)
2. Component changes (Canvas.jsx, new components)
3. Service layer updates (canvasService, rtdbService)
4. UI mockups (for Layer Panel and visual awareness)
5. Test scenarios (especially conflict cases)

**Start with Feature 1** (Multi-Select Foundation) as it unblocks all subsequent features.

