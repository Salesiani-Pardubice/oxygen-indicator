# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository.

## Working rules

- **Language:** communicate with the user in Czech. Write all code (identifiers, comments, commit messages, PR text) in English. All website content (UI labels, texts, miner names, admin UI) is in Czech.
- **One feature = one PR:** every new feature goes on its own branch and in its own pull request. Do not bundle unrelated features.
- **The user checks every feature:** after implementing a feature, stop and let the user try it and review it before moving on. Do not start the next feature or merge a PR until the user has confirmed the current one.

## Project status

Feature-complete according to the original plan (all 8 planned features implemented, one PR each); open items are listed at the end. `README.md` is the original design brief (in Czech); this file records the decisions made on top of it.

## Commands

- `npm start` — run the server (`PORT` env var, default 3000). Prints the URLs reachable from the hotspot.
- `ADMIN_PIN=1234 npm start` — fixed admin PIN; without it a random 4-digit PIN is generated and printed in the console on every start.
- `STATE_FILE=/path/state.json npm start` — where the game is saved (default `data/state.json`).
- `ALLOW_REMOTE_REFILL=1 npm start` — dev switch that lets devices other than the server PC refill oxygen (by default only the PC running the server can, see below).
- `npm test` — run all tests (`node:test`, no extra dependencies).
- Run a single test file: `node --test test/app.test.js`; filter by name: `node --test --test-name-pattern="health"`.
- Requires Node.js 20 or newer (the target PC has 20/22/24, exact version unknown).

## Stack and structure

- **Server:** plain Node.js (`node:http`), ES modules, **no runtime dependencies**. Keep it that way unless there is a strong reason; the app has to be runnable offline after copying the folder.
- **Realtime:** server → clients via SSE (Server-Sent Events); clients → server via `POST`.
- **Web:** vanilla HTML/CSS/JS in `public/`, no build step. `/` is the display, `/admin` the admin page. Sounds are generated with Web Audio (no audio files).
- `server/game.js` — the authoritative game state (`createGame({ clock })`: `tick()`, `snapshot()`, plus the commands). The clock is injectable, so tests advance fake time instead of waiting.
- Refill API (`/api/refill/start|click|stop`, `/api/session`): `server/local.js` restricts it to requests coming from the server PC itself (loopback or one of its own interface addresses), so phones in the hotspot cannot refill. The lock owner is a per-tab `clientId` generated in `public/js/api.js`.
- Admin: `server/auth.js` (PIN → HMAC-derived session cookie, stateless so it survives restarts; 5 wrong PINs lock an address for 30 s), `server/admin-commands.js` (command type → game method; commands are validated inside `game.js` and return `{ ok }` / `{ ok: false, error, message }`). API: `POST /api/admin/login|logout|command`, `GET /api/admin/session|events`. The admin SSE stream carries `game.adminSnapshot()` (snapshot + settings). The game starts **paused**; the admin starts it.
- Events: definitions live in `config/events.json` (`id`, `label`, `multiplier`, `durationSec` or `null` = until ended), validated at startup by `server/events-config.js` (the server refuses to start on a bad file). Running events are game state: `startEvent(defId, { durationSec, targets })` (durationSec `undefined` = definition default, `null` = until ended; targets `'all'` or miner ids) and `endEvent(id)`. Overlapping events multiply. `advance()` in `game.js` splits time at event ends, so results don't depend on tick frequency, and event timers freeze while the game is paused. Snapshots carry `events` and a per-miner `boost`.
- Expiry log (game state, `state.log`, admin snapshot only): when a miner's oxygen hits 0 an entry `{ id, minerId, minerName, expiredAt, recoveredAt }` is added once; it stays open until that miner is refilled (or on reset / miner removed). `zeroSeconds` is computed per snapshot. `resetGame` keeps the log; `clearLog` keeps still-open entries. The game takes an injectable `wallClock` (epoch ms) next to the monotonic `clock`.
- Phone alerts: the admin page compares log ids with the last seen one (not on the first snapshot, so reloading doesn't alert for old expiries) and then beeps, vibrates and shows a banner (`admin-alerts.js`). Sound needs a user gesture (shared `bindSoundToggle` in `ui.js`, also used by the display); wake lock only works on secure origins, so over the plain-HTTP hotspot the phone has to be kept awake by hand.
- Persistence: `game.serialize()` ↔ `createGame({ restore })` (validated by `server/saved-state.js`, which throws on anything odd; the game's ranges are passed in so they exist only in `game.js`). `server/store.js` writes the JSON atomically (tmp file + rename); `server/persistence.js` saves every 2 s only when something changed, and `index.js` saves on SIGINT/SIGTERM. A restored game is always **paused** with no refill lock. A damaged file is renamed to `state.json.broken` and the game starts fresh. Whenever you add game state that must survive a restart, extend `serialize()` and `parseSavedState()` together (and bump `version` for incompatible changes).
- `GET /api/info` returns the LAN URLs of the display/admin; the display's "Připojení" dialog (`public/js/connect.js`, only offered on the server PC) shows them.
- Admin client: `public/js/admin.js` (+ `ui.js` segmented buttons/toast, `admin-events.js`, `admin-log.js`, `admin-alerts.js` for the cards; `log.js` has the pure log helpers). It updates DOM in place and never overwrites an input that has focus.
- `server/app.js` — HTTP routing and static serving; `server/sse.js` — SSE hub; `server/http-utils.js` — response helpers; `server/index.js` — wiring and the 250 ms tick/broadcast loop; `server/network.js` — LAN address discovery.
- `public/js/display.js` renders snapshots into gauges (DOM updated in place so CSS transitions work); `levels.js` (ok/low/critical/empty thresholds) and `format.js` (time formatting, Czech preset labels) are shared helpers.
- Alarm: `public/js/alarm-pattern.js` (pure: state → off/beep/siren; follows the most endangered miner, pitch differs per miner), `alarm.js` (loop scheduling with injected `playTone`), `audio.js` (Web Audio output + persisted mute). Audio only starts after a user gesture, so the display has a "Zapnout zvuk" button and the first click anywhere also unlocks it.
- `test/` — tests mirror the server modules and the pure client modules (`public/js/*.js` that don't touch the DOM can be imported in tests).
- `data/` (runtime state backup) is gitignored.

## What this is

A game UI for a mining-themed social game at a weekend camp for 8th–9th graders. Players are split into roles; two of them are a **miner** (works in a toxic environment and needs a constant oxygen supply) and an **operator** (monitors the miner's oxygen and refills it). The number of miners/teams is **configurable in the admin, from 4 to 6** (default 4). The app simulates how much oxygen each miner has left.

## Intended architecture (from the README)

- **Offline-capable web page** served by a simple **Node.js server** running on a PC. The page must run on any OS and not need internet once downloaded/installed ahead of time.
- The PC acts as a **Wi-Fi hotspot**. The main display shows **4–6 oxygen gauges** (one per miner) and **plays alarm sounds** when any gauge runs low.
- A separate **admin interface**, reachable from a phone over the hotspot, controls the game at runtime (so the server needs to push state changes to the display, and accept admin commands).
- **Refilling:** the operator comes to the PC, picks their miner's gauge (operator names are not tracked), then refills by **clicking the mouse for a while**. Each click adds a fixed amount (default +1 %, tunable). A refill need not be to 100%. **Only one operator (one PC) may refill at a time**: the server holds a lock, released after ~10 s without clicks or via a "done" button, refill is only possible from the display page, and the click rate is limited server-side (anti auto-clicker).
- **Timing:** a full mask lasts about **2 minutes** without refilling. Time is controlled from the phone (admin), and the admin is **notified when a miner's oxygen expires**.

### Admin features required

- Set the number of miners (4–6) and assign names to them.
- Log of **who ran out of oxygen and when** (used for later penalties in the game). When oxygen hits 0 it stays at 0, the expiry is logged, the admin phone gets a sound/vibration alert, and the miner can still be refilled.
- Trigger **special events**, e.g. a bomb blast that makes oxygen deplete 2× faster. Events are defined in `config/events.json` (name, multiplier, duration, target); each can optionally expire on its own or run until the admin ends it.
- Adjust depletion speed, or **pause** oxygen depletion.
- **Consumption presets, set per miner** (plus a "set for all" button): sleep ≈ 4 min per full mask, standard ≈ 2 min, work ≈ 1 min (sleep depletes 2× slower than standard, work 2× faster).
- Admin is protected by a PIN (set at server start, or random and printed to the console); the phone remembers it in a cookie.

Depletion per second = `100 / preset_duration_s × global_multiplier × event_multiplier`, computed on the server from monotonic time.

### Planned features (one PR each)

1. Project skeleton (done)
2. Game core + display with gauges and live updates (done)
3. Click-to-refill with lock and rate limit (done)
4. Audio alarm on the display (done; includes a mute button)
5. Admin: PIN, names, number of miners, pause, speed, presets (done)
6. Special events with countdown (done)
7. Expiry log + phone alerts (done)
8. State backup to `data/state.json` (restart restores the game paused), URL dialog (done; the QR code was left out, see below)

Open: a QR code to the admin page in the "Připojení" dialog. It needs a QR encoder; the candidate is the MIT-licensed `qrcode-generator` (single file, no dependencies) vendored into `public/vendor/`, but it is not added until the user approves adding third-party code.

Unscheduled ideas: manual +/- oxygen per miner, sound on event start, CSV export of the log, projector mode with team colors.

## Notes for working here

- Everything the players see (display, admin, labels, miner names) is in Czech; code, comments, commits and PR text are in English.
- The app must work offline on a hotspot with no internet: no CDN-hosted scripts, fonts, or sounds.
- Game-state authority should live on the server (oxygen levels, presets, events, pause state, expiry log), with the display and admin pages as clients, since the display PC and the admin phone must stay in sync.
