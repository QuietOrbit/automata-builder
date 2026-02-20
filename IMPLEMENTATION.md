# Automata Builder - Implementation Guide

## Overview

A DFA builder/tester web app for CS4330 (Theory of Computation). Lets you visually construct automata on an SVG canvas and step through inputs to test them. DFA-only for now, but the data model supports future NFA/regex extension.

**Live URL (when deployed):** GitHub Pages at `/<repo-name>/automata-builder/`

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Nuxt 3 (SPA mode, no SSR) | Framework |
| TypeScript | Language |
| Pinia (`@pinia/nuxt`) | State management |
| `@nuxtjs/color-mode` | Dark/light theming |
| SVG (hand-rolled) | Canvas rendering |
| `nanoid` | ID generation |
| CSS custom properties | Theming system |

No other dependencies. Pan/zoom, drag, arrow math are all implemented from scratch.

---

## Project Structure

```
CS4330/automata-builder/
├── nuxt.config.ts
├── package.json
├── tsconfig.json
├── app.vue                        # Nuxt app entry
├── assets/
│   └── css/
│       └── main.css               # CSS custom properties for theming
├── layouts/
│   └── default.vue                # App shell layout
├── pages/
│   └── index.vue                  # Single page: canvas + panels
├── types/
│   └── automaton.ts               # Core TypeScript interfaces
├── stores/
│   ├── automaton.ts               # States, transitions, alphabet CRUD
│   ├── selection.ts               # UI selection state
│   └── simulation.ts              # Simulation run state
├── composables/
│   ├── useCanvasInteraction.ts    # Pan, zoom, coordinate transforms
│   ├── useDragState.ts            # State node dragging
│   ├── useTransitionRouting.ts    # Arrow geometry (straight, curved, self-loop)
│   └── useSimulation.ts           # Step-through simulation engine
├── components/
│   ├── canvas/
│   │   ├── SvgCanvas.vue          # Root SVG + pan/zoom + event delegation
│   │   ├── StateNode.vue          # Circle + label + accept ring
│   │   ├── TransitionArrow.vue    # Path + arrowhead + label
│   │   └── StartArrow.vue         # Arrow indicating start state
│   ├── editor/
│   │   ├── StateEditor.vue        # Panel: name, start/accept toggles, transitions list
│   │   └── TransitionEditor.vue   # Row: target dropdown + symbols input
│   ├── simulation/
│   │   └── SimulationPanel.vue    # Side panel: input, step/run/reset, status
│   └── ui/
│       ├── AppHeader.vue          # Title + theme toggle
│       └── ThemeToggle.vue        # Sun/moon icon toggle
├── utils/
│   ├── geometry.ts                # Vector math, circle intersection, bezier helpers
│   └── ids.ts                     # nanoid wrapper
└── public/
    └── .nojekyll                  # For GitHub Pages
```

---

## Data Model (`types/automaton.ts`)

### Core Interfaces

```ts
type StateId = string    // nanoid
type TransitionId = string

interface Position { x: number; y: number }

interface AutomatonState {
  id: StateId
  name: string           // "q0", "q1", ... (user-editable)
  position: Position
  isStart: boolean       // exactly one per automaton
  isAccept: boolean
}

interface Transition {
  id: TransitionId
  sourceId: StateId
  targetIds: StateId[]   // array for future NFA support; DFA enforces length 1
  symbols: string[]      // multiple symbols grouped on same edge, e.g. ["a", "b"]
}

type AutomatonType = 'DFA' | 'NFA'  // only DFA implemented initially

interface Automaton {
  id: string
  name: string
  type: AutomatonType
  alphabet: string[]     // e.g. ["0", "1"]
  states: AutomatonState[]
  transitions: Transition[]
}
```

### Simulation State

```ts
type SimulationStatus = 'idle' | 'running' | 'accepted' | 'rejected' | 'stuck'

interface SimulationHistoryEntry {
  stateId: StateId
  symbolRead: string | null
  transitionId: TransitionId | null
}

interface SimulationState {
  input: string
  currentIndex: number           // position in input string
  currentStateIds: StateId[]     // array for future NFA; DFA uses [singleId]
  status: SimulationStatus
  history: SimulationHistoryEntry[]
}
```

---

## Store Design

### `stores/automaton.ts` (Pinia)

**State:** Single `Automaton` object (states array, transitions array, alphabet, metadata).

**Getters:**
- `startState` - the single state where `isStart === true`
- `getState(id)` - lookup by ID
- `getTransitionsFrom(stateId)` - all transitions with `sourceId === stateId`
- `getTransitionBetween(sourceId, targetId)` - for detecting bidirectional edges
- `nextStateCounter` - next auto-name number (max existing qN + 1)

**Actions:**
- `addState(position)` - creates state with auto-name, first state becomes start
- `removeState(id)` - removes state AND all transitions referencing it
- `updateState(id, partial)` - update name, position, isStart, isAccept
- `setStartState(id)` - unsets previous start, sets new one
- `addTransition(sourceId, targetId, symbols)` - creates or merges with existing transition for same source-target pair
- `removeTransition(id)` - deletes transition
- `updateTransitionSymbols(id, symbols)` - update symbols on a transition
- `setAlphabet(symbols)` - set the alphabet
- `exportJSON()` / `importJSON(data)` - serialization
- `clear()` - reset to empty automaton

### `stores/selection.ts` (Pinia)

**State:**
- `selectedStateId: StateId | null`
- `selectedTransitionId: TransitionId | null`

**Actions:**
- `selectState(id)` - selects state, clears transition selection
- `selectTransition(id)` - selects transition, clears state selection
- `clearSelection()` - deselects everything

### `stores/simulation.ts` (Pinia)

**State:** A `SimulationState` object.

**Actions:**
- `setInput(input)` - sets input string, resets simulation
- `step()` - advance one symbol (reads symbol, follows transition, updates history)
- `stepBack()` - pop last history entry, restore previous state
- `runToEnd()` - step repeatedly until accept/reject/stuck
- `reset()` - go back to start state, index 0, clear history

---

## Composables Design

### `useCanvasInteraction.ts`

Manages SVG viewBox for pan and zoom.

**State:** `pan: {x, y}`, `zoom: number` (default 1, range 0.1-5)

**Methods:**
- `onWheel(event)` - zoom toward cursor position
- `onPointerDown/Move/Up` - pan when dragging on empty canvas
- `screenToWorld(screenX, screenY)` - convert screen coordinates to SVG world coordinates (accounts for pan, zoom, and SVG element offset)
- `viewBox` - computed string for SVG `viewBox` attribute

**Key math:** `worldX = (screenX - svgRect.left) / zoom + pan.x`, similar for Y.

### `useDragState.ts`

Handles dragging state nodes to reposition them.

**State:** `dragging: boolean`, `dragTarget: StateId | null`, `dragOffset: Position`

**Methods:**
- `onStatePointerDown(stateId, event)` - start drag, compute offset from state center to cursor
- `onPointerMove(event)` - update state position in store (via `updateState`)
- `onPointerUp()` - end drag

**Important:** Drag must convert screen coords to world coords using `useCanvasInteraction.screenToWorld`.

### `useTransitionRouting.ts`

Computes SVG path data for transition arrows. Three cases:

1. **Self-loop** (source === target):
   - Arc above the state circle
   - Path: `M startPoint A rx ry rotation large-arc-flag sweep-flag endPoint`
   - Start/end points offset ~30deg left/right of top of circle
   - Label positioned above the arc

2. **Unidirectional** (A->B, no B->A):
   - Straight line from circle edge to circle edge
   - Compute intersection of line between centers with each circle
   - Path: `M startPoint L endPoint`
   - Label at midpoint, offset perpendicular to line

3. **Bidirectional** (A->B and B->A both exist):
   - Both arrows curve outward using quadratic Bezier
   - Control point offset perpendicular to the line between centers
   - Path: `M startPoint Q controlPoint endPoint`
   - Each arrow curves in opposite direction
   - Label near control point

**All arrows:** End at circle perimeter (not center), arrowhead via SVG `<marker>` definition.

**Function signature:**
```ts
function computeTransitionPath(
  source: AutomatonState,
  target: AutomatonState,
  isBidirectional: boolean,
  stateRadius: number
): { path: string; labelPosition: Position; labelAngle: number }
```

### `useSimulation.ts`

Wraps the simulation store with automaton-aware logic.

**`step()`:**
1. If status is not 'running', return
2. Read `input[currentIndex]`
3. Find transition from `currentStateIds[0]` with matching symbol
4. If no transition found: set status to 'stuck'
5. Else: push history entry, update currentStateIds, increment index
6. If `currentIndex >= input.length`: set status to 'accepted' if current state isAccept, else 'rejected'

**`stepBack()`:**
1. Pop last history entry
2. Restore currentStateIds to `[history.last.stateId]`
3. Decrement currentIndex
4. Set status back to 'running'

---

## Arrow Geometry Details (`utils/geometry.ts`)

### Required Functions

```ts
// Basic vector operations
function add(a: Position, b: Position): Position
function subtract(a: Position, b: Position): Position
function scale(v: Position, s: number): Position
function length(v: Position): number
function normalize(v: Position): Position
function perpendicular(v: Position): Position  // rotates 90deg CCW
function distance(a: Position, b: Position): number

// Circle-line intersection: point on circle boundary along direction
function circleIntersection(center: Position, radius: number, direction: Position): Position

// Quadratic bezier point at t
function quadraticBezierPoint(p0: Position, p1: Position, p2: Position, t: number): Position
```

### Arrow Rendering Constants

```ts
const STATE_RADIUS = 30           // radius of state circles
const SELF_LOOP_RADIUS = 25       // radius of self-loop arc
const CURVE_OFFSET = 40           // perpendicular offset for bidirectional curves
const ARROWHEAD_SIZE = 10         // size of arrowhead marker
const LABEL_OFFSET = 15           // offset of label from path
const START_ARROW_LENGTH = 40     // length of the start state indicator arrow
```

---

## Theming (`assets/css/main.css`)

### CSS Custom Properties

```css
:root {
  /* Canvas */
  --color-bg: #ffffff;
  --color-grid: #e5e7eb;
  --color-grid-major: #d1d5db;

  /* State nodes */
  --color-state-fill: #ffffff;
  --color-state-stroke: #374151;
  --color-state-text: #111827;
  --color-state-selected: #3b82f6;
  --color-state-accept-ring: #374151;

  /* Transitions */
  --color-transition-stroke: #6b7280;
  --color-transition-text: #374151;
  --color-transition-active: #3b82f6;

  /* Simulation */
  --color-sim-current: #22c55e;
  --color-sim-accepted: #22c55e;
  --color-sim-rejected: #ef4444;
  --color-sim-stuck: #f59e0b;

  /* UI panels */
  --color-panel-bg: #f9fafb;
  --color-panel-border: #e5e7eb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-input-bg: #ffffff;
  --color-input-border: #d1d5db;
  --color-button-bg: #3b82f6;
  --color-button-text: #ffffff;
  --color-button-danger: #ef4444;

  /* Typography */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-sans: 'Inter', system-ui, sans-serif;
}

.dark {
  --color-bg: #1a1a2e;
  --color-grid: #2a2a3e;
  --color-grid-major: #3a3a4e;

  --color-state-fill: #2a2a3e;
  --color-state-stroke: #a5b4fc;
  --color-state-text: #e2e8f0;
  --color-state-selected: #818cf8;
  --color-state-accept-ring: #a5b4fc;

  --color-transition-stroke: #94a3b8;
  --color-transition-text: #cbd5e1;
  --color-transition-active: #818cf8;

  --color-sim-current: #4ade80;
  --color-sim-accepted: #4ade80;
  --color-sim-rejected: #f87171;
  --color-sim-stuck: #fbbf24;

  --color-panel-bg: #16213e;
  --color-panel-border: #2a2a3e;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-input-bg: #1a1a2e;
  --color-input-border: #3a3a4e;
  --color-button-bg: #6366f1;
  --color-button-text: #ffffff;
  --color-button-danger: #f87171;
}
```

---

## Key Interactions (Detailed)

### Canvas Interactions

| Action | Behavior |
|---|---|
| Double-click empty canvas | Add new state at cursor world position, auto-named `qN` |
| Click on state | Select it, open StateEditor panel |
| Click on empty canvas | Deselect everything, close editor |
| Drag on state | Reposition state, arrows follow reactively |
| Drag on empty canvas | Pan the viewport |
| Scroll wheel | Zoom toward cursor position |
| Delete key (with state selected) | Remove selected state and its transitions |
| Escape key | Deselect everything |

### Editor Panel Interactions

| Action | Behavior |
|---|---|
| Edit state name field | Update state name (live) |
| Toggle "Start State" | Set this state as start (unsets previous) |
| Toggle "Accept State" | Toggle accept status |
| Click "Add Transition" | Add new row with target dropdown + symbols input |
| Select target in dropdown | Set transition target |
| Edit symbols field | Comma-separated symbols, e.g. "a, b" |
| Click delete on transition row | Remove that transition |

### Simulation Interactions

| Action | Behavior |
|---|---|
| Type in input field | Set input string (resets simulation) |
| Click Step | Advance one symbol |
| Click Step Back | Go back one step |
| Click Run | Run to completion |
| Click Reset | Go back to start |

---

## SVG Canvas Structure

```xml
<svg :viewBox="viewBox" @wheel="onWheel" @pointerdown="onPointerDown" ...>
  <!-- Background grid -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-grid)" stroke-width="0.5"/>
    </pattern>
    <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--color-grid-major)" stroke-width="1"/>
    </pattern>
    <!-- Arrowhead marker -->
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-transition-stroke)"/>
    </marker>
  </defs>

  <!-- Infinite grid background -->
  <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid-major)"/>

  <!-- Transition arrows (rendered below states) -->
  <TransitionArrow v-for="t in transitions" :key="t.id" :transition="t" />

  <!-- Start arrow -->
  <StartArrow v-if="startState" :state="startState" />

  <!-- State nodes (rendered on top) -->
  <StateNode v-for="s in states" :key="s.id" :state="s" />
</svg>
```

---

## Nuxt Configuration

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },

  app: {
    baseURL: '/automata-builder/',
    head: {
      title: 'Automata Builder',
      meta: [
        { name: 'description', content: 'Visual DFA builder and tester' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' }
      ]
    }
  },

  router: {
    options: { hashMode: true }
  },

  modules: ['@pinia/nuxt', '@nuxtjs/color-mode'],

  colorMode: {
    classSuffix: '',        // uses .dark not .dark-mode
    preference: 'system',
    fallback: 'light'
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-01'
})
```

---

## Implementation Phases & Progress

### Phase 1: Scaffolding
- [x] Init Nuxt 3 project with `npx nuxi init`
- [x] Install dependencies: `npm install pinia @pinia/nuxt @nuxtjs/color-mode nanoid`
- [x] Write `nuxt.config.ts` with SPA mode, modules, baseURL
- [x] Write `assets/css/main.css` with all CSS custom properties
- [x] Write `app.vue` (just `<NuxtLayout><NuxtPage/></NuxtLayout>`)
- [x] Write `layouts/default.vue` (app shell with header + main area)
- [x] Write `pages/index.vue` (placeholder with canvas area + side panel)
- [x] Verify: `npm run dev` loads and shows empty page

### Phase 2: Data Model & Stores
- [x] Write `types/automaton.ts` with all interfaces
- [x] Write `utils/ids.ts` (nanoid wrapper)
- [x] Write `utils/geometry.ts` (vector math, circle intersection, bezier)
- [x] Write `stores/automaton.ts` (full CRUD for states + transitions)
- [x] Write `stores/selection.ts` (select/deselect logic)
- [x] Write `stores/simulation.ts` (simulation state)

### Phase 3: Canvas & States
- [x] Write `composables/useCanvasInteraction.ts` (pan, zoom, screenToWorld)
- [x] Write `composables/useDragState.ts` (state dragging)
- [x] Write `components/canvas/SvgCanvas.vue` (SVG root + grid + events)
- [x] Write `components/canvas/StateNode.vue` (circle + label + accept ring)
- [x] Wire double-click-to-add-state in SvgCanvas
- [x] Wire drag-to-move in SvgCanvas/StateNode
- [x] Verify: double-click creates states, drag moves them, pan/zoom works

### Phase 4: Transitions & Arrows
- [x] Write `composables/useTransitionRouting.ts` (3-case path computation)
- [x] Write `components/canvas/TransitionArrow.vue` (path + arrowhead + label)
- [x] Write `components/canvas/StartArrow.vue` (arrow to start state)
- [x] Add SVG marker defs for arrowheads to SvgCanvas
- [ ] Verify: arrows render for self-loops, straight, and curved cases

### Phase 5: State Editor
- [x] Write `components/editor/TransitionEditor.vue` (single transition row)
- [x] Write `components/editor/StateEditor.vue` (full panel with transitions list)
- [x] Wire click-to-select on StateNode
- [x] Wire click-canvas-to-deselect in SvgCanvas
- [ ] Verify: click state -> editor opens, can add/edit/remove transitions

### Phase 6: Simulation
- [x] Write `composables/useSimulation.ts` (step, stepBack, runToEnd logic)
- [x] Write `components/simulation/SimulationPanel.vue` (input + controls + status)
- [x] Add visual feedback: highlight current state (green), active transition, input position
- [ ] Verify: enter input, step through, correct accept/reject/stuck behavior

### Phase 7: Polish
- [x] Write `components/ui/ThemeToggle.vue` (sun/moon icon)
- [x] Write `components/ui/AppHeader.vue` (title + theme toggle)
- [x] Add keyboard shortcuts (Delete to remove selected, Escape to deselect)
- [x] Add export/import JSON functionality
- [x] Write `.github/workflows/deploy.yml` for GitHub Pages
- [x] Write `public/.nojekyll`
- [ ] Final verification: full workflow test

---

## Resuming Work

When picking up this project in a new session:

1. **Check progress:** Read this file's checklist to see what's done
2. **Check what exists:** `ls -R CS4330/automata-builder/` to see created files
3. **Run dev server:** `cd CS4330/automata-builder && npm run dev` to test current state
4. **Continue from the next unchecked item** in the phase list above

As each item is completed, update the checklist in this file (change `[ ]` to `[x]`).

---

## Design Decisions & Rationale

1. **One Transition object per source-target pair** (not per symbol): Keeps arrow rendering simple - one arrow per pair with comma-separated label. Adding a symbol to an existing pair merges into the existing Transition.

2. **`targetIds` is an array** even for DFA: Future-proofing for NFA where one symbol can lead to multiple states. DFA mode enforces `targetIds.length === 1`.

3. **SVG over Canvas API**: SVG elements are DOM nodes, so Vue reactivity works naturally. No need for manual render loops. Performance is fine for typical automata (< 50 states).

4. **Pan/zoom via viewBox manipulation**: Simpler than CSS transforms. The SVG `viewBox` attribute naturally handles coordinate transformation.

5. **Hash mode router**: Required for GitHub Pages static hosting (no server-side rewrites).

6. **No drag-to-create-transition**: Transitions are created via the editor panel (select source state, add transition, pick target from dropdown). This is simpler to implement and less error-prone than drag-between-states UX.
