// Token Radar v6.1 — dashboard app (T2.5, hybrid v5/v6). Static, fetch data.json relatif.
// Peringkat default = point-estimate v5 (rank board). Interval P10-P90 + verdict = model v6.
// Rumus beku: net = s * implied * D / TVL - fees (CONTRACT §3). Aturan verdict = refit.mjs T1.
(function () {
  'use strict';
  var D = 1000, S = 0.07;
  var DATA = null, rows = [], VAL = null;
  var DEPS = [250, 1000, 10000], SHARES = [0.035, 0.07, 0.14];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtUSD(v) {
    var neg = v < 0, a = Math.abs(v), s;
    if (a >= 1e9) s = '$' + (a / 1e9).toFixed(2) + 'B';
    else if (a >= 1e6) s = '$' + (a / 1e6).toFixed(2) + 'M';
    else if (a >= 1e3) s = '$' + (a / 1e3).toFixed(2) + 'K';
    else s = '$' + a.toFixed(2);
    return (neg ? '-' : '') + s;
  }
  function fmtUSD2(v) {
    var neg = v < 0;
    var s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? '-$' : '$') + s;
  }
  function fmtInt(v) { return v == null ? '—' : Math.round(v).toLocaleString('en-US'); }
  function fmtPct(x) { return (x * 100).toFixed(1) + '%'; }
  function fmtPct1(x) { return x == null ? '—' : (x > 0 ? '+' : '') + x.toFixed(1) + '%'; }
  function fmtX(v) { return '×' + v.toFixed(2); }
  function fmtAge(d) {
    if (d == null) return '—';
    if (d < 30) return d + ' hr';
    if (d < 365) return (d / 30).toFixed(0) + ' bln';
    return (d / 365).toFixed(1) + ' thn';
  }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }

  // ---- model per baris ----
  // v6: implied6 = V6 * P6; interval dari kuantil residual LOO (dihitung build script).
  function net6(r) { return S * r.i6 * D / r.tvl - r.fee; }
  function net6Lo(r) { return S * r.lo * D / r.tvl - r.fee; }
  function net6Hi(r) { return S * r.hi * D / r.tvl - r.fee; }
  function be6(r) {
    var denom = (S * r.v6 * D) / r.tvl;
    return Math.min(1, Math.max(0, denom > 0 ? r.fee / denom : 1));
  }
  function verdict6(r) {
    var n = net6(r), be = be6(r);
    if (n >= 5 && r.p6 >= 2 * be) return 'FARM';
    if (n >= 0 && r.p6 >= be) return 'MARGINAL';
    return 'SKIP';
  }
  // v5 (point-estimate): implied5 = value_if_launches * launch_odds; aturan verdict sama,
  // direplikasi persis 63/52/83 pada rencana default (diverifikasi build script).
  function net5(r) { return S * r.i5 * D / r.tvl - r.fee; }
  function be5(r) {
    var denom = (S * r.v5 * D) / r.tvl;
    return Math.min(1, Math.max(0, denom > 0 ? r.fee / denom : 1));
  }
  function verdict5(r) {
    var n = net5(r), be = be5(r);
    if (n >= 5 && r.p5 >= 2 * be) return 'FARM';
    if (n >= 0 && r.p5 >= be) return 'MARGINAL';
    return 'SKIP';
  }
  function confOf(r) { return r.hi / Math.max(1, r.lo); }
  function confLabel(ratio) { return ratio <= 20 ? 'Tight' : ratio <= 100 ? 'Moderate' : 'Wide'; }

  function computeAll() {
    return rows.map(function (r) {
      return { r: r, net: net6(r), netLo: net6Lo(r), netHi: net6Hi(r), verdict: verdict6(r), v5: verdict5(r), conf: confOf(r) };
    });
  }

  // ---- KPI Strip (v6; sub membawa pembanding v5) ----
  function renderKPIs() {
    var all = computeAll();
    var pool = rows.reduce(function (a, r) { return a + r.i6; }, 0);
    var farm = all.filter(function (c) { return c.verdict === 'FARM'; });
    var farmPool = farm.reduce(function (a, c) { return a + c.r.i6; }, 0);
    var medNet = median(farm.map(function (c) { return c.net; }));
    var hitAll = mean(rows.map(function (r) { return r.p6; }));
    var hitFarm = mean(farm.map(function (c) { return c.r.p6; }));
    var hit5 = mean(rows.map(function (r) { return r.p5; }));
    $('kpiPool').textContent = fmtUSD(pool);
    $('kpiPoolSub').textContent = 'Σ V·P v6 seluruh 198 protokol · v5 $1.273.129.188 (−12,5%) · FARM set v6: ' + fmtUSD(farmPool);
    $('kpiMedNet').textContent = medNet === null ? '—' : fmtUSD2(medNet);
    $('kpiMedNetSub').textContent = farm.length ? 'median net v6 dari ' + farm.length + ' baris FARM pada rencana aktif' : 'tidak ada baris FARM v6 pada rencana aktif';
    $('kpiFarm').textContent = String(farm.length);
    var v = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    all.forEach(function (c) { v[c.verdict]++; });
    $('kpiFarmSub').textContent = 'v6: FARM ' + v.FARM + ' · MARGINAL ' + v.MARGINAL + ' · SKIP ' + v.SKIP + ' (default 61/45/92) · v5: 63/52/83';
    $('kpiHit').textContent = fmtPct(hitAll);
    $('kpiHitSub').textContent = 'rata-rata P launch v6 198 protokol (v5: ' + fmtPct(hit5) + ') · FARM set v6: ' + (hitFarm === null ? '—' : fmtPct(hitFarm));
    $('planLabel').textContent = '$' + D.toLocaleString('en-US') + ' × ' + (S * 100).toFixed(1).replace('.', ',') + '%';
  }

  // ---- Cakupan board ----
  function renderCoverage() {
    var wl = rows.filter(function (r) { return r.wl; }).length;
    var pre = rows.filter(function (r) { return r.st === 'pre-token'; }).length;
    var traded = rows.length - pre;
    $('coverageBar').innerHTML =
      '<span>Watchlist ter-cover: <b>' + wl + '/40</b></span>' +
      '<span>Board: <b>198</b> = 40 watchlist + 158 di bawah floor $50jt</span>' +
      '<span>Token: <b>' + pre + ' pre-token</b> · <b>' + traded + ' sudah trade</b> di board ini</span>' +
      '<span>Semua baris membawa farm plan 6 langkah</span>';
  }

  // ---- Integrity Strip ----
  function metricCard(label, big, vs, pill) {
    return '<div class="metric"><div class="label">' + label + '</div><div class="big num">' + big + '</div><div class="vs">' + vs + '</div><div style="margin-top:6px">' + pill + '</div></div>';
  }
  function renderIntegrity() {
    var h = '';
    h += metricCard('LOO Miss (n=' + VAL.looN + ') <span class="prov v6">v6</span>', fmtX(VAL.looMed) + ' median',
      'geomean ' + fmtX(VAL.looGeo) + ' · noise floor ' + fmtX(VAL.nfGeo) + ' · v5 ' + fmtX(VAL.v5.looMed),
      '<span class="pill fail">GAGAL</span> <span class="small">target &lt; ' + fmtX(VAL.v5.looMed) + '</span>');
    h += metricCard('Walk-Forward Miss (n=' + VAL.wfN + ') <span class="prov v6">v6</span>', fmtX(VAL.wfMed) + ' median',
      'geomean ' + fmtX(VAL.wfGeo) + ' · v5 ' + fmtX(VAL.v5.wfMed),
      '<span class="pill fail">GAGAL</span> <span class="small">target &lt; ' + fmtX(VAL.v5.wfMed) + '</span>');
    h += metricCard('Range Holds (P10–P90) <span class="prov v6">v6</span>', VAL.range.toFixed(1).replace('.', ',') + '%',
      VAL.rangeHolds + '/' + VAL.rangeN + ' comps · v5 ' + VAL.v5.range.toFixed(1).replace('.', ',') + '%',
      '<span class="pill pass">LOLOS</span> <span class="small">target &gt; 68%</span>');
    h += metricCard('Top-20 Recall <span class="prov v6">v6</span>', VAL.top20 + '/20',
      'v5 17/20 · 15 dari 20 teratas v5 bertahan di v6',
      '<span class="pill fail">GAGAL</span> <span class="small">target ≥ 18/20</span>');
    h += metricCard('λ_penalty <span class="prov v6">v6</span>', String(DATA.meta.lambda),
      'grid 0,01–3000 via LOO · residual std 2,05 log · comps 92',
      '<span class="pill na">TERPILIH VIA LOO</span>');
    h += metricCard('Dataset cutoff', DATA.meta.cutoff,
      'snapshot 758 protokol · comps 92 (mcap&gt;0, lolos eksklusi) · board 198',
      '<span class="pill na">SEALED</span>');
    $('integrityGrid').innerHTML = h;
    $('t15Note').innerHTML = '<b>T1.5 — 13 varian diuji, tidak ada yang mencapai target.</b> Winsorisasi memperbaiki geomean sedikit (×4,74–4,81) dan Top-20 (+1–2) tapi <b>memperburuk median miss</b> di semua level (×3,56–3,90 vs ×3,44 baseline); blend median kategori merusak total implied (membengkak 1,5–3,8×) dan menurunkan Top-20. Konfigurasi T1 (baseline, tanpa winsor/blend) <b>dipertahankan — jangan memaksakan angka</b>. Varian terdekat target: W95-winsor-q05-q95 (Top-20 17/20, LOO med ×3,81).';
  }

  // ---- Backtest: comparison bars ----
  function barRow(label, v6, v5, max, suffix) {
    var w6 = Math.max(2, Math.round(v6 / max * 100));
    var w5 = Math.max(2, Math.round(v5 / max * 100));
    return '<div class="bar-row"><div>' + label + '</div><div style="display:flex;flex-direction:column;gap:4px">' +
      '<div style="height:10px;background:#eef1f4;border-radius:999px;overflow:hidden"><div style="height:100%;width:' + w6 + '%;background:#0b5fff"></div></div>' +
      '<div style="height:10px;background:#eef1f4;border-radius:999px;overflow:hidden"><div style="height:100%;width:' + w5 + '%;background:#98a2b3"></div></div></div>' +
      '<div class="bar-vals num">v6 <b>' + v6 + suffix + '</b> · v5 ' + v5 + suffix + '</div></div>';
  }
  function renderCompare() {
    var h = '';
    h += barRow('LOO miss (median)', VAL.looMed.toFixed(2), VAL.v5.looMed.toFixed(2), 5, '×');
    h += barRow('WF miss (median)', VAL.wfMed.toFixed(2), VAL.v5.wfMed.toFixed(2), 5, '×');
    h += barRow('Range holds', VAL.range, VAL.v5.range, 100, '%');
    h += barRow('Top-20 kept', VAL.top20, VAL.v5.top20, 20, '/20');
    $('compareBars').innerHTML = h;
    $('coverageBars').innerHTML =
      '<div class="bar-row"><div>v6 — 66/92 comps</div><div class="bar-track"><div class="bar-fill v6" style="width:71.7%"></div></div><div class="bar-vals num"><b>71,7%</b> · target &gt; 68% ✓</div></div>' +
      '<div class="bar-row"><div>v5</div><div class="bar-track"><div class="bar-fill v5" style="width:49.5%"></div></div><div class="bar-vals num"><b>49,5%</b></div></div>';
  }

  // ---- Backtest: SVG scatter LOO ----
  function renderScatter() {
    var pts = DATA.loo;
    var xs = pts.map(function (p) { return Math.log(p.pred); });
    var ys = pts.map(function (p) { return Math.log(p.act); });
    var lo = Math.floor(Math.min.apply(null, xs.concat(ys)) - 0.5);
    var hi = Math.ceil(Math.max.apply(null, xs.concat(ys)) + 0.5);
    var W = 640, H = 420, PL = 56, PR = 16, PT = 14, PB = 44;
    var X = function (v) { return PL + (v - lo) / (hi - lo) * (W - PL - PR); };
    var Y = function (v) { return PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB); };
    var ticks = [];
    for (var t = -7; t <= 7; t++) { if (t >= lo && t <= hi) ticks.push(t); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Scatter kalibrasi LOO">';
    ticks.forEach(function (t) {
      s += '<line class="grid" x1="' + X(t) + '" y1="' + PT + '" x2="' + X(t) + '" y2="' + (H - PB) + '"/>';
      s += '<line class="grid" x1="' + PL + '" y1="' + Y(t) + '" x2="' + (W - PR) + '" y2="' + Y(t) + '"/>';
      var lab = t === 0 ? '1×' : (t > 0 ? Math.round(Math.exp(t)) + '×' : '1/' + Math.round(Math.exp(-t)) + '×');
      s += '<text x="' + X(t) + '" y="' + (H - PB + 16) + '" text-anchor="middle">' + lab + '</text>';
      s += '<text x="' + (PL - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + lab + '</text>';
    });
    var q10 = DATA.bandQ10, q90 = DATA.bandQ90;
    s += '<line class="band" x1="' + X(lo) + '" y1="' + Y(lo + q90) + '" x2="' + X(hi) + '" y2="' + Y(hi + q90) + '"/>';
    s += '<line class="band" x1="' + X(lo) + '" y1="' + Y(lo + q10) + '" x2="' + X(hi) + '" y2="' + Y(hi + q10) + '"/>';
    s += '<line class="ident" x1="' + X(lo) + '" y1="' + Y(lo) + '" x2="' + X(hi) + '" y2="' + Y(hi) + '"/>';
    pts.forEach(function (p) {
      var cx = X(Math.log(p.pred)), cy = Y(Math.log(p.act));
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.4" fill="' + (p.holds ? '#0e7a3d' : '#b42318') + '" opacity="0.85"><title>' + esc(p.slug) + ' — aktual ' + p.act.toFixed(2) + '×, prediksi ' + p.pred.toFixed(2) + '×</title></circle>';
    });
    s += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle">prediksi model (×TVL, skala log)</text>';
    s += '<text x="14" y="' + (H / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + (H / 2) + ')">aktual mcap/TVL (×TVL, skala log)</text>';
    s += '</svg>';
    $('scatterWrap').innerHTML = s;
  }

  // ---- Backtest: errors + T1.5 tables ----
  var ERR_NOTE = {
    'rain': 'Outlier ekstrem: FDV terealisasi 400× TVL — jauh di luar jangkauan comps mana pun (median comp ≈0,3×). Tidak ada fitur yang bisa memprediksi lonjakan 400×; satu baris ini sendiri mengangkat geomean miss. Prediksi 0,42× vs aktual 400,20× = 957,69×.',
    'concentrator': 'Token sudah listing dengan FDV/TVL nyaris nol (0,0013×) — model memprediksi rasio normal kategori Yield (0,32×). Over-predict 244×.',
    'bitway-earn': 'FDV terealisasi 36× TVL vs prediksi 0,22× — under-predict 163×. Rasio jauh di atas median kategori Basis Trading.',
    'flokifi-locker': 'FDV terealisasi 19× TVL vs prediksi 0,25× — under-predict 76×.',
    'fables': 'FDV terealisasi 0,068× vs prediksi 4,74× — over-predict 70×. Token listing dengan FDV relatif kecil terhadap TVL.'
  };
  function renderErrTable() {
    var h = '';
    DATA.errors.forEach(function (e) {
      h += '<tr><td><b>' + esc(e.slug) + '</b></td><td>' + esc(e.category) + '</td><td class="r num">' + e.act.toFixed(4) + '×</td><td class="r num">' + e.pred.toFixed(4) + '×</td><td class="r num"><b>' + e.factor.toFixed(2) + '×</b></td><td>' + (ERR_NOTE[e.slug] || '') + '</td></tr>';
    });
    document.querySelector('#errTable tbody').innerHTML = h;
  }
  function renderT15() {
    var h = '';
    DATA.t15.experiments.forEach(function (e) {
      var ship = e.variant === 'V0-baseline-T1' ? ' ★ shipped' : '';
      h += '<tr><td><b>' + esc(e.variant) + '</b>' + ship + '</td><td class="r num">' + fmtX(e.loo_med) + '</td><td class="r num">' + fmtX(e.loo_geo) + '</td><td class="r num">' + fmtX(e.wf_med) + '</td><td class="r num">' + fmtX(e.wf_geo) + '</td><td class="r num">' + e.range_holds_pct.toFixed(1).replace('.', ',') + '%</td><td class="r num">' + e.top20_kept + '/20</td><td class="r num">' + fmtUSD(e.total_implied_v6_usd) + '</td></tr>';
    });
    document.querySelector('#t15Table tbody').innerHTML = h;
    $('t15Conclusion').textContent = DATA.t15.conclusion;
  }

  // ---- Tabel utama (default: peringkat v5) ----
  var sortKey = 'rank', sortDir = 1, selectedSlug = null;
  function valOf(c, k) {
    var r = c.r;
    switch (k) {
      case 'rank': return r.r;
      case 'name': return r.n.toLowerCase();
      case 'cat': return r.c.toLowerCase();
      case 'tvl': return r.tvl;
      case 'g7': return r.g7 == null ? -999 : r.g7;
      case 'age': return r.age == null ? -1 : r.age;
      case 'i5': return r.i5;
      case 'i6': return r.i6;
      case 'net': return c.net;
      case 'verdict': return { FARM: 0, MARGINAL: 1, SKIP: 2 }[c.verdict];
      case 'conf': return c.conf;
      default: return 0;
    }
  }
  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var fv = $('fVerdict').value, fc = $('fCat').value, fch = $('fChain').value;
    var fs = $('fScope').value, ft = $('fToken').value;
    var all = computeAll().filter(function (c) {
      var r = c.r;
      if (fv !== 'ALL' && c.verdict !== fv) return false;
      if (fc !== 'ALL' && r.c !== fc) return false;
      if (fch !== 'ALL' && r.ch.indexOf(fch) < 0) return false;
      if (fs === 'WL' && !r.wl) return false;
      if (fs === 'NONWL' && r.wl) return false;
      if (ft === 'pre-token' && r.st !== 'pre-token') return false;
      if (ft === 'traded' && r.st === 'pre-token') return false;
      if (q && (r.n.toLowerCase().indexOf(q) < 0 && r.s.indexOf(q) < 0 && r.c.toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    all.sort(function (a, b) {
      var va = valOf(a, sortKey), vb = valOf(b, sortKey);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return a.r.r - b.r.r;
    });
    return all;
  }
  function renderTable() {
    var all = filtered();
    var h = '';
    all.forEach(function (c) {
      var r = c.r;
      var netCls = c.net >= 0 ? 'pos' : 'neg';
      var chTxt = r.ch.slice(0, 3).join(' / ') + (r.ch.length > 3 ? ' +' + (r.ch.length - 3) : '');
      var sel = r.s === selectedSlug ? ' selected' : '';
      h += '<tr class="clickable' + sel + '" data-slug="' + esc(r.s) + '"><td class="num">' + r.r + '</td>' +
        '<td><b>' + esc(r.n) + '</b>' + (r.wl ? '<span class="tag wl">★ watchlist</span>' : '') + '<span class="tag pre">pre-token</span><br><span class="small">' + esc(r.s) + ' · ' + esc(chTxt) + '</span></td>' +
        '<td>' + esc(r.c) + '</td>' +
        '<td class="r num">' + fmtUSD(r.tvl) + '</td>' +
        '<td class="r num">' + fmtPct1(r.g7) + '</td>' +
        '<td class="r num">' + fmtAge(r.age) + '</td>' +
        '<td class="r num"><b>' + fmtUSD(r.i5) + '</b><br><span class="small">P launch ' + fmtPct(r.p5) + ' <span class="prov v5">v5</span></span></td>' +
        '<td class="r num"><b>' + fmtUSD(r.i6) + '</b><br><span class="small">P launch ' + fmtPct(r.p6) + ' <span class="prov v6">v6</span></span></td>' +
        '<td class="r num ' + netCls + '">' + fmtUSD2(c.net) + '</td>' +
        '<td class="r num">' + fmtUSD2(c.netLo) + ' – ' + fmtUSD2(c.netHi) + '</td>' +
        '<td><span class="verdict ' + c.verdict + '">' + c.verdict + '</span><br><span class="small">v5: ' + c.v5 + '</span></td>' +
        '<td class="r num">×' + c.conf.toFixed(0) + ' <span class="small">' + confLabel(c.conf) + '</span></td></tr>';
    });
    document.querySelector('#mainTable tbody').innerHTML = h;
    $('rowCount').textContent = 'Menampilkan ' + all.length + ' dari 198 protokol · rencana aktif $' + D.toLocaleString('en-US') + ' × ' + (S * 100).toFixed(1).replace('.', ',') + '%';
  }

  // ---- Detail View ----
  function findRow(slug) {
    for (var i = 0; i < rows.length; i++) if (rows[i].s === slug) return rows[i];
    return null;
  }
  function comparables(r) {
    var same = rows.filter(function (x) { return x.c === r.c && x.s !== r.s; });
    same.sort(function (a, b) {
      return Math.abs(Math.log(a.tvl / r.tvl)) - Math.abs(Math.log(b.tvl / r.tvl));
    });
    return same.slice(0, 5);
  }
  function netGridHtml(r) {
    var h = '<table class="netgrid"><thead><tr><th>Deposit \\ Share</th>';
    SHARES.forEach(function (s) { h += '<th>' + (s * 100).toFixed(1).replace('.', ',') + '%</th>'; });
    h += '</tr></thead><tbody>';
    DEPS.forEach(function (dep) {
      h += '<tr><td><b>$' + dep.toLocaleString('en-US') + '</b></td>';
      SHARES.forEach(function (s) {
        var net = s * r.i6 * dep / r.tvl - r.fee;
        var cls = 'num ' + (net >= 0 ? 'pos' : 'neg') + ((dep === D && s === S) ? ' active' : '');
        h += '<td class="' + cls + '">' + fmtUSD2(net) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table><p class="small">Net grid v6 — sel aktif = rencana saat ini ($' + D.toLocaleString('en-US') + ' × ' + (S * 100).toFixed(1).replace('.', ',') + '%). net = s · implied6 · D / TVL − fees.</p>';
  }
  function openDetail(slug, scroll) {
    var r = findRow(slug);
    if (!r) return;
    selectedSlug = slug;
    var c = { net: net6(r), netLo: net6Lo(r), netHi: net6Hi(r), verdict: verdict6(r), v5: verdict5(r), conf: confOf(r) };
    var n5 = net5(r), b5 = be5(r), b6 = be6(r);
    var comps = comparables(r);
    var h = '<div class="detail-head"><h3>' + esc(r.n) + '</h3>' +
      (r.wl ? '<span class="tag wl">★ watchlist</span>' : '') + '<span class="tag pre">pre-token</span>' +
      '<span class="small">' + esc(r.s) + ' · ' + esc(r.c) + ' · ' + esc(r.ch.join(' / ')) + '</span></div>' +
      '<p>TVL <b class="num">' + fmtUSD(r.tvl) + '</b> · 7d <b class="num">' + fmtPct1(r.g7) + '</b> · umur <b>' + fmtAge(r.age) + '</b> · peringkat v5 <b>#' + r.r + '</b> dari 198 · fees <b class="num">' + fmtUSD2(r.fee) + '</b></p>' +
      '<div class="detail-grid"><div><h4>Derivasi nilai — dua model, masing-masing berlabel</h4>' +
      '<table><tbody>' +
      '<tr><td>Value if launches <span class="prov v5">v5</span></td><td class="r num"><b>' + fmtUSD(r.v5) + '</b></td></tr>' +
      '<tr><td>P launch <span class="prov v5">v5</span></td><td class="r num">' + fmtPct(r.p5) + '</td></tr>' +
      '<tr><td>Implied = value × P <span class="prov v5">v5</span></td><td class="r num"><b>' + fmtUSD(r.i5) + '</b></td></tr>' +
      '<tr><td>Implied P10 – P90 (v5 band) <span class="prov v5">v5</span></td><td class="r num">' + fmtUSD(r.l5) + ' – ' + fmtUSD(r.h5) + '</td></tr>' +
      '<tr><td>Net rencana aktif <span class="prov v5">v5</span></td><td class="r num ' + (n5 >= 0 ? 'pos' : 'neg') + '">' + fmtUSD2(n5) + '</td></tr>' +
      '<tr><td>Breakeven odds <span class="prov v5">v5</span></td><td class="r num">' + fmtPct(b5) + '</td></tr>' +
      '<tr><td>Verdict rencana aktif <span class="prov v5">v5</span></td><td class="r num"><span class="verdict ' + c.v5 + '">' + c.v5 + '</span></td></tr>' +
      '<tr><td>V6 FDV est <span class="prov v6">v6</span></td><td class="r num"><b>' + fmtUSD(r.v6) + '</b></td></tr>' +
      '<tr><td>P launch (' + esc(r.pl) + ') <span class="prov v6">v6</span></td><td class="r num">' + fmtPct(r.p6) + '</td></tr>' +
      '<tr><td>Implied = V6 × P6 <span class="prov v6">v6</span></td><td class="r num"><b>' + fmtUSD(r.i6) + '</b></td></tr>' +
      '<tr><td>Implied P10 – P90 (residual LOO) <span class="prov v6">v6</span></td><td class="r num">' + fmtUSD(r.lo) + ' – ' + fmtUSD(r.hi) + '</td></tr>' +
      '<tr><td>Net P50 rencana aktif <span class="prov v6">v6</span></td><td class="r num ' + (c.net >= 0 ? 'pos' : 'neg') + '">' + fmtUSD2(c.net) + '</td></tr>' +
      '<tr><td>Net Range P10–P90 <span class="prov v6">v6</span></td><td class="r num">' + fmtUSD2(c.netLo) + ' – ' + fmtUSD2(c.netHi) + '</td></tr>' +
      '<tr><td>Breakeven odds <span class="prov v6">v6</span></td><td class="r num">' + fmtPct(b6) + '</td></tr>' +
      '<tr><td>Verdict rencana aktif <span class="prov v6">v6</span></td><td class="r num"><span class="verdict ' + c.verdict + '">' + c.verdict + '</span></td></tr>' +
      '<tr><td>Confidence P90/P10 <span class="prov v6">v6</span></td><td class="r num">×' + c.conf.toFixed(0) + ' ' + confLabel(c.conf) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="small">Model v5: category_comp ' + r.m5[0].toFixed(4) + ' · powerlaw ' + r.m5[1].toFixed(4) + ' · blended ' + r.m5[2].toFixed(4) + ' · growth ×' + r.m5[3].toFixed(4) + ' · drawdown ×' + r.m5[4].toFixed(4) + '. Model v6: Ridge log-linear ln(FDV/TVL), λ=10.</p></div>' +
      '<div><h4>Comparables terdekat — kategori ' + esc(r.c) + ' (TVL terdekat)</h4>' +
      '<table id="compTable"><thead><tr><th>Protokol</th><th class="r">TVL</th><th class="r">Implied v5</th><th class="r">Implied v6</th><th>Verdict v6</th></tr></thead><tbody>';
    comps.forEach(function (x) {
      h += '<tr><td><b>' + esc(x.n) + '</b><br><span class="small">#' + x.r + ' · ' + esc(x.s) + '</span></td><td class="r num">' + fmtUSD(x.tvl) + '</td><td class="r num">' + fmtUSD(x.i5) + '</td><td class="r num">' + fmtUSD(x.i6) + '</td><td><span class="verdict ' + verdict6(x) + '">' + verdict6(x) + '</span></td></tr>';
    });
    h += '</tbody></table>' +
      '<h4>Net grid — semua rencana (v6)</h4>' + netGridHtml(r) + '</div></div>' +
      '<h4>Farm plan — ' + r.fs.length + ' langkah (berbiaya + berwaktu)</h4><ol class="farm">';
    r.fs.forEach(function (st) { h += '<li>' + esc(st) + '</li>'; });
    h += '</ol><p><button class="linklike" id="detailClose">← Tutup detail &amp; kembali ke tabel</button></p>';
    $('detailBody').innerHTML = h;
    $('detailTitle').textContent = 'Detail View — ' + r.n + ' (#' + r.r + ' v5)';
    $('detailClose').addEventListener('click', function () { closeDetail(); });
    try { history.replaceState(null, '', '#/protocol/' + slug); } catch (e) { /* abaikan */ }
    renderTable();
    if (scroll !== false) $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function closeDetail() {
    selectedSlug = null;
    $('detailBody').innerHTML = '<p class="small">Belum ada protokol dipilih. Klik salah satu baris tabel untuk melihat derivasi nilai, comparables terdekat, net grid 3×3, dan farm plan lengkapnya.</p>';
    $('detailTitle').textContent = 'Detail View — klik baris tabel di atas';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* abaikan */ }
    renderTable();
  }

  // ---- wiring ----
  function refresh() { renderKPIs(); renderTable(); }
  function bindAll() {
    $('depBtns').addEventListener('click', function (e) {
      var b = e.target.closest('button.seg'); if (!b) return;
      D = parseInt(b.getAttribute('data-d'), 10);
      Array.prototype.forEach.call($('depBtns').children, function (x) { x.classList.toggle('active', x === b); });
      refresh();
      if (selectedSlug) openDetail(selectedSlug, false);
    });
    $('shareBtns').addEventListener('click', function (e) {
      var b = e.target.closest('button.seg'); if (!b) return;
      S = parseFloat(b.getAttribute('data-s'));
      Array.prototype.forEach.call($('shareBtns').children, function (x) { x.classList.toggle('active', x === b); });
      refresh();
      if (selectedSlug) openDetail(selectedSlug, false);
    });
    ['q', 'fVerdict', 'fCat', 'fChain', 'fScope', 'fToken'].forEach(function (id) {
      $(id).addEventListener(id === 'q' ? 'input' : 'change', renderTable);
    });
    document.querySelectorAll('#mainTable th[data-k]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = (k === 'name' || k === 'cat') ? 1 : -1; }
        renderTable();
      });
    });
    document.querySelector('#mainTable tbody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-slug]');
      if (tr) openDetail(tr.getAttribute('data-slug'));
    });
  }
  function fillFilters() {
    var cats = Array.from(new Set(rows.map(function (r) { return r.c; }))).sort();
    var sel = $('fCat');
    cats.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    var counts = {};
    rows.forEach(function (r) { r.ch.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
    var chains = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var selCh = $('fChain');
    chains.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c + ' (' + counts[c] + ')';
      selCh.appendChild(o);
    });
  }
  function renderFoot() {
    $('foot').innerHTML = 'Token Radar v6.1 (hybrid) · ranking point-estimate v5, interval P10–P90 + verdict model v6 Ridge log-linear ln(FDV/TVL), λ=10, cutoff 2026-11-14 · ' +
      'Sumber data: board-198.json (sha256 ' + DATA.meta.boardSha.slice(0, 12) + '…) + model_v6.json (sha256 ' + DATA.meta.modelSha.slice(0, 12) + '…) · ' +
      'Interval P10–P90 dari kuantil residual LOO per kategori (metode refit.mjs §3) · ' +
      'Aplikasi statis — data dimuat dari data.json di root output, tanpa aset eksternal · ' +
      'Dibangun deterministik oleh build-dashboard-v61.mjs (T2.5).';
  }

  function init(data) {
    DATA = data; rows = data.rows; VAL = data.val;
    $('loading').hidden = true;
    $('app').hidden = false;
    fillFilters();
    renderCoverage();
    renderIntegrity();
    renderCompare();
    renderScatter();
    renderErrTable();
    renderT15();
    bindAll();
    renderFoot();
    refresh();
    var m = location.hash.match(/^#\/protocol\/([A-Za-z0-9._-]+)$/);
    if (m) openDetail(m[1], false);
  }

  fetch('../data.json')
    .then(function (res) {
      if (!res.ok) throw new Error('data.json HTTP ' + res.status);
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      $('loading').hidden = true;
      var el = $('loadError');
      el.hidden = false;
      el.textContent = 'Gagal memuat data.json: ' + err.message + ' — buka dashboard lewat server lokal (bukan file langsung) agar fetch relatif berfungsi.';
    });
})();
