# Automata Builder

[![CI](https://github.com/QuietOrbit/automata-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/QuietOrbit/automata-builder/actions/workflows/ci.yml)
[![Deploy](https://github.com/QuietOrbit/automata-builder/actions/workflows/deploy.yml/badge.svg)](https://github.com/QuietOrbit/automata-builder/actions/workflows/deploy.yml)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Nuxt 3](https://img.shields.io/badge/Nuxt-3-00DC82?logo=nuxtdotjs&logoColor=white)](https://nuxt.com/)
[![GitHub last commit](https://img.shields.io/github/last-commit/QuietOrbit/automata-builder)](https://github.com/QuietOrbit/automata-builder/commits/main)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/5919aa70f26b41078c1db55e5c5470cd)](https://app.codacy.com/gh/QuietOrbit/automata-builder/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![GitHub issues](https://img.shields.io/github/issues/QuietOrbit/automata-builder)](https://github.com/QuietOrbit/automata-builder/issues)

A visual DFA/NFA builder and simulator for Automata Theory. Construct automata on an interactive SVG canvas, define them with a formal 5-tuple, and step through input strings to test acceptance.

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

## Contributing

Contributions are welcome! Please read the [contributing guide](CONTRIBUTING.md) before submitting a pull request.

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](LICENSE).

You are free to share and adapt this work for non-commercial purposes with appropriate attribution. See the [full license text](https://creativecommons.org/licenses/by-nc/4.0/) for details.
