<!-- Solano Bay v1.2 — recorded rebuild -->
# SOLANO BAY — Make GTA 6 (make.fun bounty `gta6-01`)

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/adhiejoey/makefun-gta6-game/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/adhiejoey/makefun-gta6-game/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
make.fun bounty **[Make GTA 6](https://make.fun/bounty/gta6-01)** — $1,666,
closes Tue 24 Nov 2026 15:00 UTC / 22:00 WIB.
Referral code: `mcpf7r82`.

**Everything is original**: the city of Solano Bay, protagonist Mara Voss,
characters (Dario, the Dock Rats), vehicles (Comet GT, Bay Cruiser, …),
story, art and sound are all created for this entry. Nothing from Rockstar
Games. No network requests — the game plays offline in desktop Chrome from
its own files.

## Play

```sh
node main.ts            # build the entry into /output (or $MAKEFUN_OUTPUT_DIR)
node main.ts --check    # verify only (files, screenshots, syntax, dossier)
node main.ts --serve    # verify + serve at http://localhost:8901/
```

Or open `game/index.html` directly in desktop Chrome — no server needed.

**Controls**: WASD / arrows — move & drive · Shift — sprint · **E** — enter /
steal car, talk, interact · Mouse + click — aim & shoot · R — reload ·
**1 / 2** — pistol / SMG · Space — handbrake · P — save · M — sound on/off ·
Esc — pause.

## What is in the game

- **Open city on foot and by car** — Solano Bay: Downtown, Old Town, the
  Marina, Harbor Side, Hills, Solano Park, Palm Plaza, a beach and docks;
  day/dusk/night cycle with headlights after dark, and a district name in
  the HUD wherever you are.
- **Traffic + pedestrians** — 22 traffic cars following the road grid and
  turning at intersections, 34 pedestrians who walk the sidewalks and flee
  from gunfire and cars.
- **Cars to steal** — parked cars and traffic cars (carjacking raises your
  wanted level; the driver flees). 6 original car models, plus police
  Interceptors you really should not steal.
- **Wanted level + police** — 0–5 stars for carjacking, hit-and-runs,
  shooting police; police Interceptors chase and ram, foot cops chase and
  arrest (BUSTED); heat cools off when no police unit can see you; a Spray
  Shop respray ($200) clears your wanted level and repaints the car.
- **Missions + story (3)** — 1. *The Driver*: pick up a package for Dario
  and deliver it to the Marina. 2. *Harbor Heat*: steal the Comet GT and
  deliver it to the Hills lockup. 3. *The Marina Deal*: survive an ambush
  by the Dock Rats. Talk to Dario at his bar to start each job.
- **Combat** — pistol and an SMG pickup (hospital roof), mouse aim, reload,
  enemy AI that advances and shoots back, health/armor/ammo pickups around
  the city that respawn, damaged cars smoking before they explode.
- **HUD + minimap** — health, armor, cash, wanted stars, clock, district,
  weapon & ammo, speedometer, mission objective, live minimap with player,
  police, mission, spray-shop, bar and pickup blips.
- **Start + save** — title screen with New Game / Continue, pause menu
  (pauses on window blur too), death (WASTED) and arrest (BUSTED) flows,
  localStorage save (position, cash, health, armor, weapon, mission
  progress, stats) with autosave every 60 s.
- **Sound** — procedural WebAudio only (gunshots, sirens, engine hum,
  pickups, mission stings); no audio files.

## Screenshots

`screenshots/` holds 4 real renders of the game's own code, taken in a
headless Chromium on this machine from the running game (the first by name
is the cover):

1. `01-title.jpg` — title screen
2. `02-on-foot.jpg` — Mara on foot by Dario's Bar, HUD + minimap
3. `03-driving-wanted.jpg` — dusk car chase in the Comet GT, wanted level 3
4. `04-mission.jpg` — the Marina Deal ambush at night

The game ships screenshot scenes for this: open it with
`?shot=onfoot`, `?shot=driving` or `?shot=mission` (plus `?t=HH:MM` for
the clock) and it starts itself into that scene — the browser still
renders the live game, nothing is edited or composited afterwards.

## Files

| Path | What it is |
| --- | --- |
| `main.ts` | Node 22 program (stdlib only): builds the entry into `/output` (game/ + screenshots/ + `dossier.json` via `buildDossier`), `--check` verifies it, `--serve` serves `game/` for playtesting |
| `game/index.html` | The playable game page |
| `game/game.js` | The whole game (~1,180 lines, no dependencies) |
| `game/style.css` | HUD / menus styling |
| `screenshots/` | 4 real renders of the game's own code (JPEG, each under 256 KiB) |
| `LICENSE` | MIT (OSI-approved) |
| `vendor/makefun-game.ts` | Kit file, copied unchanged (fetched 17 Nov 2026 after opening) |
| `.makefun/owner.json` | Claim file naming the entrant's wallet |

## Vendor file status ✅

`vendor/makefun-game.ts` (sha256
`dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`) was
fetched from the official GTA 6 bounty kit after it opened
(`https://make.fun/c/gta6-01/kit`, downloaded 17 Nov 2026 ~22:05 WIB) and
copied unchanged from `starter/vendor/makefun-game.ts` in the kit — the
sha256 matches the kit's own `kit.json` entry for that file.
`node main.ts --check` passes.

## How this entry was built

The game was rebuilt end to end in a recorded make.fun agent session
(recording `01a1eaaf-b2c0-71ef-81f8-aecf12f8c65a`, started 18 Nov 2026):
every counted file — `game/game.js`, `game/index.html`, `game/style.css`,
`main.ts`, `README.md` — was rewritten in that session, the old
`screenshots/.gitkeep` placeholder was deleted, and the screenshots were
retaken from the rewritten game in a headless browser. `vendor/` was not
touched. The sealed recording is named at submit time.

## Submission checklist (before Tue 24 Nov 2026 15:00 UTC)

- [x] Fetch the bounty kit after opening; copy `vendor/makefun-game.ts` unchanged
- [x] Public GitHub repo created after the opening time (17 Nov 2026 15:00 UTC), owned by adhiejoey, MIT license
- [x] Rebuild every counted file in a recorded session; delete `screenshots/.gitkeep`
- [x] Retake 4 screenshots as real renders of the rewritten game
- [x] `node main.ts --check` passes; `makefun check` passes except the transcripts row (sealed at submit)
- [ ] GitHub About: website on make.fun + topic `makefun` (set before submit)
- [ ] Submit via make.fun before the deadline (max 5/day, 10 total; last submission is final)
