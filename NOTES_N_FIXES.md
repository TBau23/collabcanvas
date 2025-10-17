-- agent is not using the colors I have defined, broadly we should just be using a more universal color palette
-- agent chat should not block the main canvas, it should be a modal that can be closed and opened again
-- canvas should open to the center of the canvas, not the top left
-- shape updating is now working to some extent, but if I say something like "move the blue circle down 1000 pixels, it will also move other blue shapes (even squares) down 1000 pixels
-- the return message from the agent probably shouldnt say the ID!
-- clean up console.logs
-- how much benefit is there to using firestore real time db - the existing one is pretty snappy but not sure.
- noticing some strange behavior with transforms - if i drag across the y axis, it resizes strangely

---

## Phase 1: Hybrid Database Migration ✅ COMPLETE (2024-10-17)

**Goal:** Migrate cursors and presence from Firestore to Realtime Database for <50ms sync

**Changes:**
- Added Firebase Realtime Database to project
- Created `rtdbService.js` with cursor and presence operations
- Migrated cursor tracking to RTDB (50ms throttle, down from 100ms)
- Migrated presence to RTDB with `onDisconnect()` automatic cleanup
- Eliminated presence heartbeat interval (was 2s, now 0 - saves 0.5 writes/sec/user)
- Added connection state indicator component in header
- Fixed cursor coordinate tracking to use canvas-space instead of viewport-space
- Removed obsolete `cursorService.js` and `presenceService.js`

**Security Rules:**
- RTDB rules in `database.rules.json`
- Users can read all cursors/presence, but only write their own

**Key Fix:** Initial permission errors resolved by moving `.read` permission from `$userId` level to collection level

**Performance:** Cursor sync latency improved from 100-150ms (Firestore) to estimated 30-50ms (RTDB)
