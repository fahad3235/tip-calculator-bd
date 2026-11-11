// tip-calculator-bd -- DOM wiring (offline, localStorage only).
(function () {
  'use strict';
  var L = window.TipCalcLogic;
  var LS_KEY = 'tip-calculator-bd-v1';
  var state = { lang: 'en', saved: [], inputs: { bill: '', tipPct: '10', scPct: '0', vat: false, people: '1', roundTo: 0 } };
  var lastCalc = null;
  var interacted = false;

  function $(id) { return document.getElementById(id); }
  function t(key) { return window.I18N[state.lang][key]; }
  function bnDigits(str) {
    if (state.lang !== 'bn') return str;
    var map = window.I18N.bn.bnDigits;
    return String(str).replace(/[0-9]/g, function (d) { return map[Number(d)]; });
  }
  function money(paisa) {
    return bnDigits(L.formatTaka(paisa));
  }
  function num(n) { return bnDigits(String(n)); }

  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.lang === 'en' || data.lang === 'bn') state.lang = data.lang;
        if (Array.isArray(data.saved)) state.saved = data.saved.filter(L.validateSaved);
        if (data.inputs && typeof data.inputs === 'object') {
          var inp = data.inputs;
          if (typeof inp.bill === 'string') state.inputs.bill = inp.bill;
          if (typeof inp.tipPct === 'string') state.inputs.tipPct = inp.tipPct;
          if (typeof inp.scPct === 'string') state.inputs.scPct = inp.scPct;
          if (typeof inp.vat === 'boolean') state.inputs.vat = inp.vat;
          if (typeof inp.people === 'string') state.inputs.people = inp.people;
          if (inp.roundTo === 0 || inp.roundTo === 500 || inp.roundTo === 1000) state.inputs.roundTo = inp.roundTo;
        }
      }
    } catch (e) { /* corrupted storage: start fresh */ }
  }
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }

  function readInputs() {
    return {
      bill: $('billInput').value,
      tipPct: $('tipInput').value,
      scPct: $('scInput').value,
      vat: $('vatCheck').checked,
      people: $('peopleInput').value,
      roundTo: Number(document.querySelector('input[name="round"]:checked').value)
    };
  }
  function writeInputs(inp) {
    $('billInput').value = inp.bill;
    $('tipInput').value = inp.tipPct;
    $('scInput').value = inp.scPct;
    $('vatCheck').checked = inp.vat;
    $('peopleInput').value = inp.people;
    document.querySelector('input[name="round"][value="' + inp.roundTo + '"]').checked = true;
  }
  function syncStateInputs() {
    state.inputs = readInputs();
    persist();
  }

  function showError(id, code) {
    var el = $(id);
    if (!code) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = t('err_' + code);
  }

  function recalc() {
    var inp = readInputs();
    var v = L.validateInputs(inp);
    var show = interacted;
    showError('billError', show && v.errors.bill ? 'bill_' + v.errors.bill : null);
    showError('tipError', show && v.errors.tipPct ? 'tip_' + v.errors.tipPct : null);
    showError('scError', show && v.errors.scPct ? 'sc_' + v.errors.scPct : null);
    showError('peopleError', show && v.errors.people ? 'people' : null);
    if (!v.ok) {
      lastCalc = null;
      $('resultContent').hidden = true;
      $('resultEmpty').hidden = false;
      return null;
    }
    var r = L.calcBill(v.values);
    lastCalc = { values: v.values, result: r };
    $('valBill').textContent = money(r.bill);
    $('valTip').textContent = money(r.tip) + ' (' + num(v.values.tipPct) + '%)';
    $('valService').textContent = money(r.service) + ' (' + num(v.values.scPct) + '%)';
    $('rowVat').hidden = !v.values.vat;
    $('valVat').textContent = money(r.vat);
    $('rowRoundExtra').hidden = r.roundExtra === 0;
    $('valRoundExtra').textContent = money(r.roundExtra);
    $('valTotal').textContent = money(r.total);
    $('valPerPerson').textContent = money(r.perPerson);
    $('valPerPersonTip').textContent = money(r.perPersonTip);
    $('resultEmpty').hidden = true;
    $('resultContent').hidden = false;
    return r;
  }

  function renderSaved() {
    var list = $('savedList');
    list.innerHTML = '';
    $('savedEmpty').hidden = state.saved.length !== 0;
    state.saved.forEach(function (rec, i) {
      var card = document.createElement('div');
      card.className = 'saved-card';
      var name = document.createElement('div');
      name.className = 'saved-name';
      name.textContent = rec.name;
      var meta = document.createElement('div');
      meta.className = 'saved-meta';
      meta.textContent = rec.savedAt + '  |  ' + t('rowBill') + ' ' + money(rec.billPaisa) +
        '  |  ' + t('tipLabel') + ' ' + num(rec.tipPct) + '%  |  ' + num(rec.people) +
        ' ' + t('peopleLabel').toLowerCase();
      var total = document.createElement('div');
      total.className = 'saved-total';
      total.textContent = t('rowTotal') + ': ' + money(rec.totalPaisa);
      var loadBtn = document.createElement('button');
      loadBtn.className = 'btn small';
      loadBtn.textContent = t('loadBtn');
      loadBtn.addEventListener('click', function () { loadSaved(i); });
      var delBtn = document.createElement('button');
      delBtn.className = 'btn small danger';
      delBtn.textContent = t('deleteBtn');
      delBtn.addEventListener('click', function () {
        state.saved.splice(i, 1);
        persist();
        renderSaved();
      });
      var row = document.createElement('div');
      row.className = 'saved-actions';
      row.appendChild(loadBtn);
      row.appendChild(delBtn);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(total);
      card.appendChild(row);
      list.appendChild(card);
    });
  }

  function loadSaved(i) {
    var rec = state.saved[i];
    if (!rec) return;
    writeInputs({
      bill: L.formatAmount(rec.billPaisa),
      tipPct: String(rec.tipPct),
      scPct: String(rec.scPct),
      vat: rec.vat,
      people: String(rec.people),
      roundTo: rec.roundTo
    });
    syncStateInputs();
    recalc();
    switchTab('calc');
  }

  function saveCurrent() {
    if (!lastCalc) { recalc(); }
    if (!lastCalc) return;
    var name = $('saveName').value.trim();
    if (!name) { $('saveName').focus(); return; }
    var rec = {
      name: name.slice(0, 60),
      billPaisa: lastCalc.values.billPaisa,
      tipPct: lastCalc.values.tipPct,
      scPct: lastCalc.values.scPct,
      vat: lastCalc.values.vat,
      people: lastCalc.values.people,
      roundTo: lastCalc.values.roundTo,
      totalPaisa: lastCalc.result.total,
      savedAt: new Date().toISOString().slice(0, 10)
    };
    if (!L.validateSaved(rec)) return;
    state.saved.unshift(rec);
    if (state.saved.length > 100) state.saved.length = 100;
    persist();
    $('saveName').value = '';
    $('saveMsg').hidden = false;
    renderSaved();
  }

  function exportPayload() {
    return JSON.stringify({ app: 'tip-calculator-bd', version: 1, saved: state.saved });
  }
  function importPayload(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'bad json' }; }
    var v = L.validateImport(parsed);
    if (!v.ok) return { ok: false, error: v.error };
    state.saved = parsed.saved.slice();
    persist();
    renderSaved();
    return { ok: true };
  }
  function eraseAll() {
    state.saved = [];
    persist();
    renderSaved();
  }

  function switchTab(name) {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
  }

  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    $('langBtn').textContent = t('langBtn');
    $('title').textContent = t('title');
    document.title = t('title');
    $('footerText').textContent = t('footer');
    recalc();
    renderSaved();
  }

  function init() {
    loadState();
    writeInputs(state.inputs);
    // tabs
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    // inputs -> live recalc
    ['billInput', 'tipInput', 'scInput', 'peopleInput'].forEach(function (id) {
      $(id).addEventListener('input', function () { interacted = true; syncStateInputs(); recalc(); $('saveMsg').hidden = true; });
    });
    $('vatCheck').addEventListener('change', function () { interacted = true; syncStateInputs(); recalc(); });
    document.querySelectorAll('input[name="round"]').forEach(function (r) {
      r.addEventListener('change', function () { interacted = true; syncStateInputs(); recalc(); });
    });
    // tip presets
    document.querySelectorAll('[data-tip]').forEach(function (b) {
      b.addEventListener('click', function () {
        $('tipInput').value = b.getAttribute('data-tip');
        syncStateInputs(); recalc();
      });
    });
    // service-charge presets
    document.querySelectorAll('[data-sc]').forEach(function (b) {
      b.addEventListener('click', function () {
        $('scInput').value = b.getAttribute('data-sc');
        syncStateInputs(); recalc();
      });
    });
    // people steppers
    $('peopleMinus').addEventListener('click', function () {
      var n = Math.max(1, (parseInt($('peopleInput').value, 10) || 1) - 1);
      $('peopleInput').value = String(n);
      syncStateInputs(); recalc();
    });
    $('peoplePlus').addEventListener('click', function () {
      var n = Math.min(L.MAX_PEOPLE, (parseInt($('peopleInput').value, 10) || 1) + 1);
      $('peopleInput').value = String(n);
      syncStateInputs(); recalc();
    });
    // save
    $('saveBtn').addEventListener('click', saveCurrent);
    // export
    $('exportBtn').addEventListener('click', function () {
      var blob = new Blob([exportPayload()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tip-calculator-bd-export.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    // import
    $('importBtn').addEventListener('click', function () {
      var res = importPayload($('importText').value);
      $('importOk').hidden = !res.ok;
      $('importFail').hidden = res.ok;
      if (!res.ok) $('importFail').textContent = t('importFail') + res.error;
    });
    // erase
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value !== 'DELETE') {
        $('eraseWrong').hidden = false;
        $('erasedMsg').hidden = true;
        return;
      }
      $('eraseWrong').hidden = true;
      eraseAll();
      $('eraseInput').value = '';
      $('erasedMsg').hidden = false;
    });
    // language
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      persist();
      applyLang();
    });
    applyLang();
  }

  // Test hooks (used by tests/smoke.js only).
  window.__tcb = {
    state: state,
    recalc: recalc,
    exportPayload: exportPayload,
    importPayload: importPayload,
    eraseAll: eraseAll,
    loadSaved: loadSaved
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
