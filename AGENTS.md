# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository.

## Working rules

- **Language:** communicate with the user in Czech. Write all code (identifiers, comments, commit messages, PR text) in English. All website content (UI labels, texts, miner names, admin UI) is in Czech.
- **One feature = one PR:** every new feature goes on its own branch and in its own pull request. Do not bundle unrelated features.
- **The user checks every feature:** after implementing a feature, stop and let the user try it and review it before moving on. Do not start the next feature or merge a PR until the user has confirmed the current one.

## Project status

Early implementation. `README.md` is the original design brief (in Czech); this file records the decisions made on top of it. Features are being added one PR at a time (see the planned order below). Only the project skeleton exists so far: a static server with placeholder display and admin pages.

## Commands

- `npm start` — run the server (`PORT` env var, default 3000). Prints the URLs reachable from the hotspot.
- `npm test` — run all tests (`node:test`, no extra dependencies).
- Run a single test file: `node --test test/app.test.js`; filter by name: `node --test --test-name-pattern="health"`.
- Requires Node.js 20 or newer (the target PC has 20/22/24, exact version unknown).

## Stack and structure

- **Server:** plain Node.js (`node:http`), ES modules, **no runtime dependencies**. Keep it that way unless there is a strong reason; the app has to be runnable offline after copying the folder.
- **Realtime:** server → clients via SSE (Server-Sent Events); clients → server via `POST`.
- **Web:** vanilla HTML/CSS/JS in `public/`, no build step. `/` is the display, `/admin` the admin page. Sounds are generated with Web Audio (no audio files).
- `server/app.js` — HTTP handler and static serving; `server/index.js` — startup; `server/network.js` — LAN address discovery; `test/` — tests.
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
2. Game core + display with gauges and live updates
3. Click-to-refill with lock and rate limit
4. Audio alarm on the display (starts after a "start game" click because of browser autoplay rules)
5. Admin: PIN, names, number of miners, pause, speed, presets
6. Special events with countdown
7. Expiry log + phone alerts
8. State backup to `data/state.json` (restart restores the game paused), URL printout, QR code to admin

Unscheduled ideas: manual +/- oxygen per miner, single-miner events (e.g. leak), time-at-zero per miner and CSV export of the log, projector mode with team colors, mute button.

## Notes for working here

- Everything the players see (display, admin, labels, miner names) is in Czech; code, comments, commits and PR text are in English.
- The app must work offline on a hotspot with no internet: no CDN-hosted scripts, fonts, or sounds.
- Game-state authority should live on the server (oxygen levels, presets, events, pause state, expiry log), with the display and admin pages as clients, since the display PC and the admin phone must stay in sync.
