/* Storm Codex IA 11.4 — diagnostics and research laboratory.
 * Read-only relative to the three signal engines and the simulated Copy Trade.
 * No orders, background execution, or claimed statistically calibrated probability.
 */
(function (root) {
  'use strict';
  var ASSETS = ['XAUUSD', 'EURUSD', 'USDJPY', 'AUDUSD'];
  var FRAMES = { M1: 60000, M5: 300000, M15: 900000, H1: 3600000 };
  var $ = function (id) { return document.getElementById(id); };
  var finite = Number.isFinite;
  var round = function (n, places) { return finite(n) ? Number(n.toFixed(places === undefined ? 2 : places)) : null; };
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reasonCategory(reason) {
    var s = String(reason || '').toLowerCase();
    if (/erro|falha|indispon.vel|http|timeout|motor|avalia..o legada/.test(s)) return 'Erro de fonte/motor';
    if (/atrasad|defasad|antiga|janela prospectiva|stale|fechamento fora|vela anterior/.test(s)) return 'Dado atrasado';
    if (/ohlc|candles|candles consecutivos|lacuna|fonte|qualidade|n.o fechada/.test(s)) return 'OHLC insuficiente';
    if (/83|conflu.ncia|score|pontua..o/.test(s)) return 'Score Turbo';
    if (/n.veis|dire..o|entrada|stop|alvo|pre.o|plano/.test(s)) return 'Plano/risco';
    if (/eleg.vel|opera..o simulada/.test(s)) return 'Elegível';
    return 'Aguardando confirmação';
  }
  function wilsonInterval(wins, n) {
    if (!n) return null;
    var z = 1.96, p = wins / n, z2 = z * z, denom = 1 + z2 / n;
    var center = (p + z2 / (2 * n)) / denom;
    var half = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n) / denom;
    return { lower: Math.max(0, center - half), upper: Math.min(1, center + half) };
  }
  function tradeReport(trades) {
    var rows = Array.isArray(trades) ? trades : [];
    var closed = rows.filter(function (r) {
      return r && (r.status === 'take' || r.status === 'stop') && finite(Number(r.score)) &&
        finite(Number(r.entry)) && finite(Number(r.stop)) && Math.abs(Number(r.entry) - Number(r.stop)) > 0;
    });
    var bands = [{ name: '84–89', min: 83, max: 90 }, { name: '90–94', min: 90, max: 95 }, { name: '95–100', min: 95, max: 101 }];
    function stats(items) {
      var wins = items.filter(function (t) { return t.status === 'take'; }).length, n = items.length;
      var R = items.reduce(function (total, t) {
        var risk = Math.abs(Number(t.stop) - Number(t.entry));
        return total + (t.status === 'take' ? Math.abs(Number(t.tp) - Number(t.entry)) / risk : -1);
      }, 0);
      return { count: n, wins: wins, losses: n - wins, winRate: n ? wins / n : null,
        avgR: n ? R / n : null, totalR: R, wilson: wilsonInterval(wins, n) };
    }
    return { total: stats(closed), byAsset: ASSETS.map(function (a) {
      return { asset: a, stats: stats(closed.filter(function (t) { return t.asset === a; })) };
    }), bands: bands.map(function (b) {
      return { name: b.name, stats: stats(closed.filter(function (t) {
        return Number(t.score) > b.min && Number(t.score) < b.max;
      })) };
    }), excluded: rows.length - closed.length };
  }
  function feedReport(feeds, now) {
    var cells = [], src = feeds || {}, time = finite(now) ? now : Date.now();
    ASSETS.forEach(function (asset) { Object.keys(FRAMES).forEach(function (tf) {
      var f = src[asset + '|' + tf], status = 'SEM CONSULTA', reason = 'Monitor ainda não consultou';
      if (f) {
        var age = finite(f.closedAt) && f.closedAt > 0 ? time - f.closedAt : null;
        if (f.error) { status = 'ERRO'; reason = String(f.error); }
        else if (!f.closedAt || !f.candles) { status = 'SEM OHLC'; reason = 'Dados ou velas insuficientes'; }
        else if (f.stale || age === null || age < -2000 || age > FRAMES[tf] + 90000) {
          status = 'ATRASADO'; reason = 'Último fechamento fora da janela esperada';
        } else {
          status = 'ATUAL'; reason = f.eval && f.eval.reason ? String(f.eval.reason) : 'Aguardando avaliação';
        }
      }
      cells.push({ asset: asset, tf: tf, status: status, reason: reason,
        source: f && f.source ? String(f.source) : '—', ageMs: f && finite(f.closedAt) ? time - f.closedAt : null,
        lastFetchAt: f && f.fetchedAt || null, closedAt: f && f.closedAt || null,
        score: f && f.eval && finite(f.eval.score) ? f.eval.score : null,
        codes: f && f.eval && Array.isArray(f.eval.codes) ? f.eval.codes.slice(0, 8) : [] });
    }); });
    return { cells: cells, healthy: cells.filter(function (f) { return f.status === 'ATUAL'; }).length,
      errors: cells.filter(function (f) { return f.status === 'ERRO'; }).length,
      stalled: cells.filter(function (f) { return f.status === 'ATRASADO'; }).length };
  }
  function diagnosticReport(input) {
    var data = input || {}, readings = Array.isArray(data.readings) ? data.readings : [];
    var unique = new Map();
    readings.forEach(function (r) { if (r && r.id && !unique.has(r.id)) unique.set(r.id, r); });
    var counts = Object.create(null);
    unique.forEach(function (r) {
      var category = reasonCategory(r.reason);
      counts[category] = (counts[category] || 0) + 1;
    });
    return { feed: feedReport(data.feeds || {}, data.now), trades: tradeReport(data.trades),
      readings: unique.size, reasons: counts, monitor: data.monitor || {},
      threshold: 'Turbo >83/100; dados válidos e vela nova observada; somente simulação' };
  }
  function ema(values, period) {
    var k = 2 / (period + 1), out = [], prior = 0;
    values.forEach(function (v, i) { prior = i ? prior * (1 - k) + k * v : v; out.push(prior); });
    return out;
  }
  /* Independent and deliberately simple EMA9/21 research baseline, NOT a replay
   * of Classic/Turbo/Indices. Decision at candle i close, entry next candle open.
   * Time-ordered OHLC; no overlapping positions or fabricated gap candles. */
  function backtestBaseline(input, options) {
    var rows = Array.isArray(input) ? input : [], opt = options || {};
    var tf = FRAMES[opt.tf] ? opt.tf : 'M5', ms = FRAMES[tf];
    var cost = finite(Number(opt.cost)) && Number(opt.cost) >= 0 ? Number(opt.cost) : 0;
    var series = rows.map(function (b) { return { t: Number(b.t), open: Number(b.open),
      high: Number(b.high), low: Number(b.low), close: Number(b.close) }; });
    if (series.length < 55) return { error: 'Histórico insuficiente: mínimo de 55 candles fechados.', count: series.length, trades: [] };
    for (var x = 0; x < series.length; x++) {
      var b = series[x];
      if (!finite(b.t) || b.t <= 0 || b.t % ms !== 0 ||
        ![b.open, b.high, b.low, b.close].every(function (v) { return finite(v) && v > 0; }) ||
        b.high < Math.max(b.open, b.close) || b.low > Math.min(b.open, b.close) ||
        (x > 0 && b.t <= series[x - 1].t)) {
        return { error: 'OHLC inválido, aberto ou fora de ordem. Backtest cancelado.', count: series.length, trades: [] };
      }
    }
    var fast = ema(series.map(function (c) { return c.close; }), 9);
    var slow = ema(series.map(function (c) { return c.close; }), 21);
    var outcomes = [], blockedGaps = 0, ambiguous = 0, expired = 0;
    for (var i = 50; i + 1 < series.length; i++) {
      // Signal requires a contiguous 21-candle lookback.
      var contiguous = true;
      for (var k = i - 20; k <= i; k++) if (k > 0 && series[k].t - series[k - 1].t !== ms) { contiguous = false; break; }
      if (!contiguous || series[i + 1].t - series[i].t !== ms) { blockedGaps++; continue; }
      var up = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
      var down = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
      if (!up && !down) continue;
      var side = up ? 1 : -1, sumTR = 0;
      for (var j = i - 13; j <= i; j++) {
        var c = series[j], priorClose = series[j - 1].close;
        sumTR += Math.max(c.high - c.low, Math.abs(c.high - priorClose), Math.abs(c.low - priorClose));
      }
      var atr = sumTR / 14;
      if (!finite(atr) || atr <= 0) continue;
      var entry = series[i + 1].open, risk = atr, tp = entry + side * risk * 1.5, stop = entry - side * risk;
      if (stop <= 0 || tp <= 0) continue;
      var result = 'expired', exitAt = null, end = i, maxFuture = Math.min(series.length - 1, i + 6);
      for (var q = i + 1; q <= maxFuture; q++) {
        if (q > i + 1 && series[q].t - series[q - 1].t !== ms) { result = 'gap'; end = q; break; }
        var hitTP = side > 0 ? series[q].high >= tp : series[q].low <= tp;
        var hitSL = side > 0 ? series[q].low <= stop : series[q].high >= stop;
        end = q;
        if (hitTP && hitSL) { result = 'ambiguous'; break; }
        if (hitTP || hitSL) { result = hitTP ? 'take' : 'stop'; exitAt = hitTP ? tp : stop; break; }
      }
      if (result === 'ambiguous') ambiguous++;
      if (result === 'expired') expired++;
      if (result === 'gap') blockedGaps++;
      var R = exitAt === null ? null : ((exitAt - entry) * side - cost) / risk;
      outcomes.push({ t: series[i].t, entryAt: series[i + 1].t, closedAt: series[end].t + ms,
        side: side > 0 ? 'buy' : 'sell', entry: entry, stop: stop, tp: tp, result: result, R: R });
      i = end; // No positions overlapping even when a candle is ambiguous/expired.
    }
    var resolved = outcomes.filter(function (o) { return o.result === 'take' || o.result === 'stop'; });
    var wins = resolved.filter(function (o) { return o.result === 'take'; }).length;
    var totalR = resolved.reduce(function (s, o) { return s + o.R; }, 0);
    var equity = 0, peak = 0, drawdownR = 0;
    resolved.forEach(function (o) { equity += o.R; peak = Math.max(peak, equity); drawdownR = Math.max(drawdownR, peak - equity); });
    return { strategy: 'Pesquisa EMA9/21 independente', tf: tf, count: series.length,
      firstT: series[0].t, lastT: series[series.length - 1].t, cost: cost,
      trades: outcomes, resolved: resolved.length, wins: wins,
      winRate: resolved.length ? wins / resolved.length : null, totalR: round(totalR, 4),
      avgR: resolved.length ? round(totalR / resolved.length, 4) : null,
      drawdownR: round(drawdownR, 4), ambiguous: ambiguous, expired: expired,
      blockedGaps: blockedGaps, wilson: wilsonInterval(wins, resolved.length),
      disclaimer: 'Baseline de pesquisa separado dos motores reais; histórico limitado; custos parametrizados em unidades de preço; resultados não são operações observadas.' };
  }
  function formatAge(ms) {
    if (!finite(ms)) return '—';
    if (ms < 0) return 'Horário futuro';
    return ms < 60000 ? Math.round(ms / 1000) + ' s' : (ms / 60000).toFixed(1).replace('.', ',') + ' min';
  }
  function percent(p) { return finite(p) ? (100 * p).toFixed(1).replace('.', ',') + '%' : '—'; }
  function downloadJSON(obj) {
    var text = JSON.stringify(obj, null, 2), blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'Storm_Codex_11_4_diagnostico_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }
  function getSnapshot() {
    var copy = root.StormCopyTrade95;
    return diagnosticReport({ trades: copy && copy.getTrades ? copy.getTrades() : [],
      readings: copy && copy.getReadings ? copy.getReadings() : [],
      feeds: copy && copy.getFeeds ? copy.getFeeds() : {},
      monitor: copy && copy.getStatus ? copy.getStatus() : {}, now: Date.now() });
  }
  function render() {
    if (!root.document || !$('stormLab114')) return;
    var d = getSnapshot(), healthy = d.feed.healthy, stats = d.trades.total;
    $('stormLabHealth').textContent = healthy + '/16 feeds recentes | ' + d.feed.errors + ' erros | ' + d.feed.stalled + ' atrasados';
    $('stormLabTrades').textContent = stats.count + ' operações resolvidas | ' + percent(stats.winRate) + ' takes | ' +
      (finite(stats.avgR) ? round(stats.avgR, 2) + ' R médio' : 'R ainda indisponível');
    $('stormLabMemory').textContent = d.readings + ' fechamentos avaliados | ' +
      (d.monitor.visible ? 'monitor visível' : 'navegador suspenso') +
      ' | dados locais, não 24/7';
    var categories = Object.keys(d.reasons).sort(function (a, b) { return d.reasons[b] - d.reasons[a]; });
    $('stormLabReasons').innerHTML = categories.length ? categories.map(function (key) {
      return '<div class="storm-lab-reason"><span>' + esc(key) + '</span><strong>' + d.reasons[key] + '</strong></div>';
    }).join('') : '<p>Nenhuma leitura prospectiva registrada neste navegador.</p>';
    $('stormLabFeeds').innerHTML = d.feed.cells.map(function (f) {
      var hint = f.codes.length ? ' · ' + f.codes.join(', ') : '';
      return '<tr><td>' + esc(f.asset + '/' + f.tf) + '</td><td><span class="lab-state lab-' +
        (f.status === 'ATUAL' ? 'ok' : f.status === 'ERRO' ? 'error' : 'warn') + '">' + esc(f.status) +
        '</span></td><td>' + esc(f.source) + '</td><td>' + esc(formatAge(f.ageMs)) +
        '</td><td>' + esc(f.reason + hint).slice(0, 850) + '</td></tr>';
    }).join('');
    $('stormLabBands').innerHTML = d.trades.bands.map(function (b) {
      return '<tr><td>' + b.name + '</td><td>' + b.stats.count +
        '</td><td>' + percent(b.stats.winRate) + '</td><td>' +
        (finite(b.stats.avgR) ? round(b.stats.avgR, 2) : '—') + '</td><td>' +
        (b.stats.wilson ? percent(b.stats.wilson.lower) + ' a ' + percent(b.stats.wilson.upper) : '—') + '</td></tr>';
    }).join('');
    $('stormLabDisclaimer').textContent = 'Amostra local de resultados reais OBSERVADOS pelo simulador, sem custos nem execução real. ' +
      d.trades.excluded + ' registros abertos, inconclusivos ou sem geometria não contam como vitória/derrota. ' +
      'Intervalo Wilson de 95% é indicativo e não elimina viés de seleção ou dependência temporal.';
  }
  function renderBacktest() {
    var copy = root.StormCopyTrade95, asset = $('stormLabAsset').value, tf = $('stormLabTf').value;
    var resultBox = $('stormLabBacktestResult');
    if (!copy || typeof copy.getCandles !== 'function') { resultBox.textContent = 'Versão 11.4 incompleta: o simulador não expõe os candles para pesquisa.'; return; }
    var bars = copy.getCandles(asset, tf), cost = Number($('stormLabCost').value) || 0;
    var result = backtestBaseline(bars, { tf: tf, cost: cost });
    if (result.error) { resultBox.textContent = asset + '/' + tf + ': ' + result.error; return; }
    resultBox.textContent = 'Baseline EMA 9/21 — ' + asset + '/' + tf + ' | ' + result.count +
      ' velas fechadas | ' + result.resolved + ' operações resolvidas | ' +
      percent(result.winRate) + ' acertos | total ' + result.totalR + ' R | drawdown ' +
      result.drawdownR + ' R | ' + result.ambiguous + ' ambíguas | ' + result.expired +
      ' expiradas. Não representa backtest dos motores Clássico, Turbo ou Índices.';
    root.StormLab114.lastBacktest = result;
  }
  function init() {
    if (!$('stormCopyTrade') || $('stormLab114')) return;
    var target = document.querySelector('#stormCopyTrade .storm-v96-equity') || $('stormCopyTrade');
    var section = document.createElement('section'); section.id = 'stormLab114';
    section.className = 'storm-lab';
    section.innerHTML =
      '<div class="storm-lab-head"><div><small>STORM CÓDEX IA · V11.4</small><h3>Laboratório de confiabilidade</h3>' +
      '<p>Auditoria local de cotações, motivos de rejeição e resultados simulados. Nenhuma ordem é enviada.</p></div>' +
      '<button type="button" class="storm-v95-btn" id="stormLabRefresh">Atualizar diagnóstico</button></div>' +
      '<div class="storm-lab-kpis"><div><small>SAÚDE DOS FEEDS</small><strong id="stormLabHealth">—</strong></div>' +
      '<div><small>DESFECHOS COPY</small><strong id="stormLabTrades">—</strong></div>' +
      '<div><small>OBSERVAÇÃO</small><strong id="stormLabMemory">—</strong></div></div>' +
      '<details open><summary>Por que não entrou? · causas das leituras</summary><div id="stormLabReasons" class="storm-lab-reasons"></div>' +
      '<p class="storm-lab-note">Categorias resumidas de fechamentos únicos, não de cliques Refresh. A elegibilidade permanece Turbo &gt;83 com integridade técnica.</p></details>' +
      '<details><summary>Central de cotações · 16 períodos</summary><div class="storm-lab-scroll"><table>' +
      '<thead><tr><th>Ativo/TF</th><th>Situação</th><th>Fonte</th><th>Idade</th><th>Diagnóstico</th></tr></thead>' +
      '<tbody id="stormLabFeeds"></tbody></table></div></details>' +
      '<details><summary>Resultados observados por faixa de score</summary><div class="storm-lab-scroll"><table>' +
      '<thead><tr><th>Turbo</th><th>Casos</th><th>Take (%)</th><th>R médio</th><th>Wilson 95%</th></tr></thead>' +
      '<tbody id="stormLabBands"></tbody></table></div><p class="storm-lab-note" id="stormLabDisclaimer"></p></details>' +
      '<details><summary>Pesquisa histórica (baseline independente, não Turbo)</summary>' +
      '<p class="storm-lab-note">EMA 9/21, ATR14, entrada na próxima abertura, stop 1 ATR, alvo 1,5 ATR, até 6 velas. Sem sobreposição, sem inventar lacunas, empate TP/stop é ambíguo. Requer candles fechados já recebidos.</p>' +
      '<div class="storm-lab-controls"><label>Ativo <select id="stormLabAsset">' +
      ASSETS.map(function (x) { return '<option value="' + x + '">' + x + '</option>'; }).join('') +
      '</select></label><label>Período <select id="stormLabTf">' +
      Object.keys(FRAMES).map(function (x) { return '<option value="' + x + '"' + (x === 'M5' ? ' selected' : '') + '>' + x + '</option>'; }).join('') +
      '</select></label><label>Custo por unidade de preço <input id="stormLabCost" type="number" min="0" step="any" value="0"></label>' +
      '<button type="button" class="storm-v95-btn" id="stormLabBacktest">Executar pesquisa</button></div>' +
      '<p id="stormLabBacktestResult" class="storm-lab-note" role="status">Sem pesquisa executada.</p></details>' +
      '<div class="storm-lab-foot"><button type="button" class="storm-v95-btn" id="stormLabExport">Exportar diagnóstico JSON</button>' +
      '<p>Sem backend persistente: aprendizado e monitoramento param quando o navegador fecha. Pesquisa histórica não é validação de lucratividade.</p></div>';
    target.parentNode.insertBefore(section, target);
    $('stormLabRefresh').addEventListener('click', render);
    $('stormLabBacktest').addEventListener('click', renderBacktest);
    $('stormLabExport').addEventListener('click', function () {
      var copy = root.StormCopyTrade95;
      downloadJSON({ schema: 'storm-lab-v114', createdAt: new Date().toISOString(), diagnostics: getSnapshot(),
        readings: copy && copy.getReadings ? copy.getReadings() : [],
        trades: copy && copy.getTrades ? copy.getTrades() : [], researchBaseline: root.StormLab114.lastBacktest || null });
    });
    setInterval(function () { if (!document.hidden && document.body.classList.contains('storm-copy-active')) render(); }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
    render();
  }
  root.StormLab114 = { version: '11.4', diagnosticReport: diagnosticReport, feedReport: feedReport,
    tradeReport: tradeReport, reasonCategory: reasonCategory, wilsonInterval: wilsonInterval,
    backtestBaseline: backtestBaseline, refresh: function () { if (root.document) render(); },
    lastBacktest: null };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.StormLab114;
  if (root.document) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
