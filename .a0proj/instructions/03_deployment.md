# Agent Browser Dev — Deployment

## Deploy Script
```bash
bash deploy.sh <A0_ROOT>
```

## Targets
| Target | Command |
|--------|----------|
| Emichi (from host) | `bash deploy.sh ~/agent-zero/emichi` |
| Vanja (from host) | `bash deploy.sh ~/agent-zero/vanja` |
| Self (from container) | `bash deploy.sh /a0` |

## What deploy.sh Does
1. Installs CLI globally via `npm install -g .` (or link)
2. Copies `a0/agents/browser/` → `<A0_ROOT>/prompts/default/agents/browser/`
3. Copies `a0/prompts/` → `<A0_ROOT>/prompts/default/`

## Full Deploy Workflow
```bash
cd /a0/usr/projects/agent_browser_dev
npm install --ignore-scripts
npx tsc                    # Build TypeScript → dist/
bash deploy.sh /a0         # Deploy to this instance
```

## Verification
1. Check CLI installed: `agent-browser --version`
2. Check agent profile exists in target prompts directory
3. Test browser subordinate in Agent Zero
4. Verify patched behaviors (AJAX awareness, storage fix)

## Notes
- Always rebuild (`npx tsc`) before deploying after src/ changes
- A0 integration files (a0/) do not need a build step
- Restart Agent Zero after deploying prompt/agent changes
