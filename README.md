# Automata Builder

A visual DFA/NFA builder and simulator for Theory of Computation courses. Construct automata on an interactive SVG canvas, define them with a formal 5-tuple, and step through input strings to test acceptance.

**[Try it live](https://quietorbit.github.io/automata-builder/)**

## Features

- **Interactive canvas** — Double-click to create states, drag to reposition, pan and zoom freely
- **Visual transitions** — Click a state to add transitions with straight, curved, and self-loop arrows rendered automatically
- **5-tuple builder** — Define automata formally with states (Q), alphabet (&Sigma;), start state (q&#8320;), accept states (F), and transition function (&delta;) via an editable table
- **Step-by-step simulation** — Run input strings one symbol at a time with visual feedback showing the current state, consumed input, and active transition
- **Multi-format export** — Export as JSON (data), SVG (vector), PNG, or JPEG
- **JSON import** — Load previously exported automata
- **Dark mode** — Automatic theme detection with manual toggle
- **Auto-layout** — Automata built from 5-tuples are automatically arranged based on graph structure (chain, layered, or circular)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm (included with Node.js)

### Install and run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build for production

```bash
npm run build      # Production build
npm run generate   # Static site generation (GitHub Pages)
npm run preview    # Preview the production build
```

## Tech Stack

- **Nuxt 3** (SPA mode, hash routing)
- **Pinia** for state management
- **Hand-rolled SVG** for canvas rendering
- **TypeScript** with strict mode
- **@nuxtjs/color-mode** for theming

## Project Structure

```
stores/           State management (automaton, selection, simulation)
composables/      Interaction logic (pan/zoom, drag, arrow geometry, simulation)
components/
  canvas/         SVG rendering (SvgCanvas, StateNode, TransitionArrow, StartArrow)
  editor/         Side panel editors (StateEditor, TransitionEditor, TupleBuilder)
  simulation/     Simulation controls (SimulationPanel)
  ui/             Header, theme toggle
utils/            Pure functions (geometry, layout, export, ID generation)
types/            TypeScript interfaces and enums
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs `nuxt generate` and deploys to GitHub Pages on push to `main`.

## License

MIT
