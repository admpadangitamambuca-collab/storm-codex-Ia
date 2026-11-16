'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lab = require('../storm-lab-v114.js');

function candles(n, tf = 300000, start = Date.parse('2026-11-02T00:00:00Z')) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const close = 100 + (i < 60 ? -i * 0.06 : -3.6 + (i - 60) * 0.3);
    const prev = i ? rows[i - 1].close : close;
    rows.push({ t: start + i * tf, open: prev, high: Math.max(prev, close) + 0.2,
      low: Math.min(prev, close) - 0.2, close });
  }
  return rows;
}
test('public API is read-only and available to node tests', () => {
  for (const fn of ['diagnosticReport', 'feedReport', 'tradeReport', 'backtestBaseline', 'wilsonInterval']) {
    assert.equal(typeof lab[fn], 'function');
  }
});
test('feed panel keeps all 16 asset/TF pairs, never labels missing/stale as live', () => {
  const now = Date.parse('2026-11-16T17:00:00Z');
  const result = lab.feedReport({
    'XAUUSD|M1': { closedAt: now - 60000, candles: 90, source: 'Biquote', stale: false, eval: { score: 86, ready: true } },
    'EURUSD|M5': { closedAt: now - 300000 * 3, candles: 90, source: 'Biquote', stale: true },
    'USDJPY|M5': { closedAt: now - 60000, candles: 0, error: 'timeout' }
  }, now);
  assert.equal(result.cells.length, 16);
  assert.equal(result.healthy, 1);
  assert.equal(result.errors, 1);
  assert.equal(result.stalled, 1);
  assert.equal(result.cells.find(x => x.asset === 'USDJPY' && x.tf === 'M5').status, 'ERRO');
});
test('duplicate Refresh checks are deduplicated by closed candle id', () => {
  const d = lab.diagnosticReport({
    now: Date.now(),
    readings: [{ id: 'x|M1|123', reason: 'Confluência Turbo não ultrapassou 83/100' },
      { id: 'x|M1|123', reason: 'Confluência Turbo não ultrapassou 83/100' },
      { id: 'x|M1|124', reason: 'OHLC sem fechamento recente' }],
    trades: [], feeds: {} });
  assert.equal(d.readings, 2);
  assert.equal(d.reasons['Score Turbo'], 1);
  assert.equal(d.reasons['OHLC insuficiente'], 1);
});
test('Wilson bounds do not claim accuracy on zero observations', () => {
  assert.equal(lab.wilsonInterval(0, 0), null);
  const range = lab.wilsonInterval(7, 10);
  assert.ok(range.lower > 0 && range.lower < 0.7);
  assert.ok(range.upper > 0.7 && range.upper <= 1);
});
test('Copy score-band analytics only use resolved records, not open, ambiguous or expired', () => {
  function trade(score, status) { return {
    score, asset: 'XAUUSD', status, entry: 100, stop: 99, tp: 101.5
  }; }
  const data = lab.tradeReport([trade(85, 'take'), trade(89, 'stop'), trade(91, 'take'),
    trade(96, 'pending'), trade(96, 'ambiguo'), trade(96, 'expirado')]);
  assert.equal(data.total.count, 3);
  assert.equal(data.total.wins, 2);
  assert.equal(data.excluded, 3);
  assert.equal(data.bands[0].stats.count, 2);
  assert.equal(data.bands[1].stats.count, 1);
  assert.equal(data.bands[2].stats.count, 0);
});
test('research baseline rejects short and corrupted OHLC series', () => {
  assert.match(lab.backtestBaseline(candles(40), { tf: 'M5' }).error, /insuficiente/);
  const broken = candles(100); broken[70].high = broken[70].close - 1;
  assert.match(lab.backtestBaseline(broken, { tf: 'M5' }).error, /inválido/);
});
test('baseline is causal, uses next-candle entry, and does not report pending data as profit', () => {
  const rows = candles(130);
  const result = lab.backtestBaseline(rows, { tf: 'M5', cost: 0 });
  assert.equal(result.error, undefined);
  assert.ok(result.trades.length > 0);
  for (const trade of result.trades) {
    assert.equal(trade.entryAt, trade.t + 300000);
    assert.ok(['take', 'stop', 'ambiguous', 'expired', 'gap'].includes(trade.result));
    if (trade.R === null) assert.ok(!['take', 'stop'].includes(trade.result));
  }
  const first = result.trades[0];
  const truncated = lab.backtestBaseline(rows.slice(0, rows.findIndex(b => b.t === first.entryAt) + 5), { tf: 'M5' });
  assert.equal(truncated.trades[0].t, first.t);
  assert.equal(truncated.trades[0].entry, first.entry);
});
test('historical series with a gap cannot invent candles or trade through gaps', () => {
  const rows = candles(130);
  rows[85].t += 300000 * 2;
  for (let i = 86; i < rows.length; i++) rows[i].t += 300000 * 2;
  const report = lab.backtestBaseline(rows, { tf: 'M5' });
  assert.ok(report.blockedGaps > 0);
});
test('production Copy and packages preserve strict >83 and include lab assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /COPY_TURBO_THRESHOLD_EXCLUSIVE=83/);
  assert.match(html, /turboScore>COPY_TURBO_THRESHOLD_EXCLUSIVE/);
  assert.match(html, /storm-lab-v114\.js/);
  assert.match(html, /storm-lab-v114\.css/);
  assert.match(html, /getCandles:\(asset,tf\)/);
  assert.match(html, /codes:Array\.isArray\(evaluation\?\.codes\)/);
  assert.doesNotMatch(html, /StormLab114\.scanNow/);
});
