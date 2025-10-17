# AI Agent Testing Guide

## 🚀 Quick Test Commands

Copy and paste these commands into the AI assistant to test the performance optimizations.

---

### ⚡ Performance Test #1: 5x5 Grid (25 shapes)
**What it tests**: Parallel execution + batch operations

```
Create a 5x5 grid of blue squares, each 100px wide, spaced 120 pixels apart, starting at position 500, 500
```

**Expected**: All 25 squares appear almost instantly (< 500ms)
**Before optimization**: Would take 2.5-7 seconds

---

### ⚡ Performance Test #2: Login Form
**What it tests**: createMultipleShapes for UI components

```
Create a login form with a title "Login", username field, password field, and a submit button
```

**Expected**: All elements appear together quickly
**Look for**: Console should show batch operation

---

### ⚡ Performance Test #3: 10x10 Grid (100 shapes) - STRESS TEST
**What it tests**: Large batch handling

```
Create a 10x10 grid of alternating red and blue circles, each 80px diameter, 20px apart, starting at 300, 300
```

**Expected**: 100 shapes created in under 1 second
**Before optimization**: Would take 10-20 seconds

---

### ⚡ Performance Test #4: Navigation Bar
**What it tests**: Prompt improvements for multiple elements

```
Create a horizontal navigation bar with 6 menu items: Home, About, Services, Portfolio, Blog, Contact
```

**Expected**: AI uses createMultipleShapes (check console)
**Look for**: Single batch operation, not 6 individual creates

---

### 🎯 Smart Filtering Test #1: Create Without Context
**What it tests**: Canvas state optimization (not sending unnecessary data)

```
Create 3 large yellow rectangles in a horizontal row at the center of the canvas
```

**Expected Console Log**: `[AI] Command does not need canvas state - optimizing payload`
**Benefit**: Faster execution, lower cost

---

### 🎯 Smart Filtering Test #2: Update With Context
**Prerequisites**: First create some shapes with different colors

```
Move the blue rectangle 300 pixels to the right
```

**Expected Console Log**: `[AI] Sending N shapes as context`
**Benefit**: Only essential shape data sent (optimized)

---

### 🎯 Parallel Operations Test
**Prerequisites**: Create 5-10 shapes first

```
Delete all the red shapes and move all the blue shapes down 200 pixels
```

**Expected**: All operations execute simultaneously
**Before optimization**: Would execute one at a time

---

### 🎨 Complex Layout Test
**What it tests**: Overall capability and batch operations

```
Create a dashboard mockup with a header bar, sidebar with 5 menu items, and 4 content cards arranged in a 2x2 grid
```

**Expected**: All elements created in a single operation
**Look for**: createMultipleShapes in console logs

---

## 🔍 What to Look For

### Console Logs (Open DevTools - F12 or Cmd+Option+I)

#### Good Signs ✅
```
[AI] Command does not need canvas state - optimizing payload
[AI] Executing N tool calls in parallel
[AI] Completed N tool calls
```

#### What to Verify
- **Speed**: Shapes should appear almost instantly for multi-shape operations
- **Batching**: Console should show batch operations, not individual creates
- **Optimization**: Commands that create new shapes shouldn't send canvas state

### In the AI Chat

#### Good Responses ✅
```
✓ Created 25 shapes successfully!
✓ Completed 10 operations successfully!
```

#### What This Means
- Large operations show summarized feedback
- Quick, clear confirmation of success

---

## 📊 Performance Benchmarks

### Expected Timings
| Command Type | Shape Count | Expected Time | Old Time |
|--------------|-------------|---------------|----------|
| Simple grid | 25 (5x5) | < 500ms | 2.5-7s |
| Large grid | 100 (10x10) | < 1s | 10-20s |
| Form/UI | 5-15 | < 300ms | 1-3s |
| Single shape | 1 | < 200ms | 0.2-0.3s |

### How to Measure
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `console.time('test')` before sending command
4. After shapes appear, type: `console.timeEnd('test')`
5. You'll see the elapsed time

---

## 🎯 Expected AI Behavior

### For Grid/Pattern Commands
✅ **Should use**: `createMultipleShapes` with all shapes in one array
❌ **Should NOT use**: Multiple individual `createShape` calls

### For Form/UI Commands  
✅ **Should use**: `createMultipleShapes` for all elements
❌ **Should NOT use**: Creating elements one by one

### For Single Shape Commands
✅ **Should use**: `createShape` (individual is fine here)

### For Update/Delete Commands
✅ **Should**: Execute all operations in parallel
❌ **Should NOT**: Wait for each operation to complete before starting next

---

## 🐛 Troubleshooting

### If shapes aren't created quickly:

1. **Check Console**: Are you seeing parallel execution logs?
2. **Check Network Tab**: Is the API call taking a long time?
3. **Check AI Response**: Did it use `createMultipleShapes` or individual creates?
4. **Try Rephrasing**: Sometimes AI interprets commands differently

### If AI uses individual creates instead of batch:

This might happen occasionally. The prompt has been optimized to prefer batch operations, but the AI might still choose individual creates in some cases. If this happens:

1. **Rephrase the command** to be more explicit about creating "multiple" shapes
2. **Use keywords** like "grid", "form", "layout", "navigation" that trigger batch mode
3. **File a note** so the prompt can be further refined

---

## 💡 Creative Test Ideas

Try these to explore the capabilities:

### Architecture Diagrams
```
Create a simple architecture diagram with 3 boxes connected by arrows
```

### UI Mockups
```
Create a mobile app mockup with a top navigation bar, 3 feature cards, and a bottom action button
```

### Data Visualizations
```
Create a bar chart with 5 bars of different heights representing: 10, 25, 15, 30, 20
```

### Game Boards
```
Create a tic-tac-toe board using rectangles and text
```

---

## 📝 Notes for Testing

- **Refresh the page** between major test sessions to clear state
- **Check the console** for optimization logs
- **Time critical operations** using console.time/timeEnd
- **Report any slow operations** that don't match expected benchmarks
- **Test with different canvas sizes** (empty vs 50+ existing shapes)

---

## ✅ Success Criteria

Your AI agent is performing optimally if:

1. ✅ Multi-shape commands complete in < 500ms
2. ✅ Console shows "parallel execution" for multi-operation commands  
3. ✅ Create commands don't unnecessarily send canvas state
4. ✅ Grid commands use `createMultipleShapes`
5. ✅ UI feedback is clear and immediate

---

Happy testing! 🎉

