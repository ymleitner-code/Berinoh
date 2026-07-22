/* =============================================================================
   engine-b.js  -  Model B, the queue scheme.

   Pure simulation. Touches no DOM, contains no language, knows nothing about
   charts or browsers. Takes a settings object, returns arrays of numbers.
   That is what makes it testable in node, portable to Excel or Python, and
   reviewable by an actuary who does not care about the interface.

   Defaults and exits are expected values, not random draws, so the engine is
   deterministic: identical inputs always give identical outputs.
   Loans are always whole. The fund never issues part of a loan.

   Validated: reproduces an independently built model to within 0.01%.
   Run tests/engine.test.js to confirm.
   ============================================================================= */
(function (root) {
  'use strict';

function simulate(P){
  var contrib=P.contrib, capM=P.capMonths, sShare=P.savingsSharePct/100;
  var target=contrib*capM, savings=sShare*target, fee=target-savings;
  var loan=P.loan, repay=P.repayRatePct/100*loan;
  var cashTotal=Math.max(0,loan-savings);
  var sched=[], rem=cashTotal;
  while(rem>1e-9 && repay>0 && sched.length<3000){ var pmt=Math.min(repay,rem); sched.push(pmt); rem-=pmt; }
  var K=sched.length, cumS=[0];
  for(var k=0;k<K;k++) cumS.push(cumS[k]+sched[k]);
  var hz=1-Math.pow(1-(P.defaultAnnualPct||0)/100,1/12);
  var xz=1-Math.pow(1-(P.exitAnnualPct||0)/100,1/12);
  var cInf=(P.costPctInflow||0)/100, cPer=(P.costPerMemberYear||0)/12;
  var recP=(P.recoveryPct||0)/100, lag=Math.max(0,Math.round(P.recoveryLagM||0));
  var resP=(P.reservePct||0)/100, H=P.horizon;
  var surv=[1]; for(var a=1;a<=K;a++) surv.push(surv[a-1]*(1-hz));
  var issued=new Float64Array(H+2), recArr=new Float64Array(H+lag+3), queue=[];
  var cash=0, joined=0, cumLoans=0, cumLoss=0, cumCost=0;
  var R={m:[],intake:[],contrib:[],topup:[],repay:[],recov:[],cost:[],refund:[],loans:[],
         cumLoans:[],queue:[],paidIn:[],wait:[],cash:[],coverage:[],joinedCum:[],
         newMoney:[],recycled:[],selfFund:[],outstanding:[],lending:[],cumLoss:[],cumCost:[]};
  var servedWait=new Array(H+2).fill(null);

  for(var m=1;m<=H;m++){
    var stopped=(P.runOffYear>0 && m>P.runOffYear*12);
    var inm=stopped?0:P.intakeBase*Math.pow(1+(P.intakeGrowthPct||0)/100,(m-1)/12);
    if(inm>1e-12){ queue.push({j:m,n:inm}); joined+=inm; }
    var refunds=0;
    if(xz>0){
      for(var qi=queue.length-1;qi>=0;qi--){
        var q=queue[qi], paid=contrib*Math.min(Math.max(0,m-q.j),capM), go=q.n*xz;
        refunds+=go*sShare*paid; q.n-=go;
        if(q.n<=1e-9) queue.splice(qi,1);
      }
    }
    var payers=0, paidIn=0;
    for(var i=0;i<queue.length;i++){
      var t=m-queue[i].j+1;
      if(t<=capM) payers+=queue[i].n;
      paidIn+=queue[i].n*contrib*Math.min(t,capM);
    }
    var C=contrib*payers, Rp=0, defOut=0, outstanding=0;
    for(a=1;a<=K;a++){
      var t2=m-a; if(t2<1) break;
      var iss=issued[t2]; if(!iss) continue;
      Rp+=sched[a-1]*iss*surv[a];
      if(hz>0) defOut+=iss*surv[a-1]*hz*(cashTotal-cumS[a-1]);
    }
    for(t2=Math.max(1,m-K);t2<=m;t2++){
      iss=issued[t2]; if(!iss) continue;
      var age=m-t2;
      for(a=age+1;a<=K;a++) outstanding+=sched[a-1]*iss*surv[a];
    }
    if(recP>0&&defOut>0) recArr[m+lag]+=recP*defOut;
    cumLoss+=defOut*(1-recP);
    var Rc=recArr[m];
    var live=0; for(t2=Math.max(1,m-K+1);t2<=m;t2++) live+=issued[t2]*surv[Math.min(K,m-t2)];
    var members=0; for(i=0;i<queue.length;i++) members+=queue[i].n;
    var cost=cInf*(C+Rp+Rc)+cPer*(members+live);
    cumCost+=cost;
    var avail=cash+C+Rp+Rc-cost-refunds, floorCash=resP*paidIn;
    var E=0, TU=0, sumWait=0, guard=0;
    while(queue.length && guard++<400000){
      var need=1, tu=0, ws=0;
      for(i=0;i<queue.length && need>1e-12;i++){
        var qq=queue[i], take=Math.min(need,qq.n), ten=m-qq.j+1;
        tu+=take*Math.max(0,target-contrib*Math.min(ten,capM));
        ws+=take*(m-qq.j); need-=take;
      }
      if(need>1e-12) break;
      if(avail+tu-loan>=floorCash-1e-6){
        avail+=tu-loan; TU+=tu; E++; sumWait+=ws; need=1;
        while(need>1e-12 && queue.length){
          qq=queue[0]; take=Math.min(need,qq.n); qq.n-=take; need-=take;
          if(qq.n<=1e-9){ if(servedWait[qq.j]===null) servedWait[qq.j]=m-qq.j; queue.shift(); }
        }
      } else break;
    }
    issued[m]=E; cumLoans+=E; cash=avail;
    var newM=C+TU, recy=Rp+Rc, qn=0;
    for(i=0;i<queue.length;i++) qn+=queue[i].n;
    R.m.push(m); R.intake.push(inm); R.contrib.push(C); R.topup.push(TU); R.repay.push(Rp);
    R.recov.push(Rc); R.cost.push(cost); R.refund.push(refunds); R.loans.push(E);
    R.cumLoans.push(cumLoans); R.queue.push(qn); R.paidIn.push(paidIn);
    R.wait.push(E>0?sumWait/E:null); R.cash.push(cash);
    R.coverage.push(joined>0?cumLoans/joined:0); R.joinedCum.push(joined);
    R.newMoney.push(newM); R.recycled.push(recy);
    R.selfFund.push((newM+recy)>0?recy/(newM+recy):0);
    R.outstanding.push(outstanding); R.lending.push(E*loan);
    R.cumLoss.push(cumLoss); R.cumCost.push(cumCost);
  }
  var pend=0; for(m=H+1;m<recArr.length;m++) pend+=recArr[m];
  var ECR=0,ERec=0;
  for(k=1;k<=K;k++){ ECR+=sched[k-1]*surv[k]; ERec+=surv[k-1]*hz*(cashTotal-cumS[k-1]); }
  ERec*=recP;
  var L=H-1;
  R.d={target:target,savings:savings,fee:fee,repayMonthly:repay,cashTotal:cashTotal,
    cashTermMonths:K,offsetMonths:repay>0?savings/repay:0,fullTermMonths:repay>0?loan/repay:0,
    multiple:savings>0?loan/savings:0,expectedBack:ECR+ERec,
    recycleShare:loan>0?(ECR+ERec)/loan:0,netPerLoan:loan-ECR-ERec,
    outstanding:R.outstanding[L],pendingRec:pend,
    refundLiability:sShare*R.paidIn[L],
    netPosition:R.cash[L]+R.outstanding[L]+pend-sShare*R.paidIn[L]};
  R.servedWait=servedWait;
  return R;
}

  /* Trailing 12-month totals: converts a monthly series to an annual one while
     keeping monthly resolution on the x-axis. */
  function roll12(a) {
    var o = new Array(a.length), s = 0;
    for (var i = 0; i < a.length; i++) {
      s += a[i] || 0;
      if (i >= 12) s -= a[i - 12] || 0;
      o[i] = s;
    }
    return o;
  }

  /* Totals for one calendar year. Flows summed over the twelve months, stocks
     taken as they stood at year end. */
  function yearAgg(R, y) {
    var a = (y - 1) * 12, b = Math.min(y * 12, R.m.length);
    var o = { newMoney: 0, recycled: 0, lending: 0, loans: 0, cost: 0 };
    for (var i = a; i < b; i++) {
      o.newMoney += R.newMoney[i]; o.recycled += R.recycled[i];
      o.lending  += R.lending[i];  o.loans    += R.loans[i];
      o.cost     += R.cost[i];
    }
    o.loss  = R.cumLoss[b - 1] - (a > 0 ? R.cumLoss[a - 1] : 0);
    o.cash  = R.cash[b - 1];
    o.queue = R.queue[b - 1];
    return o;
  }

  /* Adds the derived annual series the interface needs on top of a raw run. */
  function withAnnual(R) {
    R.a = {
      newMoney: roll12(R.newMoney), recycled: roll12(R.recycled),
      lending:  roll12(R.lending),  loans:    roll12(R.loans),
      intake:   roll12(R.intake)
    };
    R.a.selfFund = R.a.newMoney.map(function (v, i) {
      var t = v + R.a.recycled[i];
      return t > 0 ? R.a.recycled[i] / t : 0;
    });
    return R;
  }

  root.simulate = simulate; root.roll12 = roll12;
  root.yearAgg = yearAgg;   root.withAnnual = withAnnual;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { simulate: simulate, roll12: roll12, yearAgg: yearAgg, withAnnual: withAnnual };
  }
})(typeof window !== 'undefined' ? window : globalThis);
