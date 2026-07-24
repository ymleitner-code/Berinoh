/* =============================================================================
   compare.js  -  the landing and comparison page.
   Runs both engines on a small set of shared assumptions and shows the two
   schemes side by side. No DOM maths beyond wiring; numbers from engine-a.js
   (window.engineA) and engine-b.js (window.simulate/withAnnual), formatting from
   format.js, drawing from charts.js.
   ============================================================================= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var f;
  var IDS = ['cyears', 'cloan', 'cbad', 'cchildren'];
  var timer = null;

  function num(id, d) { var v = parseFloat($(id).value); return isFinite(v) ? v : d; }

  function tile(tone, k, v, n) {
    return '<div class="stat tone-' + tone + '"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="n">' + n + '</div></div>';
  }

  function run() {
    var years = Math.min(90, Math.max(10, Math.round(num('cyears', 50))));
    var loan = Math.max(1000, num('cloan', 40000));
    var bad = Math.min(15, Math.max(0, num('cbad', 0)));
    var children = Math.max(12, num('cchildren', 12000));
    $('vyears').textContent = years; $('vloan').textContent = '£' + loan.toLocaleString('en-GB');
    $('vbad').textContent = bad + '%'; $('vchildren').textContent = Math.round(children).toLocaleString('en-GB');
    var H = years * 12;

    /* Model A, on the household data */
    var Ra = window.engineA.simulate(window.SEED_500, {
      horizon: H, loanMax: loan, badDebtPct: bad, recoveryPct: bad > 0 ? 25 : 0, recoveryLagM: 24,
      fundraisingPerYear: 35000, startupFundraising: 50000
    });
    var da = Ra.d;

    /* Model B, on a steady flow of joiners */
    var Rb = window.withAnnual(window.simulate({
      contrib: 40, capMonths: 120, savingsSharePct: 50, loan: loan, repayRatePct: 1,
      intakeBase: children / 12, intakeGrowthPct: 0, runOffYear: 0,
      defaultAnnualPct: bad, recoveryPct: bad > 0 ? 50 : 0, recoveryLagM: 12, exitAnnualPct: 0,
      costPctInflow: 0, costPerMemberYear: 0, reservePct: 0, horizon: H
    }));
    var L = Rb.m.length - 1;
    var served = Rb.coverage[L] * 100;
    var lastWait = null; for (var i = L; i >= 0; i--) if (Rb.wait[i] != null) { lastWait = Rb.wait[i]; break; }
    var crossB = null; for (i = 12; i < Rb.m.length; i++) if (Rb.a.selfFund[i] >= 0.5) { crossB = Math.ceil((i + 1) / 12); break; }

    /* aligned outcome tiles */
    $('outA').innerHTML =
      tile('new', 'How a family is served', 'On the date', 'The money is there when the child marries.') +
      tile('rec', 'The loan', da.fullEntitlementMonth == null ? 'grows toward ' + f.gbp(loan) : 'reaches ' + f.gbp(loan) + ' by year ' + Math.round(da.fullEntitlementMonth / 12), 'Starts near ' + f.gbp(10000) + ' and only ever rises.') +
      tile('new', 'Weddings funded', f.ci(da.cumWeddings), 'Almost every wedding that falls due.') +
      tile('rec', 'Community growth', da.realisedGrowthPct.toFixed(1) + '% a year', 'By reproduction; measurable against member data.') +
      tile('out', 'Capital below its floor', da.capBreachMonths + ' months', 'Thin capital, held up by fundraising.');

    $('outB').innerHTML =
      tile('new', 'How a family is served', 'After a wait', 'The full amount, once your turn in the queue comes.') +
      tile('q', 'The loan', f.gbp(loan) + ', in full', 'The same amount for everyone, from the start.') +
      tile('new', 'Weddings funded', f.ci(Rb.cumLoans[L]), 'Over the run, from a steady intake.') +
      tile('q', 'Share served', served.toFixed(0) + '%', 'The rest are still in the queue. Average wait ' + f.wy(lastWait) + '.') +
      tile('rec', 'Self-funding', crossB ? 'from year ' + crossB : 'not within the run', 'Repayments overtake new money; run-off risk falls.');

    /* coverage over time, the one figure both share */
    var covA = [], cf = 0, cd = 0;
    for (i = 0; i < Ra.m.length; i++) { cf += Ra.weddingsFunded[i]; cd += Ra.weddingsDue[i]; covA.push(cd > 0 ? cf / cd * 100 : null); }
    window.charts.draw({
      el: 'c-cov', type: 'line', xMax: H, tall: true,
      title: 'Share of families served over time',
      why: 'The one measure both schemes share. Model A serves nearly everyone who becomes due, on time. Model B serves whoever the queue has reached, in full but after a wait.',
      series: [{ label: 'Gemach Hakehiloh (Model A)', color: '#b8395e', y: covA },
               { label: 'The Queue (Model B)', color: '#6a55c8', y: Rb.coverage.map(function (v) { return v * 100; }) }],
      yFmt: function (v) { return v.toFixed(0) + '%'; }, yTip: function (v) { return v.toFixed(1) + '%'; }
    });
  }

  function runSoon() { clearTimeout(timer); timer = setTimeout(run, 160); }

  document.addEventListener('DOMContentLoaded', function () {
    f = window.fmt;
    IDS.forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', runSoon); });
    run();
  });
})();
