/* =============================================================================
   strings-en.js  -  every English string the interface generates at runtime.
   Static page copy (headings, control labels, the assumptions list, the footer)
   lives in index.html. Anything interpolated with a number lives here.
   ============================================================================= */
window.STRINGS = {
  dir: 'ltr',
  unitK: 'k', unitM: 'm', unitBn: 'bn',
  axisYears: 'years',
  tipYear: function (y) { return 'Year ' + y; },
  custom: 'Your own settings.',
  markLabel: 'enrolment closes',
  durationNone: 'not yet',
  duration: function (y, m) { return y + 'y ' + m + 'm'; },
  yearOf: function (n) { return 'year ' + n; },

  horizons: ['25 years', '50 years', '75 years', '100 years'],

  nodes: {
    aria: 'Diagram of money circulating between families and the fund',
    families: 'Saving families', familiesSub: 'paying in monthly',
    fund: 'The fund', fundSub: 'balance carried forward',
    loans: 'Wedding loans', loansSub: 'funded during the year',
    costs: 'Costs and losses', costsSub: 'overheads and bad debts',
    flowNew: 'new money in', flowOut: 'loans out',
    flowRec: 'loan repayments in', flowJoin: 'new families joining'
  },

  presets: {
    base: 'Fifty years, no losses and no costs. The pure mechanics of the rules as written.',
    caut: 'Fifty years with realistic friction: 2% of loans a year stop being repaid with half recovered, running costs of 3% plus \u00a36 per member, a 5% cash reserve, and 1% of waiting families leaving each year.',
    sev:  'Fifty years under heavy strain: 5% of loans a year stop being repaid with only a quarter recovered after two years, costs of 6% plus \u00a312 per member, a 10% reserve, 3% of waiting families leaving, and enrolment shrinking 2% a year.',
    ro:   'Enrolment is closed to newcomers after year 20 and the fund runs on repayments alone, with cautious loss and cost assumptions applied throughout.'
  },

  designSummary: function (d) {
    var f = window.fmt;
    return 'Pays in <b>' + f.gbpFull(d.target) + '</b> in total. <b>' + f.gbpFull(d.savings) +
           '</b> stays theirs, <b>' + f.gbpFull(d.fee) + '</b> keeps the fund going. The loan is <b>' +
           d.multiple.toFixed(1) + ' times</b> their own savings.';
  },

  journey: function (P, d) {
    var f = window.fmt, yrsPay = (P.capMonths / 12).toFixed(0);
    return [
      ['s1', 'From enrolment', f.gbpFull(P.contrib) + '/mo',
        'A family pays a small amount every month for each child, for up to ' + yrsPay + ' years.'],
      ['s2', 'By the time they are called', f.gbpFull(d.target),
        'Paid in altogether. Half of it, ' + f.gbpFull(d.savings) + ', stays theirs. The other half is their contribution to the community.'],
      ['s3', 'When the wedding comes', f.gbpFull(P.loan),
        'Paid out in one interest-free sum, worth ' + d.multiple.toFixed(1) + ' times the family\u2019s own savings.'],
      ['s4', 'Paying it back', f.gbpFull(d.repayMonthly) + '/mo',
        'For ' + d.cashTermMonths + ' months. Their own savings then cover the last ' + Math.round(d.offsetMonths) + ' months, so nothing more is owed.'],
      ['s5', 'What the fund keeps', f.gbpFull(d.fee),
        'Left with the fund from every family that completes, which is what lets the next family be helped.']
    ];
  },

  cycle: {
    caption: function (y) {
      return 'Every amount here is a total for the whole of year ' + y +
             '. The fund balance and the number of families waiting are as they stood at the end of that year.';
    },
    waiting:  function (n) { return window.fmt.ci(n) + ' waiting'; },
    weddings: function (n) { return window.fmt.ci(n) + (n === 1 ? ' wedding' : ' weddings'); },
    narrative: function (y, loans, shareRec) {
      var n = window.fmt.ci(loans);
      if (loans === 0) return 'In year ' + y + ' the fund could not afford a single loan, so every family waited.';
      if (shareRec < 0.25) return 'In year ' + y + ' the fund is still almost entirely carried by families who are saving. ' + n + ' weddings were funded over the year.';
      if (shareRec < 0.60) return 'By year ' + y + ' repayments from families already helped are carrying a serious share of the load. ' + n + ' weddings were funded over the year.';
      return 'By year ' + y + ' the scheme largely funds itself. Most of the money going out was repaid by families helped before. ' + n + ' weddings were funded over the year.';
    }
  },

  stats: function (R, P, A) {
    var f = window.fmt, L = P.horizon - 1, d = R.d, yrs = (P.horizon / 12).toFixed(0);
    return [
      ['rec', 'Weddings funded', f.ci(R.cumLoans[L]), 'over ' + yrs + ' years'],
      ['rec', 'Funded by repayments', f.pc(R.a.selfFund[L]), 'share of the final year\u2019s money that came back from earlier loans'],
      ['new', 'Families served', f.pc(R.coverage[L]), f.ci(R.cumLoans[L]) + ' of ' + f.ci(R.joinedCum[L]) + ' who ever enrolled'],
      ['q',   'Families still waiting', f.ci(R.queue[L]), 'at the end of the period'],
      ['q',   'Wait for those called now', f.wy(A.lastWait), 'peak was ' + f.wy(A.peakWait) + ' in ' + (A.peakM ? f.yr(A.peakM) : 'n/a')],
      ['rec', 'Comes back per loan', f.gbpFull(Math.round(d.expectedBack)), f.pc(d.recycleShare) + ' of every ' + f.gbpFull(P.loan) + ' lent'],
      ['out', 'New money each loan needs', f.gbpFull(Math.round(d.netPerLoan)), 'the rest is recycled from the fund'],
      ['rec', 'Still owed to the fund', f.gbp(d.outstanding), 'repayments not yet due'],
      ['new', 'Cash in the fund', f.gbp(R.cash[L]), 'available to lend on'],
      ['out', 'Lost to unpaid loans', f.gbp(R.cumLoss[L]), 'after any recoveries'],
      ['out', 'Spent on running the fund', f.gbp(R.cumCost[L]), 'over ' + yrs + ' years'],
      ['rec', 'Net position', f.gbp(d.netPosition), 'cash plus money owed to the fund, less savings owed to waiting families']
    ];
  },

  runoff: function (R, P, A) {
    var f = window.fmt, L = P.horizon - 1;
    if (P.runOffYear > 0) {
      var lastY = (A.lastLend / 12).toFixed(1), since = (A.lastLend / 12 - P.runOffYear).toFixed(1);
      var still = A.lastLend >= P.horizon, served = R.queue[L] < 1, h2, n2, b2;
      if (served) {
        h2 = 'Everyone was served'; n2 = 'year ' + lastY;
        b2 = 'was the last wedding funded, ' + since + ' years after enrolment closed. Every family that was still waiting when the doors shut was eventually helped, entirely out of repayments.';
      } else if (still) {
        h2 = 'Still going at the end of this run'; n2 = f.pc(R.coverage[L], 0);
        b2 = 'of everyone ever enrolled had been helped by year ' + (P.horizon / 12) + ', and the fund was still paying out weddings ' + since +
             ' years after enrolment closed. ' + f.ci(R.queue[L]) + ' families were still waiting. Lengthen the period above to see how much further it reaches.';
      } else {
        h2 = 'When it ran out'; n2 = 'year ' + lastY;
        b2 = 'was the last wedding the fund could afford, ' + since + ' years after enrolment closed. ' +
             f.ci(R.queue[L]) + ' families were left unserved. Costs and unpaid loans eroded the pot faster than repayments could replenish it.';
      }
      return [
        { h: 'Enrolment closed after year ' + P.runOffYear, num: f.ci(A.afterStop),
          body: 'further weddings were funded after the last new child was enrolled, on top of the ' + f.ci(A.atStop) +
                ' already funded by then. That money came from repayments, not from anyone new.' },
        { h: h2, num: n2, body: b2 }
      ];
    }
    return [
      { h: 'Run-off is not switched on', num: f.pc(R.d.recycleShare),
        body: 'of every pound lent is expected to come back to the fund. That returning money is what makes a run-off survivable. Set a year in <em>Stop all new enrolment after year</em> above, or use the Run-off test, to see it play out.' },
      { h: 'Why the risk falls over time', num: f.pc(R.a.selfFund[P.horizon - 1]),
        body: 'of the money arriving in the final year comes from repayments rather than from new families. The higher this gets, the less the scheme depends on continued enrolment.' }
    ];
  },

  charts: {
    mix:   { title: 'Who is paying for each year\u2019s weddings',
             why: 'Every year the fund receives money from two places: families who are still saving, and families repaying loans they have already had. This shows how that balance shifts. The amber band shrinking is the whole story of the scheme.',
             s1: 'New family money (savings and completions)', s2: 'Repayments coming back',
             noteCross: function (y) { return 'Repayments overtake new money in ' + y + '.'; },
             noteNone: 'Repayments do not overtake new money within this period.' },
    self:  { title: 'The same picture in pounds a year',
             why: 'Both sources grow, but the repayment stream grows faster and eventually dwarfs the money coming from new savers. Each point is the total for the twelve months ending there.',
             s1: 'New family money a year', s2: 'Repayments coming back a year' },
    race:  { title: 'Weddings funded against children enrolled',
             why: 'While the purple line sits below the grey one the waiting list is still growing.',
             s1: 'Weddings funded a year', s2: 'Children enrolled a year',
             tip: function (v) { return window.fmt.ci(v) + ' a year'; } },
    wait:  { title: 'How long families wait',
             why: 'The average wait of the families reaching the front of the list at that point.',
             s1: 'Wait at the time of the wedding',
             tip: function (v) { return v.toFixed(1) + ' years'; } },
    queue: { title: 'Families on the waiting list', s1: 'Waiting',
             tip: function (v) { return window.fmt.ci(v) + ' families'; },
             noteClear: function (y) { return 'The list clears in ' + y + '.'; },
             noteNone: 'The list does not clear within this period.' },
    cover: { title: 'Share of families who have been helped', s1: 'Served, as a share of everyone enrolled' },
    cash:  { title: 'Cash in the fund against savings it owes',
             why: 'The amber line is what the fund would have to hand back if every waiting family left at once.',
             s1: 'Cash held', s2: 'Savings owed to waiting families' },
    loss:  { title: 'What the fund has spent and lost',
             why: 'Cumulative running costs and the value of loans that were never repaid.',
             s1: 'Running costs', s2: 'Lost to unpaid loans',
             noteZero: 'Both are zero because no costs or bad debts are switched on. Try the Cautious or Severe stress scenarios.' }
  },

  tableHeaders: ['Year', 'Enrolled', 'Weddings', 'Total funded', 'Served', 'Waiting',
                 'Wait', 'Repayment share', 'Money in', 'Loans out', 'Cash held'],
  csvHeader: 'month,children_enrolled,contributions,completion_topups,repayments,recoveries,' +
             'running_costs,exit_refunds,weddings_funded,total_funded,families_waiting,' +
             'savings_owed,avg_wait_months,cash_held,share_from_repayments,cum_costs,cum_losses',
  csvFile: 'contract_savings_loan_scheme_monthly.csv'
};
