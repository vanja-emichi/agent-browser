# Agent Browser Dev — Git Workflow

## Remotes
| Remote | URL | Branch |
|--------|-----|--------|
| origin | git@github.com:vanja-emichi/agent-browser.git | emichi |
| upstream | git@github.com:vercel-labs/agent-browser.git | main |

## Daily Workflow
```bash
git add -A
git commit -m "descriptive message"
git push origin emichi
```

## Upstream Sync
```bash
git fetch upstream
git merge upstream/main
# Expect conflicts in: src/actions.ts, src/browser.ts, src/snapshot.ts
# Resolve conflicts preserving our patches
npx tsc                    # Rebuild to verify
git push origin emichi
```

## Conflict Resolution
Our patched files will frequently conflict on upstream sync:
- **actions.ts** — largest patch surface, review carefully
- **browser.ts** — small patch, usually easy merge
- **snapshot.ts** — small patch, usually easy merge

Always rebuild and test after resolving conflicts.

## Commit Conventions
- `fix: actions: description` — patch fix in actions.ts
- `feat: a0: description` — A0 integration change
- `chore: sync upstream` — after upstream merge
- `build: update tsconfig` — build config changes
- `docs: update patches-reference` — documentation

## Rules
- Never push to `main` — that is upstream
- All work happens on `emichi` branch
- Keep `a0/` directory as our clean addition
- `dist/` is gitignored — always rebuild locally
