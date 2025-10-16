# CollabCanvas - MVP to Final Submission Epic

## Current State Assessment

### What's Working (MVP Complete) ✅
- Authentication system
- Real-time multiplayer cursors
- Canvas pan/zoom
- Shape creation (rectangles, ellipses)
- Shape manipulation (drag, resize, delete, recolor)
- Real-time shape synchronization
- Presence system
- Firebase deployment

### Rubric Score Projection (Current MVP)
**Estimated: ~45-55/100 points**

- **Section 1 - Core Infrastructure (30pts):** ~18-22pts
  - Real-time sync: 6-8pts (works but 200ms latency, not sub-100ms)
  - Conflict resolution: 4-6pts (LWW documented, works but basic)
  - Persistence: 8-9pts (solid)

- **Section 2 - Canvas Features (20pts):** ~8-10pts
  - Functionality: 3-4pts (2 shapes, basic transforms)
  - Performance: 5-6pts (untested at scale, likely 100+ objects OK)

- **Section 3 - Advanced Features (15pts):** ~0-2pts
  - No Tier 1/2/3 features yet

- **Section 4 - AI Agent (25pts):** ~0pts
  - Not implemented

- **Section 5 - Technical (10pts):** ~7-8pts
  - Architecture: 4-5pts (clean structure)
  - Auth/Security: 3pts (basic but functional)

- **Section 6 - Documentation (5pts):** ~3-4pts
  - Good progress report, needs formal README

- **Section 7 - AI Dev Log:** Not started
- **Section 8 - Demo Video:** Not started

---

## Target Score: 85-95 points (A grade)

To achieve this, we need to prioritize high-impact improvements.

---

## Epic Goals

### Primary Goals (Must Have)
1. **Implement AI Canvas Agent** (25pts potential) - HIGHEST PRIORITY
2. **Improve real-time sync performance** (Target sub-100ms, gain 4-5pts)
3. **Add advanced Figma features** (Target 10-12pts from Section 3)
4. **Scale testing** (Verify 500+ objects, 5+ users)
5. **Create demo video** (Pass/fail requirement)
6. **Write AI development log** (Pass/fail requirement)

### Secondary Goals (Nice to Have)
7. **Polish UI/UX** (Bonus points)
8. **Add more shape types** (text layers)
9. **Improve documentation**

---

## Work Breakdown

### EPIC 1: AI Canvas Agent (25 points) 🎯 CRITICAL

**Priority:** HIGHEST - This is 25% of total grade and completely missing

**Goal:** Implement AI agent that manipulates canvas through natural language

#### Requirements Breakdown:

**Command Breadth (10pts target: 9-10pts)**
- Need 8+ distinct command types covering:
  - Creation (2+): "Create red circle at 100,200", "Add text 'Hello'"
  - Manipulation (2+): "Move blue rectangle to center", "Resize circle 2x"
  - Layout (1+): "Arrange shapes in horizontal row", "Create 3x3 grid"
  - Complex (1+): "Create login form", "Build navigation bar"

**Complex Execution (8pts target: 7-8pts)**
- "Create login form" must produce 3+ properly arranged elements
- Smart positioning and styling
- Multi-step plan execution

**Performance & Reliability (7pts target: 6-7pts)**
- Sub-2 second responses
- 90%+ accuracy
- Natural UX with feedback
- Shared state across users
- Multiple users can use AI simultaneously

#### Implementation Plan:

**Phase 1: Basic AI Integration (Days 1-2)**
- [ ] Choose AI provider (OpenAI GPT-4 or Anthropic Claude)
- [ ] Set up API integration
- [ ] Create AI service layer (`aiService.js`)
- [ ] Implement function calling/tool use schema
- [ ] Define tools: `createShape`, `updateShape`, `getCanvasState`, `deleteShape`
- [ ] Create AI chat UI component (input box + chat history)
- [ ] Test basic commands: "Create a red rectangle"

**Phase 2: Command Coverage (Days 2-3)**
- [ ] Implement creation commands (5+ variations)
- [ ] Implement manipulation commands (5+ variations)
- [ ] Implement layout commands (3+ variations)
- [ ] Test each category thoroughly
- [ ] Add error handling and retry logic

**Phase 3: Complex Commands (Day 3)**
- [ ] Implement multi-step planning for complex commands
- [ ] "Create login form" → analyze → plan → execute (username field, password field, button, arranged vertically)
- [ ] "Build navigation bar" → create multiple items, arrange horizontally, style consistently
- [ ] Add smart defaults (sizing, spacing, colors)

**Phase 4: Shared State & Multi-User (Day 4)**
- [ ] AI-generated shapes sync via existing Firestore infrastructure
- [ ] Multiple users can issue AI commands simultaneously
- [ ] Show AI activity to other users (presence indicator?)
- [ ] Test with 2+ users using AI at same time

**Phase 5: UX Polish (Day 4)**
- [ ] Add loading states ("AI is thinking...")
- [ ] Show AI plan before execution ("I'll create 3 elements...")
- [ ] Add feedback messages on success/failure
- [ ] Implement chat history
- [ ] Add example prompts for users

**Key Technical Decisions:**
- **Tool Schema:** Define clear function signatures for AI to call
- **State Management:** AI operations go through same `canvasService` as manual edits
- **Prompt Engineering:** System prompt that teaches AI about canvas coordinates, sizing, layout principles
- **Context:** Pass current canvas state to AI so it knows what exists

**Estimated Time:** 4-5 days (40-50% of remaining work)

---

### EPIC 2: Performance Improvements (6-8 points gain)

**Priority:** HIGH - Required for excellent marks in Section 1

**Current State:**
- Cursor sync: ~200ms (need sub-50ms for 11-12pts)
- Object sync: ~200ms (need sub-100ms for 11-12pts)
- Untested at scale (500+ objects, 5+ users)

#### Tasks:

**Phase 1: Migrate to Realtime Database (Days 1-2)**
- [ ] Enable Firebase Realtime Database in console
- [ ] Migrate cursors to RTDB (keep shapes in Firestore)
- [ ] Migrate presence to RTDB with native `onDisconnect`
- [ ] Test latency improvements (target: 30-50ms for cursors)
- [ ] Update security rules for RTDB

**Phase 2: Optimization (Day 2)**
- [ ] Implement cursor interpolation (smooth movement between updates)
- [ ] Add viewport culling (don't render off-screen shapes)
- [ ] Optimize Firestore queries (indexes, pagination if needed)
- [ ] Batch shape updates where possible

**Phase 3: Scale Testing (Day 3)**
- [ ] Create test script to generate 500+ shapes
- [ ] Test FPS with 500 objects (target: 60 FPS)
- [ ] Test with 5+ concurrent users
- [ ] Profile and optimize bottlenecks
- [ ] Document performance characteristics

**Expected Gains:**
- Real-time sync: 6-8pts → 11-12pts (+4-5pts)
- Performance: 5-6pts → 9-10pts (+3-4pts)

**Estimated Time:** 2-3 days

---

### EPIC 3: Advanced Figma Features (10-12 points target)

**Priority:** MEDIUM-HIGH - 15% of grade, relatively quick wins

**Strategy:** Implement 3 Tier 1 + 2 Tier 2 features for 12pts

#### Tier 1 Features (Pick 3, 6pts total)

**Recommended:**
1. **Undo/Redo** (2pts) - HIGH IMPACT
   - [ ] Implement command pattern or history stack
   - [ ] Track all shape operations
   - [ ] Cmd+Z / Cmd+Shift+Z keyboard shortcuts
   - [ ] Sync undo/redo across users (tricky!)

2. **Keyboard Shortcuts** (2pts) - EASY WIN
   - [ ] Delete/Backspace (already have)
   - [ ] Duplicate: Cmd+D
   - [ ] Arrow keys to nudge selected shape
   - [ ] Cmd+A to select all
   - [ ] Escape to deselect

3. **Export Canvas** (2pts) - MEDIUM EFFORT
   - [ ] Export to PNG using Konva's built-in export
   - [ ] Export selected shapes or entire canvas
   - [ ] Download button in toolbar

**Alternatives:**
- Copy/paste (Cmd+C/V)
- Color picker with recent colors/palettes
- Snap-to-grid

#### Tier 2 Features (Pick 2, 6pts total)

**Recommended:**
1. **Layers Panel** (3pts) - HIGH IMPACT, VISIBLE
   - [ ] Sidebar showing all shapes as list
   - [ ] Click to select shape
   - [ ] Drag to reorder (z-index)
   - [ ] Show/hide shapes (visibility toggle)
   - [ ] Rename shapes

2. **Alignment Tools** (3pts) - USEFUL, MODERATE EFFORT
   - [ ] Toolbar buttons: align left/right/center/top/bottom
   - [ ] Distribute evenly (horizontal/vertical)
   - [ ] Align relative to canvas or selection

**Alternatives:**
- Z-index management (bring to front, send to back) - could combine with layers panel
- Styles/design tokens (save and reuse colors)

**Estimated Time:** 3-4 days total

---

### EPIC 4: Additional Shape Types & Features

**Priority:** MEDIUM - Improves Section 2 score

#### Tasks:
- [ ] Add text layers with basic formatting
  - [ ] Font size picker
  - [ ] Font family dropdown
  - [ ] Text color
  - [ ] Edit text on double-click
- [ ] Add line/arrow shapes
- [ ] Test multi-select (Shift+click) - may already work with Konva Transformer
- [ ] Add rotation UI (may already work with Konva Transformer)

**Expected Gains:**
- Canvas functionality: 3-4pts → 6-7pts (+2-3pts)

**Estimated Time:** 1-2 days

---

### EPIC 5: Documentation & Submission Requirements

**Priority:** CRITICAL - Pass/fail items

#### AI Development Log (REQUIRED - Pass/Fail)
- [ ] Document AI tools used (which coding assistants, how)
- [ ] List 3-5 effective prompting strategies with examples
- [ ] Estimate AI-generated vs hand-written code percentage
- [ ] Reflect on where AI excelled and struggled
- [ ] Key learnings about AI-assisted development

**Estimated Time:** 2-3 hours

#### Demo Video (REQUIRED - Pass/Fail, -10pts if missing)
**Requirements:** 3-5 minutes demonstrating:
- [ ] Real-time collaboration with 2+ users (show both screens)
- [ ] Multiple AI commands executing
- [ ] Advanced features walkthrough
- [ ] Architecture explanation
- [ ] Clear audio and video quality

**Script Outline:**
1. Intro (30s): Project overview, tech stack
2. Real-time collaboration (1min): Two browser windows, create/move shapes, show cursors, presence
3. AI agent (1.5min): Execute 6+ varied commands, show complex command (login form)
4. Advanced features (1min): Show Tier 1 and Tier 2 features
5. Architecture (1min): Explain Firestore structure, service layer pattern, conflict resolution

**Estimated Time:** 4-6 hours (planning, recording, editing)

#### README Documentation
- [ ] Project description and features
- [ ] Tech stack
- [ ] Setup instructions (local dev)
- [ ] Deployment URL
- [ ] Architecture overview
- [ ] Screenshots/GIFs
- [ ] Known limitations

**Estimated Time:** 2-3 hours

---

### EPIC 6: Bug Fixes & Polish (Bonus Points)

**Priority:** LOW - Do last if time permits

#### UX Improvements
- [ ] Loading states and spinners
- [ ] Error messages and toasts
- [ ] Smooth animations
- [ ] Better visual design (shadows, gradients, modern UI)
- [ ] Mobile responsiveness

#### Innovation (Bonus +2pts)
- [ ] AI-powered design suggestions
- [ ] Smart component detection
- [ ] Generative design tools

**Estimated Time:** 2-3 days (only if time allows)

---

## Timeline & Prioritization

### Week 1 (Days 1-7): Core Features
**Focus:** AI Agent + Performance

- **Days 1-2:** AI Agent basics + Realtime DB migration
- **Days 3-4:** AI command coverage + complex commands
- **Days 5-6:** AI polish + scale testing
- **Day 7:** Buffer for debugging

### Week 2 (Days 8-14): Advanced Features & Polish
**Focus:** Figma features + Submission requirements

- **Days 8-10:** Tier 1 features (undo/redo, shortcuts, export)
- **Days 11-12:** Tier 2 features (layers panel, alignment tools)
- **Day 13:** Text layers + additional shapes
- **Day 14:** Bug fixes

### Week 3 (Days 15-21): Submission Prep
**Focus:** Documentation, testing, demo

- **Days 15-16:** AI dev log + README documentation
- **Day 17:** Demo video recording and editing
- **Days 18-19:** Final testing (all rubric requirements)
- **Day 20:** Buffer for last-minute issues
- **Day 21:** Final submission

---

## Risk Management

### High-Risk Items
1. **AI Agent Implementation** (NEW technology, 25pts at stake)
   - Mitigation: Start immediately, test incrementally, have fallback simpler implementation
   
2. **Demo Video Quality** (Pass/fail, -10pts if poor)
   - Mitigation: Record early, get feedback, reshoot if needed
   
3. **Performance at Scale** (500+ objects target)
   - Mitigation: Test early, optimize progressively, document limits if can't hit target

### Medium-Risk Items
4. **Undo/Redo with Multi-User** (Complex feature)
   - Mitigation: Start with local undo/redo, add sync later if time
   
5. **Time Management** (Lots of work, limited time)
   - Mitigation: Prioritize ruthlessly, cut Tier 2 features if needed

---

## Success Metrics

### Minimum Viable Final (70-79 pts, C grade)
- AI agent with 6 basic commands (12-15pts)
- Current performance maintained (18-22pts Section 1, 8-10pts Section 2)
- 1-2 Tier 1 features (2-4pts Section 3)
- Demo video and AI log completed
- Documentation updated

### Target Final (85-95 pts, A grade)
- AI agent with 8+ commands, complex execution, excellent UX (22-24pts)
- Improved performance (sub-100ms sync, scale tested) (24-26pts Section 1, 11-12pts Section 2)
- 3 Tier 1 + 2 Tier 2 features (12pts Section 3)
- High-quality demo video and comprehensive AI log
- Professional documentation

### Stretch Final (95-100+ pts, A+)
- All of above +
- Bonus points for innovation/polish/scale (+3-5pts)
- All features working excellently
- Production-ready quality

---

## Next Steps

1. **Review this epic with stakeholder** (you!)
2. **Prioritize EPICs** based on your available time
3. **Start with EPIC 1 (AI Agent)** - highest priority, most points
4. **Set up project tracking** (GitHub issues, task list, or simple checklist)
5. **Begin Day 1:** AI Agent Phase 1

**First PR to start tomorrow:** AI Agent - Basic Integration

Ready to begin?