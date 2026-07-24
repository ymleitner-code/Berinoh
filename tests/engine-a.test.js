/* =============================================================================
   engine-a.test.js  -  validation checks for the Model A engine.
   No test framework needed. Run:  node tests/engine-a.test.js
   Exits non-zero if any check fails, so it can gate a commit.

   Anchors (cumWeddings, cumLent, ...) lock the current base-case behaviour so a
   later change to the engine cannot move the headline numbers unnoticed. Update
   them deliberately, with a note, when a rule genuinely changes.
   ============================================================================= */
var E = require('../js/engine-a.js');
var seed = require('../js/seed-500.js');
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

var R = E.simulate(seed, { horizon: 600 });
var d = R.d, H = R.m.length;

console.log('\nSEED AND FEE ARITHMETIC');
check('seed households loaded', seed.households.length, 500);
check('fee capital share', +d.capShare.toFixed(4), 10.9091, 1e-4);
check('fee overhead share', +d.ovhShare.toFixed(4), 4.0909, 1e-4);
check('capital and overhead split the whole fee', +(d.capShare + d.ovhShare).toFixed(6), 15);

console.log('\nTHE BALANCE-SHEET IDENTITY  (cash + loans == savings + capital)');
assert('identity holds every month, to under a penny', d.maxIdentityErr < 0.01,
       'max error ' + d.maxIdentityErr.toExponential(3));

console.log('\nDETERMINISM');
var R2 = E.simulate(seed, { horizon: 600 });
assert('two identical runs give identical totals',
       R2.d.cumWeddings === d.cumWeddings && R2.d.cumLent === d.cumLent);

console.log('\nOPENING PHASE, START-UP CAPITAL AND THE FLOOR');
check('lending begins at the lending-start month', d.lendingStartMonth, 36);
assert('nothing is lent before lending begins',
       R.weddingsFunded.slice(0, d.lendingStartMonth).every(function (x) { return x === 0; }));
assert('start-up capital is the fee balance after set-up costs, and is thin',
       d.startupCapital > 0 && d.startupCapital < 0.08 * 40000 * 100, 'GBP ' + Math.round(d.startupCapital));
assert('more set-up cost leaves less start-up capital',
       E.simulate(seed, { horizon: 120, setupCostTotal: 200000 }).d.startupCapital
       < E.simulate(seed, { horizon: 120, setupCostTotal: 60000 }).d.startupCapital);
assert('the thin start opens below the 8% floor for a stretch', d.capBreachMonths > 0,
       d.capBreachMonths + ' months');
assert('fundraising lifts capital and shortens the breach',
       E.simulate(seed, { horizon: 600, fundraisingPerYear: 35000 }).d.capBreachMonths < d.capBreachMonths);
assert('start-up fundraising lifts the opening capital and can clear the floor',
       E.simulate(seed, { horizon: 600, startupFundraising: 120000 }).d.startupCapital > d.startupCapital &&
       E.simulate(seed, { horizon: 600, startupFundraising: 120000 }).d.capBreachMonths < d.capBreachMonths);
assert('liquidity never falls below its reserve in the base case', d.liqBreachMonths === 0,
       d.liqBreachMonths + ' months below');

console.log('\nTHE AMOUNT IS SOLVED, BOUNDED, AND RAMPS TOWARD THE CEILING');
var minA = Infinity, maxA = 0, reached40 = false;
for (var i = 0; i < H; i++) {
  var a = R.amount[i];
  if (a > 0) { if (a < minA) minA = a; if (a > maxA) maxA = a; }
  if (a >= 40000 - 1e-6) reached40 = true;
}
assert('every set amount stays within [0, 40000]', maxA <= 40000 + 1e-6, 'max ' + Math.round(maxA));
assert('the amount reaches the full 40000 ceiling at maturity', reached40);
assert('the amount is genuinely rationed below the ceiling at times', minA < 40000 - 1000,
       'min ' + Math.round(minA));
assert('the first loan is the ramp-start figure of 10000', R.amount[d.lendingStartMonth] === 10000,
       'got ' + R.amount[d.lendingStartMonth]);
var dips = false, hiA = 0;
for (i = d.lendingStartMonth; i < H; i++) { if (R.amount[i] < hiA - 1e-6) dips = true; hiA = Math.max(hiA, R.amount[i]); }
assert('the loan only ever rises, never dips', !dips);

console.log('\nGROWTH IS DEMOGRAPHIC (reproduction), MEASURED IN UNITS');
assert('the member base grows', d.endMembers > 500, d.endMembers + ' at end');
assert('realised growth is in the reproduction range 3.5% to 5.5% a year',
       d.realisedGrowthPct > 3.5 && d.realisedGrowthPct < 5.5, d.realisedGrowthPct.toFixed(2) + '%');

console.log('\nTHE MEMBERSHIP GATE BITES ON ESTABLISHED JOINERS');
var gated = 0;
for (i = 0; i < H; i++) if (R.weddingsDue[i] > R.weddingsFunded[i] + 1e-9) gated++;
assert('some weddings are due but not funded, because gated joiners marry off older children',
       gated > 0, gated + ' such months');
var noGate = E.simulate(seed, { horizon: 600, enrollAnnualPct: 0 });
assert('with no established joiners there is far less gating',
       ((function () { var g = 0; for (var k = 0; k < H; k++) if (noGate.weddingsDue[k] > noGate.weddingsFunded[k] + 1e-9) g++; return g; })()) < gated);

console.log('\nSCHEDULE MODE: A COMMITTEE-SET RAMP IS FOLLOWED');
var RS = E.simulate(seed, { horizon: 600, amountSchedule: [{ fromYear: 1, amount: 10000 }, { fromYear: 20, amount: 40000 }] });
check('schedule holds 10000 in year 5', RS.amount[5 * 12], 10000);
check('schedule steps to 40000 in year 30', RS.amount[30 * 12], 40000);
assert('the schedule run keeps its liquidity reserve and stays finite',
       RS.d.liqBreachMonths === 0 && RS.cash.every(isFinite));

console.log('\nSTRESS: DEFAULTS ERODE CAPITAL, RUN STAYS FINITE');
var SV = E.simulate(seed, { horizon: 600, defaultAnnualPct: 5, recoveryPct: 25, recoveryLagM: 24 });
assert('every value stays finite under stress', SV.cash.every(isFinite) && SV.capital.every(isFinite));
assert('the identity still holds under stress, losses and recoveries and all', SV.d.maxIdentityErr < 0.01,
       'max error ' + SV.d.maxIdentityErr.toExponential(3));
assert('the base case records no losses', d.endCumLoss === 0, 'base loss ' + d.endCumLoss);
assert('defaults record real losses that erode capital', SV.d.endCumLoss > 0 && SV.d.endCapital < d.endCapital,
       'stress loss ' + Math.round(SV.d.endCumLoss) + ', capital ' + Math.round(SV.d.endCapital) + ' vs ' + Math.round(d.endCapital));

console.log('\nINTEREST ON CASH: OFF BY DEFAULT, ACCRUES WHEN SET, IDENTITY HOLDS');
assert('no interest in the base case', d.endCumInterest === 0);
var IN = E.simulate(seed, { horizon: 600, cashInterestPct: 4 });
assert('interest accrues when a rate is set', IN.d.endCumInterest > 0, 'earned ' + Math.round(IN.d.endCumInterest));
assert('interest income lifts end capital above the no-interest run', IN.d.endCapital > d.endCapital);
assert('the identity still holds with interest on', IN.d.maxIdentityErr < 0.01,
       'max error ' + IN.d.maxIdentityErr.toExponential(3));

console.log('\nFIXED OVERHEAD, FUNDRAISING, BAD DEBT, WITHDRAWAL: each moves the fund and holds the identity');
var OH = E.simulate(seed, { horizon: 600, fixedOverheadPerYear: 120000 });
assert('fixed overhead raises total costs and lowers capital', OH.d.endCumCost > d.endCumCost && OH.d.endCapital < d.endCapital);
assert('overhead run keeps the identity', OH.d.maxIdentityErr < 0.01, 'err ' + OH.d.maxIdentityErr.toExponential(3));
var FR = E.simulate(seed, { horizon: 600, fundraisingPerYear: 120000 });
assert('fundraising brings money in and lifts capital', FR.d.endCumFundraise > 0 && FR.d.endCapital > d.endCapital);
assert('fundraising run keeps the identity', FR.d.maxIdentityErr < 0.01, 'err ' + FR.d.maxIdentityErr.toExponential(3));
var BD = E.simulate(seed, { horizon: 600, badDebtPct: 3 });
assert('bad debt records losses', BD.d.endCumLoss > 0 && d.endCumLoss === 0);
assert('bad-debt run keeps the identity', BD.d.maxIdentityErr < 0.01, 'err ' + BD.d.maxIdentityErr.toExponential(3));
var WD = E.simulate(seed, { horizon: 600, withdrawalAnnualPct: 5 });
assert('withdrawals shrink the end membership', WD.d.endMembers < d.endMembers, WD.d.endMembers + ' vs ' + d.endMembers);
assert('withdrawal run keeps the identity', WD.d.maxIdentityErr < 0.01, 'err ' + WD.d.maxIdentityErr.toExponential(3));
assert('withdrawals are deterministic', E.simulate(seed, { horizon: 600, withdrawalAnnualPct: 5 }).d.endMembers === WD.d.endMembers);

console.log('\nMARRIAGE AGE VARIES WHEN ASKED, SYNCHRONISES WHEN NOT');
var sync = E.simulate(seed, { horizon: 600, marriageAgeSd: 0 });
assert('a zero spread is accepted and runs', sync.d.cumWeddings > 0);

console.log('\nBASE-CASE ANCHORS  (lock current behaviour; change deliberately)');
check('cumulative weddings funded, 50 years', d.cumWeddings, 10433);
check('cumulative pounds lent, 50 years', Math.round(d.cumLent), 355762500);
check('first funded wedding, month', d.firstWeddingMonth, 36);
check('members at end', d.endMembers, 4523);
check('start-up capital at lending start, GBP', Math.round(d.startupCapital), 150800);

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
