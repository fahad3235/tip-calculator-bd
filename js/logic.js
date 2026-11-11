// tip-calculator-bd -- pure money math (no DOM). Integer paisa math throughout.
// Usage in node: const L = require('../js/logic.js');
(function (root) {
  'use strict';

  var MAX_BILL_PAISA = 100000000; // Tk 1,000,000
  var MAX_PEOPLE = 20;
  var VAT_RATE = 15; // percent, applied to bill + service charge when enabled

  // Parse a taka amount string into integer paisa. Returns null when invalid.
  // Accepts "123", "123.4", "123.45", " 1,234.50 " (commas stripped).
  function parseAmount(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim().replace(/,/g, '');
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split('.');
    var taka = parseInt(parts[0], 10);
    var paisa = parts.length === 2 ? parseInt((parts[1] + '00').slice(0, 2), 10) : 0;
    var total = taka * 100 + paisa;
    if (!isFinite(total) || total < 0) return null;
    return total;
  }

  // Parse a percentage string. Returns null when invalid (not a number, < 0).
  function parsePct(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim();
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var v = parseFloat(s);
    if (!isFinite(v) || v < 0) return null;
    return v;
  }

  // Validate a full input set. Returns { ok, errors: {field: code}, values }.
  // values holds parsed numbers when ok.
  function validateInputs(inp) {
    var errors = {};
    var bill = parseAmount(inp.bill);
    if (bill === null) errors.bill = 'invalid';
    else if (bill < 1) errors.bill = 'zero';
    else if (bill > MAX_BILL_PAISA) errors.bill = 'tooBig';
    var tipPct = parsePct(inp.tipPct);
    if (tipPct === null) errors.tipPct = 'invalid';
    else if (tipPct > 100) errors.tipPct = 'tooBig';
    var scPct = parsePct(inp.scPct);
    if (scPct === null) errors.scPct = 'invalid';
    else if (scPct > 50) errors.scPct = 'tooBig';
    var people = inp.people;
    if (typeof people === 'string') {
      if (!/^\d+$/.test(people.trim())) errors.people = 'invalid';
      else people = parseInt(people.trim(), 10);
    }
    if (!errors.people) {
      if (!isFinite(people) || people < 1) errors.people = 'min';
      else if (people > MAX_PEOPLE) errors.people = 'tooBig';
    }
    var roundTo = inp.roundTo;
    if (roundTo !== 0 && roundTo !== 500 && roundTo !== 1000) errors.roundTo = 'invalid';
    var ok = Object.keys(errors).length === 0;
    return {
      ok: ok,
      errors: errors,
      values: ok ? { billPaisa: bill, tipPct: tipPct, scPct: scPct, vat: !!inp.vat, people: people, roundTo: roundTo } : null
    };
  }

  // Core calculation. Input: { billPaisa, tipPct, scPct, vat, people, roundTo }.
  // All money in integer paisa. Returns breakdown in paisa.
  function calcBill(v) {
    var tip = Math.round(v.billPaisa * v.tipPct / 100);
    var service = Math.round(v.billPaisa * v.scPct / 100);
    var vatBase = v.billPaisa + service;
    var vatAmt = v.vat ? Math.round(vatBase * VAT_RATE / 100) : 0;
    var total = v.billPaisa + tip + service + vatAmt;
    var roundExtra = 0;
    if (v.roundTo > 0) {
      var rounded = Math.ceil(total / v.roundTo) * v.roundTo;
      roundExtra = rounded - total;
      total = rounded;
    }
    var perPerson = Math.round(total / v.people);
    var perPersonTip = Math.round(tip / v.people);
    return {
      bill: v.billPaisa,
      tip: tip,
      service: service,
      vat: vatAmt,
      vatBase: vatBase,
      total: total,
      roundExtra: roundExtra,
      perPerson: perPerson,
      perPersonTip: perPersonTip,
      people: v.people
    };
  }

  // Format integer paisa as "1,234.56" (no currency symbol; UI adds it).
  function formatAmount(paisa) {
    var neg = paisa < 0;
    var abs = Math.abs(Math.round(paisa));
    var taka = Math.floor(abs / 100);
    var p = abs % 100;
    var takaStr = String(taka).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + takaStr + '.' + (p < 10 ? '0' : '') + p;
  }

  // Format with the taka sign.
  function formatTaka(paisa) {
    return '\u09F3' + formatAmount(paisa);
  }

  // ---- saved-calculation records + export/import ----
  function validateSaved(rec) {
    if (!rec || typeof rec !== 'object') return false;
    if (typeof rec.name !== 'string' || rec.name.trim() === '' || rec.name.length > 60) return false;
    if (!isFinite(rec.billPaisa) || rec.billPaisa < 1 || rec.billPaisa > MAX_BILL_PAISA) return false;
    if (!isFinite(rec.tipPct) || rec.tipPct < 0 || rec.tipPct > 100) return false;
    if (!isFinite(rec.scPct) || rec.scPct < 0 || rec.scPct > 50) return false;
    if (typeof rec.vat !== 'boolean') return false;
    if (!isFinite(rec.people) || rec.people < 1 || rec.people > MAX_PEOPLE) return false;
    if (rec.roundTo !== 0 && rec.roundTo !== 500 && rec.roundTo !== 1000) return false;
    if (!isFinite(rec.totalPaisa) || rec.totalPaisa < 1) return false;
    if (typeof rec.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(rec.savedAt)) return false;
    return true;
  }

  function validateImport(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'notObject' };
    if (payload.app !== 'tip-calculator-bd') return { ok: false, error: 'wrongApp' };
    if (payload.version !== 1) return { ok: false, error: 'version' };
    if (!Array.isArray(payload.saved)) return { ok: false, error: 'savedNotArray' };
    if (payload.saved.length > 100) return { ok: false, error: 'tooMany' };
    for (var i = 0; i < payload.saved.length; i++) {
      if (!validateSaved(payload.saved[i])) return { ok: false, error: 'badRecord' };
    }
    return { ok: true };
  }

  var api = {
    MAX_BILL_PAISA: MAX_BILL_PAISA,
    MAX_PEOPLE: MAX_PEOPLE,
    VAT_RATE: VAT_RATE,
    parseAmount: parseAmount,
    parsePct: parsePct,
    validateInputs: validateInputs,
    calcBill: calcBill,
    formatAmount: formatAmount,
    formatTaka: formatTaka,
    validateSaved: validateSaved,
    validateImport: validateImport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TipCalcLogic = api;
})(typeof window !== 'undefined' ? window : this);
