/* =============================================================================
   app.js  -  state, presets, wiring and rendering.
   Holds no simulation maths and no language. Numbers come from engine-b.js,
   words from the strings file the page loaded.
   ============================================================================= */
(function () {
  'use strict';

  /* Scenario definitions. Numbers only; the descriptions live in the strings file. */
  var DESIGN = { contrib: 40, capMonths: 120, savingsSharePct: 50, loan: 40000,
                 repayRatePct: 1, intakeBase: 12000, intakeGrowthPct: 0 };
  var CLEAN  = { defaultAnnualPct: 0, recoveryPct: 0, recoveryLagM: 12, exitAnnualPct: 0,
                 costPctInflow: 0, costPerMemberYear: 0, reservePct: 0, runOffYear: 0 };
  var PRESETS = {
    base: { horizon: 600, v: Object.assign({}, DESIGN, CLEAN) },
    caut: { horizon: 600, v: Object.assign({}, DESIGN, CLEAN, { defaultAnnualPct: 2, recoveryPct: 50,
             recoveryLagM: 12, costPctInflow: 3, costPerMemberYear: 6, reservePct: 5, exitAnnualPct: 1 }) },
    sev:  { horizon: 600, v: Object.assign({}, DESIGN, CLEAN, { defaultAnnualPct: 5, recoveryPct: 25,
             recoveryLagM: 24, costPctInflow: 6, costPerMemberYear: 12, reservePct: 10,
             exitAnnualPct: 3, intakeGrowthPct: -2 }) },
    ro:   { horizon: 900, v: Object.assign({}, DESIGN, CLEAN, { runOffYear: 20, defaultAnnualPct: 2,
             recoveryPct: 50, costPctInflow: 3, costPerMemberYear: 6, reservePct: 5 }) }
  };
  var IDS = ['contrib', 'capMonths', 'savingsSharePct', 'loan', 'repayRatePct', 'intakeBase',
             'intakeGrowthPct', 'defaultAnnualPct', 'recoveryPct', 'recoveryLagM', 'exitAnnualPct',
             'costPctInflow', 'costPerMemberYear', 'reservePct', 'runOffYear'];
  var HORIZONS = [300, 600, 900, 1200];
  var PRESET_BTN = { base: 'p-base', caut: 'p-caut', sev: 'p-sev', ro: 'p-ro' };

  var state = { horizon: 600, preset: 'base', scrubYear: 1 };
  var R = null, P = null, S = null, f = null, timer = null;

  function $(id) { return document.getElementById(id); }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }

  /* The page asks for enrolment a year; the engine works in months. */
  function readP() {
    return {
      contrib: Math.max(1, num('contrib')), capMonths: Math.max(1, Math.round(num('capMonths'))),
      savingsSharePct: Math.min(100, Math.max(0, num('savingsSharePct'))),
      loan: Math.max(100, num('loan')), repayRatePct: Math.max(0.05, num('repayRatePct')),
      intakeBase: Math.max(0.1, num('intakeBase') / 12), intakeGrowthPct: num('intakeGrowthPct'),
      defaultAnnualPct: Math.max(0, num('defaultAnnualPct')),
      recoveryPct: Math.min(100, Math.max(0, num('recoveryPct'))),
      recoveryLagM: Math.max(0, num('recoveryLagM')),
      exitAnnualPct: Math.min(90, Math.max(0, num('exitAnnualPct'))),
      costPctInflow: Math.min(60, Math.max(0, num('costPctInflow'))),
      costPerMemberYear: Math.max(0, num('costPerMemberYear')),
      reservePct: Math.max(0, num('reservePct')),
      runOffYear: Math.max(0, Math.round(num('runOffYear'))),
      horizon: state.horizon
    };
  }

  function applyPreset(key) {
    var pr = PRESETS[key];
    for (var k in pr.v) if ($(k)) $(k).value = pr.v[k];
    state.horizon = pr.horizon; state.preset = key;
    $('presetNote').textContent = S.presets[key];
    state.scrubYear = Math.min(state.scrubYear, pr.horizon / 12);
    syncChrome(); run();
  }
  function markCustom() {
    if (state.preset !== 'custom') {
      state.preset = 'custom'; $('presetNote').textContent = S.custom; syncChrome();
    }
  }
  function syncChrome() {
    for (var k in PRESET_BTN) $(PRESET_BTN[k]).classList.toggle('on', state.preset === k);
    var hb = $('hbs');
    hb.innerHTML = HORIZONS.map(function (h, i) {
      return '<button type="button" class="hb' + (h === state.horizon ? ' on' : '') + '" data-h="' + h + '">' + S.horizons[i] + '</button>';
    }).join('');
    hb.querySelectorAll('.hb').forEach(function (b) {
      b.addEventListener('click', function () {
        state.horizon = parseInt(b.dataset.h, 10);
        state.scrubYear = Math.min(state.scrubYear, state.horizon / 12);
        markCustom(); syncChrome(); run();
      });
    });
  }

  function analyse() {
    var A = {}, n = R.m.length, i;
    A.cross50 = null;
    for (i = 12; i < n; i++) if (R.a.selfFund[i] >= 0.5) { A.cross50 = R.m[i]; break; }
    A.peakWait = -1; A.peakM = null;
    for (i = 0; i < n; i++) { var w = R.wait[i]; if (w != null && w > A.peakWait) { A.peakWait = w; A.peakM = R.m[i]; } }
    A.lastWait = null;
    for (i = n - 1; i >= 0; i--) if (R.wait[i] != null) { A.lastWait = R.wait[i]; break; }
    A.clear = null;
    for (i = 0; i < n; i++) if (R.queue[i] < 1) { A.clear = R.m[i]; break; }
    A.lastLend = 0;
    for (i = 0; i < n; i++) if (R.loans[i] > 0) A.lastLend = R.m[i];
    if (P.runOffYear > 0) {
      var st = Math.min(n, P.runOffYear * 12) - 1;
      A.atStop = st >= 0 ? R.cumLoans[st] : 0;
      A.afterStop = R.cumLoans[n - 1] - A.atStop;
    }
    return A;
  }

  function paintJourney() {
    $('journey').innerHTML = S.journey(P, R.d).map(function (s) {
      return '<div class="stage ' + s[0] + '"><div class="stage-when">' + s[1] + '</div>' +
             '<div class="stage-amt">' + s[2] + '</div><p>' + s[3] + '</p></div>';
    }).join('');
  }

  function paintCycle() {
    var maxY = Math.floor(P.horizon / 12), sl = $('cycYear');
    sl.max = maxY; if (state.scrubYear > maxY) state.scrubYear = maxY;
    sl.value = state.scrubYear;
    $('cycYearOut').textContent = state.scrubYear;

    var Y = window.yearAgg(R, state.scrubYear), tot = Y.newMoney + Y.recycled;
    var shareRec = tot > 0 ? Y.recycled / tot : 0, shareNew = 1 - shareRec;

    $('cycPct').textContent = Math.round(shareRec * 100);
    $('splitNew').style.width = (shareNew * 100).toFixed(1) + '%';
    $('splitRec').style.width = (shareRec * 100).toFixed(1) + '%';

    var wNew = 3 + shareNew * 11, wRec = 3 + shareRec * 11, wOut = Y.lending > 0 ? 12 : 2.5;
    $('fNew').setAttribute('stroke-width', wNew.toFixed(1));
    $('fRec').setAttribute('stroke-width', wRec.toFixed(1));
    $('fOut').setAttribute('stroke-width', wOut.toFixed(1));
    window.charts.sizeArrow('ah-new', wNew);
    window.charts.sizeArrow('ah-rec', wRec);
    window.charts.sizeArrow('ah-out', wOut);

    $('fNewAmt').textContent = f.gbp(Y.newMoney);
    $('fRecAmt').textContent = f.gbp(Y.recycled);
    $('fOutAmt').textContent = f.gbp(Y.lending);
    $('cycPot').textContent = f.gbp(Y.cash);
    $('cycFam').textContent = S.cycle.waiting(Y.queue);
    $('cycLoansN').textContent = S.cycle.weddings(Y.loans);
    $('cycCap').textContent = S.cycle.caption(state.scrubYear);
    $('cycRead').textContent = S.cycle.narrative(state.scrubYear, Y.loans, shareRec);

    var outgo = Y.cost + Y.loss, gc = $('gCost');
    if (outgo > 0.5) {
      gc.style.display = '';
      $('cycCostAmt').textContent = f.gbp(outgo);
      var wCost = Math.max(2.5, Math.min(11, 2.5 + (Y.lending > 0 ? outgo / Y.lending : 0) * 26));
      $('fCost').setAttribute('stroke-width', wCost.toFixed(1));
      window.charts.sizeArrow('ah-cost', wCost);
    } else gc.style.display = 'none';
  }

  function paintStats(A) {
    $('stats').innerHTML = S.stats(R, P, A).map(function (c) {
      return '<div class="stat tone-' + c[0] + '"><div class="k">' + c[1] + '</div>' +
             '<div class="v">' + c[2] + '</div><div class="n">' + c[3] + '</div></div>';
    }).join('');
  }

  function paintRunoff(A) {
    $('roGrid').innerHTML = S.runoff(R, P, A).map(function (c) {
      return '<div class="ro-card"><h3>' + c.h + '</h3><div class="ro-num">' + c.num + '</div><p>' + c.body + '</p></div>';
    }).join('');
  }

  function paintCharts(A) {
    var H = P.horizon, mark = P.runOffYear > 0 ? P.runOffYear * 12 : null, ML = S.markLabel;
    var C = S.charts, money = function (v) { return '\u00a3' + f.shortN(v); };
    var d = window.charts.draw;

    d({ el: 'c-mix', type: 'stack100', xMax: H, tall: true, title: C.mix.title, why: C.mix.why,
        series: [{ label: C.mix.s1, color: '#dd7d33', y: R.a.newMoney, op: 0.9 },
                 { label: C.mix.s2, color: '#10897c', y: R.a.recycled, op: 0.9 }],
        yFmt: function (v) { return Math.round(v * 100) + '%'; }, markX: mark, markLabel: ML,
        note: A.cross50 ? C.mix.noteCross(f.yr(A.cross50)) : C.mix.noteNone });

    d({ el: 'c-self', type: 'stack', xMax: H, title: C.self.title, why: C.self.why,
        series: [{ label: C.self.s1, color: '#dd7d33', y: R.a.newMoney, op: 0.85 },
                 { label: C.self.s2, color: '#10897c', y: R.a.recycled, op: 0.85 }],
        yFmt: money, yTip: f.gbpFull, markX: mark, markLabel: ML });

    d({ el: 'c-race', type: 'line', xMax: H, title: C.race.title, why: C.race.why,
        series: [{ label: C.race.s1, color: '#6a55c8', y: R.a.loans },
                 { label: C.race.s2, color: '#8fa0b6', y: R.a.intake, dash: true }],
        yFmt: f.shortN, yTip: C.race.tip, markX: mark, markLabel: ML });

    d({ el: 'c-wait', type: 'line', xMax: H, title: C.wait.title, why: C.wait.why,
        series: [{ label: C.wait.s1, color: '#b8395e',
                   y: R.wait.map(function (v) { return v == null ? null : v / 12; }) }],
        yFmt: function (v) { return v.toFixed(0); }, yTip: C.wait.tip, markX: mark, markLabel: ML });

    d({ el: 'c-queue', type: 'line', xMax: H, title: C.queue.title,
        series: [{ label: C.queue.s1, color: '#6a55c8', y: R.queue }],
        yFmt: f.shortN, yTip: C.queue.tip, markX: mark, markLabel: ML,
        note: A.clear ? C.queue.noteClear(f.yr(A.clear)) : C.queue.noteNone });

    d({ el: 'c-cover', type: 'line', xMax: H, title: C.cover.title,
        series: [{ label: C.cover.s1, color: '#10897c',
                   y: R.coverage.map(function (v) { return v * 100; }) }],
        yFmt: function (v) { return v.toFixed(0) + '%'; },
        yTip: function (v) { return v.toFixed(1) + '%'; }, markX: mark, markLabel: ML });

    d({ el: 'c-cash', type: 'line', xMax: H, title: C.cash.title, why: C.cash.why,
        series: [{ label: C.cash.s1, color: '#16233a', y: R.cash },
                 { label: C.cash.s2, color: '#dd7d33', dash: true,
                   y: R.paidIn.map(function (v) { return v * P.savingsSharePct / 100; }) }],
        yFmt: money, yTip: f.gbpFull, markX: mark, markLabel: ML });

    d({ el: 'c-loss', type: 'line', xMax: H, title: C.loss.title, why: C.loss.why,
        series: [{ label: C.loss.s1, color: '#c08f2a', y: R.cumCost },
                 { label: C.loss.s2, color: '#b8395e', y: R.cumLoss }],
        yFmt: money, yTip: f.gbpFull, markX: mark, markLabel: ML,
        note: (P.defaultAnnualPct === 0 && P.costPctInflow === 0 && P.costPerMemberYear === 0) ? C.loss.noteZero : '' });
  }

  function lastWaitTo(i) { for (var k = i; k >= 0; k--) if (R.wait[k] != null) return R.wait[k]; return null; }

  function paintTable() {
    var yrs = Math.floor(P.horizon / 12);
    var h = '<thead><tr>' + S.tableHeaders.map(function (t) { return '<th>' + t + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var y = 1; y <= yrs; y++) {
      var a = (y - 1) * 12, b = y * 12, inS = 0, outS = 0, lS = 0, iS = 0, sf = 0;
      for (var i = a; i < b; i++) {
        inS += R.newMoney[i] + R.recycled[i]; outS += R.lending[i];
        lS += R.loans[i]; iS += R.intake[i]; sf += R.selfFund[i];
      }
      var j = b - 1;
      h += '<tr><td class="n">' + y + '</td><td class="n">' + f.ci(iS) + '</td><td class="n">' + f.ci(lS) +
           '</td><td class="n">' + f.ci(R.cumLoans[j]) + '</td><td class="n">' + f.pc(R.coverage[j]) +
           '</td><td class="n">' + f.ci(R.queue[j]) + '</td><td>' + f.wy(lastWaitTo(j)) +
           '</td><td class="n">' + f.pc(sf / 12) + '</td><td class="n">' + f.gbp(inS) +
           '</td><td class="n">' + f.gbp(outS) + '</td><td class="n">' + f.gbp(R.cash[j]) + '</td></tr>';
    }
    $('tbl').innerHTML = h + '</tbody>';
  }

  function downloadCSV() {
    if (!R) return;
    var rows = [S.csvHeader];
    for (var i = 0; i < R.m.length; i++) {
      rows.push([R.m[i], R.intake[i].toFixed(2), R.contrib[i].toFixed(2), R.topup[i].toFixed(2),
        R.repay[i].toFixed(2), R.recov[i].toFixed(2), R.cost[i].toFixed(2), R.refund[i].toFixed(2),
        R.loans[i], R.cumLoans[i], R.queue[i].toFixed(2),
        (R.paidIn[i] * P.savingsSharePct / 100).toFixed(2),
        (R.wait[i] == null ? '' : R.wait[i].toFixed(3)), R.cash[i].toFixed(2),
        R.selfFund[i].toFixed(5), R.cumCost[i].toFixed(2), R.cumLoss[i].toFixed(2)].join(','));
    }
    /* Byte-order mark so Excel opens Hebrew headers correctly. */
    var blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = S.csvFile; a.click();
  }

  function run() {
    P = readP();
    R = window.withAnnual(window.simulate(P));
    var A = analyse();
    $('sumDesign').innerHTML = S.designSummary(R.d);
    paintJourney(); paintCycle(); paintStats(A); paintRunoff(A); paintCharts(A); paintTable();
  }
  function runSoon() { clearTimeout(timer); timer = setTimeout(run, 200); }

  document.addEventListener('DOMContentLoaded', function () {
    S = window.STRINGS; f = window.fmt;
    window.cycle.build($('cycleHost'), S.dir, S);
    IDS.forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { markCustom(); runSoon(); });
    });
    $('cycYear').addEventListener('input', function (e) {
      state.scrubYear = parseInt(e.target.value, 10) || 1; paintCycle();
    });
    for (var k in PRESET_BTN) {
      (function (key) { $(PRESET_BTN[key]).addEventListener('click', function () { applyPreset(key); }); })(k);
    }
    $('dlBtn').addEventListener('click', downloadCSV);
    state.scrubYear = 1;
    applyPreset('base');
  });
})();
