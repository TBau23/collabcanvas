# AI Canvas Agent - Technical Design Document

## Overview

Add an AI agent that manipulates the canvas through natural language commands. Users click a floating button to open a chat modal, type commands like "create a blue rectangle" or "arrange these shapes in a grid," and the AI executes the commands by calling canvas manipulation functions.

**Target:** 22-24 points out of 25 in rubric Section 4

---

## Architecture

### High-Level Flow

```
User types command in AI modal
    ↓
AIService sends to OpenAI with function calling schema
    ↓
OpenAI returns function calls (tool_calls)
    ↓
AIService executes functions via canvasService
    ↓
Shapes created/modified → sync via Firestore
    ↓
All users see results (existing sync infrastructure)
```

### Key Design Principles

1. **Reuse Existing Infrastructure:** AI uses same `canvasService` functions as manual edits, so sync is automatic
2. **Stateless Commands:** Each AI command is independent, no persistent conversation context
3. **Simple First, Iterate:** Start with basic commands, add complexity progressively
4. **No Special Treatment:** AI-generated shapes are just shapes - no metadata marking them as "AI created"

---

## Component Architecture

### New Files to Create

```
src/
├── services/
│   └── aiService.js          # OpenAI integration, function calling
├── components/
│   └── AI/
│       ├── AIModal.jsx       # Chat modal UI
│       ├── AIModal.css       # Modal styles
│       └── AIButton.jsx      # Floating button to open modal
```

### Modifications to Existing Files

```
src/components/Canvas/Canvas.jsx
  - Add AIButton component
  - Pass canvas state to AI when needed

src/services/canvasService.js
  - No changes needed (AI will call existing functions)
```

---

## Data Flow

### 1. User Input
```javascript
// User types: "Create a red rectangle at 100, 200"
AIModal → aiService.sendCommand(userMessage, canvasState)
```

### 2. OpenAI Request
```javascript
// aiService.js
const response = await openai.chat.completions.create({
  model: "gpt-4o", // or whatever model you choose
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ],
  tools: toolDefinitions, // Function calling schema
  tool_choice: "auto"
});
```

### 3. Function Execution
```javascript
// AI returns: { name: "createShape", arguments: { type: "rectangle", x: 100, y: 200, fill: "red" } }

// aiService.js executes:
await canvasService.createShape(userId, shapeData);
// This automatically syncs via Firestore to all users
```

### 4. User Feedback
```javascript
// AIModal displays:
"✓ Created red rectangle at (100, 200)"
// Or on error:
"✗ Error: Could not create shape"
```

---

## OpenAI Function Calling Schema

### Tool Definitions

The AI will have access to these functions:

#### 1. createShape
```javascript
{
  name: "createShape",
  description: "Create a new shape on the canvas",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["rectangle", "ellipse"],
        description: "Type of shape to create"
      },
      x: {
        type: "number",
        description: "X coordinate (0-5000)"
      },
      y: {
        type: "number",
        description: "Y coordinate (0-5000)"
      },
      width: {
        type: "number",
        description: "Width in pixels"
      },
      height: {
        type: "number",
        description: "Height in pixels"
      },
      fill: {
        type: "string",
        description: "Fill color (hex code or color name)"
      }
    },
    required: ["type", "x", "y", "width", "height", "fill"]
  }
}
```

#### 2. updateShape
```javascript
{
  name: "updateShape",
  description: "Update an existing shape's properties",
  parameters: {
    type: "object",
    properties: {
      shapeId: {
        type: "string",
        description: "ID of the shape to update"
      },
      x: { type: "number", description: "New X coordinate" },
      y: { type: "number", description: "New Y coordinate" },
      width: { type: "number", description: "New width" },
      height: { type: "number", description: "New height" },
      fill: { type: "string", description: "New fill color" },
      rotation: { type: "number", description: "Rotation in degrees" }
    },
    required: ["shapeId"]
  }
}
```

#### 3. getCanvasState
```javascript
{
  name: "getCanvasState",
  description: "Get current canvas state (all shapes). Use this to reference existing shapes before manipulating them.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
}
```

#### 4. createMultipleShapes
```javascript
{
  name: "createMultipleShapes",
  description: "Create multiple shapes at once (for complex layouts)",
  parameters: {
    type: "object",
    properties: {
      shapes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["rectangle", "ellipse"] },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            fill: { type: "string" }
          }
        }
      }
    },
    required: ["shapes"]
  }
}
```

### System Prompt

```javascript
const SYSTEM_PROMPT = `You are an AI assistant that helps users create and manipulate shapes on a canvas.

Canvas Details:
- Canvas size: 5000x5000 pixels
- Available shapes: rectangle, ellipse
- Coordinate system: (0, 0) is top-left, (5000, 5000) is bottom-right
- Colors: Use hex codes (e.g., "#FF0000") or common color names (e.g., "red", "blue")

Your capabilities:
1. Create shapes with specific positions, sizes, and colors
2. Update existing shapes (move, resize, recolor, rotate)
3. Get current canvas state to reference existing shapes
4. Create multiple shapes for complex layouts

Guidelines:
- Use reasonable default sizes (150x100 for rectangles, 100x100 for ellipses) if not specified
- When arranging shapes, space them appropriately (50-100px apart)
- For complex commands like "create a login form", break it down into multiple shapes with proper positioning
- Center of canvas is at (2500, 2500)
- Always use the getCanvasState function first if the command references existing shapes (e.g., "move the blue rectangle")

Be concise in your responses. Just execute the requested actions.`;
```

---

## UI Design

### Floating AI Button

**Location:** Fixed position, bottom-right corner (above presence panel if overlapping)

**Appearance:**
- Circular button with AI/sparkle icon (✨ or 🤖)
- Size: 60x60px
- Background: Primary color (e.g., #4A90E2)
- Shadow for depth
- Hover effect: slight scale up

**Behavior:**
- Click opens AIModal
- Z-index high enough to be above canvas

### AI Modal

**Location:** Centered on screen (or bottom-right if you prefer)

**Structure:**
```
┌─────────────────────────────────┐
│  AI Assistant              [X]  │
├─────────────────────────────────┤
│                                 │
│  Chat History:                  │
│  ┌─────────────────────────┐   │
│  │ User: Create a red rect │   │
│  │ AI: ✓ Created rectangle │   │
│  │                         │   │
│  │ User: Move it to center │   │
│  │ AI: ✗ Error: No shape   │   │
│  │     selected            │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Type your command...    │   │
│  └─────────────────────────┘   │
│                    [Send]       │
└─────────────────────────────────┘
```

**Features:**
- Scrollable chat history
- Text input at bottom
- Send button (or Enter to submit)
- Loading indicator while AI is processing
- Error messages in red
- Success messages in green
- Close button (X)

**Styling:**
- Width: 400px
- Height: 500px
- Background: white with slight transparency
- Border radius: 8px
- Box shadow for depth

---

## Implementation Plan - PR Breakdown

### PR #1: AI Service Foundation (Day 1, 2-3 hours)

**Goal:** Get basic OpenAI integration working, test with simple command

**Tasks:**
- [ ] Create `src/services/aiService.js`
- [ ] Set up OpenAI client initialization
- [ ] Define tool schema for `createShape` only (start simple)
- [ ] Implement `sendCommand(message, userId)` function
- [ ] Implement function execution logic
- [ ] Test manually with console: `aiService.sendCommand("Create a red rectangle", userId)`
- [ ] Verify shape appears on canvas

**Files:**
- Create: `src/services/aiService.js`
- Create: `.env.local` entry for `VITE_OPENAI_API_KEY`

**Testing:**
```javascript
// In browser console:
import aiService from './services/aiService';
await aiService.sendCommand("Create a blue rectangle at 100, 200", currentUserId);
// Should create shape on canvas
```

**Acceptance Criteria:**
- OpenAI API call succeeds
- AI returns createShape function call
- Shape appears on canvas
- No errors in console

---

### PR #2: AI Modal UI (Day 1, 2-3 hours)

**Goal:** Build chat interface, connect to AI service

**Tasks:**
- [ ] Create `src/components/AI/AIButton.jsx` - Floating button
- [ ] Create `src/components/AI/AIModal.jsx` - Modal with chat interface
- [ ] Create `src/components/AI/AIModal.css` - Styling
- [ ] Add state for modal open/closed
- [ ] Add state for chat history (array of messages)
- [ ] Connect text input to `aiService.sendCommand()`
- [ ] Display user message and AI response in chat
- [ ] Add loading state while AI processes
- [ ] Integrate into Canvas.jsx

**Files:**
- Create: `src/components/AI/AIButton.jsx`
- Create: `src/components/AI/AIModal.jsx`
- Create: `src/components/AI/AIModal.css`
- Modify: `src/components/Canvas/Canvas.jsx` (add AIButton)

**Chat Message Structure:**
```javascript
{
  role: "user" | "assistant",
  content: string,
  timestamp: number,
  status: "success" | "error" | "loading"
}
```

**Acceptance Criteria:**
- Button appears in bottom-right
- Clicking button opens modal
- Can type and submit commands
- Chat history displays messages
- Loading indicator shows while processing
- Modal can be closed

---

### PR #3: Command Coverage - Creation (Day 2, 2-3 hours)

**Goal:** Support all creation command types

**Tasks:**
- [ ] Test and refine creation commands:
  - "Create a red rectangle at 100, 200"
  - "Add a blue ellipse in the center"
  - "Make a 200x300 green rectangle"
  - "Create a small yellow circle at 500, 500"
  - "Add an orange square at the top left"
- [ ] Improve system prompt for better defaults
- [ ] Handle color name conversion (e.g., "red" → "#FF0000")
- [ ] Handle relative positions ("center", "top left")
- [ ] Add response formatting (friendly success messages)

**Helper Functions to Add:**
```javascript
// In aiService.js
const colorNameToHex = (colorName) => {
  const colors = {
    red: "#FF0000",
    blue: "#0000FF",
    green: "#00FF00",
    yellow: "#FFFF00",
    // ... more colors
  };
  return colors[colorName.toLowerCase()] || colorName;
};

const parsePosition = (position, canvasSize = 5000) => {
  const positions = {
    center: { x: canvasSize / 2, y: canvasSize / 2 },
    "top left": { x: 100, y: 100 },
    "top right": { x: canvasSize - 100, y: 100 },
    // ... more positions
  };
  return positions[position] || { x: 100, y: 100 };
};
```

**Acceptance Criteria:**
- 5+ creation command variations work correctly
- AI handles color names and hex codes
- AI handles relative positions
- Default sizes are reasonable
- Response messages are user-friendly

---

### PR #4: Command Coverage - Manipulation (Day 2, 2-3 hours)

**Goal:** Support manipulation commands that reference existing shapes

**Tasks:**
- [ ] Add `updateShape` to tool schema
- [ ] Add `getCanvasState` to tool schema
- [ ] Implement `getCanvasState()` function (returns current shapes)
- [ ] Update system prompt to instruct AI to call getCanvasState first
- [ ] Test manipulation commands:
  - "Move the blue rectangle to the center"
  - "Resize the red circle to be twice as big"
  - "Change the green ellipse to yellow"
  - "Rotate the rectangle 45 degrees"
- [ ] Handle ambiguity (multiple blue rectangles → pick first one, mention in response)

**getCanvasState Implementation:**
```javascript
// In aiService.js
async function getCanvasState() {
  // Return current shapes from canvasService or pass from Canvas component
  return shapes.map(shape => ({
    id: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    fill: shape.fill,
    rotation: shape.rotation || 0
  }));
}
```

**Acceptance Criteria:**
- AI can reference existing shapes by color
- AI calls getCanvasState before manipulating
- Move, resize, recolor, rotate commands work
- Handles "no shapes found" gracefully
- Mentions if multiple matches found

---

### PR #5: Command Coverage - Layout 

**Goal:** Support layout commands that arrange multiple shapes

**Tasks:**
- [ ] Add `createMultipleShapes` to tool schema
- [ ] Test layout commands:
  - "Arrange these shapes in a horizontal row"
  - "Create a 3x3 grid of squares"
  - "Space the rectangles evenly"
  - "Create 5 circles in a vertical line"
- [ ] Implement smart spacing (50-100px between shapes)
- [ ] Handle grid calculations (evenly spaced)

**Layout Helper Logic:**
```javascript
// Example: "Create a 3x3 grid of squares"
// AI should call createMultipleShapes with 9 squares
// Positioned at (x + i*spacing, y + j*spacing) for i,j in 0..2
```

**Acceptance Criteria:**
- 3+ layout command variations work
- Shapes are spaced appropriately
- Grid layouts work correctly
- Vertical/horizontal arrangements work

---

### PR #6: Command Coverage - Complex (Day 3-4, 3-4 hours)

**Goal:** Support complex multi-step commands

**Tasks:**
- [ ] Improve system prompt with examples of complex commands
- [ ] Test complex commands:
  - "Create a login form with username and password fields"
  - "Build a navigation bar with 4 menu items"
  - "Make a card layout with title and description"
  - "Create a dashboard with 3 panels"
- [ ] Ensure AI uses createMultipleShapes for complex layouts
- [ ] Verify proper arrangement and sizing

**Example Complex Command Breakdown:**

"Create a login form" should produce:
1. Label: "Username" (text - we'll skip for now, use rectangle as placeholder)
2. Input field: Rectangle (white fill, gray border effect with smaller rect)
3. Label: "Password"
4. Input field: Rectangle
5. Button: Rectangle ("Submit" - again, using rect as placeholder)

Arranged vertically with proper spacing.

**Acceptance Criteria:**
- "Create login form" produces 3+ elements arranged properly
- "Build navigation bar" creates multiple items horizontally
- Complex layouts are visually reasonable
- Spacing and sizing is appropriate

---

### PR #7: Error Handling & Polish (Day 4, 2 hours)

**Goal:** Robust error handling, better UX

**Tasks:**
- [ ] Add try/catch around all function executions
- [ ] Display error messages in chat (red text)
- [ ] Handle API errors (rate limits, network issues)
- [ ] Add retry logic for transient failures
- [ ] Improve response messages:
  - Success: "✓ Created 3 shapes for your login form"
  - Error: "✗ Could not find any blue rectangles on the canvas"
- [ ] Add loading messages: "AI is thinking..."
- [ ] Test edge cases (empty canvas, invalid commands, API errors)

**Acceptance Criteria:**
- All errors caught and displayed
- User never sees raw error messages
- Loading states are clear
- Chat history persists within session

---

### PR #8: Multi-User Testing & Final Polish (Day 4, 2 hours)

**Goal:** Verify multi-user AI usage works, final testing

**Tasks:**
- [ ] Test with 2+ users using AI simultaneously
- [ ] Verify AI-generated shapes sync correctly
- [ ] Test all command categories with 2+ users
- [ ] Performance test: AI response time < 2 seconds
- [ ] Accuracy test: 10 varied commands, expect 9/10 to work
- [ ] Polish UI (colors, spacing, animations)
- [ ] Add keyboard shortcut to open AI modal (e.g., Cmd+K)
- [ ] Final cleanup and documentation

**Test Scenarios:**
1. User A: "Create a red rectangle" → User B sees it immediately
2. User A and User B both use AI at same time → both commands execute
3. User A: "Move the blue rectangle" (that User B created) → works correctly

**Acceptance Criteria:**
- Multi-user AI usage works without conflicts
- Response times < 2 seconds
- 90%+ command accuracy
- UI is polished and professional
- No console errors

---

## Testing Strategy

### Unit Testing (Optional - if time)
- `aiService.js`: Mock OpenAI responses, test function execution
- Color name conversion
- Position parsing

### Integration Testing (Manual - Required)
After each PR, test these command categories:

**Creation (5+ commands):**
- "Create a red rectangle"
- "Add a blue ellipse at 200, 300"
- "Make a green circle in the center"
- "Create a 100x200 yellow rectangle at the top"
- "Add a small purple square"

**Manipulation (5+ commands):**
- "Move the red rectangle to the center"
- "Resize the blue ellipse to 200x200"
- "Change the green circle to orange"
- "Rotate the rectangle 45 degrees"
- "Make the ellipse twice as big"

**Layout (3+ commands):**
- "Arrange these shapes in a horizontal row"
- "Create a 3x3 grid of squares"
- "Space the circles evenly"

**Complex (3+ commands):**
- "Create a login form with username and password"
- "Build a navigation bar with Home, About, Contact"
- "Make a card with a title and description"

### Performance Testing
- Measure AI response time (target: < 2 seconds)
- Test with 10 commands, expect 9/10 success rate
- Test multi-user: 2 users issuing commands simultaneously



```javascript
// src/services/aiService.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});
```

**Security Note:** In production, API calls should go through your backend to protect the API key. For MVP/demo, client-side is acceptable.



- Backend proxy for API key security
