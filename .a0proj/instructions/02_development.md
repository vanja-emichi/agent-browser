# Agent Browser Dev — Development

## Working Directory
- **Container:** `/a0/usr/projects/agent_browser_dev/`
- **Host:** `~/agent-zero/vanja/usr/projects/agent_browser_dev/`

## Making Changes

### Editing TypeScript source
1. Edit files in `src/` (mainly actions.ts, browser.ts, snapshot.ts)
2. Build: `npx tsc`
3. Output goes to `dist/`
4. Deploy and test

### Editing A0 integration
1. Edit files in `a0/` (agent profile, prompts, extensions)
2. No build step needed — deploy copies files directly
3. Restart Agent Zero to pick up changes

## Build
```bash
cd /a0/usr/projects/agent_browser_dev
npm install --ignore-scripts
npx tsc
```

## Testing
- After build, test CLI directly: `agent-browser --help`
- Test browser actions in Agent Zero via browser subordinate
- Check for TypeScript errors: `npx tsc --noEmit`

## Important Files
| File | Role |
|------|------|
| `src/actions.ts` | Core browser actions — most patches here |
| `src/browser.ts` | Browser lifecycle, storage fix |
| `src/snapshot.ts` | DOM snapshot, element detection |
| `a0/agents/browser/` | Agent Zero browser agent profile |
| `a0/prompts/` | Browser tool/agent prompts for A0 |
| `package.json` | Dependencies and CLI bin entry |
| `tsconfig.json` | TypeScript compiler config |
