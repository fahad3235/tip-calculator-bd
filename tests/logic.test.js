// tip-calculator-bd -- node unit tests for js/logic.js (no DOM needed).
// Usage: node tests/logic.test.js   (exit 0 = all green)
const L = require('../js/logic.js');
let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}

// ---- parseAmount ----
check('parse 1250 -> 125000 paisa', L.parseAmount('1250') === 125000);
check('parse 1250.50 -> 125050', L.parseAmount('1250.50') === 125050);
check('parse 1250.5 -> 125050', L.parseAmount('1250.5') === 125050);
check('parse 1,250.50 strips commas', L.parseAmount('1,250.50') === 125050);
check('parse 0 -> 0', L.parseAmount('0') === 0);
check('parse 0.05 -> 5', L.parseAmount('0.05') === 5);
check('reject empty', L.parseAmount('') === null);
check('reject abc', L.parseAmount('abc') === null);
check('reject 12.345 (3 decimals)', L.parseAmount('12.345') === null);
check('reject -5', L.parseAmount('-5') === null);
check('reject 12.5.6', L.parseAmount('12.5.6') === null);

// ---- parsePct ----
check('parsePct 10 -> 10', L.parsePct('10') === 10);
check('parsePct 7.5 -> 7.5', L.parsePct('7.5') === 7.5);
check('reject parsePct empty', L.parsePct('') === null);
check('reject parsePct abc', L.parsePct('abc') === null);
check('reject parsePct -1', L.parsePct('-1') === null);

// ---- validateInputs ----
function valid() { return { bill: '1250', tipPct: '10', scPct: '0', vat: false, people: '1', roundTo: 0 }; }
check('valid inputs ok', L.validateInputs(valid()).ok);
check('valid values parsed', L.validateInputs(valid()).values.billPaisa === 125000);
check('empty bill invalid', L.validateInputs(Object.assign(valid(), { bill: '' })).errors.bill === 'invalid');
check('bill 0 zero', L.validateInputs(Object.assign(valid(), { bill: '0' })).errors.bill === 'zero');
check('bill 1000000.01 tooBig', L.validateInputs(Object.assign(valid(), { bill: '1000000.01' })).errors.bill === 'tooBig');
check('bill 1000000 ok (max)', L.validateInputs(Object.assign(valid(), { bill: '1000000' })).ok);
check('tip 101 tooBig', L.validateInputs(Object.assign(valid(), { tipPct: '101' })).errors.tipPct === 'tooBig');
check('tip 100 ok', L.validateInputs(Object.assign(valid(), { tipPct: '100' })).ok);
check('sc 51 tooBig', L.validateInputs(Object.assign(valid(), { scPct: '51' })).errors.scPct === 'tooBig');
check('people 0 min', L.validateInputs(Object.assign(valid(), { people: '0' })).errors.people === 'min');
check('people 21 tooBig', L.validateInputs(Object.assign(valid(), { people: '21' })).errors.people === 'tooBig');
check('people 20 ok', L.validateInputs(Object.assign(valid(), { people: '20' })).ok);
check('people abc invalid', L.validateInputs(Object.assign(valid(), { people: 'abc' })).errors.people === 'invalid');
check('roundTo 300 invalid', L.validateInputs(Object.assign(valid(), { roundTo: 300 })).errors.roundTo === 'invalid');

// ---- calcBill ----
let r = L.calcBill({ billPaisa: 125000, tipPct: 10, scPct: 0, vat: false, people: 1, roundTo: 0 });
check('1250 + 10% tip = 125.00', r.tip === 12500, 'got ' + r.tip);
check('1250 + 10% total = 1375.00', r.total === 137500, 'got ' + r.total);
check('per person 1 = total', r.perPerson === 137500);
check('no vat row is 0', r.vat === 0);
check('no round extra', r.roundExtra === 0);

r = L.calcBill({ billPaisa: 100000, tipPct: 10, scPct: 10, vat: true, people: 2, roundTo: 0 });
check('1000 bill: tip 100.00', r.tip === 10000, 'got ' + r.tip);
check('1000 bill: service 100.00', r.service === 10000, 'got ' + r.service);
check('vat base 1100.00', r.vatBase === 110000, 'got ' + r.vatBase);
check('vat 15% of 1100 = 165.00', r.vat === 16500, 'got ' + r.vat);
check('full total 1365.00', r.total === 136500, 'got ' + r.total);
check('per person 682.50', r.perPerson === 68250, 'got ' + r.perPerson);
check('tip per person 50.00', r.perPersonTip === 5000, 'got ' + r.perPersonTip);

r = L.calcBill({ billPaisa: 999, tipPct: 10, scPct: 0, vat: false, people: 1, roundTo: 0 });
check('9.99 bill: tip rounds 0.999 -> 1.00', r.tip === 100, 'got ' + r.tip);
check('9.99 bill: total 10.99', r.total === 1099, 'got ' + r.total);

r = L.calcBill({ billPaisa: 1000, tipPct: 0, scPct: 0, vat: false, people: 3, roundTo: 0 });
check('10.00 split 3 ways: 3.33 each', r.perPerson === 333, 'got ' + r.perPerson);

r = L.calcBill({ billPaisa: 123400, tipPct: 10, scPct: 0, vat: false, people: 1, roundTo: 1000 });
check('round to 10: 1357.40 -> 1360.00', r.total === 136000, 'got ' + r.total);
check('round extra 2.60', r.roundExtra === 260, 'got ' + r.roundExtra);

r = L.calcBill({ billPaisa: 137500, tipPct: 0, scPct: 0, vat: false, people: 1, roundTo: 500 });
check('already multiple of 5: no extra', r.total === 137500 && r.roundExtra === 0);

r = L.calcBill({ billPaisa: 100001, tipPct: 0, scPct: 0, vat: false, people: 1, roundTo: 500 });
check('round to 5: 1000.01 -> 1005.00', r.total === 100500 && r.roundExtra === 499, 'got ' + r.total);

// ---- formatAmount / formatTaka ----
check('format 125050 -> 1,250.50', L.formatAmount(125050) === '1,250.50');
check('format 100 -> 1.00', L.formatAmount(100) === '1.00');
check('format 5 -> 0.05', L.formatAmount(5) === '0.05');
check('format 0 -> 0.00', L.formatAmount(0) === '0.00');
check('formatTaka starts with taka sign', L.formatTaka(125050) === '\u09F31,250.50');

// ---- validateSaved / validateImport ----
function goodRec() {
  return { name: 'Friday dinner', billPaisa: 125000, tipPct: 10, scPct: 0, vat: false, people: 4, roundTo: 0, totalPaisa: 137500, savedAt: '2026-11-11' };
}
check('good saved record valid', L.validateSaved(goodRec()));
check('saved: empty name invalid', !L.validateSaved(Object.assign(goodRec(), { name: '' })));
check('saved: bill 0 invalid', !L.validateSaved(Object.assign(goodRec(), { billPaisa: 0 })));
check('saved: tip 101 invalid', !L.validateSaved(Object.assign(goodRec(), { tipPct: 101 })));
check('saved: people 21 invalid', !L.validateSaved(Object.assign(goodRec(), { people: 21 })));
check('saved: roundTo 300 invalid', !L.validateSaved(Object.assign(goodRec(), { roundTo: 300 })));
check('saved: bad date invalid', !L.validateSaved(Object.assign(goodRec(), { savedAt: 'tomorrow' })));
check('import good payload ok', L.validateImport({ app: 'tip-calculator-bd', version: 1, saved: [goodRec()] }).ok);
check('import wrong app rejected', !L.validateImport({ app: 'dice-roller-bd', version: 1, saved: [] }).ok);
check('import version 2 rejected', !L.validateImport({ app: 'tip-calculator-bd', version: 2, saved: [] }).ok);
check('import bad record rejected', !L.validateImport({ app: 'tip-calculator-bd', version: 1, saved: [Object.assign(goodRec(), { name: '' })] }).ok);
check('import saved not array rejected', !L.validateImport({ app: 'tip-calculator-bd', version: 1, saved: {} }).ok);
var many = []; for (var i = 0; i < 101; i++) many.push(goodRec());
check('import 101 records rejected', !L.validateImport({ app: 'tip-calculator-bd', version: 1, saved: many }).ok);
check('import null rejected', !L.validateImport(null).ok);

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
