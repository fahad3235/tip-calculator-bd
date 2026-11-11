# TEST_RESULTS.md — tip-calculator-bd (factory run #308, 2026-11-11)

Real results, run on this VM. Nothing invented.

## Node unit tests — 68/68 green

Command: `node tests/logic.test.js`

- Amount parsing: `1250` → 125000 paisa, `1250.50` → 125050, `1,250.50` strips commas, `0.05` → 5; rejects empty / `abc` / 3 decimals / negative / `12.5.6`.
- Percent parsing: `10` → 10, `7.5` → 7.5; rejects empty / `abc` / negative.
- Validation limits: bill 0 → zero, bill 1000000.01 → tooBig, bill 1000000 ok; tip 101 → tooBig, tip 100 ok; service charge 51 → tooBig; people 0 → min, 21 → tooBig, 20 ok, `abc` → invalid; roundTo 300 → invalid.
- Exact paisa math (hand-checked):
  - 1250 bill + 10% tip → tip 125.00, total 1375.00, per person 1375.00.
  - 1000 bill + 10% tip + 10% service charge + 15% VAT → tip 100.00, service 100.00, VAT base 1100.00, VAT 165.00, total 1365.00, per person (2) 682.50, tip per person 50.00.
  - 9.99 bill + 10% tip → tip rounds 0.999 → 1.00, total 10.99.
  - 10.00 split 3 ways → 3.33 each.
  - Round to nearest Tk 10: 1357.40 → 1360.00, extra 2.60. Already-multiple total: no extra. 1000.01 rounded to Tk 5 → 1005.00, extra 4.99.
- Formatting: 125050 → `1,250.50`; 5 paisa → `0.05`; formatTaka starts with the taka sign.
- Saved-record / import validation: good record valid; empty name / bill 0 / tip 101 / people 21 / roundTo 300 / bad date all rejected; import rejects wrong app, version 2, bad record, non-array saved, 101 records, null.

## Headless-Chrome smoke tests — 65/65 green

Command: `node tests/smoke.js` (raw CDP, headless_shell-1187, file://)

- Defaults: tip 10, service charge 0, people 1, VAT off, result empty state, no error on first load, 6 guide items, 5 tip chips, 3 service-charge chips.
- Live calc: 1250 + 10% → tip 125.00, total 1,375.00, per person 1,375.00; VAT and round-extra rows hidden.
- Preset 15% → tip 187.50, total 1,437.50.
- Service charge 10% + VAT on, 4 people → service 125.00, VAT 206.25, total 1,768.75, per person 442.19, tip per person 46.88.
- Round to nearest Tk 10: 1234 + 10% → total 1,360.00, extra 2.60.
- People steppers: + → 2 people, 687.50 each; − → back to 1.
- Validation: `abc` bill shows error and hides result; `0` bill error mentions "more than 0"; tip 101 shows error; valid input clears it.
- Save/load: save "Test dinner" → confirmation, 1 saved card, load restores bill 1,250.00 and total 1,375.00.
- Export/import: payload is tip-calculator-bd v1, carries the name; eraseAll empties; valid import restores; wrong-app import rejected and leaves data intact; bad JSON via UI shows error; good JSON via UI succeeds.
- Typed-DELETE: wrong word rejected and keeps data; DELETE erases and shows success.
- Language: Bengali title + Bengali-digit total (১,৩৭৫.০০), saved-tab label in Bengali, persists after reload, back to EN.
- Footer mentions voluntary tip.
- 390px mobile: no horizontal overflow on calc / saved / guide tabs.
- Zero non-file network requests; 0 console/page errors.

## Repairs

- 1 syntax error in tests/smoke.js (extra `)`), caught by running the test — fixed, re-run 65/65 green.
- 2 non-ASCII characters in shipped sources (taka sign in a comment, `·` separators) found by grep — replaced with ASCII, re-verified pure-ASCII.
