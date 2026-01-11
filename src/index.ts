#!/usr/bin/env node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { send, setDebug, setSession, getSession } from './client.js';
import type { Response } from './types.js';

// ============================================================================
// Utilities
// ============================================================================

function listSessions(): string[] {
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    const sessions: string[] = [];
    for (const file of files) {
      const match = file.match(/^agent-browser-(.+)\.pid$/);
      if (match) {
        const pidFile = path.join(tmpDir, file);
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          process.kill(pid, 0);
          sessions.push(match[1]);
        } catch {
          /* Process not running */
        }
      }
    }
    return sessions;
  } catch {
    return [];
  }
}

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const c = (color: keyof typeof colors, text: string) => `${colors[color]}${text}${colors.reset}`;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function err(msg: string): never {
  console.error(c('red', 'Error:'), msg);
  process.exit(1);
}

// ============================================================================
// Help
// ============================================================================

function printHelp(): void {
  console.log(`
${c('bold', 'agent-browser')} - headless browser automation for AI agents

${c('yellow', 'Usage:')} agent-browser <command> [options]

${c('yellow', 'Core Commands:')}
  ${c('cyan', 'open')} <url>                 Navigate to URL
  ${c('cyan', 'click')} <sel>                Click element
  ${c('cyan', 'type')} <sel> <text>          Type into element
  ${c('cyan', 'fill')} <sel> <text>          Clear and fill
  ${c('cyan', 'press')} <key>                Press key (Enter, Tab, Control+a)
  ${c('cyan', 'hover')} <sel>                Hover element
  ${c('cyan', 'select')} <sel> <val>         Select dropdown option
  ${c('cyan', 'scroll')} <dir> [px]          Scroll (up/down/left/right)
  ${c('cyan', 'wait')} <sel|ms>              Wait for element or time
  ${c('cyan', 'screenshot')} [path]          Take screenshot
  ${c('cyan', 'snapshot')}                   Accessibility tree (for AI)
  ${c('cyan', 'eval')} <js>                  Run JavaScript
  ${c('cyan', 'close')}                      Close browser

${c('yellow', 'Get Info:')}  agent-browser get <what> [selector]
  text, html, value, attr, title, url, count, box

${c('yellow', 'Check State:')}  agent-browser is <what> <selector>
  visible, enabled, checked

${c('yellow', 'Find Elements:')}  agent-browser find <locator> <action> [value]
  role, text, label, placeholder, alt, title, testid, first, last, nth

${c('yellow', 'Mouse:')}  agent-browser mouse <action> [args]
  move <x> <y>, down, up, wheel <dy>

${c('yellow', 'Storage:')}
  ${c('cyan', 'cookies')} [get|set|clear]    Manage cookies
  ${c('cyan', 'storage')} <local|session>    Manage web storage

${c('yellow', 'Browser:')}  agent-browser set <setting> [value]
  viewport, device, geo, offline, headers, credentials

${c('yellow', 'Network:')}  agent-browser network <action>
  route, unroute, requests

${c('yellow', 'Tabs:')}
  ${c('cyan', 'tab')} [new|list|close|<n>]   Manage tabs

${c('yellow', 'Debug:')}
  ${c('cyan', 'trace')} start|stop <path>    Record trace
  ${c('cyan', 'console')}                    View console logs
  ${c('cyan', 'errors')}                     View page errors

${c('yellow', 'Options:')}
  --session <name>    Isolated session (or AGENT_BROWSER_SESSION env)
  --json              JSON output
  --full, -f          Full page screenshot
  --headed            Show browser window (not headless)
  --debug             Debug output

${c('yellow', 'Examples:')}
  agent-browser open example.com
  agent-browser click "#submit"
  agent-browser fill "#email" "test@example.com"
  agent-browser get text "h1"
  agent-browser is visible ".modal"
  agent-browser find role button click --name Submit
  agent-browser wait 2000
  agent-browser wait --load networkidle
`);
}

// ============================================================================
// Response Printing
// ============================================================================

function printResponse(response: Response, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(response));
    return;
  }

  if (!response.success) {
    console.error(c('red', '✗ Error:'), response.error);
    process.exit(1);
  }

  const data = response.data as Record<string, unknown>;

  if (data.url && data.title) {
    console.log(c('green', '✓'), c('bold', data.title as string));
    console.log(c('dim', `  ${data.url}`));
  } else if (data.text !== undefined) {
    console.log(data.text ?? c('dim', 'null'));
  } else if (data.html !== undefined) {
    console.log(data.html);
  } else if (data.value !== undefined) {
    console.log(data.value ?? c('dim', 'null'));
  } else if (data.result !== undefined) {
    const result = data.result;
    console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
  } else if (data.snapshot) {
    console.log(data.snapshot);
  } else if (data.visible !== undefined) {
    console.log(data.visible ? c('green', 'true') : c('red', 'false'));
  } else if (data.enabled !== undefined) {
    console.log(data.enabled ? c('green', 'true') : c('red', 'false'));
  } else if (data.checked !== undefined) {
    console.log(data.checked ? c('green', 'true') : c('red', 'false'));
  } else if (data.count !== undefined) {
    console.log(data.count);
  } else if (data.box) {
    const box = data.box as { x: number; y: number; width: number; height: number };
    console.log(`x:${box.x} y:${box.y} w:${box.width} h:${box.height}`);
  } else if (data.url) {
    console.log(data.url);
  } else if (data.title) {
    console.log(data.title);
  } else if (data.base64) {
    console.log(c('green', '✓'), 'Screenshot captured');
  } else if (data.path) {
    console.log(c('green', '✓'), `Saved: ${data.path}`);
  } else if (data.cookies) {
    const cookies = data.cookies as Array<{ name: string; value: string }>;
    if (cookies.length === 0) console.log(c('dim', 'No cookies'));
    else cookies.forEach((ck) => console.log(`${c('cyan', ck.name)}: ${ck.value}`));
  } else if (data.tabs) {
    const tabs = data.tabs as Array<{ index: number; url: string; title: string; active: boolean }>;
    tabs.forEach((t) => {
      const marker = t.active ? c('green', '→') : ' ';
      console.log(`${marker} [${t.index}] ${t.title || c('dim', '(untitled)')}`);
      if (t.url) console.log(c('dim', `     ${t.url}`));
    });
  } else if (data.index !== undefined && data.total !== undefined) {
    console.log(c('green', '✓'), `Tab ${data.index} (${data.total} total)`);
  } else if (data.messages) {
    const msgs = data.messages as Array<{ type: string; text: string }>;
    if (msgs.length === 0) console.log(c('dim', 'No messages'));
    else
      msgs.forEach((m) => {
        const col = m.type === 'error' ? 'red' : m.type === 'warning' ? 'yellow' : 'dim';
        console.log(`${c(col, `[${m.type}]`)} ${m.text}`);
      });
  } else if (data.errors) {
    const errs = data.errors as Array<{ message: string }>;
    if (errs.length === 0) console.log(c('dim', 'No errors'));
    else errs.forEach((e) => console.log(c('red', '✗'), e.message));
  } else if (data.requests) {
    const reqs = data.requests as Array<{ method: string; url: string }>;
    if (reqs.length === 0) console.log(c('dim', 'No requests'));
    else reqs.forEach((r) => console.log(`${c('cyan', r.method)} ${r.url}`));
  } else if (data.moved) {
    console.log(c('green', '✓'), `Moved to (${data.x}, ${data.y})`);
  } else if (data.body !== undefined && data.status !== undefined) {
    // Response body
    console.log(c('green', '✓'), `${data.status} ${data.url}`);
    console.log(typeof data.body === 'object' ? JSON.stringify(data.body, null, 2) : data.body);
  } else if (data.filename) {
    // Download
    console.log(c('green', '✓'), `Downloaded: ${data.filename}`);
    console.log(c('dim', `  Path: ${data.path}`));
  } else if (data.inserted) {
    console.log(c('green', '✓'), 'Text inserted');
  } else if (data.key) {
    console.log(c('green', '✓'), `Key ${data.down ? 'down' : 'up'}: ${data.key}`);
  } else if (data.note) {
    console.log(c('yellow', '⚠'), data.note);
  } else if (data.closed === true) {
    console.log(c('green', '✓'), 'Browser closed');
  } else if (data.launched) {
    console.log(c('green', '✓'), 'Browser launched');
  } else if (data.state) {
    console.log(c('green', '✓'), `Load state: ${data.state}`);
  } else if (
    Object.keys(data).some((k) =>
      [
        'clicked',
        'typed',
        'filled',
        'pressed',
        'hovered',
        'scrolled',
        'selected',
        'waited',
        'checked',
        'unchecked',
        'focused',
        'set',
        'cleared',
        'started',
        'down',
        'up',
      ].includes(k)
    )
  ) {
    console.log(c('green', '✓'), 'Done');
  } else {
    console.log(c('green', '✓'), JSON.stringify(data));
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleGet(args: string[], id: string): Promise<Record<string, unknown>> {
  const what = args[0];
  const selector = args[1];

  switch (what) {
    case 'text':
      if (!selector) err('Selector required: agent-browser get text <selector>');
      return { id, action: 'gettext', selector };
    case 'html':
      if (!selector) err('Selector required: agent-browser get html <selector>');
      return { id, action: 'innerhtml', selector };
    case 'value':
      if (!selector) err('Selector required: agent-browser get value <selector>');
      return { id, action: 'inputvalue', selector };
    case 'attr':
      if (!selector || !args[2]) err('Usage: agent-browser get attr <selector> <attribute>');
      return { id, action: 'getattribute', selector, attribute: args[2] };
    case 'title':
      return { id, action: 'title' };
    case 'url':
      return { id, action: 'url' };
    case 'count':
      if (!selector) err('Selector required: agent-browser get count <selector>');
      return { id, action: 'count', selector };
    case 'box':
      if (!selector) err('Selector required: agent-browser get box <selector>');
      return { id, action: 'boundingbox', selector };
    default:
      err(`Unknown: agent-browser get ${what}. Options: text, html, value, attr, title, url, count, box`);
  }
}

async function handleIs(args: string[], id: string): Promise<Record<string, unknown>> {
  const what = args[0];
  const selector = args[1];

  if (!selector) err(`Selector required: agent-browser is ${what} <selector>`);

  switch (what) {
    case 'visible':
      return { id, action: 'isvisible', selector };
    case 'enabled':
      return { id, action: 'isenabled', selector };
    case 'checked':
      return { id, action: 'ischecked', selector };
    default:
      err(`Unknown: agent-browser is ${what}. Options: visible, enabled, checked`);
  }
}

async function handleFind(
  args: string[],
  id: string,
  flags: Flags
): Promise<Record<string, unknown>> {
  const locator = args[0];
  const value = args[1];
  const subaction = args[2] || 'click';
  const fillValue = args[3];

  if (!value) err(`Value required: agent-browser find ${locator} <value> <action>`);

  const exact = flags.exact;
  const name = flags.name;

  switch (locator) {
    case 'role':
      return { id, action: 'getbyrole', role: value, subaction, value: fillValue, name, exact };
    case 'text':
      return { id, action: 'getbytext', text: value, subaction, exact };
    case 'label':
      return { id, action: 'getbylabel', label: value, subaction, value: fillValue, exact };
    case 'placeholder':
      return {
        id,
        action: 'getbyplaceholder',
        placeholder: value,
        subaction,
        value: fillValue,
        exact,
      };
    case 'alt':
      return { id, action: 'getbyalttext', text: value, subaction, exact };
    case 'title':
      return { id, action: 'getbytitle', text: value, subaction, exact };
    case 'testid':
      return { id, action: 'getbytestid', testId: value, subaction, value: fillValue };
    case 'first':
      return { id, action: 'nth', selector: value, index: 0, subaction, value: fillValue };
    case 'last':
      return { id, action: 'nth', selector: value, index: -1, subaction, value: fillValue };
    case 'nth': {
      const idx = parseInt(value, 10);
      const sel = args[2];
      const act = args[3] || 'click';
      const val = args[4];
      if (isNaN(idx) || !sel) err('Usage: agent-browser find nth <index> <selector> <action>');
      return { id, action: 'nth', selector: sel, index: idx, subaction: act, value: val };
    }
    default:
      err(
        `Unknown locator: ${locator}. Options: role, text, label, placeholder, alt, title, testid, first, last, nth`
      );
  }
}

async function handleMouse(args: string[], id: string): Promise<Record<string, unknown>> {
  const action = args[0];

  switch (action) {
    case 'move': {
      const x = parseInt(args[1], 10);
      const y = parseInt(args[2], 10);
      if (isNaN(x) || isNaN(y)) err('Usage: agent-browser mouse move <x> <y>');
      return { id, action: 'mousemove', x, y };
    }
    case 'down':
      return { id, action: 'mousedown', button: args[1] || 'left' };
    case 'up':
      return { id, action: 'mouseup', button: args[1] || 'left' };
    case 'wheel': {
      const dy = parseInt(args[1], 10) || 100;
      const dx = parseInt(args[2], 10) || 0;
      return { id, action: 'wheel', deltaY: dy, deltaX: dx };
    }
    default:
      err(`Unknown: agent-browser mouse ${action}. Options: move, down, up, wheel`);
  }
}

async function handleSet(args: string[], id: string): Promise<Record<string, unknown>> {
  const setting = args[0];

  switch (setting) {
    case 'viewport': {
      const w = parseInt(args[1], 10);
      const h = parseInt(args[2], 10);
      if (isNaN(w) || isNaN(h)) err('Usage: agent-browser set viewport <width> <height>');
      return { id, action: 'viewport', width: w, height: h };
    }
    case 'device':
      if (!args[1]) err('Usage: agent-browser set device <name>');
      return { id, action: 'device', device: args[1] };
    case 'geo':
    case 'geolocation': {
      const lat = parseFloat(args[1]);
      const lng = parseFloat(args[2]);
      if (isNaN(lat) || isNaN(lng)) err('Usage: agent-browser set geo <lat> <lng>');
      return { id, action: 'geolocation', latitude: lat, longitude: lng };
    }
    case 'offline':
      return { id, action: 'offline', offline: args[1] !== 'off' && args[1] !== 'false' };
    case 'headers':
      if (!args[1]) err('Usage: agent-browser set headers <json>');
      try {
        return { id, action: 'headers', headers: JSON.parse(args[1]) };
      } catch {
        err('Invalid JSON for headers');
      }
      break;
    case 'credentials':
    case 'auth':
      if (!args[1] || !args[2]) err('Usage: agent-browser set credentials <user> <pass>');
      return { id, action: 'credentials', username: args[1], password: args[2] };
    case 'media': {
      const colorScheme = args.includes('dark')
        ? 'dark'
        : args.includes('light')
          ? 'light'
          : undefined;
      const media = args.includes('print')
        ? 'print'
        : args.includes('screen')
          ? 'screen'
          : undefined;
      return { id, action: 'emulatemedia', colorScheme, media };
    }
    default:
      err(
        `Unknown: agent-browser set ${setting}. Options: viewport, device, geo, offline, headers, credentials, media`
      );
  }
  return {};
}

async function handleNetwork(
  args: string[],
  id: string,
  allArgs: string[]
): Promise<Record<string, unknown>> {
  const action = args[0];

  switch (action) {
    case 'route': {
      const url = args[1];
      if (!url) err('Usage: agent-browser network route <url> [--abort|--body <json>]');
      const abort = allArgs.includes('--abort');
      const bodyIdx = allArgs.indexOf('--body');
      const body = bodyIdx !== -1 ? allArgs[bodyIdx + 1] : undefined;
      return {
        id,
        action: 'route',
        url,
        abort,
        response: body ? { body, contentType: 'application/json' } : undefined,
      };
    }
    case 'unroute':
      return { id, action: 'unroute', url: args[1] };
    case 'requests': {
      const clear = allArgs.includes('--clear');
      const filterIdx = allArgs.indexOf('--filter');
      const filter = filterIdx !== -1 ? allArgs[filterIdx + 1] : undefined;
      return { id, action: 'requests', clear, filter };
    }
    default:
      err(`Unknown: agent-browser network ${action}. Options: route, unroute, requests`);
  }
  return {};
}

async function handleStorage(args: string[], id: string): Promise<Record<string, unknown>> {
  const type = args[0] as 'local' | 'session';
  const sub = args[1];

  if (type !== 'local' && type !== 'session') {
    err('Usage: agent-browser storage <local|session> [get|set|clear] [key] [value]');
  }

  if (sub === 'set') {
    if (!args[2] || !args[3]) err(`Usage: agent-browser storage ${type} set <key> <value>`);
    return { id, action: 'storage_set', type, key: args[2], value: args[3] };
  } else if (sub === 'clear') {
    return { id, action: 'storage_clear', type };
  } else {
    // get (default)
    return { id, action: 'storage_get', type, key: sub };
  }
}

async function handleCookies(args: string[], id: string): Promise<Record<string, unknown>> {
  const sub = args[0];

  if (sub === 'set') {
    if (!args[1]) err('Usage: agent-browser cookies set <json>');
    try {
      return { id, action: 'cookies_set', cookies: JSON.parse(args[1]) };
    } catch {
      err('Invalid JSON for cookies');
    }
  } else if (sub === 'clear') {
    return { id, action: 'cookies_clear' };
  } else {
    return { id, action: 'cookies_get' };
  }
  return {};
}

async function handleTab(args: string[], id: string): Promise<Record<string, unknown>> {
  const sub = args[0];

  if (sub === 'new') {
    return { id, action: 'tab_new' };
  } else if (sub === 'list' || sub === 'ls' || !sub) {
    return { id, action: 'tab_list' };
  } else if (sub === 'close') {
    const idx = args[1] !== undefined ? parseInt(args[1], 10) : undefined;
    return { id, action: 'tab_close', index: idx };
  } else {
    const idx = parseInt(sub, 10);
    if (isNaN(idx)) err(`Unknown: agent-browser tab ${sub}. Options: new, list, close, <index>`);
    return { id, action: 'tab_switch', index: idx };
  }
}

async function handleTrace(args: string[], id: string): Promise<Record<string, unknown>> {
  const sub = args[0];

  if (sub === 'start') {
    return { id, action: 'trace_start', screenshots: true, snapshots: true };
  } else if (sub === 'stop') {
    if (!args[1]) err('Usage: agent-browser trace stop <path>');
    return { id, action: 'trace_stop', path: args[1] };
  } else {
    err('Usage: agent-browser trace start|stop');
  }
  return {};
}

async function handleState(args: string[], id: string): Promise<Record<string, unknown>> {
  const sub = args[0];
  const path = args[1];

  if (sub === 'save') {
    if (!path) err('Usage: agent-browser state save <path>');
    return { id, action: 'state_save', path };
  } else if (sub === 'load') {
    if (!path) err('Usage: agent-browser state load <path>');
    return { id, action: 'state_load', path };
  } else {
    err('Usage: agent-browser state save|load <path>');
  }
  return {};
}

// ============================================================================
// Flags Parser
// ============================================================================

interface Flags {
  json: boolean;
  full: boolean;
  text: boolean;
  debug: boolean;
  headed: boolean;
  session: string;
  selector?: string;
  name?: string;
  exact: boolean;
  url?: string;
  load?: string;
  fn?: string;
}

function parseFlags(args: string[]): { flags: Flags; cleanArgs: string[] } {
  const flags: Flags = {
    json: false,
    full: false,
    text: false,
    debug: false,
    headed: false,
    session: process.env.AGENT_BROWSER_SESSION || 'default',
    exact: false,
  };

  const cleanArgs: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--full' || arg === '-f') {
      flags.full = true;
    } else if (arg === '--text' || arg === '-t') {
      flags.text = true;
    } else if (arg === '--debug') {
      flags.debug = true;
    } else if (arg === '--headed' || arg === '--head') {
      flags.headed = true;
    } else if (arg === '--exact') {
      flags.exact = true;
    } else if (arg === '--session' && args[i + 1]) {
      flags.session = args[++i];
    } else if ((arg === '--selector' || arg === '-s') && args[i + 1]) {
      flags.selector = args[++i];
    } else if ((arg === '--name' || arg === '-n') && args[i + 1]) {
      flags.name = args[++i];
    } else if (arg === '--url' && args[i + 1]) {
      flags.url = args[++i];
    } else if (arg === '--load' && args[i + 1]) {
      flags.load = args[++i];
    } else if ((arg === '--fn' || arg === '--function') && args[i + 1]) {
      flags.fn = args[++i];
    } else if (!arg.startsWith('-')) {
      cleanArgs.push(arg);
    }
    i++;
  }

  return { flags, cleanArgs };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { flags, cleanArgs } = parseFlags(rawArgs);

  if (flags.debug) setDebug(true);
  setSession(flags.session);

  if (cleanArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const command = cleanArgs[0];
  const args = cleanArgs.slice(1);
  const id = genId();

  let cmd: Record<string, unknown>;

  switch (command) {
    // === Core Commands ===
    case 'open':
    case 'goto':
    case 'navigate': {
      if (!args[0]) err('URL required');
      const url = args[0].startsWith('http') ? args[0] : `https://${args[0]}`;
      // If --headed, launch with headless=false first
      if (flags.headed) {
        await send({ id: genId(), action: 'launch', headless: false });
      }
      cmd = { id, action: 'navigate', url };
      break;
    }

    case 'click':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'click', selector: args[0] };
      break;

    case 'dblclick':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'dblclick', selector: args[0] };
      break;

    case 'type':
      if (!args[0] || !args[1]) err('Usage: agent-browser type <selector> <text>');
      cmd = { id, action: 'type', selector: args[0], text: args.slice(1).join(' ') };
      break;

    case 'fill':
      if (!args[0] || !args[1]) err('Usage: agent-browser fill <selector> <text>');
      cmd = { id, action: 'fill', selector: args[0], value: args.slice(1).join(' ') };
      break;

    case 'press':
    case 'key':
      if (!args[0]) err('Key required');
      cmd = { id, action: 'press', key: args[0] };
      break;

    case 'keydown':
      if (!args[0]) err('Key required');
      cmd = { id, action: 'keydown', key: args[0] };
      break;

    case 'keyup':
      if (!args[0]) err('Key required');
      cmd = { id, action: 'keyup', key: args[0] };
      break;

    case 'hover':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'hover', selector: args[0] };
      break;

    case 'focus':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'focus', selector: args[0] };
      break;

    case 'check':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'check', selector: args[0] };
      break;

    case 'uncheck':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'uncheck', selector: args[0] };
      break;

    case 'select':
      if (!args[0] || !args[1]) err('Usage: agent-browser select <selector> <value>');
      cmd = { id, action: 'select', selector: args[0], value: args[1] };
      break;

    case 'drag':
      if (!args[0] || !args[1]) err('Usage: agent-browser drag <source> <target>');
      cmd = { id, action: 'drag', source: args[0], target: args[1] };
      break;

    case 'upload':
      if (!args[0] || !args[1]) err('Usage: agent-browser upload <selector> <files...>');
      cmd = { id, action: 'upload', selector: args[0], files: args.slice(1) };
      break;

    case 'scroll': {
      const dir = args[0] || 'down';
      const amount = parseInt(args[1], 10) || 300;
      cmd = { id, action: 'scroll', direction: dir, amount, selector: flags.selector };
      break;
    }

    case 'wait': {
      const target = args[0];
      // Check for flags
      if (flags.fn) {
        cmd = { id, action: 'waitforfunction', expression: flags.fn };
      } else if (flags.url) {
        cmd = { id, action: 'waitforurl', url: flags.url };
      } else if (flags.load) {
        cmd = { id, action: 'waitforloadstate', state: flags.load };
      } else if (flags.text) {
        if (!target) err('Text required with --text flag');
        cmd = { id, action: 'wait', text: target };
      } else if (target && /^\d+$/.test(target)) {
        cmd = { id, action: 'wait', timeout: parseInt(target, 10) };
      } else if (target) {
        cmd = { id, action: 'wait', selector: target };
      } else {
        err('Usage: agent-browser wait <selector|ms|--text|--url|--load|--fn>');
      }
      break;
    }

    case 'screenshot': {
      const path = args[0];
      cmd = { id, action: 'screenshot', path, fullPage: flags.full, selector: flags.selector };
      break;
    }

    case 'pdf':
      if (!args[0]) err('Path required');
      cmd = { id, action: 'pdf', path: args[0] };
      break;

    case 'snapshot':
      cmd = { id, action: 'snapshot' };
      break;

    case 'eval':
      if (!args[0]) err('Script required');
      cmd = { id, action: 'evaluate', script: args.join(' ') };
      break;

    case 'close':
    case 'quit':
    case 'exit':
      cmd = { id, action: 'close' };
      break;

    // === Navigation ===
    case 'back':
      cmd = { id, action: 'back' };
      break;

    case 'forward':
      cmd = { id, action: 'forward' };
      break;

    case 'reload':
      cmd = { id, action: 'reload' };
      break;

    // === Grouped Commands ===
    case 'get':
      cmd = await handleGet(args, id);
      break;

    case 'is':
      cmd = await handleIs(args, id);
      break;

    case 'find':
      cmd = await handleFind(args, id, flags);
      break;

    case 'mouse':
      cmd = await handleMouse(args, id);
      break;

    case 'set':
      cmd = await handleSet(args, id);
      break;

    case 'network':
      cmd = await handleNetwork(args, id, rawArgs);
      break;

    case 'storage':
      cmd = await handleStorage(args, id);
      break;

    case 'cookies':
      cmd = await handleCookies(args, id);
      break;

    case 'tab':
      cmd = await handleTab(args, id);
      break;

    case 'window':
      if (args[0] === 'new') {
        cmd = { id, action: 'window_new' };
      } else {
        err('Usage: agent-browser window new');
      }
      break;

    case 'frame':
      if (!args[0]) err('Selector required');
      if (args[0] === 'main') {
        cmd = { id, action: 'mainframe' };
      } else {
        cmd = { id, action: 'frame', selector: args[0] };
      }
      break;

    case 'dialog':
      if (args[0] === 'accept') {
        cmd = { id, action: 'dialog', response: 'accept', promptText: args[1] };
      } else if (args[0] === 'dismiss') {
        cmd = { id, action: 'dialog', response: 'dismiss' };
      } else {
        err('Usage: agent-browser dialog accept|dismiss');
      }
      break;

    case 'trace':
      cmd = await handleTrace(args, id);
      break;

    case 'state':
      cmd = await handleState(args, id);
      break;

    case 'console':
      cmd = { id, action: 'console', clear: rawArgs.includes('--clear') };
      break;

    case 'errors':
      cmd = { id, action: 'errors', clear: rawArgs.includes('--clear') };
      break;

    case 'highlight':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'highlight', selector: args[0] };
      break;

    case 'scrollintoview':
    case 'scrollinto':
      if (!args[0]) err('Selector required');
      cmd = { id, action: 'scrollintoview', selector: args[0] };
      break;

    case 'initscript':
      if (!args[0]) err('Script required');
      cmd = { id, action: 'addinitscript', script: args.join(' ') };
      break;

    case 'inserttext':
    case 'insert':
      if (!args[0]) err('Text required');
      cmd = { id, action: 'inserttext', text: args.join(' ') };
      break;

    case 'multiselect':
      if (!args[0] || args.length < 2)
        err('Usage: agent-browser multiselect <selector> <value1> [value2...]');
      cmd = { id, action: 'multiselect', selector: args[0], values: args.slice(1) };
      break;

    case 'download':
      cmd = { id, action: 'waitfordownload', path: args[0] };
      break;

    case 'response':
      if (!args[0]) err('URL pattern required');
      cmd = { id, action: 'responsebody', url: args[0] };
      break;

    case 'session':
      if (args[0] === 'list' || args[0] === 'ls') {
        const sessions = listSessions();
        const current = getSession();
        if (sessions.length === 0) {
          console.log(c('dim', 'No active sessions'));
        } else {
          sessions.forEach((s) => {
            const marker = s === current ? c('green', '→') : ' ';
            console.log(`${marker} ${c('cyan', s)}`);
          });
        }
        process.exit(0);
      } else {
        console.log(c('cyan', getSession()));
        process.exit(0);
      }

    // === Legacy aliases for backwards compatibility ===
    case 'url':
      cmd = { id, action: 'url' };
      break;
    case 'title':
      cmd = { id, action: 'title' };
      break;
    case 'gettext':
      cmd = { id, action: 'gettext', selector: args[0] };
      break;
    case 'extract':
      cmd = { id, action: 'content', selector: args[0] };
      break;

    default:
      console.error(c('red', 'Unknown command:'), command);
      console.error(c('dim', 'Run: agent-browser --help'));
      process.exit(1);
  }

  try {
    const response = await send(cmd);
    printResponse(response, flags.json);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (flags.json) {
      console.log(JSON.stringify({ id, success: false, error: message }));
    } else {
      console.error(c('red', '✗ Error:'), message);
    }
    process.exit(1);
  }
}

main();
