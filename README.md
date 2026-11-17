# SOLANO BAY — Make GTA 6 (make.fun bounty `gta6-01`)

An original open-world crime game in the spirit of GTA 6, built for the
make.fun bounty **"Make GTA 6"** — $1,666, opens Tue 17 Nov 2026 15:00 UTC /
22:00 WIB, ends Tue 24 Nov 2026 15:00 UTC.
Bounty page: https://make.fun/bounty/gta6-01

**Everything is original**: the city of Solano Bay, protagonist Mara Voss,
characters (Dario, the Dock Rats), vehicles (Comet GT, Bay Cruiser, …),
story, art and sound are all created for this entry. Nothing from Rockstar
Games. No network requests — the game plays offline in desktop Chrome from
its own files.

## Play

```sh
node main.ts            # verify + serve at http://localhost:8901/
node main.ts --check    # verify only
```

Or open `game/index.html` directly in desktop Chrome — no server needed.

**Controls**: WASD / arrows — move & drive · Shift — sprint · **E** — enter /
steal car, talk, interact · Mouse + click — aim & shoot · R — reload ·
Space — handbrake · P — save · M — sound on/off · Esc — pause.

## What is in the game

- **Open city on foot and by car** — Solano Bay: Downtown, Old Town, the
  Marina, Harbor Side, Hills, Solano Park, Palm Plaza, a beach and docks;
  day/dusk/night cycle.
- **Traffic + pedestrians** — 22 traffic cars following the road grid,
  34 pedestrians who walk the sidewalks and flee from gunfire and cars.
- **Cars to steal** — parked cars and traffic cars (carjacking raises your
  wanted level; the driver flees). 6 original car models.
- **Wanted level + police** — 0–5 stars for carjacking, hit-and-runs,
  shooting police; police Interceptors chase and ram, foot cops chase and
  arrest (BUSTED); heat cools off when you break line of sight; a Spray
  Shop respray ($200) clears your wanted level.
- **Missions + story (3)** — 1. *The Driver*: pick up a package for Dario
  and deliver it to the Marina. 2. *Harbor Heat*: steal the Comet GT and
  deliver it to the Hills lockup. 3. *The Marina Deal*: survive an ambush
  by the Dock Rats. Talk to Dario at his bar to start each job.
- **Combat** — pistol with mouse aim, reload, enemy AI that takes cover
  range and shoots back, health/armor/ammo pickups around the city.
- **HUD + minimap** — health, armor, cash, wanted stars, clock, weapon &
  ammo, speedometer, mission objective, live minimap with player, police,
  mission and spray-shop blips.
- **Start + save** — title screen with New Game / Continue, pause menu,
  death (WASTED) and arrest (BUSTED) flows, localStorage save (position,
  cash, health, mission progress, stats) with autosave.
- **Sound** — procedural WebAudio only (gunshots, sirens, engine, pickups);
  no audio files.

## Files

| Path | What it is |
| --- | --- |
| `main.ts` | Node 22 program (stdlib only): verifies the entry and serves `game/` for local playtesting |
| `game/index.html` | The playable game page |
| `game/game.js` | The whole game (~870 lines, no dependencies) |
| `game/style.css` | HUD / menus styling |
| `screenshots/` | 3–4 real renders of the game's own code |
| `LICENSE` | MIT (OSI-approved) |
| `vendor/makefun-game.ts` | Kit file, copied unchanged (fetched 17 Nov 2026 after opening) |

## Vendor file status ✅

`vendor/makefun-game.ts` (56,282 bytes, sha256
`dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`) was
fetched from the official GTA 6 bounty kit after it opened
(`https://make.fun/c/gta6-01/kit`, downloaded 17 Nov 2026 ~22:05 WIB) and
copied unchanged from `starter/vendor/makefun-game.ts` in the kit — the
sha256 matches the kit's own `kit.json` entry for that file.
`node main.ts --check` passes.

## Transcripts

The sealed recordings of the agent sessions that built this entry are made
by the kit's record command while the agent works and are named at submit
time. The kit was not available at build time, so no sealed recording
exists yet for this entry — run the kit's record command for the session
that performs the final submission packaging.

## Submission checklist (before the 24 Nov 2026 15:00 UTC deadline)

- [x] Fetch the bounty kit after opening; copy `vendor/makefun-game.ts` unchanged — done 17 Nov 2026 ~22:05 WIB
- [ ] Create the public GitHub repo **after** the opening time (17 Nov 2026 15:00 UTC), owned by your own account, MIT license
- [ ] `node main.ts --check` passes (3–4 screenshots present, vendor file present)
- [ ] Play-test in desktop Chrome; confirm screenshots are real renders
- [ ] Submit via make.fun (max 5/day, 10 total; last submission is final)
