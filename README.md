# Tip Calculator BD

A free, fully offline bilingual (Bangla / English) restaurant tip calculator for Bangladesh. Enter the bill, pick a tip %, add service charge and 15% VAT if they apply, split the total among friends and family — and save the calculation for next time.

Live site: https://fahad3235.github.io/tip-calculator-bd/

## Problem

Splitting a restaurant bill in Bangladesh means juggling three extras at once: a tip, a service charge (many restaurants add 5–10%), and 15% VAT — then dividing the total fairly. Mental maths at the table gets it wrong; this app does the exact paisa math and shows every line.

## Features

- **Live bill breakdown** — bill, tip, service charge, VAT, grand total, per-person total and tip per person, recalculated on every keystroke
- **Tip presets** — 0 / 5 / 10 / 15 / 20% chips plus a custom % field (0–100%)
- **Service charge** — 0 / 5 / 10% chips plus custom % (0–50%); VAT toggle adds 15% on bill + service charge, with the base shown
- **Split among 1–20 people** — steppers plus direct entry
- **Round up** — grand total to the nearest Tk 5 or Tk 10, with the extra amount shown
- **Saved calculations** — save by name, tap to load, delete; up to 100 saved
- **JSON export / import** — strict validation (right app, version 1, valid records only)
- **Erase all** — typed-DELETE guard
- **Bilingual EN / বাংলা** — toggle persists, Bengali digits throughout
- **Fully offline** — zero network requests; all data stays in localStorage on the device

## Money math (exact)

All amounts are integer paisa — no floating-point drift:

- Tip = bill × tip% (rounded to the nearest paisa)
- Service charge = bill × service-charge%
- VAT (when on) = 15% × (bill + service charge)
- Grand total = bill + tip + service charge + VAT
- Round-up (when on) = ceiling of the grand total to the next Tk 5 / Tk 10
- Per person = grand total ÷ people (rounded to the nearest paisa)

## Stack

- Plain HTML + CSS + vanilla JavaScript (no framework, no build step, no dependencies)
- `js/logic.js` — pure, DOM-free money math (unit-tested in Node)
- `js/i18n.js` — EN/BN strings (generated from `tools/gen_i18n.py`, Bengali as `\uXXXX` escapes so every shipped source stays pure ASCII)
- `js/app.js` — DOM wiring, localStorage persistence

## Prerequisites

- Any modern browser. To run the tests: Node.js 18+ and a headless Chromium (the smoke test uses the Playwright `headless_shell` binary if present).

## Install / run

```sh
# Just open it — no install, no server needed:
open index.html
# or serve it locally:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Dev commands

```sh
node tests/logic.test.js   # 68 Node unit checks for js/logic.js
node tests/smoke.js        # 65 headless-Chrome checks (raw CDP, file://)
python3 tools/gen_i18n.py # regenerate js/i18n.js after editing strings
```

## Testing

- `node tests/logic.test.js` — 68/68 green: amount/% parsing, input validation limits, exact paisa math (tip, service charge, VAT base, split rounding, round-up), formatting, saved-record and import validation.
- `node tests/smoke.js` — 65/65 green: defaults, live calc (1250 + 10% = 1375.00), presets, service charge + VAT (1000 bill → 1365.00 total, 682.50 each for 2), round-up to nearest Tk 10, people steppers, inline validation errors, save/load, export/import round-trip, typed-DELETE erase, Bengali toggle with Bengali digits persisting after reload, 390px no-overflow on all 3 tabs, zero non-file network requests, 0 console/page errors.
- Hand-verified: 1000 bill + 10% tip + 10% service charge + 15% VAT, split 2 ways = 682.50 each; 1234 bill + 10% tip rounded to nearest Tk 10 = 1360.00 (extra 2.60).

## Deployment

Static site — any static host works. GitHub Pages: publish the `main` branch from the repository root.

## Limitations

- Tip and service charge are voluntary in Bangladesh — the app calculates what you ask for, it does not tell you what you must pay.
- The 15% VAT rate is the common restaurant rate at the time of writing; rates can change — always check the actual rate printed on the restaurant's bill.
- The tipping guide is general custom, not a rulebook.
- Saved data lives in the browser's localStorage on one device; export JSON to move it.

## Status

Complete MVP — factory run #308, 2026-11-11. Published and verified live.
