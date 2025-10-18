# Presence Disconnect Bug - Resolution

## Problem
In production, user presence and cursor data persisted in Firebase Realtime Database even after users disconnected. The presence panel showed "ghost" users who were no longer online. This only occurred in production, not in local development.

## Root Cause
Two separate issues were causing the problem:

### Issue 1: Permission Denied on `onDisconnect` Handlers
The `onDisconnect` handlers were attempting to SET presence data to `online: false`, but Firebase RTDB security rules rejected these writes:
```
PERMISSION_DENIED at /sessions/main-canvas/presence/{userId}
```

Security rules required `auth.uid === $userId`, but when disconnect handlers execute server-side, there's no auth context, causing permission failures.

### Issue 2: Logout Flow Invalidated Auth Before Cleanup
When users clicked "Logout", the sequence was:
1. `signOut(auth)` called → Auth token invalidated immediately
2. Canvas component unmounts → Attempts cleanup
3. RTDB security rules reject cleanup writes (no valid auth token)
4. Presence/cursor/selection data left orphaned

## What Didn't Work

### Attempt 1: Connection State Race Condition Fix
**Theory**: `onDisconnect()` handlers weren't registering because they were called before RTDB connection was established (timing issue between localhost emulators vs production).

**Implementation**: 
- Added connection state monitoring
- Created `waitForConnection()` helper
- Made all setup functions wait for connection before registering handlers
- Added reconnection handling

**Result**: ❌ Didn't fix the issue. The real problem was permissions, not timing. The logs revealed `permission_denied` errors, not connection issues.

## What Actually Worked

### Fix 1: Use `.remove()` Instead of `.set()` for Disconnect
**Changed**: `onDisconnect().set({ online: false })` → `onDisconnect().remove()`

**Files Modified**:
- `src/services/rtdbService.js`:
  - `setUserOnlineRTDB()`: Changed disconnect handler from `.set()` to `.remove()`
  - `setUserOfflineRTDB()`: Changed from setting `online: false` to removing entry entirely
  - `subscribeToPresenceRTDB()`: Updated to treat any existing entry as "online" (since offline users are removed)

**Why it works**: Firebase's recommended presence pattern. If user is online, entry exists. If offline, entry removed. No permission issues since `.remove()` works with standard security rules.

### Fix 2: Clean Up BEFORE Logout
**Changed**: Moved RTDB cleanup to happen BEFORE `signOut()` is called.

**Files Modified**:
- `src/services/authService.js`:
  - Modified `logout()` function to call cleanup functions BEFORE signing out
  - Added: `Promise.all([setUserOfflineRTDB(), deleteCursorRTDB(), clearSelection()])` before `signOut()`
  - Ensures auth token is still valid when cleanup executes

- `src/components/Canvas/Canvas.jsx`:
  - Removed manual cleanup from unmount effect (would fail without auth)
  - Removed unreliable `beforeunload` cleanup
  - Added explanatory comments

**Why it works**: Auth token remains valid during cleanup, so RTDB security rules allow the writes.

## Final Cleanup Strategy

### 1. Explicit Logout (clicking logout button)
→ `authService.logout()` performs cleanup BEFORE signing out
→ Auth token valid, security rules pass ✅

### 2. Tab Close/Browser Crash  
→ `onDisconnect()` handlers fire automatically
→ Server-side mechanism, no client auth required ✅

## Additional Changes

### Diagnostic Logging
Added comprehensive logging throughout (`[RTDB-DIAG]`, `[CANVAS-DIAG]`, `[AUTH-DIAG]` tags) to aid future debugging. These logs can be removed once stability is confirmed.

### Database Rules
No changes required. Original rules work correctly with the `.remove()` pattern:
```json
"presence": {
  ".read": "auth != null",
  "$userId": {
    ".write": "auth != null && auth.uid === $userId"
  }
}
```

## Lessons Learned
1. **Trust the error messages**: The `permission_denied` error was the real clue, not a timing issue
2. **Follow Firebase patterns**: Firebase docs recommend `.remove()` for presence, not `.set({ online: false })`
3. **Order matters in logout**: Always clean up state BEFORE invalidating credentials
4. **Emulators hide issues**: Local emulators have different timing/security behavior than production

