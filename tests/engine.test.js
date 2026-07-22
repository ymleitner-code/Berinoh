/* =============================================================================
   engine.test.js  -  validation checks for the Model B engine.
   No test framework needed. Run:  node tests/engine.test.js
   Exits non-zero if any check fails, so it can gate a commit.
   ============================================================================= */
var E = require('../js/engine-b.js');
var pass = 0, fail = 0;

function check(name, actual, expected, tol) {
  var ok = (tol === undefined) ? (actual === expected) : (Math.abs(actual - expected) <= tol);
  if (ok) { pass++; console.log('  PASS  ' + name + '  =  ' + actual); }
  else { fail++; console.log('  FAIL  ' + name + '  got ' + actual + ', expected ' + expected); }
}
function assert(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  ' + detail : '')); }
}

var BASE = {
  contrib: 40, capMonths: 120, savingsSharePct: 50, loan: 40000, repayRatePct: 1,
  intakeBase: 1000, intakeGrowthPct: 0, runOffYear: 0,
  defaultAnnualPct: 0, recoveryPct: 0, recoveryLagM: 12, exitAnnualPct: 0,
  costPctInflow: 0, costPerMemberYear: 0, reservePct: 0, horizon: 600
};
function run(over) { return E.withAnnual(E.simulate(Object.assign({}, BASE, over || {}))); }

console.log('\nPER-MEMBER ARITHMETIC');
var R = run(), d = R.d;
check('paid in total', d.target, 4800);
check('savings half', d.savings, 2400);
check('community half', d.fee, 2400);
check('loan multiple of savings', +d.multiple.toFixed(2), 16.67);
check('cash repayment months', d.cashTermMonths, 94);
check('months covered by savings offset', Math.round(d.offsetMonths), 6);

console.log('\nBASE CASE OVER 50 YEARS');
var L = 599;
check('weddings funded', R.cumLoans[L], 335080);
check('families served %', +(R.coverage[L] * 100).toFixed(1), 55.8);
check('average wait, years', +(R.wait[L] / 12).toFixed(1), 22.1);
check('final-year self-funding %', +(R.a.selfFund[L] * 100).toFixed(1), 88.4);
var cross = null;
for (var i = 12; i < 600; i++) if (R.a.selfFund[i] >= 0.5) { cross = Math.ceil((i + 1) / 12); break; }
check('repayments overtake new money, year', cross, 11);

console.log('\nINVARIANTS THAT MUST NEVER BREAK');
var neg = 0, over = 0, frac = 0;
for (i = 0; i < 600; i++) {
  if (R.cash[i] < -0.5) neg++;
  if (R.cash[i] >= 40000) over++;
  if (R.loans[i] !== Math.floor(R.loans[i])) frac++;
}
assert('cash never goes negative', neg === 0, neg + ' months negative');
assert('unlent cash never exceeds one loan', over === 0, over + ' months over');
assert('loans are always whole numbers', frac === 0, frac + ' fractional');
assert('every value is finite', R.cumLoans.every(isFinite) && R.cash.every(isFinite));

console.log('\nSCALE INVARIANCE');
/* Halving every flow should halve every total. It does not match to the exact
   loan, because the fund only ever issues WHOLE loans, so the leftover cash that
   is too small to fund another one rounds differently at a different scale. That
   drift is inherent to the design, not a bug, so the test bounds it rather than
   ignoring it: it must stay under one hundredth of one per cent. */
var H = run({ intakeBase: 500 });
var drift = Math.abs(H.cumLoans[L] * 2 - R.cumLoans[L]);
var driftPct = drift / R.cumLoans[L] * 100;
assert('half the enrolment gives half the weddings, within whole-loan rounding',
       driftPct < 0.01, 'drift ' + drift + ' loans = ' + driftPct.toFixed(4) + '%');
console.log('        (whole-loan rounding drift at half scale: ' + drift + ' loans, ' + driftPct.toFixed(4) + '%)');
check('coverage is unchanged', +(H.coverage[L] * 100).toFixed(1), +(R.coverage[L] * 100).toFixed(1));

console.log('\nRUN-OFF, ENROLMENT CLOSED AT YEAR 20');
var RO = run({ horizon: 900, runOffYear: 20, defaultAnnualPct: 2, recoveryPct: 50,
               costPctInflow: 3, costPerMemberYear: 6, reservePct: 5 });
var atStop = RO.cumLoans[20 * 12 - 1];
check('funded before closure', Math.round(atStop), 46586);
check('funded after closure, from repayments alone', Math.round(RO.cumLoans[899] - atStop), 140635);
check('served by year 75, %', +(RO.coverage[899] * 100).toFixed(1), 78.0);
var noIntake = 0;
for (i = 240; i < 900; i++) noIntake += RO.intake[i];
check('no enrolment after the closure year', Math.round(noIntake), 0);

console.log('\nSTRESS RUNS COMPLETE WITHOUT BREAKING');
var SV = run({ defaultAnnualPct: 5, recoveryPct: 25, recoveryLagM: 24, costPctInflow: 6,
               costPerMemberYear: 12, reservePct: 10, exitAnnualPct: 3, intakeGrowthPct: -2 });
assert('severe stress produces finite results', SV.cumLoans.every(isFinite));
assert('severe stress funds fewer weddings than base', SV.cumLoans[L] < R.cumLoans[L],
       SV.cumLoans[L] + ' vs ' + R.cumLoans[L]);
assert('losses are recorded when defaults are on', SV.cumLoss[L] > 0);
assert('costs are recorded when costs are on', SV.cumCost[L] > 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
