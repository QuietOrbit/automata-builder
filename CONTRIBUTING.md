# Contributing to Automata Builder

Thanks for your interest in contributing! This guide covers the workflow and conventions used in this project.

## Getting Started

```bash
git clone https://github.com/QuietOrbit/automata-builder.git
cd automata-builder
npm install
npm run dev
```

The dev server starts at `http://localhost:3000`.

## Branching

We use **trunk-based development**: `main` is the production branch, and all work happens on short-lived feature branches.

### Branch naming

Every branch must be linked to a GitHub issue. Use the format `type/issue-N-description`:

| Prefix | Use for |
|-----------|------------------------------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code restructuring |
| `chore/` | Build, CI, tooling changes |

Examples:
- `feat/issue-12-undo-redo`
- `fix/issue-42-arrow-offset`
- `docs/issue-7-update-readme`

**Workflow:** Create a GitHub issue first, then branch from it.

> A CI check enforces this naming convention — pushes and PRs with non-conforming branch names will fail the `"Check branch name"` status check.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/) informally:

```
type: short description

Optional longer explanation.
```

Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `style`, `perf`

Keep commits focused — one logical change per commit.

## Pull Requests

1. Create a GitHub issue for the work
2. Branch off `main` using the `type/issue-N-description` format
3. Make your changes
4. Run `npx tsc --noEmit` and `npm run build` locally to catch errors early
5. Push your branch and open a PR
6. Fill out the PR template (link the issue with `Closes #N`)
7. CI must pass (type-check + build + branch naming)
8. Wait for review from a code owner

## Code Style

This project doesn't have a linter configured yet, so please follow these conventions manually:

### TypeScript

- **Enums over string literals** — Use enums (not raw strings) as object keys, map keys, and discriminators
- **`Number.isNaN()` over `isNaN()`** — Always use the `Number.*` static methods instead of their global equivalents
- **Small functions** — Keep cognitive complexity low. Extract loops and branching into named helpers
- **JSDoc on exports** — Add JSDoc comments to all exported functions, interfaces, and types

### Vue / Nuxt

- **Pinia as source of truth** — All state lives in stores. Components read reactively from stores
- **CSS custom properties** — Reference theme variables from `assets/css/main.css`. Never hardcode colors
- **No path prefixes** — Components are globally registered by filename (`pathPrefix: false`)

### SVG / Canvas

- **Event delegation** — Canvas interactions go through the canvas wrapper component
- **Computed alphabet** — Never store the alphabet directly. It's always derived from transition symbols

## Reporting Issues

Use the issue templates when opening bugs or feature requests. They help ensure we have the context needed to triage efficiently.
