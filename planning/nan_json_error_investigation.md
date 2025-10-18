# "Data Cannot Be Encoded in JSON: NaN" Error Investigation

**Date:** October 18, 2025  
**Environment:** Production only (not reproducible in local testing)  
**Error Message:** `"data cannot be encoded in JSON: NaN"`  
**Occurs When:** Sending AI commands via AIModal

---

## Root Cause Analysis

### Primary Issue: `optimizeCanvasState` Function

**Location:** `src/services/aiService.js`, lines 404-416

**Problematic Code:**
```javascript
const optimizeCanvasState = (shapes) => {
  if (!shapes || shapes.length === 0) return [];
  
  return shapes.map(shape => ({
    id: shape.id,
    type: shape.type,
    x: Math.round(shape.x),        // ⚠️ If shape.x is undefined → NaN
    y: Math.round(shape.y),        // ⚠️ If shape.y is undefined → NaN
    fill: shape.fill,
    ...(shape.type === 'text' && shape.text && { text: shape.text.substring(0, 50) })
  }));
};
```

**The Problem:**
- `Math.round(undefined)` returns `NaN`
- `JSON.stringify()` cannot encode `NaN` values
- This throws an error when sending data to Firebase Cloud Functions

**When It's Called:**
1. User types AI command in AIModal
2. `sendCommand()` calls `optimizeCanvasState(currentShapes)` (line 430)
3. Optimized shapes sent to Cloud Function via `callAIFunction()` (line 440-445)
4. If any shape has `undefined` x or y → error thrown

---

## Why Production Only?

### Hypothesis 1: Data Corruption in Firestore (Most Likely)

**Scenario:**
- Old shapes in production Firestore DB might be missing x/y properties
- Created before schema was fully defined
- Or corrupted during early development/testing

**Evidence:**
- Local development uses empty/fresh Firestore emulator
- Production has accumulated shapes over time
- No validation on Firestore writes to ensure x/y exist

**Check:**
```javascript
// Query Firestore directly in production console
db.collection('canvases')
  .doc('main-canvas')
  .collection('objects')
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.x === undefined || data.y === undefined) {
        console.log('Invalid shape:', doc.id, data);
      }
    });
  });
```

### Hypothesis 2: Race Condition with Optimistic Updates

**Scenario:**
- AI creates shapes optimistically (Bug #4 fix, line 1027)
- Shapes added to local state before all properties set
- User quickly opens AI modal before Firestore confirms
- `currentShapes` includes incomplete shapes

**Code Path:**
```javascript
// Canvas.jsx line 1027
onShapesCreated={(newShapes) => {
  setShapes([...shapes, ...newShapes]);  // Optimistic update
}}
```

**Potential Issue:**
If `newShapes` from AI service has shapes without x/y (due to OpenAI returning bad data):
```javascript
// aiService.js createShape (line 254-255)
x: args.x,  // If OpenAI doesn't provide x → undefined
y: args.y,  // If OpenAI doesn't provide y → undefined
```

### Hypothesis 3: OpenAI Function Calling Returns Invalid Arguments

**Scenario:**
- OpenAI GPT model occasionally returns malformed function arguments
- Despite schema requiring x/y as numbers, AI might return:
  - Missing values
  - String values that can't be converted
  - `null` or `undefined`

**Example of Bad AI Response:**
```json
{
  "tool_calls": [{
    "function": {
      "name": "createShape",
      "arguments": {
        "type": "rectangle",
        "x": null,          // ❌ Not a valid number
        "y": "center",      // ❌ String instead of number
        "width": 100,
        "height": 100,
        "fill": "#FF0000"
      }
    }
  }]
}
```

**Why Production Only:**
- Different model behavior under load
- Different prompts/commands in production
- Network issues causing partial JSON parsing

### Hypothesis 4: Konva Node Transform Returns NaN

**Scenario:**
- During drag/transform, Konva node.x() or node.y() could return NaN
- If node is detached or in invalid state
- Shape's position gets set to NaN in local state

**Locations:**
```javascript
// Canvas.jsx line 510-511 (drag end)
const newX = node.x();  // Could be NaN?
const newY = node.y();  // Could be NaN?

// Canvas.jsx line 562 (transform)
x: node.x(),  // Could be NaN?
y: node.y(),  // Could be NaN?
```

**Why Production Only:**
- More complex multi-user interactions
- Network lag causing transform state issues
- Konva version differences (if deps not locked)

---

## Evidence in Code

### 1. No Validation on Shape Creation

AI service creates shapes without validating numeric values:

```javascript
// aiService.js line 254-255
const shapeData = {
  id: shapeId,
  type: args.type,
  x: args.x,              // ⚠️ No validation
  y: args.y,              // ⚠️ No validation
  width: args.width,      // ⚠️ No validation
  height: args.height,    // ⚠️ No validation
  fill: args.fill,
  rotation: args.rotation || 0,
  // ...
};
```

### 2. Canvas Has Defensive Code for Missing Width/Height

Canvas.jsx handles missing width/height (line 97-98):
```javascript
const shapeWidth = shape.width || 200;
const shapeHeight = shape.height || 50;
```

But does NOT handle missing x/y, suggesting shapes CAN have undefined properties.

### 3. Inconsistency Between createShape and createMultipleShapes

```javascript
// createShape (line 251-265) - MISSING updatedBy/updatedAt
const shapeData = {
  id: shapeId,
  type: args.type,
  x: args.x,
  // ...
};

// createMultipleShapes (line 328-344) - HAS updatedBy/updatedAt
const shapeData = {
  id: shapeId,
  type: shape.type,
  x: shape.x,
  updatedBy: userId,       // ✅ Present
  updatedAt: Date.now(),   // ✅ Present
  // ...
};
```

This inconsistency could cause issues with Bug #1 fix (which relies on timestamps).

---

## Data Flow Analysis

### Normal Flow (Working):
```
User: "Create a rectangle at 100, 200"
  ↓
AIModal.handleSubmit()
  ↓
sendCommand(message, userId, currentShapes)
  ↓
optimizeCanvasState(currentShapes) → [{ id, type, x: 100, y: 200, fill }]
  ↓
callAIFunction({ canvasState: optimizedShapes })
  ↓
OpenAI returns: createShape(x: 500, y: 500, ...)
  ↓
executeTool() creates shape with x: 500, y: 500
  ↓
onShapesCreated([{ id, x: 500, y: 500, ... }])
  ↓
setShapes([...shapes, newShape])
  ↓
Success ✅
```

### Failure Flow (Production):
```
User: [Previous session created corrupted shapes]
  ↓
Firestore loads: [{ id: 'shape1', x: undefined, ... }]
  ↓
setShapes() includes shape with undefined x
  ↓
User: "Create a rectangle"
  ↓
sendCommand(message, userId, currentShapes)
  ↓
optimizeCanvasState(currentShapes)
  ↓
shapes.map(shape => ({ x: Math.round(undefined) }))  // NaN!
  ↓
JSON.stringify({ canvasState: [{ x: NaN }] })
  ↓
Error: "data cannot be encoded in JSON: NaN" ❌
```

---

## Additional Clues

### Error Occurs "Often" But Not Always

This suggests:
- **Not** caused by code that runs every time (like AI service initialization)
- **Likely** caused by specific data conditions (corrupted shapes in canvas)
- **Or** intermittent AI behavior (OpenAI returns bad data sometimes)

### Production vs Local Differences

| Aspect | Local | Production |
|--------|-------|------------|
| Database | Fresh emulator | Accumulated data over time |
| AI Model | Same API endpoint | Same API endpoint |
| Network | Fast, stable | Variable latency |
| Shape Count | 0-50 shapes | Potentially 100+ shapes |
| Multi-User | Single user testing | Real multi-user interactions |
| Session Duration | Minutes | Hours (long-running sessions) |

---

## Recommended Debugging Steps

### Step 1: Add Defensive Validation (Quick Fix)

**File:** `src/services/aiService.js`

```javascript
const optimizeCanvasState = (shapes) => {
  if (!shapes || shapes.length === 0) return [];
  
  return shapes
    .filter(shape => {
      // Validate shape has required numeric properties
      const isValid = 
        typeof shape.x === 'number' && !isNaN(shape.x) &&
        typeof shape.y === 'number' && !isNaN(shape.y);
      
      if (!isValid) {
        console.error('[AI] Invalid shape detected, excluding from canvas state:', {
          id: shape.id,
          x: shape.x,
          y: shape.y,
          type: shape.type
        });
      }
      
      return isValid;
    })
    .map(shape => ({
      id: shape.id,
      type: shape.type,
      x: Math.round(shape.x),
      y: Math.round(shape.y),
      fill: shape.fill,
      ...(shape.type === 'text' && shape.text && { text: shape.text.substring(0, 50) })
    }));
};
```

**Benefits:**
- Prevents error immediately
- Logs corrupted shapes for investigation
- Gracefully handles bad data

### Step 2: Add Shape Validation on Creation

**File:** `src/services/aiService.js`

```javascript
case 'createShape': {
  const shapeId = generateShapeId();
  
  // Validate numeric arguments
  const x = typeof args.x === 'number' ? args.x : 2500;
  const y = typeof args.y === 'number' ? args.y : 2500;
  const width = typeof args.width === 'number' ? args.width : 150;
  const height = typeof args.height === 'number' ? args.height : 100;
  
  if (args.x === undefined || args.y === undefined) {
    console.warn('[AI] OpenAI returned undefined x/y, using defaults:', args);
  }
  
  const shapeData = {
    id: shapeId,
    type: args.type,
    x,
    y,
    width,
    height,
    fill: args.fill || '#4A90E2',
    rotation: args.rotation || 0,
    updatedBy: userId,        // Add for consistency
    updatedAt: Date.now(),    // Add for consistency
    // ...
  };
  
  await createShape(userId, shapeData);
  return {
    success: true,
    message: `Created ${args.type} at (${x}, ${y})`,
    data: shapeData
  };
}
```

### Step 3: Query Production Firestore for Corrupted Data

Run this in Firebase Console or admin script:

```javascript
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function findCorruptedShapes() {
  const snapshot = await db
    .collection('canvases')
    .doc('main-canvas')
    .collection('objects')
    .get();
  
  const corrupted = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (
      data.x === undefined || data.x === null || isNaN(data.x) ||
      data.y === undefined || data.y === null || isNaN(data.y)
    ) {
      corrupted.push({ id: doc.id, ...data });
    }
  });
  
  console.log(`Found ${corrupted.length} corrupted shapes:`, corrupted);
  return corrupted;
}

findCorruptedShapes();
```

### Step 4: Add Client-Side Validation on Firestore Load

**File:** `src/components/Canvas/Canvas.jsx`

```javascript
// Line 159 - subscribeToShapes
const unsubscribe = subscribeToShapes((remoteShapes) => {
  // Validate shapes before adding to state
  const validShapes = remoteShapes.filter(shape => {
    const isValid = 
      typeof shape.x === 'number' && !isNaN(shape.x) &&
      typeof shape.y === 'number' && !isNaN(shape.y);
    
    if (!isValid) {
      console.error('[Canvas] Invalid shape from Firestore, skipping:', shape);
    }
    
    return isValid;
  });
  
  setShapes((currentShapes) => {
    // ... existing merge logic with validShapes
  });
});
```

### Step 5: Monitor OpenAI Responses

Add logging to capture OpenAI's raw responses:

```javascript
// aiService.js - in sendCommand()
const result = await callAIFunction({
  message,
  canvasState: optimizedCanvasState,
  systemPrompt: SYSTEM_PROMPT,
  tools: TOOL_DEFINITIONS
});

// Log for debugging
if (result.data.message.tool_calls) {
  result.data.message.tool_calls.forEach(tc => {
    const args = JSON.parse(tc.function.arguments);
    if (args.x === undefined || args.y === undefined || isNaN(args.x) || isNaN(args.y)) {
      console.error('[AI] OpenAI returned invalid coordinates:', {
        function: tc.function.name,
        arguments: args
      });
    }
  });
}
```

---

## Priority of Fixes

### 🔴 CRITICAL (Do Immediately):
1. **Add validation to `optimizeCanvasState`** (Step 1)
   - Prevents error from happening
   - Logs corrupted shapes for investigation

### 🟠 HIGH (Do Soon):
2. **Add shape validation on AI creation** (Step 2)
   - Prevents creating invalid shapes
   - Adds missing updatedBy/updatedAt to createShape

3. **Query production Firestore** (Step 3)
   - Identify if data corruption exists
   - Clean up corrupted shapes if found

### 🟡 MEDIUM (Follow-up):
4. **Add client-side validation on Firestore load** (Step 4)
   - Defense in depth
   - Prevents corrupted data from entering state

5. **Monitor OpenAI responses** (Step 5)
   - Identify if AI is source of bad data
   - Could add retry logic if AI returns invalid args

---

## Expected Outcome

**After Step 1 (Validation in optimizeCanvasState):**
- ✅ Error stops occurring
- ✅ Console logs identify which shapes are invalid
- ✅ AI commands work (invalid shapes excluded from context)

**After Step 2 (Shape creation validation):**
- ✅ No new invalid shapes created
- ✅ Consistency between createShape and createMultipleShapes

**After Step 3 (Clean production data):**
- ✅ Historical corrupted shapes removed
- ✅ No more error logs

---

## Long-Term Improvements

### 1. TypeScript Migration
Add compile-time type safety:
```typescript
interface Shape {
  id: string;
  type: 'rectangle' | 'ellipse' | 'text';
  x: number;      // Guaranteed to be number
  y: number;      // Guaranteed to be number
  width: number;
  height: number;
  fill: string;
  rotation: number;
  // ...
}
```

### 2. Firestore Schema Validation
Use Firebase Security Rules or Cloud Functions triggers:
```javascript
// Cloud Functions - validate before write
exports.validateShape = functions.firestore
  .document('canvases/{canvasId}/objects/{shapeId}')
  .onWrite((change, context) => {
    const newData = change.after.data();
    if (typeof newData.x !== 'number' || isNaN(newData.x)) {
      throw new Error('Invalid x coordinate');
    }
    // ...
  });
```

### 3. Runtime Validation Library
Use something like `zod` or `yup`:
```javascript
import { z } from 'zod';

const ShapeSchema = z.object({
  id: z.string(),
  type: z.enum(['rectangle', 'ellipse', 'text']),
  x: z.number().finite(),  // Rejects NaN, Infinity
  y: z.number().finite(),
  // ...
});

// Validate before using
const validatedShape = ShapeSchema.parse(shape);
```

---

## Summary

**Root Cause:** `Math.round(undefined)` returns `NaN`, which cannot be JSON encoded.

**Why Production Only:** Likely corrupted shapes in Firestore from early development, or intermittent bad data from OpenAI.

**Immediate Fix:** Add validation to `optimizeCanvasState` to filter out invalid shapes.

**Follow-up:** Validate on shape creation, clean production data, add client-side validation.

**Prevention:** TypeScript, schema validation, runtime validation library.

