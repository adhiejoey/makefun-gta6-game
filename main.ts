// Solano Bay v1.2 — recorded rebuild
// SOLANO BAY v1.2 — make.fun bounty entry "gta6-01": build / check / serve.
// Node 22+, standard library only, no dependencies, no network calls.
//
//   node main.ts                  build the entry into /output (or $MAKEFUN_OUTPUT_DIR)
//   node main.ts --check          verify the entry (builds into a temp dir, then checks it)
//   node main.ts --serve          verify, then serve game/ locally for playtesting
//   node main.ts --port 8901      serve on a different port (default 8901)
//   node main.ts --out out        build into ./out instead of /output
//
// The build copies game/ and screenshots/ beside this file into the output
// directory and writes output/dossier.json with buildDossier from the kit's
// vendored library (vendor/makefun-game.ts, copied unchanged). The game
// itself is plain static files under game/ and plays offline in desktop
// Chrome from its own files — open game/index.html directly, or serve it.

import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = resolve(import.meta.dirname ?? '.');
const GAME_DIR = join(ROOT, 'game');
const SHOTS_DIR = join(ROOT, 'screenshots');

/* The scorer's own caps (kit gate.json): only text_max_bytes shapes the
   bytes; the other caps only refuse an entry the scorer would refuse. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const REQUIRED = ['game/index.html', 'game/game.js', 'game/style.css', 'LICENSE', 'README.md', 'vendor/makefun-game.ts'];
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function outDirFrom(args: string[]): string {
  const flag = args.find((a) => a.startsWith('--out='));
  if (flag) return resolve(flag.slice('--out='.length));
  return resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
}

/* Read a PNG's width/height out of its IHDR chunk, or a JPEG's out of its
   first SOF marker — enough to check the bounty screenshot dimensions
   without any image library. Returns null when the bytes are neither. */
function imageDims(file: string): { w: number; h: number } | null {
  const b = readFileSync(file);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      const len = b.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  return null;
}

/* Copy game/ + screenshots/ into outDir and write outDir/dossier.json.
   Returns a short summary of what was written. */
function build(outDir: string): { files: number; bytes: number; shots: string[] } {
  rmSync(join(outDir, 'game'), { recursive: true, force: true });
  rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(outDir, 'dossier.json'), { force: true });
  cpSync(GAME_DIR, join(outDir, 'game'), { recursive: true });
  cpSync(SHOTS_DIR, join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  let files = 0, bytes = 0;
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else { files++; bytes += statSync(p).size; }
    }
  };
  walk(join(outDir, 'game'));
  const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.')).sort();
  return { files, bytes, shots };
}

interface CheckResult { ok: boolean; lines: string[] }
function check(): CheckResult {
  const lines: string[] = [];
  let ok = true;
  const mark = (good: boolean, msg: string) => {
    lines.push((good ? '  [ok] ' : '  [FAIL] ') + msg);
    if (!good) ok = false;
  };
  lines.push('SOLANO BAY v1.1 — pre-flight check');
  lines.push('root: ' + ROOT);
  for (const rel of REQUIRED) mark(existsSync(join(ROOT, rel)), rel);
  const vendorBytes = existsSync(join(ROOT, 'vendor', 'makefun-game.ts'))
    ? statSync(join(ROOT, 'vendor', 'makefun-game.ts')).size : 0;
  lines.push(`  vendor/makefun-game.ts: ${vendorBytes} bytes (kit file, must stay unchanged)`);

  const shots = existsSync(SHOTS_DIR)
    ? readdirSync(SHOTS_DIR).filter((f) => !f.startsWith('.')).sort() : [];
  mark(shots.length >= 3 && shots.length <= 4, `screenshots: ${shots.length} file(s) (need 3-4)`);
  for (const f of shots) {
    const p = join(SHOTS_DIR, f);
    const size = statSync(p).size;
    const dims = imageDims(p);
    const good = size <= 262144 && !!dims && Math.max(dims.w, dims.h) <= 1280 && Math.min(dims.w, dims.h) >= 480;
    mark(good, `screenshots/${f}: ${size} bytes, ${dims ? dims.w + 'x' + dims.h : 'not a PNG/JPEG'} (max 256 KiB, long side <= 1280, short side >= 480)`);
  }

  const res = spawnSync(process.execPath, ['--check', join(GAME_DIR, 'game.js')], { encoding: 'utf-8' });
  mark(res.status === 0, 'game.js syntax (node --check)');
  if (res.status !== 0) lines.push(res.stderr.trim());

  const html = readFileSync(join(GAME_DIR, 'index.html'), 'utf-8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('http') && !u.startsWith('data:'));
  let refsOk = true;
  for (const ref of refs) {
    if (!existsSync(join(GAME_DIR, ref))) { lines.push('  [FAIL] referenced file missing: ' + ref); refsOk = false; }
  }
  mark(refsOk, `index.html references ${refs.length} local file(s), all present`);
  const external = [...html.matchAll(/(?:src|href)="https?:[^"]+"/g)];
  mark(external.length === 0, `external (network) references in index.html: ${external.length} (must be 0 for offline play)`);

  /* The real proof: build into a temp dir and let buildDossier judge it. */
  try {
    const tmp = mkdtempSync(join(tmpdir(), 'solano-bay-check-'));
    const summary = build(tmp);
    lines.push(`  [ok] buildDossier wrote ${summary.shots.length} screenshot(s), ${summary.files} game file(s), dossier.json`);
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    mark(false, 'buildDossier failed: ' + (e as Error).message);
  }
  lines.push(ok ? 'CHECK PASSED' : 'CHECK FAILED — see items above');
  return { ok, lines };
}

function serve(port: number): void {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = join(GAME_DIR, path);
    if (!file.startsWith(GAME_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
    try {
      const data = readFileSync(file);
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
    console.log('  Screenshot scenes: ?shot=onfoot | ?shot=driving | ?shot=mission');
  });
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node main.ts [--check] [--serve] [--port N] [--out DIR]');
  console.log('  (no flags)  build the entry into /output or $MAKEFUN_OUTPUT_DIR');
  process.exit(0);
}
if (args.includes('--check')) {
  const { ok, lines } = check();
  console.log(lines.join('\n'));
  process.exit(ok ? 0 : 1);
}
const portArg = args.find((a) => a.startsWith('--port='));
const port = portArg ? Number(portArg.split('=')[1]) : 8901;
if (args.includes('--serve')) {
  const { ok, lines } = check();
  console.log(lines.join('\n'));
  if (!ok) console.log('\nNote: serving anyway so the game can still be play-tested locally.');
  serve(port);
} else {
  const out = outDirFrom(args);
  const summary = build(out);
  console.log(`Built Solano Bay into ${out}`);
  console.log(`  game/: ${summary.files} file(s), ${summary.bytes} bytes`);
  console.log(`  screenshots/: ${summary.shots.join(', ')}`);
  console.log('  dossier.json written (makefun/dossier/v1)');
}
