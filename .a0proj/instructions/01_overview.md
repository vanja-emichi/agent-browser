# Agent Browser Dev — Overview

## Purpose
Fork of vercel-labs/agent-browser with TypeScript patches and A0 integration.
Provides headless browser automation CLI optimized for AI agents.

## Repository
- **GitHub:** https://github.com/vanja-emichi/agent-browser
- **Branch:** `emichi` (our customizations)
- **Upstream:** vercel-labs/agent-browser (branch: `main`)

## Branch Strategy
- `emichi` — our working branch with patches, always deployed
- `main` — upstream default, never commit directly
- Custom patches maintained on `emichi`, upstream merged in

## Structure
```
src/                # TypeScript source (OUR PATCHES)
├── actions.ts      # PATCHED: 17 handler fixes, AJAX awareness
├── browser.ts      # PATCHED: storage SecurityError fix
├── snapshot.ts     # PATCHED: auto-detection improvements
├── protocol.ts
├── daemon.ts
├── stream-server.ts
├── types.ts
└── *.test.ts
a0/                 # A0 INTEGRATION (OUR ADDITION)
├── agents/browser/ # Browser agent profile + extension
└── prompts/        # Browser tool prompt + agent system prompt
dist/               # Compiled JS output (built from src/)
bin/                # CLI entry point
cli/                # CLI helpers
deploy.sh           # Deploys CLI + A0 integration to target
```

## Key Patches (src/)
- **actions.ts** — 17 handler fixes, AJAX awareness, auto-detection
- **browser.ts** — storage SecurityError fix
- **snapshot.ts** — improved element auto-detection
