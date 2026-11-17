// SOLANO BAY — make.fun bounty entry "gta6-01" (build / verify / serve tool).
// Node 22, standard library only, no dependencies, no network calls.
// Usage:
//   node main.ts            verify files, syntax-check the game, serve it
//   node main.ts --check    verify only, then exit 0/1
//   node main.ts --port 8901
// The game itself is static files under game/ and plays offline in a
// desktop browser from its own files (open game/index.html directly).

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname ?? '.');
const GAME_DIR = join(ROOT, 'game');

const REQUIRED: string[] = [
  'game/index.html',
  'game/game.js',
  'game/style.css',
  'LICENSE',
  'README.md',
];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
};

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function check(): Promise<boolean> {
  let ok = true;
  console.log('SOLANO BAY — pre-flight check');
  console.log('root:', ROOT);
  for (const rel of REQUIRED) {
    const good = await exists(join(ROOT, rel));
    console.log((good ? '  [ok] ' : '  [MISSING] ') + rel);
    if (!good) ok = false;
  }
  // vendor file: supplied by the make.fun kit, copied unchanged. If the kit
  // was not available when this entry was built, this reports it honestly
  // instead of fabricating the file.
  const vendor = join(ROOT, 'vendor', 'makefun-game.ts');
  if (await exists(vendor)) {
    console.log('  [ok] vendor/makefun-game.ts (kit file, unchanged)');
  } else {
    console.log('  [MISSING] vendor/makefun-game.ts — not supplied by the bounty kit page at build time; see README.md');
    ok = false;
  }
  const shots = await readdir(join(ROOT, 'screenshots')).catch(() => []);
  const pngs = shots.filter((f: string) => f.endsWith('.png'));
  console.log(`  screenshots: ${pngs.length} png file(s) (need 3-4)`);
  if (pngs.length < 3) ok = false;

  const res = spawnSync(process.execPath, ['--check', join(GAME_DIR, 'game.js')], { encoding: 'utf-8' });
  console.log((res.status === 0 ? '  [ok] ' : '  [FAIL] ') + 'game.js syntax (node --check)');
  if (res.status !== 0) { console.log(res.stderr); ok = false; }

  const html = await readFile(join(GAME_DIR, 'index.html'), 'utf-8').catch(() => '');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('http'));
  let refsOk = true;
  for (const ref of refs) {
    const good = await exists(join(GAME_DIR, ref));
    if (!good) { console.log('  [MISSING] referenced file: ' + ref); refsOk = false; }
  }
  console.log((refsOk ? '  [ok] ' : '  [FAIL] ') + `index.html references ${refs.length} local file(s), all present`);
  if (!refsOk) ok = false;
  const external = [...html.matchAll(/(?:src|href)="https?:[^"]+"/g)];
  console.log(`  external (network) references in index.html: ${external.length} (must be 0 for offline play)`);
  if (external.length > 0) ok = false;
  console.log(ok ? 'CHECK PASSED' : 'CHECK FAILED — see missing items above');
  return ok;
}

function serve(port: number): void {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = join(GAME_DIR, path);
    if (!file.startsWith(GAME_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  server.listen(port, () => {
    console.log(`\n▶ SOLANO BAY is served at http://localhost:${port}/`);
    console.log('  Open it in desktop Chrome. Click NEW GAME, drive with WASD,');
    console.log('  press E near a car to enter/steal it. Progress saves to localStorage.');
    console.log('  (The same files also open directly: game/index.html, fully offline.)');
  });
}

const args = process.argv.slice(2);
const portArg = args.find((a) => a.startsWith('--port='));
const port = portArg ? Number(portArg.split('=')[1]) : 8901;
const ok = await check();
if (args.includes('--check')) process.exit(ok ? 0 : 1);
if (!ok) console.log('\nNote: continuing to serve anyway so the game can still be play-tested locally.');
serve(port);
