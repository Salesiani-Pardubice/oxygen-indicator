# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository.

## Working rules

- **Language:** communicate with the user in Czech. Write all code (identifiers, comments, commit messages, PR text) in English. All website content (UI labels, texts, miner names, admin UI) is in Czech.
- **One feature = one PR:** every new feature goes on its own branch and in its own pull request. Do not bundle unrelated features.
- **The user checks every feature:** after implementing a feature, stop and let the user try it and review it before moving on. Do not start the next feature or merge a PR until the user has confirmed the current one.

## Project status

Pre-implementation. The repo contains only `README.md`, a design brief written in Czech. There is no source code, package manifest, build system, linter, or test suite yet, so there are no build/test commands to document. Update this file once a stack is chosen and code exists.

## What this is

A game UI for a mining-themed social game at a weekend camp for 8th–9th graders. Players are split into roles; two of them are a **miner** (works in a toxic environment and needs a constant oxygen supply) and an **operator** (monitors the miner's oxygen and refills it). There are always **4 teams**, so 4 miners. The app simulates how much oxygen each miner has left.

## Intended architecture (from the README)

- **Offline-capable web page** served by a simple **Node.js server** running on a PC. The page must run on any OS and not need internet once downloaded/installed ahead of time.
- The PC acts as a **Wi-Fi hotspot**. The main display shows **4 oxygen gauges** (one per miner) and **plays alarm sounds** when any gauge runs low.
- A separate **admin interface**, reachable from a phone over the hotspot, controls the game at runtime (so the server needs to push state changes to the display, and accept admin commands).
- **Refilling:** the operator comes to the PC, picks their name and/or their miner's gauge, then refills by **clicking the mouse for a while**. A refill need not be to 100%. **Only one operator (one PC) may refill at a time**, so refill needs to be a single-owner/locked action.
- **Timing:** a full mask lasts about **2 minutes** without refilling. Time is controlled from the phone (admin), and the admin is **notified when a miner's oxygen expires**.

### Admin features required

- Assign names to miners.
- Log of **who ran out of oxygen and when** (used for later penalties in the game).
- Trigger **special events**, e.g. a bomb blast that makes oxygen deplete 2× faster.
- Adjust depletion speed, or **pause** oxygen depletion.
- **Consumption presets**: sleep ≈ 4 min per full mask, standard ≈ 2 min, work ≈ 1 min (sleep depletes 2× slower than standard, work 2× faster).

The README also asks for suggestions of further improvements; none are recorded in the repo yet.

## Notes for working here

- The README and the intended UI audience are Czech-speaking; user-facing strings (miner names, labels, admin UI) will likely need to be in Czech.
- Keep dependencies minimal and bundleable, because the app must work offline on a hotspot with no internet (e.g. no CDN-hosted scripts, fonts, or sounds).
- Game-state authority should live on the server (oxygen levels, presets, events, pause state, expiry log), with the display and admin pages as clients, since the display PC and the admin phone must stay in sync.
