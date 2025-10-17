# AI Agent Performance Analysis & Optimization Plan

## Current Architecture

### Flow
1. **User Input** → AIModal.jsx
2. **Client-side** → aiService.js sends command to Firebase Cloud Function
3. **Backend** → functions/index.js calls OpenAI API (GPT-4o-mini)
4. **Response** → Tool calls returned to client
5. **Execution** → Client executes tools sequentially, writing to Firestore

### Components
- **Model**: GPT-4o-mini (fast, cost-effective)
- **Database**: Firestore for persistent shapes
- **Tools**: createShape, updateShape, deleteShape, getCanvasState, createMultipleShapes

---

## Performance Issues Identified

### 🔴 CRITICAL: Sequential Tool Execution
**Location**: `aiService.js:380`
```javascript
for (const toolCall of aiMessage.tool_calls) {
  const result = await executeTool(toolCall, userId, currentShapes);
  // Sequential execution - major bottleneck!
}
```

**Impact**: 
- For a 5x5 grid (25 shapes), if AI makes 25 individual `createShape` calls: **25 sequential operations**
- Each Firestore write takes ~100-300ms → **2.5-7.5 seconds total**
- Even if AI uses `createMultipleShapes`, other parallel operations (updates, deletes) still run sequentially

**Solution**: Parallelize independent tool calls with `Promise.all()`

---

### 🟡 HIGH: Canvas State Overhead
**Location**: `functions/index.js:75-80`
```javascript
if (canvasState && canvasState.length > 0) {
  messages.push({
    role: "system",
    content: `Current canvas state (${canvasState.length} shapes):\n` +
      JSON.stringify(canvasState, null, 2),
  });
}
```

**Impact**:
- Entire canvas state sent to Cloud Function
- Stringified as JSON in system message
- For 100+ shapes: **large token usage**, increased latency, higher costs
- Most operations don't need the full canvas state

**Solution**: Smart canvas state filtering - only send relevant shapes

---

### 🟡 MEDIUM: AI May Not Use Batch Operations
**Issue**: The AI has `createMultipleShapes` available but may choose to make multiple individual `createShape` calls instead

**Impact**: 
- Individual calls = individual Firestore writes (slower)
- `createMultipleShapes` uses batch writes (faster, atomic)

**Solution**: Improve prompt to emphasize batch operations for multi-shape commands

---

### 🟢 LOW: Token Usage in Prompts
**Issue**: System prompt could be more concise, canvas state format verbose

**Impact**: Slightly higher latency and costs

**Solution**: Optimize prompt structure and canvas state format

---

## Optimization Plan

### Phase 1: Parallelize Tool Execution (HIGHEST IMPACT) ⚡

**Goal**: Execute independent tool calls in parallel

**Changes to `aiService.js`**:
```javascript
// OLD (Sequential)
for (const toolCall of aiMessage.tool_calls) {
  const result = await executeTool(toolCall, userId, currentShapes);
  toolResults.push({ ... });
}

// NEW (Parallel)
const toolResults = await Promise.all(
  aiMessage.tool_calls.map(async (toolCall) => {
    const result = await executeTool(toolCall, userId, currentShapes);
    return {
      toolCall: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments),
      result
    };
  })
);
```

**Expected Improvement**: 
- 5x5 grid with 25 individual creates: **25x faster** (2.5s → ~100ms)
- Mixed operations (10 updates + 5 deletes): **15x faster**

---

### Phase 2: Smart Canvas State Filtering

**Goal**: Reduce data sent to Cloud Function

**Implementation Options**:

#### Option A: Only Send When Needed
```javascript
// Modify sendCommand() to detect if canvas state is needed
const needsCanvasState = message.toLowerCase().includes('move') || 
                         message.toLowerCase().includes('delete') ||
                         message.toLowerCase().includes('update') ||
                         message.toLowerCase().match(/\b(the|that|this)\b/);

const result = await callAIFunction({
  message,
  canvasState: needsCanvasState ? currentShapes : [],
  systemPrompt: SYSTEM_PROMPT,
  tools: TOOL_DEFINITIONS
});
```

#### Option B: Send Shape Summary
```javascript
// Send condensed version
const shapeSummary = currentShapes.map(s => ({
  id: s.id,
  type: s.type,
  x: Math.round(s.x),
  y: Math.round(s.y),
  fill: s.fill,
  // Omit width, height, rotation, etc.
}));
```

#### Option C: Smart Context Window
```javascript
// Only send shapes in user's viewport or recently modified
const recentShapes = currentShapes
  .filter(s => Date.now() - s.updatedAt < 60000) // Last minute
  .slice(0, 20); // Max 20 shapes
```

**Expected Improvement**: 
- 50-90% reduction in payload size
- Faster Cloud Function execution
- Lower token costs

---

### Phase 3: Improve AI Prompts for Batch Operations

**Goal**: Train AI to use `createMultipleShapes` for patterns/grids

**Enhanced System Prompt**:
```javascript
const SYSTEM_PROMPT = `You are an AI assistant that helps users create and manipulate shapes on a collaborative canvas.

Canvas Details:
- Canvas size: 5000x5000 pixels
- Available shapes: rectangle, ellipse, text
- Coordinate system: (0, 0) is top-left, (5000, 5000) is bottom-right
- Center of canvas is at (2500, 2500)
- Colors: Use hex codes (e.g., "#FF0000") or common color names that will be converted

Your capabilities:
1. Create shapes with specific positions, sizes, and colors using createShape
2. Update existing shapes (move, resize, recolor, rotate) using updateShape
3. Get current canvas state to reference existing shapes using getCanvasState
4. **Create multiple shapes for complex layouts using createMultipleShapes** ⭐
5. Delete shapes using deleteShape

**PERFORMANCE GUIDELINES** (CRITICAL):
- ⚡ For 3+ shapes in a SINGLE command, ALWAYS use createMultipleShapes (not individual createShape calls)
- ⚡ This applies to: grids, patterns, forms, layouts, repeated shapes
- ⚡ Examples requiring createMultipleShapes:
  * "Create a 5x5 grid of squares" → ONE createMultipleShapes call with 25 shapes
  * "Make a login form" → ONE createMultipleShapes call with all form elements
  * "Add 10 circles" → ONE createMultipleShapes call with 10 circles
- ⚡ Only use individual createShape for single, isolated shapes

Guidelines:
- Use reasonable default sizes if not specified: 150x100 for rectangles, 100x100 for ellipses, 200x50 for text
- For text shapes, always include the text content in the text parameter (e.g., text: "Welcome")
- Use font size 24-32 for normal text, 40-60 for headlines
- When arranging multiple shapes, space them appropriately (50-100px apart)
- For complex commands like "create a login form", use text shapes for labels with appropriate shapes
- Always call getCanvasState first if the command references existing shapes (e.g., "move the blue rectangle")
- When multiple shapes match a description (e.g., multiple blue rectangles), operate on the first one and mention this in your response
- For colors, convert common names to hex codes: red=#FF0000, blue=#0000FF, green=#00FF00, yellow=#FFFF00, orange=#FFA500, purple=#800080, pink=#FFC0CB, white=#FFFFFF, black=#000000, gray=#808080
- When creating UI components (forms, buttons, labels), use text shapes for readability
- Text should be readable - use dark colors (#000000, #333333) for text on light backgrounds

Be concise and clear in your responses. Execute the requested actions and confirm what you did.`;
```

**Expected Improvement**:
- AI will consistently use batch operations
- Fewer tool calls overall
- More predictable performance

---

### Phase 4: Unified Batch Execution

**Goal**: Combine ALL operations into a single Firestore batch

**Current**: 
- `createMultipleShapes` uses batch writes ✅
- Individual operations use separate writes ❌

**New Approach**: Collect all operations and execute in one batch
```javascript
const executeTool = async (toolCall, userId, currentShapes, batch = null) => {
  // If batch provided, add to it instead of executing immediately
  // Otherwise, create temporary batch and commit
};

// In sendCommand
if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
  const batch = writeBatch(db);
  
  const toolResults = await Promise.all(
    aiMessage.tool_calls.map(async (toolCall) => {
      // Pass batch to executeTool
      const result = await executeTool(toolCall, userId, currentShapes, batch);
      return { ... };
    })
  );
  
  // Commit all operations at once
  await batch.commit();
}
```

**Expected Improvement**:
- Single network round-trip for all operations
- Atomic execution (all or nothing)
- Reduced Firestore costs

---

### Phase 5: Additional Optimizations

#### A. Add Progress Feedback for Large Operations
```javascript
// In AIModal.jsx, show progress during execution
if (result.toolCalls && result.toolCalls.length > 10) {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `⏳ Creating ${result.toolCalls.length} shapes...`,
    timestamp: Date.now()
  }]);
}
```

#### B. Optimize getCanvasState
```javascript
// Instead of returning full shape objects, return minimal data
case 'getCanvasState': {
  const minimalShapes = currentShapes.map(s => ({
    id: s.id,
    type: s.type,
    x: Math.round(s.x),
    y: Math.round(s.y),
    fill: s.fill,
    text: s.text // for text shapes
  }));
  return {
    success: true,
    message: `Retrieved ${currentShapes.length} shapes`,
    data: minimalShapes
  };
}
```

#### C. Consider GPT-4o for Complex Commands
```javascript
// In functions/index.js, use smarter model for complex operations
const modelToUse = data.canvasState?.length > 50 || 
                   data.message.split(' ').length > 20
  ? "gpt-4o"
  : "gpt-4o-mini";

const response = await openai.chat.completions.create({
  model: modelToUse,
  // ...
});
```

---

## Expected Overall Improvements

### Speed Improvements
| Scenario | Current | After Phase 1 | After All Phases |
|----------|---------|---------------|------------------|
| 5x5 grid (25 shapes) | 2.5-7.5s | 0.1-0.3s | 0.1-0.2s |
| Login form (10 shapes) | 1-3s | 0.1-0.3s | 0.1-0.2s |
| Update 5 shapes | 0.5-1.5s | 0.1-0.3s | 0.1-0.2s |
| Simple 1 shape | 0.1-0.3s | 0.1-0.3s | 0.1-0.2s |

### Cost Improvements
- **Token usage**: 30-50% reduction (smart canvas filtering)
- **Firestore writes**: Batched operations = lower costs
- **Cloud Function**: Faster execution = lower compute costs

### Accuracy Improvements
- Better prompts → more consistent use of batch operations
- Clearer guidelines → better shape positioning and sizing

---

## Implementation Priority

1. **Phase 1** (Parallel execution) - Highest impact, easiest to implement
2. **Phase 3** (Better prompts) - High impact, very easy
3. **Phase 2** (Canvas filtering) - Medium impact, medium complexity
4. **Phase 4** (Unified batching) - Medium impact, higher complexity
5. **Phase 5** (Additional optimizations) - Nice-to-haves

---

## Testing Plan

### Test Cases
1. **5x5 grid test**: "Create a 5x5 grid of red squares, 100px apart"
2. **Form test**: "Create a login form with username, password, and submit button"
3. **Update test**: "Move the blue rectangle 200 pixels to the right"
4. **Complex test**: "Create a navigation bar with 5 menu items"
5. **Large canvas test**: Test with 100+ existing shapes

### Metrics to Track
- ⏱️ **Execution time**: Start to finish for each command
- 🎯 **Accuracy**: Does it create correct shapes/positions?
- 💰 **Token usage**: Prompt tokens + completion tokens
- 📝 **Tool calls**: Number and type of tools called
- 💾 **Firestore operations**: Number of writes

---

## Conclusion

The AI agent is well-architected but has one critical bottleneck: **sequential tool execution**. By parallelizing tool calls and optimizing prompts, we can achieve **10-75x speed improvements** for multi-shape operations while maintaining accuracy and reducing costs.

The most impactful change is Phase 1 (parallel execution), which is also the easiest to implement. Combined with better prompts (Phase 3), this should dramatically improve the user experience for complex operations like grids and forms.

