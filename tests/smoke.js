// tip-calculator-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9358;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/tcb-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setVal = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true}))`);
  const BN_TITLE = '\u099f\u09bf\u09aa\u0020\u0995\u09cd\u09af\u09be\u09b2\u0995\u09c1\u09b2\u09c7\u099f\u09b0\u0020\u09ac\u09bf\u09a1\u09bf';

  // ---- Load: defaults ----
  await nav(BASE);
  check('page title mentions Tip Calculator', (await ev('document.title'))?.includes('Tip Calculator'));
  check('3 tabs present', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 3);
  check('default tip is 10', (await ev(`document.getElementById('tipInput').value`)) === '10');
  check('default service charge is 0', (await ev(`document.getElementById('scInput').value`)) === '0');
  check('default people is 1', (await ev(`document.getElementById('peopleInput').value`)) === '1');
  check('VAT off by default', (await ev(`document.getElementById('vatCheck').checked`)) === false);
  check('result empty state shown', (await ev(`document.getElementById('resultEmpty').hidden`)) === false);
  check('no bill error on first load', (await ev(`document.getElementById('billError').hidden`)) === true);
  check('guide renders 6 items', (await ev(`document.querySelectorAll('#guideList li').length`)) === 6);
  check('5 tip preset chips', (await ev(`document.querySelectorAll('[data-tip]').length`)) === 5);
  check('3 service-charge chips', (await ev(`document.querySelectorAll('[data-sc]').length`)) === 3);

  // ---- Basic calc: 1250 bill, 10% tip ----
  await setVal('billInput', '1250');
  check('1250 + 10%: tip 125.00', (await ev(`document.getElementById('valTip').textContent`)).includes('125.00'));
  check('1250 + 10%: total 1,375.00', (await ev(`document.getElementById('valTotal').textContent`)).includes('1,375.00'));
  check('1250 + 10%: per person 1,375.00', (await ev(`document.getElementById('valPerPerson').textContent`)).includes('1,375.00'));
  check('VAT row hidden when off', (await ev(`document.getElementById('rowVat').hidden`)) === true);
  check('round-extra row hidden when 0', (await ev(`document.getElementById('rowRoundExtra').hidden`)) === true);

  // ---- Tip preset 15% ----
  await ev(`document.querySelector('[data-tip="15"]').click()`);
  check('preset 15%: tip 187.50', (await ev(`document.getElementById('valTip').textContent`)).includes('187.50'));
  check('preset 15%: total 1,437.50', (await ev(`document.getElementById('valTotal').textContent`)).includes('1,437.50'));

  // ---- Service charge 10% + VAT on, split 4 ----
  await ev(`document.querySelector('[data-sc="10"]').click()`);
  await ev(`document.getElementById('vatCheck').click()`);
  await setVal('peopleInput', '4');
  check('sc 10%: service 125.00', (await ev(`document.getElementById('valService').textContent`)).includes('125.00'));
  check('VAT row shown', (await ev(`document.getElementById('rowVat').hidden`)) === false);
  check('VAT 15% of 1375 = 206.25', (await ev(`document.getElementById('valVat').textContent`)).includes('206.25'));
  check('full total 1,768.75', (await ev(`document.getElementById('valTotal').textContent`)).includes('1,768.75'));
  check('per person 442.19', (await ev(`document.getElementById('valPerPerson').textContent`)).includes('442.19'));
  check('tip per person 46.88', (await ev(`document.getElementById('valPerPersonTip').textContent`)).includes('46.88'));

  // ---- Round up to nearest 10 ----
  await setVal('billInput', '1234');
  await setVal('tipInput', '10');
  await setVal('scInput', '0');
  await ev(`document.getElementById('vatCheck').click()`); // VAT off again
  await setVal('peopleInput', '1');
  await ev(`document.querySelector('input[name="round"][value="1000"]').click()`);
  check('round to 10: total 1,360.00', (await ev(`document.getElementById('valTotal').textContent`)).includes('1,360.00'));
  check('round-extra row shown', (await ev(`document.getElementById('rowRoundExtra').hidden`)) === false);
  check('round extra 2.60', (await ev(`document.getElementById('valRoundExtra').textContent`)).includes('2.60'));

  // ---- People stepper ----
  await ev(`document.querySelector('input[name="round"][value="0"]').click()`);
  await setVal('billInput', '1250');
  await setVal('tipInput', '10');
  await ev(`document.getElementById('peoplePlus').click()`);
  check('stepper + makes 2 people', (await ev(`document.getElementById('peopleInput').value`)) === '2');
  check('split 2 ways: 687.50 each', (await ev(`document.getElementById('valPerPerson').textContent`)).includes('687.50'));
  await ev(`document.getElementById('peopleMinus').click()`);
  check('stepper - back to 1', (await ev(`document.getElementById('peopleInput').value`)) === '1');

  // ---- Validation: bad bill, zero bill, bad tip ----
  await setVal('billInput', 'abc');
  check('abc bill shows error', (await ev(`document.getElementById('billError').hidden`)) === false);
  check('abc bill hides result', (await ev(`document.getElementById('resultContent').hidden`)) === true);
  await setVal('billInput', '0');
  check('zero bill error mentions more than 0', (await ev(`document.getElementById('billError').textContent`)).includes('more than 0'));
  await setVal('billInput', '1250');
  await setVal('tipInput', '101');
  check('tip 101 shows error', (await ev(`document.getElementById('tipError').hidden`)) === false);
  await setVal('tipInput', '10');
  check('valid inputs clear tip error', (await ev(`document.getElementById('tipError').hidden`)) === true);

  // ---- Save + load ----
  await setVal('saveName', 'Test dinner');
  await ev(`document.getElementById('saveBtn').click()`);
  check('save shows confirmation', (await ev(`document.getElementById('saveMsg').hidden`)) === false);
  await clickTab('saved');
  check('1 saved card', (await ev(`document.querySelectorAll('#savedList .saved-card').length`)) === 1);
  check('saved card shows name', (await ev(`document.getElementById('savedList').textContent`)).includes('Test dinner'));
  await ev(`document.querySelector('#savedList .saved-card .btn').click()`);
  check('load switches to calc tab', (await ev(`document.querySelector('[data-tab="calc"]').classList.contains('active')`)) === true);
  check('load restores bill 1,250.00', (await ev(`document.getElementById('billInput').value`)) === '1,250.00');
  check('load restores total', (await ev(`document.getElementById('valTotal').textContent`)).includes('1,375.00'));

  // ---- Export / erase / import round-trip via test hooks ----
  const payload = await ev(`window.__tcb.exportPayload()`);
  check('export payload is tip-calculator-bd v1', payload.includes('"app":"tip-calculator-bd"') && payload.includes('"version":1'), payload.slice(0, 120));
  check('export carries saved name', payload.includes('Test dinner'));
  await ev(`window.__tcb.eraseAll()`);
  check('eraseAll empties saved', (await ev(`window.__tcb.exportPayload()`)).includes('"saved":[]'));
  const imp = await ev(`JSON.stringify(window.__tcb.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores saved name', (await ev(`window.__tcb.exportPayload()`)).includes('Test dinner'));
  const badImp = await ev(`JSON.stringify(window.__tcb.importPayload('{"app":"dice-roller-bd","version":1,"saved":[]}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__tcb.exportPayload()`)).includes('Test dinner'));

  // ---- Bad import via UI textarea; good import succeeds ----
  await clickTab('saved');
  await ev(`document.getElementById('importText').value='{not json'; document.getElementById('importBtn').click()`);
  check('bad UI import shows error', (await ev(`document.getElementById('importFail').hidden`)) === false);
  await ev(`document.getElementById('importText').value=${JSON.stringify(payload)}; document.getElementById('importBtn').click()`);
  check('good UI import succeeds', (await ev(`document.getElementById('importOk').hidden`)) === false);

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await ev(`document.getElementById('eraseInput').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word rejected', (await ev(`document.getElementById('eraseWrong').hidden`)) === false);
  check('wrong erase keeps data', (await ev(`window.__tcb.exportPayload()`)).includes('Test dinner'));
  await ev(`document.getElementById('eraseInput').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__tcb.exportPayload()`)).includes('"saved":[]'));
  check('erase success message shows', (await ev(`document.getElementById('erasedMsg').hidden`)) === false);

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await clickTab('calc');
  await setVal('billInput', '1250');
  await setVal('tipInput', '10');
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === BN_TITLE);
  check('BN toggle: total in Bengali digits', (await ev(`document.getElementById('valTotal').textContent`)).includes('\u09e7,\u09e9\u09ed\u09eb.\u09e6\u09e6'));
  check('BN toggle: tab label in Bengali', (await ev(`document.querySelector('[data-tab="saved"]').textContent`)).includes('\u09b8\u0982\u09b0\u0995\u09cd\u09b7\u09bf\u09a4'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__tcb.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__tcb.state.lang`)) === 'en');

  // ---- Footer disclaimer ----
  check('footer mentions voluntary tip', (await ev(`document.getElementById('footerText').textContent`)).includes('voluntary'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['calc', 'saved', 'guide']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
