/* =============================================================================
   engine-a.js  -  Model A, the Gemach Hakehiloh scheme.

   Pure simulation. Touches no DOM, contains no language, knows nothing about
   charts or browsers. Takes a settings object and the seed of households, and
   returns arrays of numbers plus a derived summary.

   Model A is NOT Model B. Where engine-b is a smooth cohort flow in fractional
   people with a fixed loan, engine-a runs the real household structure from the
   seed, one family at a time, and SOLVES FOR THE LOAN AMOUNT. The loan is not a
   fixed 40,000; 40,000 is the ceiling the amount climbs toward. Each year, in
   advance, the fund sets one loan amount for every wedding due that year, from
   the funds it can free up for lending, held under a capital minimum and a
   liquidity minimum.

   Growth is demographic, not a fixed rate:
     - Reproduction. Every FEMALE wedding creates a new member-household that
       joins reproLagMonths later (a daughter marrying and forming her own home).
       That household then has its own children, whose weddings seed further
       households. This is the engine of long-run growth; its rate emerges from
       family size and the female share rather than being assumed.
     - Pilot-era joiners. Established families who were in the community but not
       on the founding roster join over an early window, bringing children of
       mixed ages and held to the 18-year membership gate.

   Marriage age can vary. Each wedding is drawn around the mean marriage age with
   a spread, so weddings are not perfectly synchronised.

   Determinism. Every random draw comes from a fixed seeded generator keyed by a
   stable index, so identical inputs always give identical outputs.

   Balance-sheet identity, held every month and asserted in tests:
       cash + loans outstanding  ==  member savings + capital

   Reference date, month 0: 1 August 2023.
   ============================================================================= */
(function (root) {
  'use strict';

  /* ---- deterministic generator -------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rNormal(rng, mu, sd) {
    var u = Math.max(1e-12, rng()), v = rng();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function rLognormal(rng, mu, sigma) { return Math.exp(rNormal(rng, mu, sigma)); }
  function rGamma(rng, k, theta) {
    if (k < 1) { var g = rGamma(rng, k + 1, theta); return g * Math.pow(Math.max(1e-12, rng()), 1 / k); }
    var d = k - 1 / 3, c = 1 / Math.sqrt(9 * d), x, vv, u;
    for (;;) {
      do { x = rNormal(rng, 0, 1); vv = 1 + c * x; } while (vv <= 0);
      vv = vv * vv * vv; u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * vv * theta;
      if (Math.log(u) < 0.5 * x * x + d * (1 - vv + Math.log(vv))) return d * vv * theta;
    }
  }

  /* Calibration for the forward birth engine, mirroring generate_seed.py. */
  var BIRTH = {
    firstBirthShift: 15.0, firstBirthLogMu: 1.70, firstBirthLogSigma: 0.58,
    firstBirthMin: 16.0, firstBirthMax: 47.0,
    cessMu: 38.0, cessSd: 4.5,
    gapMean: 2.55, gapShape: 4.9, gapFloor: 0.60,
    femaleProb: 0.4895
  };

  /* A wedding is { m: month it falls, female: does it seed a new household }. */
  function marriageMonth(rng, P, birthMonth) {
    var age = P.marriageAge + (P.marriageAgeSd > 0 ? rNormal(rng, 0, P.marriageAgeSd) : 0);
    age = Math.max(P.marriageAge - 2, Math.min(P.marriageAge + 6, age));
    return birthMonth + Math.round(age * 12);
  }

  function newFamily(id, kind, enrolMonth, eligibleMonth, memberAge0) {
    return { id: id, kind: kind, enrolMonth: enrolMonth, eligibleMonth: eligibleMonth,
             memberAge0: memberAge0, weddings: [], wi: 0,
             cumSaved: 0, pot: 0, loans: [], active: true, done: false, withdrawn: false };
  }

  /* Carry a member's childbearing forward from a member age to cessation,
     appending weddings with a drawn sex and a varied marriage age. */
  function growWeddings(fam, rng, P, fromAge, memberAge0, baseMonth, cessAge) {
    var a = fromAge;
    while (a <= cessAge) {
      var birthMonth = baseMonth + Math.round((a - memberAge0) * 12);
      var wm = marriageMonth(rng, P, birthMonth);
      if (wm >= 0) fam.weddings.push({ m: wm, female: rng() < BIRTH.femaleProb });
      a += Math.max(BIRTH.gapFloor, rGamma(rng, BIRTH.gapShape, BIRTH.gapMean / BIRTH.gapShape));
    }
  }

  /* Founding family from a seed household: observed children give firm weddings
     with their recorded sex; childbearing is then carried forward to cessation. */
  function familyFromSeed(h, idx, P) {
    var rng = mulberry32((P.randomSeed + idx * 2654435761) >>> 0);
    var fam = newFamily(h.household_id, 'seed', 0, 0, h.member.age_years);
    var youngest = Infinity;
    for (var c = 0; c < h.children.length; c++) {
      var age = h.children[c].age_years, birthMonth = -Math.round(age * 12);
      fam.weddings.push({ m: marriageMonth(rng, P, birthMonth), female: h.children[c].sex === 'F' });
      if (age < youngest) youngest = age;
    }
    var cess = rNormal(rng, BIRTH.cessMu, BIRTH.cessSd);
    var memberAtYoungest = h.member.age_years - (isFinite(youngest) ? youngest : 0);
    var nextAge = memberAtYoungest + Math.max(BIRTH.gapFloor,
      rGamma(rng, BIRTH.gapShape, BIRTH.gapMean / BIRTH.gapShape));
    growWeddings(fam, rng, P, nextAge, h.member.age_years, 0, cess);
    fam.weddings.sort(function (x, y) { return x.m - y.m; });
    return fam;
  }

  /* A newlywed household formed by reproduction: member at marriage age, no
     children yet, held to the membership gate (its weddings fall well beyond it). */
  function reproductionFamily(id, enrolMonth, seedInt, P) {
    var rng = mulberry32(seedInt >>> 0);
    var fam = newFamily(id, 'repro', enrolMonth,
      enrolMonth + Math.round(P.memberYears * 12), P.marriageAge);
    var firstBirthAge = Math.min(BIRTH.firstBirthMax, Math.max(P.marriageAge + 0.5,
      BIRTH.firstBirthShift + rLognormal(rng, BIRTH.firstBirthLogMu, BIRTH.firstBirthLogSigma)));
    var cess = Math.max(firstBirthAge, rNormal(rng, BIRTH.cessMu, BIRTH.cessSd));
    growWeddings(fam, rng, P, firstBirthAge, P.marriageAge, enrolMonth, cess);
    fam.weddings.sort(function (x, y) { return x.m - y.m; });
    return fam;
  }

  /* An established family joining mid-pilot, its child ages taken from a seed
     household (a real family shape), held to the 18-year gate so only its very
     youngest children can ever borrow. */
  function establishedJoiner(id, enrolMonth, template, idx, P) {
    var rng = mulberry32((P.randomSeed * 97 + idx * 1234567) >>> 0);
    var fam = newFamily(id, 'joiner', enrolMonth,
      enrolMonth + Math.round(P.memberYears * 12), template.member.age_years);
    var youngest = Infinity;
    for (var c = 0; c < template.children.length; c++) {
      var age = template.children[c].age_years;
      var birthMonth = enrolMonth - Math.round(age * 12);
      fam.weddings.push({ m: marriageMonth(rng, P, birthMonth), female: template.children[c].sex === 'F' });
      if (age < youngest) youngest = age;
    }
    var cess = rNormal(rng, BIRTH.cessMu, BIRTH.cessSd);
    var memberAtYoungest = template.member.age_years - (isFinite(youngest) ? youngest : 0);
    var nextAge = memberAtYoungest + Math.max(BIRTH.gapFloor,
      rGamma(rng, BIRTH.gapShape, BIRTH.gapMean / BIRTH.gapShape));
    growWeddings(fam, rng, P, nextAge, template.member.age_years, enrolMonth, cess);
    fam.weddings = fam.weddings.filter(function (w) { return w.m >= enrolMonth; });
    fam.weddings.sort(function (x, y) { return x.m - y.m; });
    return fam;
  }

  /* ---- defaults ----------------------------------------------------------- */
  var DEFAULTS = {
    save: 135, fee: 15, feeCapitalParts: 8, feeOverheadParts: 3,
    potCap: 40000, loanMax: 40000, repayRatePct: 1, repayCap: 1200, repayFixed: 0,
    marriageAge: 20, marriageAgeSd: 1.25, memberYears: 18,
    capitalMinPct: 8, liquidityMinPct: 10,
    cashInterestPct: 0,        /* annual interest earned on cash in the bank, 0 to 10 */
    fixedOverheadPerYear: 0,   /* a fixed running cost beyond the fee's overhead share */
    fundraisingPerYear: 0,     /* external money raised into the fund each year */
    badDebtPct: 0,             /* annual bad-debt rate on loans still being repaid */
    withdrawalAnnualPct: 0,    /* share of loan-free members who withdraw a year, pot returned */
    /* growth */
    reproFraction: 1.0,        /* share of female weddings that seed a household */
    reproLagMonths: 24,        /* a daughter joins this long after her wedding */
    enrollAnnualPct: 2.0,      /* established families joining a year, % of seed size */
    enrollYears: 10,           /* over this opening window (pilot in-migration) */
    /* stress (expected value) */
    defaultAnnualPct: 0, recoveryPct: 0, recoveryLagM: 12, runOffYear: 0,
    /* amount solver */
    surplusSpreadYears: 6, amountSchedule: null, minLoan: 0,
    lendingStartYears: 3,      /* earliest lending begins, years after the pilot start */
    setupCostTotal: 130000,    /* set-up costs over the collection phase; the balance of the fees becomes start-up capital */
    startupFundraising: 0,     /* one-off founding fundraising added to capital at the outset */
    amountRampStart: 10000,    /* the first loan when lending begins */
    rampStep: 2500,            /* how much the loan is lifted each year it can hold a higher level */
    horizon: 600, randomSeed: 20230814
  };
  function withDefaults(P) {
    var o = {}; for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in (P || {})) if (P[k] !== undefined) o[k] = P[k];
    return o;
  }

  /* ---- the simulation ----------------------------------------------------- */
  function simulate(seed, Pin) {
    var P = withDefaults(Pin);
    var H = Math.max(12, Math.round(P.horizon));
    var capShare = P.fee * P.feeCapitalParts / (P.feeCapitalParts + P.feeOverheadParts);
    var ovhShare = P.fee - capShare;
    var lendingStartMonth = Math.max(0, Math.round((P.lendingStartYears || 0) * 12));
    var setupPerMonth = lendingStartMonth > 0 ? (P.setupCostTotal || 0) / lendingStartMonth : 0;
    var startupCapital = null;
    var repRate = P.repayRatePct / 100;
    var badRate = (P.badDebtPct > 0 ? P.badDebtPct : (P.defaultAnnualPct || 0));
    var hz = 1 - Math.pow(1 - badRate / 100, 1 / 12);
    var wz = 1 - Math.pow(1 - (P.withdrawalAnnualPct || 0) / 100, 1 / 12);
    var recP = (P.recoveryPct || 0) / 100, lag = Math.max(0, Math.round(P.recoveryLagM || 0));

    var fams = [];
    for (var i = 0; i < seed.households.length; i++) fams.push(familyFromSeed(seed.households[i], i, P));
    var seedSize = fams.length, nextId = 1, reproSeq = 1000003;

    var cash = 0, capital = 0, memberSavings = 0, loansOut = 0, cumLoss = 0, cumCost = 0, cumInterest = 0, cumFundraise = 0;
    var wRng = mulberry32((P.randomSeed ^ 0x9e3779b9) >>> 0);
    var recArr = new Float64Array(H + lag + 3);

    /* one-off start-up fundraising, founding capital raised at the outset */
    if (P.startupFundraising > 0) { cash += P.startupFundraising; capital += P.startupFundraising; cumFundraise += P.startupFundraising; }

    var R = { m: [], members: [], savers: [], joinersRepro: [], joinersEst: [],
              weddingsDue: [], weddingsFunded: [], cumWeddings: [], amount: [],
              cash: [], capital: [], memberSavings: [], loansOut: [],
              capitalRatio: [], liquidityRatio: [], capitalHead: [], liquidityHead: [],
              contribIn: [], feeIn: [], repayIn: [], interestIn: [], lentOut: [], potDischarged: [],
              cumLent: [], cumLoss: [], identityErr: [], breachCap: [], breachLiq: [] };

    var cumWeddings = 0, cumLent = 0, yearAmount = 0;

    function setYearAmount(m) {
      if (m < lendingStartMonth) { yearAmount = 0; return; }   /* no lending during collection */
      if (P.amountSchedule) {
        var yr = Math.floor(m / 12) + 1, amt = 0;
        for (var s = 0; s < P.amountSchedule.length; s++)
          if (yr >= P.amountSchedule[s].fromYear) amt = P.amountSchedule[s].amount;
        yearAmount = Math.min(P.loanMax, Math.max(0, amt)); return;
      }
      /* count fundable weddings due over the coming year */
      var due = 0, members = 0, savers = 0;
      for (var f = 0; f < fams.length; f++) {
        var fa = fams[f]; if (!fa.active || fa.withdrawn || fa.enrolMonth > m) continue;
        members++; if (fa.cumSaved < P.potCap - 1e-6) savers++;
        for (var wi = fa.wi; wi < fa.weddings.length; wi++) {
          var w = fa.weddings[wi].m;
          if (w < m) continue;
          if (w >= m + 12) break;
          if (w >= fa.eligibleMonth) due++;
        }
      }
      /* the loan only ever rises. It begins at the ramp-start figure, and is lifted
         one step a year, but only while the fund can hold the higher level: the
         year's affordable amount must reach it and both ratios must be sound. It is
         never cut, so a family is never offered less than the family before it. */
      if (yearAmount < P.amountRampStart) { yearAmount = P.amountRampStart; return; }
      if (due === 0) return;                        /* hold the level; nothing to lend this year */
      var monthlyInflow = savers * P.save + members * capShare;
      var surplus = Math.max(0, cash - (P.liquidityMinPct / 100) * memberSavings);
      var affordable = (12 * monthlyInflow + surplus / Math.max(1, P.surplusSpreadYears)) / due;
      var capOK = memberSavings <= 1e-6 || capital / memberSavings >= P.capitalMinPct / 100;
      var liqOK = memberSavings <= 1e-6 || cash / memberSavings >= P.liquidityMinPct / 100;
      var next = yearAmount + P.rampStep;
      if (next <= P.loanMax && affordable >= next && capOK && liqOK) yearAmount = next;
      yearAmount = Math.min(P.loanMax, yearAmount);
    }

    for (var m = 0; m < H; m++) {
      var stopped = (P.runOffYear > 0 && m >= P.runOffYear * 12);
      var pending = [];  /* reproduction joiners created this month, appended after the loop */

      /* interest on cash held in the bank, monthly on the balance carried in, so
         cash that sits longer earns more. Income to the fund, so it lifts capital. */
      var interestIn = 0;
      if (P.cashInterestPct > 0 && cash > 1e-9) {
        interestIn = cash * (P.cashInterestPct / 100) / 12;
        cash += interestIn; capital += interestIn; cumInterest += interestIn;
      }
      /* set-up costs run during the collection phase and consume the pooled fees;
         from lending start, ongoing fundraising and fixed overhead take over. */
      if (m < lendingStartMonth) {
        if (setupPerMonth > 0) { cash -= setupPerMonth; capital -= setupPerMonth; cumCost += setupPerMonth; }
      } else {
        if (P.fundraisingPerYear > 0) { var fr = P.fundraisingPerYear / 12; cash += fr; capital += fr; cumFundraise += fr; }
        if (P.fixedOverheadPerYear > 0) { var fo = P.fixedOverheadPerYear / 12; cash -= fo; capital -= fo; cumCost += fo; }
      }
      if (m === lendingStartMonth) startupCapital = capital;   /* the balance of fees, less set-up costs */

      /* established pilot-era joiners at each year start over the opening window */
      var estThisMonth = 0;
      if (m % 12 === 0 && !stopped && P.enrollAnnualPct > 0 && m < P.enrollYears * 12) {
        var nEst = Math.round((P.enrollAnnualPct / 100) * seedSize);
        for (var e = 0; e < nEst; e++) {
          var tmpl = seed.households[(nextId * 2654435761 >>> 0) % seedSize];
          fams.push(establishedJoiner('E' + nextId, m, tmpl, nextId, P)); nextId++; estThisMonth++;
        }
      }

      if (m % 12 === 0) setYearAmount(m);

      var contribIn = 0, feeIn = 0, repayIn = 0, lentOut = 0, potDisch = 0;
      var weddingsDue = 0, weddingsFunded = 0, savers = 0, members = 0, reproThisMonth = 0;
      var reqLiquidityNow = (P.liquidityMinPct / 100) * memberSavings;

      for (var fi = 0; fi < fams.length; fi++) {
        var fam = fams[fi];
        if (!fam.active || fam.enrolMonth > m) continue;

        /* withdrawal: a loan-free member stops saving and takes back its returnable
           pot. Only the saver leaves; the family's children still marry, so its
           daughters still seed new households and downstream growth is kept. The
           non-returnable fee capital it has paid stays with the fund. */
        if (wz > 0 && !fam.withdrawn && fam.loans.length === 0 && wRng() < wz) {
          if (fam.pot > 1e-9) { cash -= fam.pot; memberSavings -= fam.pot; }
          fam.pot = 0; fam.withdrawn = true;
        }

        /* 1. contributions, while still a saving member */
        if (!fam.withdrawn) {
          members++;
          if (fam.cumSaved < P.potCap - 1e-6) {
            var pay = Math.min(P.save, P.potCap - fam.cumSaved);
            cash += pay; fam.pot += pay; fam.cumSaved += pay; memberSavings += pay;
            contribIn += pay; savers++;
          }
          if (m < lendingStartMonth) { cash += P.fee; capital += P.fee; feeIn += P.fee; }
          else { cash += capShare; capital += capShare; feeIn += P.fee; cumCost += ovhShare; }
        }

        /* 2. weddings due this month, at their real month. Every wedding occurs
              whether or not it is funded, and each female wedding seeds a
              household reproLagMonths on; a wedding is funded only if the family
              is past its membership gate at the time, so a gated family's older
              children marry unfunded and never get a loan for it later. */
        while (fam.wi < fam.weddings.length && fam.weddings[fam.wi].m === m) {
          var wd = fam.weddings[fam.wi]; if (!fam.withdrawn) weddingsDue++;
          if (wd.female && P.reproFraction > 0 && !stopped) {
            /* seeds a household, unless run-off has closed the community to newcomers */
            reproSeq = (reproSeq + 2246822519) >>> 0;
            if ((reproSeq / 4294967296) < P.reproFraction && m + P.reproLagMonths < H) {
              pending.push(reproductionFamily('R' + nextId, m + P.reproLagMonths,
                (reproSeq ^ (nextId * 40503)) >>> 0, P)); nextId++; reproThisMonth++;
            }
          }
          if (!fam.withdrawn && m >= lendingStartMonth && yearAmount > 0 && m >= fam.eligibleMonth) {
            var amt = Math.min(yearAmount, Math.max(0, cash));
            if (amt > 1e-6) {
              cash -= amt; loansOut += amt; fam.loans.push({ orig: amt, rem: amt });
              lentOut += amt; weddingsFunded++; cumWeddings++; cumLent += amt;
            }
          }
          fam.wi++;
        }

        /* 3. repayments: 1% of each loan's own original, capped across the family */
        if (fam.loans.length) {
          var budget = P.repayCap;
          for (var li = 0; li < fam.loans.length && budget > 1e-9; li++) {
            var ln = fam.loans[li]; if (ln.rem <= 1e-9) continue;
            if (hz > 0) { var loss = ln.rem * hz; ln.rem -= loss; loansOut -= loss;
                          capital -= loss;                 /* equity absorbs the write-off */
                          cumLoss += loss; if (recP > 0) recArr[m + lag] += recP * loss; }
            var perLoan = (P.repayFixed > 0) ? P.repayFixed : repRate * ln.orig;
            var inst = Math.min(perLoan, ln.rem, budget);
            if (inst > 1e-9) { cash += inst; ln.rem -= inst; loansOut -= inst; repayIn += inst; budget -= inst; }
          }
          /* 4. the tail of a family's borrowing is discharged by its pot, once it
                has no further weddings and its remaining debt fits the pot */
          var future = fam.wi < fam.weddings.length;
          var rem = 0; for (li = 0; li < fam.loans.length; li++) rem += Math.max(0, fam.loans[li].rem);
          if (!future && rem > 1e-9 && rem <= fam.pot + 1e-6) {
            for (li = 0; li < fam.loans.length; li++) fam.loans[li].rem = 0;
            fam.pot -= rem; memberSavings -= rem; loansOut -= rem; potDisch += rem;
          }
          fam.loans = fam.loans.filter(function (x) { return x.rem > 1e-9; });
        }

        /* 5. completion: no future weddings, no loans left. Pot returned, family exits. */
        if (fam.wi >= fam.weddings.length && fam.loans.length === 0) {
          if (fam.pot > 1e-9) { cash -= fam.pot; memberSavings -= fam.pot; }
          fam.pot = 0; fam.active = false; fam.done = true;
        }
      }

      for (var p = 0; p < pending.length; p++) fams.push(pending[p]);
      if (recArr[m] > 0) { cash += recArr[m]; capital += recArr[m]; }
      if (Math.abs(memberSavings) < 1e-6) memberSavings = 0;

      var capRatio = memberSavings > 1e-6 ? capital / memberSavings : (capital > 0 ? Infinity : 0);
      var liqRatio = memberSavings > 1e-6 ? cash / memberSavings : (cash > 0 ? Infinity : 0);
      var capMin = P.capitalMinPct / 100, liqMin = P.liquidityMinPct / 100;

      R.m.push(m); R.members.push(members); R.savers.push(savers);
      R.joinersRepro.push(reproThisMonth); R.joinersEst.push(estThisMonth);
      R.weddingsDue.push(weddingsDue); R.weddingsFunded.push(weddingsFunded);
      R.cumWeddings.push(cumWeddings); R.amount.push(yearAmount);
      R.cash.push(cash); R.capital.push(capital); R.memberSavings.push(memberSavings);
      R.loansOut.push(loansOut); R.capitalRatio.push(capRatio); R.liquidityRatio.push(liqRatio);
      R.capitalHead.push(capRatio - capMin); R.liquidityHead.push(liqRatio - liqMin);
      R.contribIn.push(contribIn); R.feeIn.push(feeIn); R.repayIn.push(repayIn);
      R.interestIn.push(interestIn);
      R.lentOut.push(lentOut); R.potDischarged.push(potDisch); R.cumLent.push(cumLent); R.cumLoss.push(cumLoss);
      R.identityErr.push((cash + loansOut) - (memberSavings + capital));
      R.breachCap.push(isFinite(capRatio) && capRatio < capMin - 1e-9 ? 1 : 0);
      R.breachLiq.push(isFinite(liqRatio) && liqRatio < liqMin - 1e-9 ? 1 : 0);
    }

    var L = H - 1, firstWed = null, fullYear = null;
    for (m = 0; m < H; m++) {
      if (firstWed === null && R.weddingsFunded[m] > 0) firstWed = m;
      if (fullYear === null && R.amount[m] >= P.loanMax - 1e-6 && R.weddingsFunded[m] > 0) fullYear = m;
    }
    var y1 = R.members[Math.min(11, L)], yN = R.members[L], yrs = H / 12;
    R.d = {
      capShare: capShare, ovhShare: ovhShare,
      firstWeddingMonth: firstWed, fullEntitlementMonth: fullYear,
      cumWeddings: cumWeddings, cumLent: cumLent,
      endCash: cash, endCapital: capital, endMemberSavings: memberSavings, endLoansOut: loansOut,
      endCapitalRatio: R.capitalRatio[L], endLiquidityRatio: R.liquidityRatio[L],
      endMembers: R.members[L], endFamiliesEver: fams.length, endCumLoss: cumLoss,
      endCumInterest: cumInterest, endCumFundraise: cumFundraise, endCumCost: cumCost,
      startupCapital: startupCapital, lendingStartMonth: lendingStartMonth,
      realisedGrowthPct: (y1 > 0 && yrs > 1) ? (Math.pow(yN / y1, 1 / (yrs - 1)) - 1) * 100 : 0,
      maxIdentityErr: R.identityErr.reduce(function (a, b) { return Math.max(a, Math.abs(b)); }, 0),
      capBreachMonths: R.breachCap.reduce(function (a, b) { return a + b; }, 0),
      liqBreachMonths: R.breachLiq.reduce(function (a, b) { return a + b; }, 0)
    };
    return R;
  }

  function yearAgg(R, y) {
    var a = (y - 1) * 12, b = Math.min(y * 12, R.m.length), o =
      { weddings: 0, lent: 0, repay: 0, contrib: 0, joiners: 0 };
    for (var i = a; i < b; i++) {
      o.weddings += R.weddingsFunded[i]; o.lent += R.lentOut[i];
      o.repay += R.repayIn[i]; o.contrib += R.contribIn[i];
      o.joiners += R.joinersRepro[i] + R.joinersEst[i];
    }
    var j = b - 1;
    o.amount = R.amount[j]; o.cash = R.cash[j]; o.capitalRatio = R.capitalRatio[j];
    o.liquidityRatio = R.liquidityRatio[j]; o.memberSavings = R.memberSavings[j];
    o.members = R.members[j]; o.cumWeddings = R.cumWeddings[j]; o.weddingsDue = 0;
    for (i = a; i < b; i++) o.weddingsDue += R.weddingsDue[i];
    return o;
  }

  root.engineA = { simulate: simulate, yearAgg: yearAgg, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { simulate: simulate, yearAgg: yearAgg, DEFAULTS: DEFAULTS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
