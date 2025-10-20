# AI Agent Consistency Research

**Date**: October 20, 2025  
**Status**: Research Document  
**Purpose**: Analyze AI agent output quality issues and identify improvements

---

## Executive Summary

The AI agent uses a **single-shot interaction model** with OpenAI function calling, executing all tool calls client-side. While performance is excellent (via parallel execution), there are critical consistency issues:

1. **User-facing messages expose internal IDs** → Poor UX
2. **AI sometimes calls getCanvasState without following through** → Command fails
3. **No conversation loop** → Can't react to tool results

**Quick Wins Identified**: 3 high-impact fixes requiring minimal code changes

---

## 1. Current Architecture

### Request Flow
```
User Command → Cloud Function (OpenAI API) → Tool Calls → Client Execution → Display Results
```

**Key Characteristics**:
- **Single OpenAI call per command** (no multi-turn conversation)
- **Canvas state sent upfront** (when `needsCanvasState()` detects it)
- **All tool calls executed in parallel** (client-side)
- **No feedback loop** (AI doesn't see tool execution results)

### What Works Well ✅
- Sub-2 second responses for most commands
- Parallel execution delivers 10-75x speedup for multi-shape operations
- Smart canvas state filtering reduces tokens by 50-90%
- `createMultipleShapes` handles complex layouts efficiently

---

## 2. Identified Issues

### Issue #1: Shape IDs in User Messages (HIGH PRIORITY)

**Problem**: Tool execution messages expose internal shape IDs to users

**Examples**:
```javascript
// aiService.js lines 311, 320
"Updated shape shape-1729456789-abc123xyz with x, y, fill"
"Deleted shape shape-1729456789-def456xyz"
```

**Impact**:
- Unprofessional user experience
- Users see technical implementation details
- Messages are verbose and unclear

**Root Cause**: Tool execution returns raw shape IDs in success messages

**Expected Behavior**:
```
✓ Moved the blue rectangle
✓ Deleted the shape
✓ Changed color to red
```

---

### Issue #2: getCanvasState Without Follow-Through (CRITICAL)

**Problem**: AI calls `getCanvasState` tool but doesn't execute the actual command

**Example Scenario**:
```
User: "Create a login form"
AI Response: "Retrieved 50 shapes"
Result: Nothing created ❌
```

**Why This Happens**:

1. **Single-shot interaction**: AI makes ONE decision about which tools to call
2. **Canvas state sent upfront**: But AI sometimes still calls `getCanvasState` tool
3. **No second round**: AI can't see tool results and make follow-up calls
4. **Tool choice confusion**: AI treats `getCanvasState` as the primary action

**Contributing Factors**:
- System prompt says "Always call getCanvasState first if command references existing shapes"
- But canvas state is already provided in the system message (lines 75-80, functions/index.js)
- This creates confusion: AI thinks it needs to call the tool explicitly

**Frequency**: Especially common with:
- Complex commands ("create a login form")
- Commands after canvas has many shapes
- Commands that might reference existing shapes

---

### Issue #3: No Conversation Context (ARCHITECTURAL)

**Problem**: AI can't see results of tool calls or ask clarifying questions

**Limitations**:
- Can't handle "make it bigger" without prior shape selection
- Can't recover from ambiguous commands
- Can't learn from tool execution failures

**Example**:
```
User: "Create 3 red rectangles"
AI: Calls createMultipleShapes with invalid coordinates (NaN)
Client: Falls back to defaults, creates shapes at center
AI: Never knows about the problem
```

**Current Workaround**: Client-side validation with defaults (lines 253-260, aiService.js)

---

## 3. Analysis: Root Causes

### Architecture: Single-Shot vs Agentic Loop

**Current (Single-Shot)**:
```
User → [AI decides tools] → Execute all → Show results
```

**Agentic Loop (Industry Standard)**:
```
User → [AI decides tools] → Execute → [AI sees results] → More tools? → Execute → Done
```

**Trade-offs**:

| Aspect | Single-Shot | Agentic Loop |
|--------|-------------|--------------|
| Response time | Fast (1 call) | Slower (2-5 calls) |
| Cost | Low | 2-5x higher |
| Accuracy | Good | Excellent |
| Complex commands | Limited | Strong |
| Error recovery | None | Built-in |

### System Prompt Conflicts

**Lines 44-45 (aiService.js)**:
```
"Always call getCanvasState first if the command references existing shapes"
```

**BUT lines 75-80 (functions/index.js)**:
```javascript
if (canvasState && canvasState.length > 0) {
  messages.push({
    role: "system",
    content: `Current canvas state (${canvasState.length} shapes):\n` + 
      JSON.stringify(canvasState, null, 2),
  });
}
```

**Conflict**: Canvas state is ALREADY provided as context, but prompt tells AI to call the tool.

**Result**: AI sometimes calls `getCanvasState` unnecessarily, wasting its "turn"

---

## 4. Proposed Solutions

### Tier 1: Quick Wins (1-2 hours)

#### Fix 1A: User-Friendly Messages
**Change**: Update tool execution messages to be user-centric

```javascript
// aiService.js lines 308-313
case 'updateShape': {
  // ... existing logic ...
  
  // Determine what was updated for better messaging
  const updateTypes = [];
  if (updates.x !== undefined || updates.y !== undefined) updateTypes.push('position');
  if (updates.width !== undefined || updates.height !== undefined) updateTypes.push('size');
  if (updates.fill !== undefined) updateTypes.push('color');
  if (updates.rotation !== undefined) updateTypes.push('rotation');
  
  const action = updateTypes.join(' and ');
  
  return {
    success: true,
    message: `Updated ${action}`, // No shape ID!
    data: updates,
    shapeId: args.shapeId // Keep ID in data for debugging
  };
}
```

**Similar changes for**:
- `deleteShape`: "Deleted the shape" (line 320)
- `createShape`: Keep current format (it's fine)

**Impact**: ✅ Professional, clear messages

---

#### Fix 1B: Remove getCanvasState from Tools
**Change**: Remove `getCanvasState` from tool definitions entirely

**Rationale**:
- Canvas state is ALREADY sent in system message
- Tool is redundant and causes confusion
- AI doesn't need to explicitly call it

```javascript
// aiService.js lines 162-173 - REMOVE THIS TOOL
// const TOOL_DEFINITIONS = [
//   ... other tools ...
//   // DELETE the getCanvasState tool definition
// ];

// Update executeTool() to handle legacy calls gracefully
case 'getCanvasState': {
  console.warn('[AI] getCanvasState called but deprecated - canvas state already provided');
  return {
    success: true,
    message: `Canvas state already available in context`,
    data: optimizeCanvasState(currentShapes)
  };
}
```

**Also update system prompt (lines 24, 44-45)**:
```
REMOVE: "Get current canvas state using getCanvasState"
REMOVE: "Always call getCanvasState first..."

ADD: "Current canvas state is always provided in context"
```

**Impact**: 
- ✅ Eliminates the "Retrieved X shapes" non-action
- ✅ AI will use its tool calls for actual operations
- ✅ Simpler mental model for AI

**Risk**: Low (canvas state already provided upfront)

---

#### Fix 1C: Improve Tool Choice Prompt
**Change**: Add explicit instruction about tool call priority

```javascript
// aiService.js line 50 - Add before final line
Tool Calling Rules:
- You MUST execute the user's command with appropriate tool calls
- If creating/updating/deleting shapes, call those tools (don't just acknowledge)
- For "create X", call createShape or createMultipleShapes 
- For "move/change X", call updateShape
- Use ALL necessary tools in a single response
- Do NOT only return text - execute actions!

Example good responses:
❌ BAD: User "create a login form" → AI says "I'll create a form" (no tool calls)
✅ GOOD: User "create a login form" → AI calls createMultipleShapes with form elements

Be concise in text responses. Let the tool executions speak for themselves.
```

**Impact**: ✅ Forces AI to take action, not just acknowledge

---

### Tier 2: Moderate Improvements (4-6 hours)

#### Fix 2A: Agentic Loop with Result Feedback
**Change**: Implement 2-round conversation when needed

**Architecture**:
```javascript
// New Cloud Function or client-side loop
async function sendCommandWithLoop(message, userId, shapes) {
  // Round 1: Initial tool calls
  let result = await callAI(message, shapes);
  let toolResults = await executeTools(result.tool_calls);
  
  // Round 2: Check if AI needs to see results
  if (needsFollowUp(result, toolResults)) {
    result = await callAI(
      "Previous tool results: " + JSON.stringify(toolResults), 
      shapes
    );
    const round2Results = await executeTools(result.tool_calls);
    toolResults.push(...round2Results);
  }
  
  return formatResponse(toolResults);
}
```

**When to use Round 2**:
- Tool execution failed (need AI to retry with different params)
- Only `getCanvasState` called in Round 1
- Complex command requires multiple steps

**Impact**:
- ✅ Eliminates "only retrieved state" issue
- ✅ Better error recovery
- ⚠️ 2x cost (2 OpenAI calls)
- ⚠️ Slightly slower (additional 500-1000ms)

**Optimization**: Only use loop when necessary (detect via heuristics)

---

#### Fix 2B: Parallel + Sequential Tool Execution
**Change**: Support both parallel (independent) and sequential (dependent) tool calls

```javascript
// If tools are marked as dependent, execute in sequence
const hasGetCanvasState = toolCalls.some(tc => tc.function.name === 'getCanvasState');

if (hasGetCanvasState && toolCalls.length > 1) {
  // Execute getCanvasState first, then others
  const getStateCall = toolCalls.find(tc => tc.function.name === 'getCanvasState');
  await executeTool(getStateCall);
  
  const otherCalls = toolCalls.filter(tc => tc.function.name !== 'getCanvasState');
  await Promise.all(otherCalls.map(executeTool));
} else {
  // All parallel (current behavior)
  await Promise.all(toolCalls.map(executeTool));
}
```

**Impact**: ✅ Supports dependent tool calls (if AI requests them)

---

### Tier 3: Advanced Enhancements (2-3 days)

#### Fix 3A: Contextual Canvas State + Conversation History
**Change**: Maintain conversation history across commands

```javascript
// Store last N commands + results per session
const conversationHistory = {
  [sessionId]: [
    { role: 'user', content: 'Create a blue rectangle' },
    { role: 'assistant', tool_calls: [...], content: 'Created rectangle' },
    { role: 'user', content: 'Make it bigger' },
    // ...
  ]
};

// Send history to AI for context-aware responses
```

**Benefits**:
- ✅ "Make it bigger" works (references last created shape)
- ✅ Better multi-turn conversations
- ✅ AI learns from recent commands

**Challenges**:
- Token limit (need to truncate old messages)
- State management (per-user or per-canvas?)
- Cost (more tokens per request)

---

#### Fix 3B: Tool Result Streaming
**Change**: Show live updates as each tool executes

**Current**: All tools execute → show all results at once  
**Proposed**: Show each tool result as it completes

**Implementation**: WebSocket or SSE for real-time updates

**Impact**: ✅ Better perceived performance for large operations

---

## 5. Recommendations (Prioritized)

### Immediate (Next Session)
1. **Fix 1A**: User-friendly messages (30 min) - ⚡ High impact, zero risk
2. **Fix 1B**: Remove `getCanvasState` tool (45 min) - ⚡ Solves Issue #2
3. **Fix 1C**: Improve prompt about tool execution (15 min) - ⚡ Prevents acknowledgment-only responses

**Expected outcomes**:
- Professional, clear user messages
- "Create login form" will actually create elements
- No more "Retrieved 50 shapes" dead-ends

**Total time**: ~1.5 hours  
**Risk**: Very low  
**Impact**: High

---

### Near Term (Next Sprint)
4. **Fix 2A**: Implement basic agentic loop (4 hours)
   - Only trigger for complex commands or failures
   - Max 2 rounds to control cost

5. **Fix 2B**: Sequential tool execution support (2 hours)
   - Rare edge cases where order matters

**Expected outcomes**:
- More robust complex command handling
- Better error recovery
- Slightly higher cost (2-3%)

---

### Future Considerations
6. **Fix 3A**: Conversation history (research prototype)
   - Test with 5-10 users first
   - Monitor token usage carefully

7. **Fix 3B**: Result streaming (nice-to-have)
   - Only if users report perceived slowness

---

## 6. Testing Strategy

### Before Fixes
Test these commands and document failures:
1. "Create a login form" → Does it create elements or just say "Retrieved X shapes"?
2. "Move the blue rectangle 100 pixels right" → Does message show shape ID?
3. "Delete that shape" → Does message show shape ID?
4. "Create 5 red circles in a row" → Does it use `createMultipleShapes` or individual calls?

### After Fixes (Tier 1)
Re-test above commands, expect:
1. Login form → Creates 3+ form elements
2. Move → "Moved the shape" (no ID)
3. Delete → "Deleted the shape" (no ID)
4. 5 circles → Uses batch operation

### Success Criteria
- ✅ No shape IDs in user-facing messages
- ✅ Complex commands execute (not just retrieve state)
- ✅ 95%+ of commands succeed on first attempt
- ✅ Messages are clear and actionable

---

## 7. Performance vs Consistency Trade-offs

### Current System
- **Strength**: Blazing fast (parallel execution, single API call)
- **Weakness**: Consistency issues (no feedback loop)

### After Tier 1 Fixes
- **Strength**: Fast + Consistent + Professional
- **Weakness**: Still can't handle "make it bigger" without context
- **Cost**: No change

### After Tier 2 Fixes (Agentic Loop)
- **Strength**: Highly consistent, handles complex commands
- **Weakness**: 500-1000ms slower for commands needing 2 rounds
- **Cost**: 2x for ~20% of commands (estimated)

### Recommendation
Implement Tier 1 immediately (quick wins). Monitor success rate for 1-2 weeks. If issues persist, implement selective Tier 2 (only for complex commands).

---

## 8. Implementation Checklist

### Phase 1: Quick Wins
- [ ] Update `updateShape` message (remove shape ID)
- [ ] Update `deleteShape` message (remove shape ID)
- [ ] Remove `getCanvasState` from tool definitions
- [ ] Update system prompt (remove getCanvasState references)
- [ ] Add tool calling rules to system prompt
- [ ] Test 10 diverse commands
- [ ] Verify no regressions in parallel execution

### Phase 2: Validation
- [ ] Deploy to staging
- [ ] Run automated test suite (if exists)
- [ ] Manual test: 20+ commands across all categories
- [ ] Check console logs for errors
- [ ] Monitor OpenAI API usage (should not increase)

### Phase 3: Documentation
- [ ] Update README with improved command examples
- [ ] Add testing guide for AI commands
- [ ] Document expected behavior for edge cases

---

## 9. Expected Rubric Impact

**Current AI Score** (estimated): 18-20/25
- Command breadth: 8/10 (good variety)
- Complex commands: 5-6/8 (sometimes fails)
- Performance: 6/7 (fast but inconsistent)

**After Tier 1 Fixes**: 22-24/25
- Command breadth: 9/10 (same commands, more reliable)
- Complex commands: 7-8/8 (consistent execution)
- Performance: 7/7 (fast + reliable + professional UX)

**Improvement**: +4 points (16% boost to AI section)

---

## 10. Conclusion

The AI agent has an excellent technical foundation (parallel execution, smart optimization), but user experience suffers from:
1. Technical details leaking into messages
2. Redundant `getCanvasState` tool causing failures
3. Prompt not emphasizing action execution

**All three issues are fixable in ~1.5 hours with zero architectural changes.**

The single-shot architecture is appropriate for this use case. An agentic loop is possible (Tier 2) but adds complexity and cost. Start with Tier 1 fixes and monitor results before considering Tier 2.

**Next Step**: Implement the three Tier 1 fixes in order (1A → 1B → 1C) and test thoroughly.

