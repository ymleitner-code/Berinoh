/* =============================================================================
   strings-a-en.js  -  English runtime strings for the Gemach Hakehiloh (Model A)
   simulator. Static page copy lives in the HTML; this holds what app-a.js injects
   and the formatting hooks that format.js and charts.js expect.
   No em dashes. No verdicts. Growth is stated in units.
   ============================================================================= */
(function (root) {
  'use strict';

  function gbp0(v){ return '£' + Math.round(v).toLocaleString('en-GB'); }
  function pc1(v){ return (v*100).toFixed(1) + '%'; }

  var S = {
    dir: 'ltr',
    /* format.js / charts.js hooks */
    unitBn:'bn', unitM:'m', unitK:'k',
    axisYears:'years',
    durationNone:'-',
    duration:function(y,m){ return y>0 ? (y+'y '+m+'m') : (m+'m'); },
    yearOf:function(y){ return 'year '+y; },
    tipYear:function(x){ return 'Year '+x; },
    markLabel:'closed to newcomers',

    horizons:['25 years','50 years','75 years','100 years'],
    custom:'Custom settings. The presets are a starting point; every figure below follows from what you set.',
    presets:{
      base:'Base case. The intended design: three years of collecting before lending begins, a modest start-up capital left after set-up costs, 35,000 pounds a year of fundraising, and no losses or withdrawals assumed.',
      caut:'Cautious. A little bad debt and withdrawal, some running cost, and modest interest and fundraising, to see the scheme under everyday wear.',
      sev:'Severe stress. Heavy bad debt, steady withdrawals and high fixed overhead at once, to find where the capital floor gives.',
      ro:'Run-off. The community closes to newcomers after year twenty, so you can see the fund serve the members it already has and wind down.'
    },

    /* one family's journey: [stageClass, when, amount, text] */
    journey:function(P){
      var potYears = Math.round(P.potCap / (P.save*12));
      return [
        ['s1','From the first month','£'+P.save+' a month','Into the family pot, up to a cap of '+gbp0(P.potCap)+', which at this rate takes about '+potYears+' years to fill. A '+ '£'+P.fee+' fee is paid alongside and never returned; most of it builds the fund’s reserves.'],
        ['s2','Around age '+P.marriageAge,'the year’s amount','When a child marries, the fund lends what it can afford that year while holding its safety levels. Early on that is a smaller loan; it climbs toward '+gbp0(P.loanMax)+' as the fund matures.'],
        ['s3','For the years after','£'+Math.round(P.repayRatePct/100*P.loanMax)+' a month','Each full loan is repaid at '+P.repayRatePct+'% of itself a month, with a family paying no more than '+gbp0(P.repayCap)+' a month across all its loans at once.'],
        ['s4','At the very end','the family’s own pot','The tail of a family’s last loan is closed by its own pot rather than repaid in cash, and the fund keeps it.'],
        ['s5','A generation on','the next weddings','Every daughter who marries starts her own saving household, so the community that a family seeds funds the weddings that come after it.']
      ];
    },

    /* headline tiles: [tone, key, value, note] */
    stats:function(R,P,A){
      var d=R.d;
      return [
        ['rec','Community growth a year', d.realisedGrowthPct.toFixed(1)+'%', 'In units, one unit being one saving household. Measured, not assumed.'],
        ['new','Lending begins', d.lendingStartMonth!=null?('year '+(d.lendingStartMonth/12)):'-', 'The fund collects first, then lends. Weddings before then are not funded.'],
        ['out','Start-up capital', root.fmt.gbp(d.startupCapital||0), 'The fees left after set-up costs, plus start-up fundraising, when lending begins.'],
        ['new','Weddings funded', root.fmt.ci(d.cumWeddings), 'Over the whole run.'],
        ['rec','Loan reaches the full '+gbp0(P.loanMax), d.fullEntitlementMonth==null?'not within the run':('year '+Math.round(d.fullEntitlementMonth/12)), 'The loan starts near '+gbp0(P.amountRampStart)+' and only ever rises.'],
        ['new','Total lent', root.fmt.gbp(d.cumLent), 'Cash paid out in wedding loans over the run.'],
        ['out','Capital ratio at the end', pc1(d.endCapitalRatio), 'The fund’s reserves against member savings. The floor is '+P.capitalMinPct+'%.'],
        ['out','Liquidity ratio at the end', isFinite(d.endLiquidityRatio)?pc1(d.endLiquidityRatio):'-', 'Cash against member savings. The reserve is '+P.liquidityMinPct+'%.'],
        ['q','Saving households at the end', root.fmt.ci(d.endMembers), 'The paying membership at the close of the run.'],
        ['out','Months a ratio sat below its floor', (d.capBreachMonths+d.liqBreachMonths), 'Capital below '+P.capitalMinPct+'% or liquidity below '+P.liquidityMinPct+'%, shown as a fact.']
      ];
    },

    charts:{
      amount:{ title:'The loan amount, year by year',
        why:'The heart of the scheme. The loan begins at a modest figure, about 10,000 pounds, and is lifted only once the fund can hold the higher figure for good, so it only ever rises. It holds steady while capital is below its floor, then climbs toward the full amount as reserves and repayments build.' },
      weddings:{ title:'Weddings each year: due and funded',
        why:'How many weddings fall due, and how many the fund funds. A gap opens where families are still inside their eighteen-year membership wait.' },
      capital:{ title:'Capital against its floor',
        why:'Reserves as a share of member savings. The fee builds this; losses eat it. The dashed line is the '+'floor.' },
      liquidity:{ title:'Liquidity against its reserve',
        why:'Cash as a share of member savings. Lending spends it, saving and repayment refill it. The dashed line is the reserve.' },
      money:{ title:'Where the fund’s money comes from',
        s1:'New saving', s2:'Repayments',
        why:'Each year, new saving from members against repayments coming back in. As the scheme matures, repayments carry more of the lending.' },
      members:{ title:'The community, in units',
        why:'Saving households over time. Every daughter’s wedding seeds a new one, so the base compounds.' },
      cash:{ title:'Cash and reserves held',
        s1:'Cash in the fund', s2:'Reserves (capital)',
        why:'What the fund holds. The gap over the floors is what it can turn into larger loans.' },
      cumulative:{ title:'Lent and lost, cumulatively',
        s1:'Total lent', s2:'Total lost to bad debt',
        why:'Everything the fund has paid out, and anything written off. With no bad debt the lower line stays flat.' }
    },

    /* run-off cards: {h, num, body} */
    runoff:function(R,P,A){
      if(!(P.runOffYear>0)) return [{h:'Set a run-off year',num:'—',body:'Use the "close to newcomers after year" control, or the Run-off preset, to close the community to new households and see the fund serve those it already has.'}];
      return [
        {h:'Funded before it closed', num: root.fmt.ci(A.atStop), body:'Weddings the fund had funded by the year new households stopped joining.'},
        {h:'Funded after it closed', num: root.fmt.ci(A.afterStop), body:'Further weddings funded from repayments and standing savings alone, after the community shut to newcomers.'},
        {h:'Still lending', num: A.stillLending?'yes':'no', body:'Whether the fund is still funding weddings at the end of the run.'},
        {h:'Capital at the end', num: pc1(R.d.endCapitalRatio), body:'The reserve ratio as the closed fund winds down.'}
      ];
    },

    tableHeaders:['Year','Households','Due','Funded','Amount','Capital %','Liquidity %','Cash','Lent (year)','Repaid (year)'],
    csvHeader:['month','households','weddings_due','weddings_funded','loan_amount','capital_ratio','liquidity_ratio','cash','member_savings','capital','contributions','repayments','lent','cum_weddings','cum_lent','cum_loss'],
    csvFile:'gemach-hakehiloh-monthly.csv'
  };

  root.STRINGS = S;
})(typeof window !== 'undefined' ? window : globalThis);
