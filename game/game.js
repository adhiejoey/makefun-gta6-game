// Solano Bay v1.2 — recorded rebuild
/* ============================================================================
   SOLANO BAY v1.2 — an original open-world crime game (make.fun gta6-01).
   Top-down 2D canvas, zero network requests, all art and sound procedural.
   The city (Solano Bay), the characters (Mara Voss, Dario, the Dock Rats),
   the vehicles, the story and the music are original creations — nothing
   from Rockstar Games, nothing borrowed from any other game.

   Play: open game/index.html in desktop Chrome, or run `node main.ts`
   from the repo root and open the printed address. WASD move/drive,
   E enter or steal a car, mouse + click shoot, R reload, Space handbrake,
   P save, M mute, Esc pause. Progress autosaves to localStorage.

   Screenshot hooks (used only to take the entry's own screenshots):
   open the page with ?shot=onfoot, ?shot=driving, ?shot=mission or
   ?shot=title — the game starts itself into that scene so a headless
   browser can capture a real render of the running game. ?t=HH:MM sets
   the in-game clock, e.g. ?shot=driving&t=17:30.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ setup */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const mm = document.getElementById('minimap');
const mmc = mm.getContext('2d');
const $ = (id) => document.getElementById(id);

/* Deterministic RNG so the city layout is identical on every load. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261117);
const rand = (lo, hi) => lo + rng() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ world */
const WORLD_W = 3200;
const WORLD_H = 2400;
const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];
const ROAD_W = 92;
const SAVE_KEY = 'solanoBaySaveV2';
const DISTRICTS = ['DOWNTOWN', 'OLD TOWN', 'THE MARINA', 'HARBOR SIDE', 'HILLS', 'MARKET ROW', 'PALM COURT', 'DOCKS'];

function districtAt(x, y) {
  if (y > WORLD_H - 130) return 'SOLANO BEACH';
  if (x > WORLD_W - 130) return 'THE HARBOR';
  const ix = clamp(ROAD_X.findIndex((rx) => x < rx) - 1, 0, ROAD_X.length - 2);
  const iy = clamp(ROAD_Y.findIndex((ry) => y < ry) - 1, 0, ROAD_Y.length - 2);
  return DISTRICTS[(ix * 3 + iy) % DISTRICTS.length];
}
function isRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
function nearestRoadX(x) {
  let best = ROAD_X[0], d = Infinity;
  for (const r of ROAD_X) { const dd = Math.abs(x - r); if (dd < d) { d = dd; best = r; } }
  return best;
}
function nearestRoadY(y) {
  let best = ROAD_Y[0], d = Infinity;
  for (const r of ROAD_Y) { const dd = Math.abs(y - r); if (dd < d) { d = dd; best = r; } }
  return best;
}

/* One building (or park) per city block, placed by the seeded RNG. */
const buildings = [];
(function genCity() {
  const palette = ['#3a4a6b', '#5b4a6b', '#6b4a3a', '#2f5b4a', '#6b5b2f', '#4a3a5b', '#37506b', '#6b3a4a'];
  let bi = 0;
  for (let ix = 0; ix < ROAD_X.length - 1; ix++) {
    for (let iy = 0; iy < ROAD_Y.length - 1; iy++) {
      const x0 = ROAD_X[ix] + ROAD_W / 2 + 14, x1 = ROAD_X[ix + 1] - ROAD_W / 2 - 14;
      const y0 = ROAD_Y[iy] + ROAD_W / 2 + 14, y1 = ROAD_Y[iy + 1] - ROAD_W / 2 - 14;
      if (ix === 3 && iy === 2) { buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, park: true, name: 'SOLANO PARK' }); continue; }
      if (ix === 1 && iy === 3) { buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, park: true, name: 'PALM PLAZA' }); continue; }
      const n = 2 + (bi % 2);
      for (let k = 0; k < n; k++) {
        const w = randInt(90, 200), h = randInt(80, 180);
        const bx = x0 + 8 + rand(0, Math.max(1, x1 - x0 - w - 16));
        const by = y0 + 8 + rand(0, Math.max(1, y1 - y0 - h - 16));
        buildings.push({ x: bx, y: by, w, h, color: palette[bi % palette.length], name: DISTRICTS[bi % DISTRICTS.length] });
      }
      bi++;
    }
  }
})();

const BEACH = { x: 0, y: WORLD_H - 130, w: WORLD_W, h: 130 };
const WATER = { x: WORLD_W - 130, y: 0, w: 130, h: WORLD_H };

/* Push a circle out of every solid building; returns the corrected point. */
function collideBuildings(x, y, r) {
  for (const b of buildings) {
    if (b.park) continue;
    const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.01;
      x = cx + (dx / d) * r; y = cy + (dy / d) * r;
    }
  }
  return { x, y };
}
function inBuilding(x, y) {
  for (const b of buildings) {
    if (!b.park && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}
function inWater(x, y) { return x > WATER.x || y > BEACH.y + 55; }

/* ------------------------------------------------------------------ state */
const SAVE_DEFAULT = () => ({
  cash: 250, hp: 100, armor: 0, nextMission: 0, completed: [],
  x: 600, y: 1000, timeMin: 8 * 60, kills: 0, carsStolen: 0, playMin: 0,
  weapon: 'PISTOL',
});
let S = SAVE_DEFAULT();
let player = null; /* built by resetPlayer() */
let cash = S.cash, wanted = 0, wantedTimer = 0, crimeCooldown = 0;
let gameTime = S.timeMin; /* minutes since midnight */
let cam = { x: S.x, y: S.y };
let bullets = [], enemies = [], pickups = [], particles = [], floaters = [];
let cars = [], peds = [], cops = [], policeCars = [];
let mission = null, missionStep = 0, missionTimer = 0, missionActive = false;
let paused = false, started = false, dead = false, busted = false, muted = false;
let dialogueQueue = [], dialogueCb = null;
let stats = { kills: 0, carsStolen: 0, missionsDone: 0 };
let playSeconds = 0, lastSave = 0, shake = 0;
let shotMode = null; /* 'title' | 'onfoot' | 'driving' | 'mission' | null */

const WEAPONS = {
  PISTOL: { label: 'PISTOL', magSize: 12, cooldown: 0.22, damage: 26, auto: false, bulletSpeed: 22 },
  SMG: { label: 'SMG', magSize: 30, cooldown: 0.09, damage: 14, auto: true, bulletSpeed: 24 },
};
function resetPlayer(x, y, hp, armor, weapon) {
  player = {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: hp ?? 100, armor: armor ?? 0, car: null, onFoot: true, radius: 13,
    shootCd: 0, reloadT: 0, mag: WEAPONS[weapon || 'PISTOL'].magSize,
    weapon: weapon || 'PISTOL',
  };
}
resetPlayer(S.x, S.y, S.hp, S.armor, S.weapon);

const CAR_COLORS = ['#e33', '#39c', '#fc0', '#eee', '#3a3', '#f6c', '#888', '#f80', '#6cf', '#a52'];
const CAR_MODELS = [
  { name: 'Comet GT', top: 8.4, acc: 0.24, color: '#e33' },
  { name: 'Solano Taxi', top: 6.4, acc: 0.16, color: '#fc0' },
  { name: 'Bay Cruiser', top: 6.8, acc: 0.17, color: '#39c' },
  { name: 'Rust Bucket', top: 5.4, acc: 0.13, color: '#888' },
  { name: 'Harbor Van', top: 5.8, acc: 0.14, color: '#eee' },
  { name: 'Palm Sedan', top: 6.2, acc: 0.15, color: '#3a3' },
];
function makeCar(x, y, angle, model, kind) {
  return {
    x, y, angle, speed: 0, model, kind: kind || 'traffic',
    hp: 100, w: 46, h: 22, driver: kind === 'parked' ? null : 'npc',
    stuck: 0, ramCd: 0, crashCd: 0, hitCd: 0, siren: 0,
  };
}

/* Pickup spawn points; pickups respawn 45 s after being collected. */
const PICKUP_SPOTS = [
  { x: 640, y: 640, kind: 'health' }, { x: 1440, y: 1040, kind: 'health' },
  { x: 2240, y: 640, kind: 'armor' }, { x: 1040, y: 1840, kind: 'armor' },
  { x: 2640, y: 1440, kind: 'health' }, { x: 1840, y: 2240, kind: 'ammo' },
  { x: 640, y: 620, kind: 'smg' },
];
function spawnWorld() {
  cars = []; peds = []; cops = []; policeCars = []; enemies = []; pickups = []; bullets = [];
  for (const spot of PICKUP_SPOTS) pickups.push({ ...spot, respawnIn: 0 });
  for (let i = 0; i < 26; i++) {
    const rx = ROAD_X[i % ROAD_X.length], ry = ROAD_Y[(i * 3) % ROAD_Y.length];
    const horiz = i % 2 === 0;
    const x = horiz ? 350 + ((i * 277) % 2600) : rx + (i % 2 ? 58 : -58);
    const y = horiz ? ry + (i % 2 ? 58 : -58) : 350 + ((i * 311) % 1800);
    if (inBuilding(x, y)) continue;
    cars.push(makeCar(x, y, horiz ? 0 : Math.PI / 2, CAR_MODELS[i % CAR_MODELS.length], 'parked'));
  }
  for (let i = 0; i < 22; i++) {
    const horiz = i % 2 === 0;
    const c = makeCar(
      horiz ? 200 + ((i * 397) % 2800) : ROAD_X[i % ROAD_X.length],
      horiz ? ROAD_Y[(i * 2) % ROAD_Y.length] : 200 + ((i * 431) % 2000),
      horiz ? 0 : Math.PI / 2, CAR_MODELS[(i + 2) % CAR_MODELS.length], 'traffic');
    c.axis = horiz ? 'h' : 'v'; c.dir = i % 4 < 2 ? 1 : -1;
    c.speed = 2.2 + (i % 3) * 0.5; c.lane = (i % 2 ? 22 : -22);
    cars.push(c);
  }
  const pedColors = ['#f88', '#8f8', '#88f', '#ff8', '#f8f', '#8ff'];
  for (let i = 0; i < 34; i++) {
    const rx = ROAD_X[i % ROAD_X.length];
    peds.push({
      x: rx + (i % 2 ? 70 : -70), y: 250 + ((i * 173) % 1900),
      angle: rand(0, TAU), speed: 0.5 + (i % 3) * 0.25,
      color: pedColors[i % pedColors.length], panic: 0, tx: 0, ty: 0, retarget: 0,
    });
  }
}

/* ------------------------------------------------------- audio (WebAudio) */
let AC = null, engineOsc = null, engineGain = null;
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = AC.createOscillator(); engineGain = AC.createGain();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 40; engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(AC.destination); engineOsc.start();
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(freq, dur, type, vol, slide) {
  if (muted || !audio()) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  shoot: () => beep(900, 0.09, 'square', 0.10, 120),
  smg: () => beep(1100, 0.05, 'square', 0.07, 200),
  hit: () => beep(180, 0.12, 'sawtooth', 0.08, 60),
  pickup: () => { beep(660, 0.1, 'sine', 0.1); setTimeout(() => beep(990, 0.14, 'sine', 0.1), 90); },
  cash: () => { beep(880, 0.08, 'sine', 0.1); setTimeout(() => beep(1320, 0.16, 'sine', 0.1), 80); },
  siren: () => { if (!muted && AC) beep(750, 0.35, 'sine', 0.03, 950); },
  crash: () => beep(90, 0.2, 'sawtooth', 0.12, 40),
  reload: () => { beep(300, 0.08, 'square', 0.06); setTimeout(() => beep(420, 0.08, 'square', 0.06), 120); },
  mission: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.12), i * 130)); },
  fail: () => beep(220, 0.5, 'sawtooth', 0.1, 110),
  door: () => beep(200, 0.1, 'square', 0.07, 400),
};

/* ------------------------------------------------------------------ input */
const keys = {};
let mouse = { x: 640, y: 360, down: false };
addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape') togglePause();
  if (e.key.toLowerCase() === 'p' && started && !paused) saveGame(true);
  if (e.key.toLowerCase() === 'm') { muted = !muted; toast(muted ? '🔇 Sound off' : '🔊 Sound on'); }
  if (e.key.toLowerCase() === 'r') reload();
  if (e.key.toLowerCase() === 'e') interact();
  if (e.key.toLowerCase() === '1') setWeapon('PISTOL');
  if (e.key.toLowerCase() === '2' && player.weapon === 'SMG') setWeapon('SMG');
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('mousemove', (e) => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (cv.width / r.width);
  mouse.y = (e.clientY - r.top) * (cv.height / r.height);
});
cv.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    mouse.down = true;
    if (dialogueQueue.length) nextDialogue();
  }
});
addEventListener('mouseup', () => { mouse.down = false; });
addEventListener('blur', () => { if (started && !paused && !shotMode) togglePause(); });
/* Canvas pixels are the world-view pixels (1280x720), so the mouse maps
   straight onto the screen; the camera offset turns it into world coords. */
function screenToWorld() {
  return { x: cam.x + (mouse.x - 640), y: cam.y + (mouse.y - 360) };
}

/* ------------------------------------------------------------- save / load */
function saveGame(manual) {
  try {
    const data = {
      cash, hp: player.hp, armor: player.armor,
      nextMission: S.nextMission, completed: S.completed || [],
      x: player.x, y: player.y, timeMin: gameTime,
      kills: stats.kills, carsStolen: stats.carsStolen,
      playMin: (S.playMin || 0) + playSeconds / 60,
      weapon: player.weapon,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    S = data; lastSave = performance.now();
    if (manual) toast('💾 Game saved');
  } catch (e) {
    if (manual) toast('⚠ Save failed — browser storage blocked');
  }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function toast(msg, ms) {
  const t = $('toast'); t.textContent = msg; t.style.opacity = 1;
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = 0; }, ms || 2600);
}
function floater(x, y, text, color) {
  floaters.push({ x, y, text, color: color || '#fff', life: 1.4 });
}
function addShake(n) { shake = Math.max(shake, n); }

/* --------------------------------------------------------------- dialogue */
function say(name, text, cb) {
  dialogueQueue.push({ name, text });
  if (cb) dialogueCb = cb;
  showDialogue();
}
function showDialogue() {
  if (!dialogueQueue.length) { $('dialogue').classList.add('hidden'); return; }
  const d = dialogueQueue[0];
  $('dname').textContent = d.name; $('dtext').textContent = d.text;
  $('dialogue').classList.remove('hidden');
}
function nextDialogue() {
  dialogueQueue.shift();
  if (!dialogueQueue.length) {
    $('dialogue').classList.add('hidden');
    const cb = dialogueCb; dialogueCb = null;
    if (cb) cb();
  } else showDialogue();
}
$('dialogue').addEventListener('click', nextDialogue);

/* --------------------------------------------------------------- missions */
const SAFEHOUSE = { x: 620, y: 1420 };
const SPRAY = { x: 1820, y: 620 };
const DARIO_BAR = { x: 640, y: 1040 };
const MISSIONS = [
  {
    id: 0, name: 'THE DRIVER', sub: 'Dario needs a driver he can trust.',
    steps: [
      {
        text: 'Go to Dario’s Bar in Old Town (yellow marker).', marker: { ...DARIO_BAR }, radius: 55,
        onArrive() {
          say('DARIO', 'Mara! You came back. Good. One package, no questions. Take my sedan outside — it’s yours for the job — and drop the case at the Marina pier. Cops are jumpy tonight, so drive clean.', () => { missionStep = 1; setObjective(); });
        },
      },
      {
        text: 'Deliver the package to the Marina pier. Avoid trouble.', marker: { x: 2640, y: 620 }, radius: 60,
        onArrive() { cash += 300; sfx.cash(); completeMission('Package delivered. Dario owes you one — and the city noticed.'); },
      },
    ],
  },
  {
    id: 1, name: 'HARBOR HEAT', sub: 'Steal the Comet GT. Lose the heat. Get paid.',
    steps: [
      {
        text: 'Steal the red Comet GT from the Harbor lot (east docks).', marker: { x: 2850, y: 1840 }, radius: 60,
        onArrive() {
          const c = makeCar(2850, 1840, 0, CAR_MODELS[0], 'parked');
          cars.push(c);
          say('MARA', 'There she is — the Comet GT. Dario’s buyer is waiting. Take it, and don’t get caught holding it.', () => { missionStep = 1; setObjective(); });
        },
      },
      {
        text: 'Get the Comet GT to the lockup in the Hills.', marker: { x: 2620, y: 220 }, radius: 60,
        onArrive() {
          if (player.car && player.car.model.name === 'Comet GT') {
            cash += 600; sfx.cash();
            completeMission('Comet GT delivered. $600 — and a reputation.');
          } else {
            toast('⚠ You need the Comet GT!');
            missionStep = 1; setObjective();
          }
        },
      },
    ],
  },
  {
    id: 2, name: 'THE MARINA DEAL', sub: 'A deal goes bad. Finish it.',
    steps: [
      {
        text: 'Meet the crew at the Marina. Something feels wrong…', marker: { x: 2440, y: 420 }, radius: 60,
        onArrive() {
          say('DARIO', 'It’s a setup! The Dock Rats sold us out — take cover and take them down!', () => {
            for (let i = 0; i < 5; i++) spawnEnemy(2300 + i * 90, 300 + (i % 2) * 130, 'Dock Rat');
            missionStep = 1; setObjective();
            toast('🔫 Ambush! Eliminate the Dock Rats!');
          });
        },
      },
      {
        text: 'Eliminate the Dock Rats.', marker: { x: 2440, y: 420 }, radius: 9999,
        check() { return enemies.length === 0; },
        onArrive() {
          cash += 1200; sfx.cash();
          say('DARIO', 'Clean work, Mara. Twelve hundred — and the Marina is ours now. Solano Bay is yours, kid. Drive safe.', () => completeMission('The Marina is yours. Story complete — free roam continues.'));
        },
      },
    ],
  },
];
function startMission(i) {
  mission = MISSIONS[i]; missionStep = 0; missionActive = true; missionTimer = 0;
  $('mbtitle').textContent = 'MISSION: ' + mission.name;
  $('mbsub').textContent = mission.sub;
  $('missionbanner').classList.remove('hidden');
  setTimeout(() => $('missionbanner').classList.add('hidden'), 3600);
  sfx.mission(); setObjective();
}
function setObjective() {
  if (!missionActive || !mission) {
    $('objtitle').textContent = 'FREE ROAM';
    $('objtext').textContent = S.nextMission < MISSIONS.length
      ? 'Explore Solano Bay. Talk to Dario at his bar in Old Town to start the next job.'
      : 'Story complete. Solano Bay is yours — free roam.';
    return;
  }
  const st = mission.steps[missionStep];
  $('objtitle').textContent = 'MISSION: ' + mission.name;
  let extra = '';
  if (mission.id === 2 && missionStep === 1) extra = ' (' + (5 - enemies.length) + '/5 down)';
  $('objtext').textContent = st.text + extra;
}
function completeMission(msg) {
  const doneIdx = mission ? MISSIONS.indexOf(mission) : -1;
  missionActive = false; mission = null;
  if (!S.completed) S.completed = [];
  if (doneIdx >= 0 && !S.completed.includes(doneIdx)) S.completed.push(doneIdx);
  S.nextMission = Math.min((S.nextMission || 0) + 1, MISSIONS.length);
  stats.missionsDone = S.completed.length;
  sfx.mission(); toast('✅ ' + msg, 4200);
  floater(player.x, player.y - 30, msg, '#7dff8a');
  saveGame(false); setObjective();
  if (S.nextMission < MISSIONS.length) {
    setTimeout(() => { if (!shotMode) say('DARIO', 'New job’s waiting when you are. Come see me at the bar.', null); }, 5000);
  }
}
function missionMarker() {
  if (!missionActive || !mission) return null;
  return mission.steps[missionStep].marker;
}
function spawnEnemy(x, y, name) {
  enemies.push({ x, y, angle: 0, hp: 50, speed: 1.1, name: name || 'Thug', shootCd: 1.5 + Math.random() * 1.5, radius: 13 });
}

/* -------------------------------------------------------- wanted / police */
function addWanted(n, reason) {
  if (n <= 0) return;
  const before = wanted;
  wanted = Math.min(5, wanted + n); wantedTimer = 0; crimeCooldown = 4;
  if (wanted > before) { toast('★ Wanted level ' + wanted + ' — ' + reason); sfx.siren(); }
}
function policeNearby(range) {
  return policeCars.some((c) => dist(c.x, c.y, player.x, player.y) < range)
    || cops.some((c) => dist(c.x, c.y, player.x, player.y) < range);
}
function updateWanted(dt) {
  if (crimeCooldown > 0) crimeCooldown -= dt;
  if (wanted > 0) {
    wantedTimer += dt;
    /* Heat only cools when no police unit can see you. */
    if (!policeNearby(520) && wantedTimer > 22) {
      wanted--; wantedTimer = 0;
      toast(wanted ? '★ Heat cooling off… now ' + wanted + ' star' + (wanted > 1 ? 's' : '') : '★ You lost the cops. Clean.');
    }
    const wantCars = wanted >= 4 ? 3 : wanted >= 2 ? 2 : 1;
    if (policeCars.length < wantCars && Math.random() < 0.02) spawnPoliceCar();
    if (wanted >= 2 && cops.length < wanted && Math.random() < 0.01) spawnCop();
  } else if (policeCars.length || cops.length) {
    policeCars = []; cops = [];
  }
}
function spawnPoliceCar() {
  const a = Math.random() * TAU;
  const c = makeCar(player.x + Math.cos(a) * 600, player.y + Math.sin(a) * 600, 0,
    { name: 'Interceptor', top: 8.8, acc: 0.3, color: '#112' }, 'police');
  cars.push(c); policeCars.push(c);
}
function spawnCop() {
  const a = Math.random() * TAU;
  cops.push({
    x: player.x + Math.cos(a) * 380, y: player.y + Math.sin(a) * 380,
    angle: 0, hp: 40, speed: 1.6, shootCd: 2.0, radius: 13, holdT: 0,
  });
}
function updatePolice(dt) {
  for (const c of policeCars) {
    const dx = player.x - c.x, dy = player.y - c.y, d = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let da = want - c.angle;
    while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    c.angle += clamp(da, -0.06, 0.06);
    c.speed = Math.min(9.2, c.speed + 0.12);
    c.x += Math.cos(c.angle) * c.speed; c.y += Math.sin(c.angle) * c.speed;
    const p = collideBuildings(c.x, c.y, 20); c.x = p.x; c.y = p.y;
    c.siren += dt; if (c.siren > 1.1) { c.siren = 0; sfx.siren(); }
    c.ramCd = Math.max(0, c.ramCd - dt);
    if (d < 46 && c.ramCd <= 0) {
      c.ramCd = 0.6;
      if (player.car) { player.car.hp -= 4; sfx.crash(); addShake(4); }
      else hurtPlayer(6, 'police');
      c.speed *= 0.4;
    } else if (d < 46) { c.speed *= 0.7; }
    if (d > 1400) c.fading = true;
  }
  policeCars = policeCars.filter((c) => !c.fading && c.hp > 0);
  for (const cop of cops) {
    const dx = player.x - cop.x, dy = player.y - cop.y, d = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (d > 46) { cop.x += Math.cos(cop.angle) * cop.speed; cop.y += Math.sin(cop.angle) * cop.speed; }
    else if (player.onFoot) {
      cop.holdT += dt;
      if (cop.holdT > 1.6 && wanted > 0) { doBusted(); return; }
    }
    cop.shootCd -= dt;
    if (cop.shootCd <= 0 && d < 420 && d > 60) { cop.shootCd = 2.2 + Math.random(); enemyShoot(cop, 7); }
  }
}
function doBusted() {
  if (busted || dead) return; busted = true;
  $('busted').classList.remove('hidden'); sfx.fail();
  cash = Math.max(0, cash - 150);
  setTimeout(() => {
    $('busted').classList.add('hidden'); busted = false;
    wanted = 0; policeCars = []; cops = [];
    resetPlayer(SAFEHOUSE.x, SAFEHOUSE.y, 100, player.armor, player.weapon);
    toast('🚔 Busted! $150 bail. Released at the safehouse.');
    saveGame(false);
  }, 2200);
}
function doWasted() {
  if (dead) return; dead = true;
  $('wasted').classList.remove('hidden'); sfx.fail();
  cash = Math.max(0, cash - 100);
  setTimeout(() => {
    $('wasted').classList.add('hidden'); dead = false;
    wanted = Math.max(0, wanted - 1); policeCars = []; cops = [];
    resetPlayer(640, 620, 100, 0, player.weapon);
    toast('🏥 Wasted! You wake up at Solano General, $100 lighter.');
    saveGame(false);
  }, 2200);
}
function hurtPlayer(dmg, src) {
  if (dead || busted || !started || paused) return;
  if (player.armor > 0) { const ab = Math.min(player.armor, dmg); player.armor -= ab; dmg -= ab; }
  player.hp -= dmg;
  $('vignette').style.boxShadow = 'inset 0 0 120px 40px rgba(255,0,0,.55)';
  setTimeout(() => { $('vignette').style.boxShadow = 'inset 0 0 120px 40px rgba(255,0,0,0)'; }, 180);
  if (player.hp <= 0) { player.hp = 0; doWasted(); }
}

/* ----------------------------------------------------------------- combat */
function setWeapon(name) {
  if (!WEAPONS[name]) return;
  player.weapon = name;
  player.mag = WEAPONS[name].magSize;
  player.reloadT = 0;
}
function reload() {
  const w = WEAPONS[player.weapon];
  if (!player.onFoot || player.reloadT > 0 || player.mag === w.magSize) return;
  player.reloadT = 1.1; sfx.reload();
}
function shoot() {
  if (!player.onFoot || player.reloadT > 0 || player.shootCd > 0 || player.mag <= 0 || dialogueQueue.length) return;
  const w = WEAPONS[player.weapon];
  player.shootCd = w.cooldown; player.mag--;
  const t = screenToWorld();
  const a = Math.atan2(t.y - player.y, t.x - player.x);
  player.angle = a;
  bullets.push({
    x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20,
    vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed,
    life: 0.9, from: 'player', dmg: w.damage,
  });
  if (player.weapon === 'SMG') sfx.smg(); else sfx.shoot();
  particles.push({ x: player.x + Math.cos(a) * 24, y: player.y + Math.sin(a) * 24, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 0.12, color: '#ffea00', r: 5 });
  for (const p of peds) if (dist(p.x, p.y, player.x, player.y) < 300) p.panic = 3;
}
function enemyShoot(e, dmg) {
  const a = Math.atan2(player.y - e.y, player.x - e.x);
  bullets.push({
    x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, life: 1.1, from: 'enemy', dmg,
  });
  beep(500, 0.08, 'square', 0.05, 90);
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx; b.y += b.vy; b.life -= dt;
    if (inBuilding(b.x, b.y)) {
      b.life = 0;
      particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, color: '#ccc', r: 3 });
      continue;
    }
    if (b.from === 'player') {
      for (const e of [...enemies, ...cops]) {
        if (dist(e.x, e.y, b.x, b.y) < 16) {
          e.hp -= b.dmg; b.life = 0; sfx.hit();
          floater(e.x, e.y - 18, '-' + b.dmg, '#ff8080');
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
      if (b.life > 0) {
        for (const c of cars) {
          if (c !== player.car && dist(c.x, c.y, b.x, b.y) < 24) {
            c.hp -= 8; b.life = 0;
            if (c.kind === 'police') addWanted(1, 'shooting at police');
            break;
          }
        }
      }
      if (b.life > 0) {
        for (const p of peds) {
          if (dist(p.x, p.y, b.x, b.y) < 14) { p.panic = 5; b.life = 0; addWanted(1, 'hitting a pedestrian'); break; }
        }
      }
    } else if (player.onFoot && dist(player.x, player.y, b.x, b.y) < 14) {
      b.life = 0; hurtPlayer(b.dmg, 'shot');
    } else if (player.car && dist(player.car.x, player.car.y, b.x, b.y) < 24) {
      b.life = 0; player.car.hp -= 3;
    }
  }
  bullets = bullets.filter((b) => b.life > 0);
}
function killEnemy(e) {
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  const j = cops.indexOf(e); if (j >= 0) cops.splice(j, 1);
  stats.kills++;
  cash += 25; floater(e.x, e.y - 26, '+$25', '#7dff8a');
  particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.5, color: '#f00', r: 14 });
  setObjective();
}

/* ---------------------------------------------------------- interact / cars */
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of cars) {
    const d = dist(c.x, c.y, player.x, player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function interact() {
  if (!started || paused || dead || busted) return;
  if (dialogueQueue.length) { nextDialogue(); return; }
  if (!missionActive && S.nextMission < MISSIONS.length) {
    if (dist(player.x, player.y, DARIO_BAR.x, DARIO_BAR.y) < 70) { startMission(S.nextMission); return; }
  }
  if (player.onFoot) {
    const c = nearestCar(64);
    if (c) enterCar(c);
  } else exitCar();
}
function enterCar(c) {
  if (c.kind === 'police') {
    toast('🚔 That’s a police car — stealing it is a bad idea.');
    addWanted(2, 'stealing a police car');
  }
  if (c.kind === 'traffic') {
    stats.carsStolen++; addWanted(1, 'carjacking');
    peds.push({
      x: c.x + 30, y: c.y + 30, angle: 0, speed: 1.4, color: '#f88',
      panic: 4, tx: 0, ty: 0, retarget: 0,
    });
    toast('🚗 Carjacked! The driver ran — and someone called it in.');
  } else if (c.kind === 'parked') { stats.carsStolen++; }
  player.car = c; player.onFoot = false; c.driver = 'player'; c.kind = 'player';
  $('speedbox').classList.remove('hidden');
  $('carname').textContent = c.model.name;
  sfx.door();
}
function exitCar() {
  const c = player.car; if (!c) return;
  player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 34;
  player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 34;
  const p = collideBuildings(player.x, player.y, 14); player.x = p.x; player.y = p.y;
  player.onFoot = true; player.car = null; c.driver = null; c.kind = 'parked'; c.speed = 0;
  $('speedbox').classList.add('hidden');
  sfx.door();
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (!started || paused || dead || busted) return;
  if (dialogueQueue.length) return; /* freeze the world during dialogue */
  playSeconds += dt;
  gameTime = (gameTime + dt * 0.35) % (24 * 60);
  if (player.shootCd > 0) player.shootCd -= dt;
  if (player.reloadT > 0) {
    player.reloadT -= dt;
    if (player.reloadT <= 0) player.mag = WEAPONS[player.weapon].magSize;
  }
  if (mouse.down && (WEAPONS[player.weapon].auto || true)) shoot();
  if (player.onFoot) updateOnFoot(dt); else updateDriving(dt);
  updateTraffic(dt); updatePeds(dt); updatePolice(dt); updateWanted(dt);
  updateBullets(dt); updateEnemies(dt); updatePickups(dt); updateMission(dt); updateParticles(dt);
  cam.x += (player.x - cam.x) * 0.12; cam.y += (player.y - cam.y) * 0.12;
  if (shake > 0) shake *= 0.85;
  if (AC && engineGain) {
    const sp = player.car ? Math.abs(player.car.speed) : 0;
    engineGain.gain.value = muted ? 0 : (player.car ? 0.02 + sp * 0.004 : 0);
    engineOsc.frequency.value = 45 + sp * 12;
  }
  if (performance.now() - lastSave > 60000) saveGame(false);
  updateHUD();
}
function updateOnFoot(dt) {
  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  const sp = keys['shift'] ? 4.6 : 2.9;
  if (mx || my) {
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    player.x += mx * sp; player.y += my * sp;
    player.angle = Math.atan2(my, mx);
  }
  const w = screenToWorld();
  if (dist(w.x, w.y, player.x, player.y) > 40) player.angle = Math.atan2(w.y - player.y, w.x - player.x);
  player.x = clamp(player.x, 20, WORLD_W - 20);
  player.y = clamp(player.y, 20, WORLD_H - 20);
  const p = collideBuildings(player.x, player.y, player.radius); player.x = p.x; player.y = p.y;
  if (inWater(player.x, player.y)) {
    player.y = Math.min(player.y, BEACH.y + 40);
    player.x = Math.min(player.x, WATER.x - 20);
  }
  const c = nearestCar(64);
  $('interact').classList.toggle('hidden', !c);
  if (c) $('interact').textContent = c.kind === 'traffic' ? 'Press E — steal car' : 'Press E — enter ' + c.model.name;
}
function updateDriving(dt) {
  const c = player.car; if (!c) { player.onFoot = true; return; }
  const fwd = (keys['w'] || keys['arrowup']) ? 1 : 0;
  const rev = (keys['s'] || keys['arrowdown']) ? 1 : 0;
  if (fwd) c.speed += c.model.acc;
  if (rev) c.speed -= c.model.acc * 0.8;
  if (!fwd && !rev) c.speed *= 0.985;
  if (keys[' ']) {
    c.speed *= 0.9;
    if (Math.abs(c.speed) > 3 && Math.random() < 0.5) {
      particles.push({ x: c.x - Math.cos(c.angle) * 20, y: c.y - Math.sin(c.angle) * 20, vx: 0, vy: 0, life: 0.3, color: '#999', r: 4 });
    }
  }
  c.speed = clamp(c.speed, -3.5, c.model.top);
  const steer = ((keys['a'] || keys['arrowleft']) ? -1 : 0) + ((keys['d'] || keys['arrowright']) ? 1 : 0);
  if (Math.abs(c.speed) > 0.2) c.angle += steer * 0.045 * Math.sign(c.speed) * (1 + Math.abs(c.speed) * 0.04);
  c.x += Math.cos(c.angle) * c.speed; c.y += Math.sin(c.angle) * c.speed;
  const before = { x: c.x, y: c.y };
  const p = collideBuildings(c.x, c.y, 22); c.x = p.x; c.y = p.y;
  const pushed = dist(p.x, p.y, before.x, before.y);
  c.crashCd = Math.max(0, c.crashCd - dt);
  if (pushed > 0.1 && Math.abs(c.speed) > 3 && c.crashCd <= 0) {
    c.crashCd = 0.5; c.speed *= -0.3; c.hp -= 3; sfx.crash(); addShake(3);
  } else if (pushed > 0.1) { c.speed *= 0.6; }
  c.x = clamp(c.x, 24, WORLD_W - 24); c.y = clamp(c.y, 24, WORLD_H - 24);
  player.x = c.x; player.y = c.y; player.angle = c.angle;
  for (const ped of peds) {
    if (dist(ped.x, ped.y, c.x, c.y) < 26 && Math.abs(c.speed) > 2) {
      ped.panic = 6;
      ped.x += Math.cos(c.angle) * 40; ped.y += Math.sin(c.angle) * 40;
      addWanted(1, 'hit and run'); sfx.crash(); addShake(5);
    }
  }
  for (const o of cars) {
    if (o === c || o.kind === 'player') continue;
    if (dist(o.x, o.y, c.x, c.y) < 40) {
      o.x += (o.x - c.x) * 0.12; o.y += (o.y - c.y) * 0.12;
      c.speed *= 0.55;
      c.hitCd = Math.max(0, c.hitCd - dt);
      if (c.hitCd <= 0) {
        c.hitCd = 0.5; o.hp -= 6; c.hp -= 2; sfx.crash(); addShake(3);
        if (o.kind === 'police') addWanted(1, 'ramming a police car');
      }
    }
  }
  if (c.hp <= 0) {
    particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.8, color: '#f80', r: 30 });
    cars.splice(cars.indexOf(c), 1);
    player.car = null; player.onFoot = true;
    hurtPlayer(20, 'car explosion'); $('speedbox').classList.add('hidden');
    toast('💥 Your car exploded!');
  }
  $('speed').textContent = Math.round(Math.abs(c.speed) * 9);
  $('interact').classList.add('hidden');
}
function updateTraffic(dt) {
  for (const c of cars) {
    if (c.kind !== 'traffic') continue;
    const lane = c.lane || 22;
    if (c.axis === 'h') {
      const ry = nearestRoadY(c.y);
      c.y += (ry + lane - c.y) * 0.05;
      c.x += c.dir * c.speed; c.angle = c.dir > 0 ? 0 : Math.PI;
      if (Math.random() < 0.003 && ROAD_X.some((rx) => Math.abs(c.x - rx) < 30)) { c.axis = 'v'; c.dir = Math.random() < 0.5 ? 1 : -1; }
      if (c.x < 120) c.dir = 1; if (c.x > WORLD_W - 160) c.dir = -1;
    } else {
      const rx = nearestRoadX(c.x);
      c.x += (rx + lane - c.x) * 0.05;
      c.y += c.dir * c.speed; c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (Math.random() < 0.003 && ROAD_Y.some((ry) => Math.abs(c.y - ry) < 30)) { c.axis = 'h'; c.dir = Math.random() < 0.5 ? 1 : -1; }
      if (c.y < 120) c.dir = 1; if (c.y > WORLD_H - 160) c.dir = -1;
    }
    if (player.car && dist(c.x, c.y, player.car.x, player.car.y) < 70) c.speed = Math.max(0.4, c.speed * 0.99);
  }
  cars = cars.filter((c) => c.hp > 0 || c.kind === 'player');
}
function updatePeds(dt) {
  for (const p of peds) {
    p.retarget -= dt;
    if (p.panic > 0) {
      p.panic -= dt;
      const a = Math.atan2(p.y - player.y, p.x - player.x);
      p.x += Math.cos(a) * 2.6; p.y += Math.sin(a) * 2.6; p.angle = a;
    } else if (p.retarget <= 0) {
      p.retarget = 2 + Math.random() * 4;
      p.tx = clamp(p.x + (Math.random() - 0.5) * 500, 80, WORLD_W - 200);
      p.ty = clamp(p.y + (Math.random() - 0.5) * 500, 80, WORLD_H - 80);
    } else {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d > 8) { p.x += (dx / d) * p.speed; p.y += (dy / d) * p.speed; p.angle = Math.atan2(dy, dx); }
    }
    const q = collideBuildings(p.x, p.y, 10); p.x = q.x; p.y = q.y;
  }
}
function updateEnemies(dt) {
  for (const e of enemies) {
    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (d > 130) { e.x += Math.cos(e.angle) * e.speed; e.y += Math.sin(e.angle) * e.speed; }
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 460) { e.shootCd = 1.8 + Math.random() * 1.2; enemyShoot(e, 6); }
    const q = collideBuildings(e.x, e.y, 12); e.x = q.x; e.y = q.y;
  }
}
function updatePickups(dt) {
  for (const pk of pickups) {
    if (pk.respawnIn > 0) { pk.respawnIn -= dt; continue; }
    if (pk.taken) continue;
    if (dist(pk.x, pk.y, player.x, player.y) < 34) {
      pk.taken = true; pk.respawnIn = 45;
      if (pk.kind === 'health') { player.hp = Math.min(100, player.hp + 40); toast('❤ +40 health'); }
      if (pk.kind === 'armor') { player.armor = Math.min(100, player.armor + 50); toast('🛡 +50 armor'); }
      if (pk.kind === 'ammo') { player.mag = WEAPONS[player.weapon].magSize; toast('🔫 Ammo refilled'); }
      if (pk.kind === 'smg') { setWeapon('SMG'); toast('🔫 SMG picked up! (1/2 to switch)'); }
      sfx.pickup();
    }
  }
  for (const pk of pickups) {
    if (pk.taken && pk.respawnIn <= 0) { pk.taken = false; pk.respawnIn = 0; }
  }
  if (player.car && dist(player.x, player.y, SPRAY.x, SPRAY.y) < 70 && wanted > 0 && cash >= 200) {
    cash -= 200; wanted = 0; policeCars = []; cops = [];
    player.car.model = { ...player.car.model, color: pick(CAR_COLORS) };
    sfx.cash(); toast('🎨 Respray $200 — wanted cleared, new paint job!');
  }
}
function updateMission(dt) {
  if (!missionActive || !mission) return;
  missionTimer += dt;
  const st = mission.steps[missionStep];
  if (!st) return;
  const d = dist(player.x, player.y, st.marker.x, st.marker.y);
  if (st.check) { if (st.check()) st.onArrive(); }
  else if (d < st.radius && !st._inside) { st._inside = true; st.onArrive(); }
  else if (d >= st.radius) st._inside = false;
  if (mission && mission.id === 2 && missionStep === 1) setObjective();
}
function updateParticles(dt) {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life -= dt; }
  particles = particles.filter((p) => p.life > 0);
  for (const f of floaters) { f.y -= 0.6; f.life -= dt; }
  floaters = floaters.filter((f) => f.life > 0);
}

/* -------------------------------------------------------------------- HUD */
function updateHUD() {
  const h = Math.floor(gameTime / 60), m = Math.floor(gameTime % 60);
  $('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  $('cash').textContent = '$' + cash.toLocaleString('en-US');
  $('stars').innerHTML = Array.from({ length: 5 }, (_, i) =>
    '<span class="' + (i < wanted ? '' : 'dim') + '">★</span>').join('');
  $('healthfill').style.width = Math.max(0, player.hp) + '%';
  $('healthtext').textContent = Math.round(Math.max(0, player.hp));
  $('armorfill').style.width = Math.max(0, player.armor) + '%';
  const w = WEAPONS[player.weapon];
  $('weapon').textContent = w.label + (player.reloadT > 0 ? ' — RELOADING…' : '');
  $('ammo').textContent = player.mag + ' / ' + w.magSize;
  $('district').textContent = districtAt(player.x, player.y);
  const ch = $('crosshair');
  if (player.onFoot && started && !paused && !shotMode) {
    ch.style.display = 'block'; ch.style.left = mouse.x + 'px'; ch.style.top = mouse.y + 'px';
  } else ch.style.display = 'none';
}

/* ----------------------------------------------------------------- render */
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawCar(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-24, -13, 48, 26);
  ctx.fillStyle = c.kind === 'police' ? '#101018' : (c.model.color || '#888');
  roundRectPath(-23, -12, 46, 24, 6); ctx.fill();
  ctx.fillStyle = c.kind === 'police' ? '#fff' : 'rgba(0,0,0,.45)';
  roundRectPath(-6, -10, 16, 20, 3); ctx.fill();
  ctx.fillStyle = '#bfe8ff'; roundRectPath(2, -9, 10, 18, 2); ctx.fill();
  if (c.kind === 'police') {
    ctx.fillStyle = (Math.floor(performance.now() / 250) % 2) ? '#f00' : '#06f';
    ctx.fillRect(-14, -12, 8, 5); ctx.fillRect(-14, 7, 8, 5);
  }
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(21, -9, 3, 5); ctx.fillRect(21, 4, 3, 5);
  if (c.hp < 50) { /* damage smoke */
    ctx.fillStyle = 'rgba(120,120,120,.6)';
    ctx.beginPath(); ctx.arc(-10 + Math.random() * 6, -6, 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (c.kind === 'police') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', c.x, c.y - 20);
  }
}
function drawPerson(x, y, angle, color, label) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(2, 2, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(5, 0, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(8, -3, 5, 6);
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 18);
  }
}
function drawLandmark(x, y, color, label) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 16);
}
function render() {
  const hour = gameTime / 60;
  const night = hour < 6 || hour > 19.5;
  const dusk = (hour >= 17 && hour <= 19.5) || (hour >= 5.5 && hour < 7);
  ctx.fillStyle = night ? '#0d1a0d' : dusk ? '#2b2b1a' : '#274d24';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(640 - cam.x + (Math.random() - 0.5) * shake, 360 - cam.y + (Math.random() - 0.5) * shake);
  ctx.fillStyle = night ? '#16281a' : '#2c5a2e';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = '#e8d28a'; ctx.fillRect(BEACH.x, BEACH.y, BEACH.w, BEACH.h);
  ctx.fillStyle = '#1d6fb8'; ctx.fillRect(WATER.x, WATER.y, WATER.w, WATER.h);
  ctx.fillStyle = '#2f8fd0'; ctx.fillRect(BEACH.x, BEACH.y + 55, BEACH.w, 12);
  ctx.fillStyle = '#33363d';
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.strokeStyle = '#e8c33a'; ctx.lineWidth = 3; ctx.setLineDash([18, 16]);
  for (const rx of ROAD_X) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke(); }
  for (const ry of ROAD_Y) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const rx of ROAD_X) for (const ry of ROAD_Y) for (let i = -3; i <= 3; i++) ctx.fillRect(rx + i * 12 - 4, ry - 44, 8, 12);
  for (const b of buildings) {
    if (b.park) {
      ctx.fillStyle = '#3f7d3a'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#2f6b2f';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(b.x + 30 + i * 55, b.y + 30 + (i % 2) * 90, 16, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,220,.5)';
    for (let wx = b.x + 12; wx < b.x + b.w - 14; wx += 26) {
      for (let wy = b.y + 12; wy < b.y + b.h - 14; wy += 26) ctx.fillRect(wx, wy, 12, 14);
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + 16);
  }
  drawLandmark(DARIO_BAR.x, DARIO_BAR.y, '#ffd23f', '★ DARIO’S BAR');
  drawLandmark(SPRAY.x, SPRAY.y, '#3f6', '🎨 SPRAY SHOP $200');
  drawLandmark(SAFEHOUSE.x, SAFEHOUSE.y, '#6cf', '⌂ SAFEHOUSE');
  drawLandmark(640, 620, '#f66', '✚ HOSPITAL');
  drawLandmark(2640, 620, '#fc0', '⚓ MARINA');
  for (const pk of pickups) {
    if (pk.taken) continue;
    ctx.save(); ctx.translate(pk.x, pk.y);
    const bob = Math.sin(performance.now() / 300 + pk.x) * 2;
    ctx.translate(0, bob);
    ctx.fillStyle = pk.kind === 'health' ? '#f44' : pk.kind === 'armor' ? '#4db8ff' : pk.kind === 'smg' ? '#c66' : '#fc0';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : pk.kind === 'smg' ? 'S' : '»', 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
  const mk = missionMarker();
  if (mk) {
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
    ctx.save(); ctx.translate(mk.x, mk.y); ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  for (const p of peds) drawPerson(p.x, p.y, p.angle, p.color);
  for (const c of cars) drawCar(c);
  for (const e of enemies) drawPerson(e.x, e.y, e.angle, '#c22', e.name);
  for (const c of cops) drawPerson(c.x, c.y, c.angle, '#2244aa', 'POLICE');
  if (player.onFoot) drawPerson(player.x, player.y, player.angle, '#ffd23f', 'MARA');
  for (const b of bullets) {
    ctx.strokeStyle = '#ffe95e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.7, b.y - b.vy * 0.7); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  /* Night headlights: a soft cone ahead of the player's car. */
  if (night && player.car) {
    const g = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 260);
    g.addColorStop(0, 'rgba(255,240,180,.20)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(player.x, player.y, 260, 0, TAU); ctx.fill();
  }
  if (night) { ctx.fillStyle = 'rgba(8,10,40,.28)'; ctx.fillRect(cam.x - 660, cam.y - 380, 1320, 760); }
  else if (dusk) { ctx.fillStyle = 'rgba(255,120,40,.10)'; ctx.fillRect(cam.x - 660, cam.y - 380, 1320, 760); }
  ctx.restore();
  drawMinimap();
}
function drawMinimap() {
  const w = mm.width, h = mm.height, sx = w / WORLD_W, sy = h / WORLD_H;
  mmc.fillStyle = '#12240f'; mmc.fillRect(0, 0, w, h);
  mmc.fillStyle = '#1d6fb8'; mmc.fillRect(WATER.x * sx, 0, WATER.w * sx, h);
  mmc.fillStyle = '#e8d28a'; mmc.fillRect(0, BEACH.y * sy, w, BEACH.h * sy);
  mmc.fillStyle = '#555';
  for (const rx of ROAD_X) mmc.fillRect(rx * sx - 2, 0, 4, h);
  for (const ry of ROAD_Y) mmc.fillRect(0, ry * sy - 2, w, 4);
  mmc.fillStyle = '#888';
  for (const b of buildings) {
    if (!b.park) mmc.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  const dot = (x, y, c, r) => {
    mmc.fillStyle = c; mmc.beginPath(); mmc.arc(x * sx, y * sy, r, 0, TAU); mmc.fill();
  };
  dot(SPRAY.x, SPRAY.y, '#3f6', 3); dot(SAFEHOUSE.x, SAFEHOUSE.y, '#6cf', 3);
  dot(DARIO_BAR.x, DARIO_BAR.y, '#ffd23f', 3);
  for (const pk of pickups) if (!pk.taken) dot(pk.x, pk.y, pk.kind === 'health' ? '#f44' : '#fc0', 2);
  const mk = missionMarker(); if (mk) dot(mk.x, mk.y, '#ffd23f', 5);
  for (const c of policeCars) dot(c.x, c.y, (Math.floor(performance.now() / 250) % 2) ? '#f00' : '#06f', 3);
  for (const c of cops) dot(c.x, c.y, '#06f', 2);
  dot(player.x, player.y, '#fff', 4);
  mmc.strokeStyle = '#fff'; mmc.lineWidth = 1;
  mmc.strokeRect(player.x * sx - 14, player.y * sy - 11, 28, 22);
}

/* ------------------------------------------------------------------- flow */
function togglePause() {
  if (!started) return;
  paused = !paused;
  $('pause').classList.toggle('hidden', !paused);
  if (paused) {
    $('pausestats').innerHTML = 'Cash $' + cash.toLocaleString('en-US')
      + ' · Missions done: ' + stats.missionsDone + ' / 3 · Cars stolen: ' + stats.carsStolen
      + ' · Takedowns: ' + stats.kills + ' · ' + districtAt(player.x, player.y);
    $('pauseprog').textContent = (S.completed || []).length + ' of 3 story missions complete';
  }
}
function beginPlay() {
  $('start').classList.add('hidden'); $('hud').classList.remove('hidden');
  started = true; paused = false; audio();
  setObjective(); updateHUD();
}
function newGame() {
  S = SAVE_DEFAULT(); cash = S.cash; wanted = 0; gameTime = S.timeMin;
  stats = { kills: 0, carsStolen: 0, missionsDone: 0 };
  resetPlayer(S.x, S.y, 100, 0, 'PISTOL');
  cam.x = player.x; cam.y = player.y;
  spawnWorld(); mission = null; missionActive = false; missionStep = 0;
  beginPlay();
  if (!shotMode) {
    say('MARA', 'Solano Bay. Last time I was here I left in a hurry. Dario’s at his bar in Old Town — he says he has work. Time to see what the city owes me.');
    toast('📍 Go to Dario’s Bar (yellow marker) — or just explore');
  }
}
function continueGame() {
  const sv = loadSave();
  if (!sv) { toast('No save found — start a new game'); return; }
  S = sv; cash = sv.cash; gameTime = sv.timeMin || 8 * 60;
  stats = { kills: sv.kills || 0, carsStolen: sv.carsStolen || 0, missionsDone: (sv.completed || []).length };
  resetPlayer(sv.x, sv.y, sv.hp || 100, sv.armor || 0, sv.weapon || 'PISTOL');
  cam.x = player.x; cam.y = player.y;
  spawnWorld(); mission = null; missionActive = false;
  beginPlay();
  toast('💾 Save loaded — welcome back to Solano Bay');
}
$('btnNew').addEventListener('click', newGame);
$('btnContinue').addEventListener('click', continueGame);
$('btnResume').addEventListener('click', togglePause);
$('btnSave').addEventListener('click', () => { saveGame(true); });
$('btnQuit').addEventListener('click', () => {
  saveGame(false); started = false; paused = false;
  $('pause').classList.add('hidden'); $('hud').classList.add('hidden'); $('start').classList.remove('hidden');
  $('btnContinue').disabled = !loadSave();
});
$('btnContinue').disabled = !loadSave();

/* ------------------------------------------- screenshot scenes (?shot=...) */
function applyShotScene() {
  const params = new URLSearchParams(location.search);
  shotMode = params.get('shot');
  const t = params.get('t');
  if (t && /^\d{1,2}:\d{2}$/.test(t)) {
    const [hh, mm2] = t.split(':').map(Number);
    gameTime = (hh * 60 + mm2) % (24 * 60);
  }
  if (!shotMode || shotMode === 'title') { window.__solanoShot = 'title'; return; }
  newGame();
  if (shotMode === 'onfoot') {
    gameTime = 10 * 60;
    resetPlayer(700, 1120, 100, 25, 'PISTOL');
    cam.x = player.x; cam.y = player.y;
    toast('📍 Dario’s Bar — Old Town');
  } else if (shotMode === 'driving') {
    gameTime = 17 * 60 + 30;
    const c = makeCar(1400, 1000, 0, CAR_MODELS[0], 'parked');
    cars.push(c);
    resetPlayer(1400, 1000, 100, 0, 'PISTOL');
    player.car = c; player.onFoot = false; c.driver = 'player'; c.kind = 'player'; c.speed = 5;
    cam.x = player.x; cam.y = player.y;
    $('speedbox').classList.remove('hidden');
    $('carname').textContent = c.model.name;
    wanted = 3; wantedTimer = 0;
    spawnPoliceCar(); spawnPoliceCar();
    policeCars[0].x = player.x - 320; policeCars[0].y = player.y - 60;
    policeCars[1].x = player.x - 220; policeCars[1].y = player.y + 90;
    toast('★ Wanted level 3 — lose the Interceptors!');
  } else if (shotMode === 'mission') {
    gameTime = 20 * 60;
    resetPlayer(2440, 560, 100, 50, 'SMG');
    cam.x = player.x; cam.y = player.y;
    startMission(2);
    missionStep = 1;
    for (let i = 0; i < 5; i++) spawnEnemy(2300 + i * 90, 300 + (i % 2) * 130, 'Dock Rat');
    setObjective();
    toast('🔫 Ambush! Eliminate the Dock Rats!');
  }
  updateHUD();
  window.__solanoShot = shotMode;
}

/* -------------------------------------------------------------- main loop */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started) update(dt);
  render();
  requestAnimationFrame(loop);
}
spawnWorld();
applyShotScene();
render();
requestAnimationFrame(loop);
