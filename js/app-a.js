/* =============================================================================
   app-a.js  -  state, presets, wiring and rendering for the Model A simulator.
   Holds no simulation maths and no language. Numbers come from engine-a.js,
   words from strings-a-en.js, drawing from charts.js and format.js.
   ============================================================================= */
(function () {
  'use strict';

  var DESIGN = {
    save:135, fee:15, potCap:40000, loanMax:40000, amountRampStart:10000, rampStep:2500,
    repayRatePct:1, repayCap:1200, lendingStartYears:3, setupCostTotal:130000, startupFundraising:50000,
    capitalMinPct:8, liquidityMinPct:10, cashInterestPct:0,
    fundraisingPerYear:35000, fixedOverheadPerYear:0, marriageAge:20, enrollAnnualPct:2,
    withdrawalAnnualPct:0, badDebtPct:0, runOffYear:0
  };
  function mix(over){ var o={}; for(var k in DESIGN) o[k]=DESIGN[k]; for(k in (over||{})) o[k]=over[k]; return o; }
  var PRESETS = {
    base:{ horizon:600, v:mix() },
    caut:{ horizon:600, v:mix({ cashInterestPct:2, badDebtPct:1, withdrawalAnnualPct:1, fixedOverheadPerYear:60000 }) },
    sev: { horizon:600, v:mix({ badDebtPct:4, withdrawalAnnualPct:3, fixedOverheadPerYear:150000, fundraisingPerYear:0 }) },
    ro:  { horizon:900, v:mix({ runOffYear:20 }) }
  };
  var IDS = ['save','fee','potCap','loanMax','amountRampStart','rampStep','repayRatePct','repayCap',
             'lendingStartYears','setupCostTotal','startupFundraising','capitalMinPct','liquidityMinPct','cashInterestPct','fundraisingPerYear','fixedOverheadPerYear',
             'marriageAge','enrollAnnualPct','withdrawalAnnualPct','badDebtPct','runOffYear'];
  var HORIZONS = [300,600,900,1200];
  var PRESET_BTN = { base:'p-base', caut:'p-caut', sev:'p-sev', ro:'p-ro' };

  var state = { horizon:600, preset:'base' };
  var R=null, P=null, S=null, f=null, timer=null;

  function $(id){ return document.getElementById(id); }
  function num(id){ var v=parseFloat($(id).value); return isFinite(v)?v:0; }

  function readP(){
    return {
      save:Math.max(0,num('save')), fee:Math.max(0,num('fee')),
      potCap:Math.max(0,num('potCap')), loanMax:Math.max(1000,num('loanMax')),
      amountRampStart:Math.max(0,num('amountRampStart')), rampStep:Math.max(500,num('rampStep')),
      repayRatePct:Math.max(0.1,num('repayRatePct')), repayCap:Math.max(50,num('repayCap')),
      lendingStartYears:Math.max(0,num('lendingStartYears')),
      setupCostTotal:Math.max(0,num('setupCostTotal')),
      startupFundraising:Math.max(0,num('startupFundraising')),
      surplusSpreadYears:6,
      capitalMinPct:Math.max(0,num('capitalMinPct')), liquidityMinPct:Math.max(0,num('liquidityMinPct')),
      cashInterestPct:Math.min(10,Math.max(0,num('cashInterestPct'))),
      fixedOverheadPerYear:Math.max(0,num('fixedOverheadPerYear')),
      fundraisingPerYear:Math.max(0,num('fundraisingPerYear')),
      marriageAge:Math.min(26,Math.max(18,num('marriageAge'))),
      enrollAnnualPct:Math.max(0,num('enrollAnnualPct')),
      withdrawalAnnualPct:Math.min(20,Math.max(0,num('withdrawalAnnualPct'))),
      badDebtPct:Math.min(15,Math.max(0,num('badDebtPct'))),
      runOffYear:Math.max(0,Math.round(num('runOffYear'))),
      recoveryPct: num('badDebtPct')>0 ? 25 : 0, recoveryLagM:24,
      marriageAgeSd:1.25, enrollYears:10, reproFraction:1.0,
      horizon: state.horizon
    };
  }

  function applyPreset(key){
    var pr=PRESETS[key];
    for(var k in pr.v){ if($(k)) $(k).value=pr.v[k]; }
    state.horizon=pr.horizon; state.preset=key;
    $('presetNote').textContent=S.presets[key];
    syncChrome(); run();
  }
  function markCustom(){ if(state.preset!=='custom'){ state.preset='custom'; $('presetNote').textContent=S.custom; syncChrome(); } }
  function syncChrome(){
    for(var k in PRESET_BTN) $(PRESET_BTN[k]).classList.toggle('on', state.preset===k);
    var hb=$('hbs');
    hb.innerHTML=HORIZONS.map(function(h,i){ return '<button type="button" class="hb'+(h===state.horizon?' on':'')+'" data-h="'+h+'">'+S.horizons[i]+'</button>'; }).join('');
    hb.querySelectorAll('.hb').forEach(function(b){ b.addEventListener('click',function(){ state.horizon=parseInt(b.dataset.h,10); markCustom(); syncChrome(); run(); }); });
  }

  function roll12(a){ var o=new Array(a.length), s=0; for(var i=0;i<a.length;i++){ s+=a[i]||0; if(i>=12) s-=a[i-12]||0; o[i]=s; } return o; }

  function analyse(){
    var A={}, n=R.m.length;
    if(P.runOffYear>0){
      var st=Math.min(n, P.runOffYear*12)-1;
      A.atStop = st>=0 ? R.cumWeddings[st] : 0;
      A.afterStop = R.cumWeddings[n-1]-A.atStop;
      var recent=0; for(var i=Math.max(0,n-12);i<n;i++) recent+=R.weddingsFunded[i];
      A.stillLending = recent>0;
    }
    return A;
  }

  function paintJourney(){
    $('journey').innerHTML = S.journey(P).map(function(s){
      return '<div class="stage '+s[0]+'"><div class="stage-when">'+s[1]+'</div><div class="stage-amt">'+s[2]+'</div><p>'+s[3]+'</p></div>';
    }).join('');
  }
  function paintStats(A){
    $('stats').innerHTML = S.stats(R,P,A).map(function(c){
      return '<div class="stat tone-'+c[0]+'"><div class="k">'+c[1]+'</div><div class="v">'+c[2]+'</div><div class="n">'+c[3]+'</div></div>';
    }).join('');
  }
  function flat(v){ var a=new Array(R.m.length); for(var i=0;i<a.length;i++) a[i]=v; return a; }

  function paintCharts(A){
    var H=P.horizon, C=S.charts, d=window.charts.draw;
    var mark = P.runOffYear>0 ? P.runOffYear*12 : null, ML=S.markLabel;
    var money=function(v){ return '£'+f.shortN(v); };
    var pct=function(v){ return v.toFixed(0)+'%'; };

    d({ el:'c-amount', type:'line', xMax:H, tall:true, title:C.amount.title, why:C.amount.why,
        series:[{label:'Loan amount set that year',color:'#b8395e',y:R.amount}],
        yFmt:money, yTip:f.gbpFull, markX:mark, markLabel:ML });

    d({ el:'c-wed', type:'line', xMax:H, title:C.weddings.title, why:C.weddings.why,
        series:[{label:'Weddings due',color:'#8fa0b6',y:roll12(R.weddingsDue),dash:true},
                {label:'Weddings funded',color:'#6a55c8',y:roll12(R.weddingsFunded)}],
        yFmt:f.shortN, markX:mark, markLabel:ML });

    d({ el:'c-cap', type:'line', xMax:H, title:C.capital.title, why:C.capital.why,
        series:[{label:'Capital ratio',color:'#10897c',y:R.capitalRatio.map(function(v){return isFinite(v)?v*100:null;})},
                {label:'Floor',color:'#c08f2a',dash:true,y:flat(P.capitalMinPct)}],
        yFmt:pct, yTip:function(v){return v.toFixed(1)+'%';}, markX:mark, markLabel:ML });

    d({ el:'c-liq', type:'line', xMax:H, title:C.liquidity.title, why:C.liquidity.why,
        series:[{label:'Liquidity ratio',color:'#16233a',y:R.liquidityRatio.map(function(v){return isFinite(v)?v*100:null;})},
                {label:'Reserve',color:'#c08f2a',dash:true,y:flat(P.liquidityMinPct)}],
        yFmt:pct, yTip:function(v){return v.toFixed(0)+'%';}, markX:mark, markLabel:ML });

    d({ el:'c-money', type:'stack100', xMax:H, title:C.money.title, why:C.money.why,
        series:[{label:C.money.s1,color:'#dd7d33',y:roll12(R.contribIn),op:0.9},
                {label:C.money.s2,color:'#10897c',y:roll12(R.repayIn),op:0.9}],
        yFmt:function(v){return Math.round(v*100)+'%';}, markX:mark, markLabel:ML });

    d({ el:'c-mem', type:'line', xMax:H, title:C.members.title, why:C.members.why,
        series:[{label:'Saving households',color:'#6a55c8',y:R.members}],
        yFmt:f.shortN, yTip:f.ci, markX:mark, markLabel:ML });

    d({ el:'c-cash', type:'line', xMax:H, title:C.cash.title, why:C.cash.why,
        series:[{label:C.cash.s1,color:'#16233a',y:R.cash},
                {label:C.cash.s2,color:'#10897c',y:R.capital}],
        yFmt:money, yTip:f.gbpFull, markX:mark, markLabel:ML });

    d({ el:'c-cum', type:'line', xMax:H, title:C.cumulative.title, why:C.cumulative.why,
        series:[{label:C.cumulative.s1,color:'#3b6ea5',y:R.cumLent},
                {label:C.cumulative.s2,color:'#b8395e',y:R.cumLoss}],
        yFmt:money, yTip:f.gbpFull, markX:mark, markLabel:ML });
  }

  function paintRunoff(A){
    $('roGrid').innerHTML = S.runoff(R,P,A).map(function(c){
      return '<div class="ro-card"><h3>'+c.h+'</h3><div class="ro-num">'+c.num+'</div><p>'+c.body+'</p></div>';
    }).join('');
  }

  function paintTable(){
    var yrs=Math.floor(P.horizon/12);
    var h='<thead><tr>'+S.tableHeaders.map(function(t){return '<th>'+t+'</th>';}).join('')+'</tr></thead><tbody>';
    for(var y=1;y<=yrs;y++){
      var a=(y-1)*12,b=y*12,due=0,fund=0,lent=0,rep=0;
      for(var i=a;i<b;i++){ due+=R.weddingsDue[i]; fund+=R.weddingsFunded[i]; lent+=R.lentOut[i]; rep+=R.repayIn[i]; }
      var j=b-1;
      h+='<tr><td class="n">'+y+'</td><td class="n">'+f.ci(R.members[j])+'</td><td class="n">'+Math.round(due)+'</td><td class="n">'+Math.round(fund)+
         '</td><td class="n">'+f.gbp(R.amount[j])+'</td><td class="n">'+(R.capitalRatio[j]*100).toFixed(1)+'</td><td class="n">'+(isFinite(R.liquidityRatio[j])?(R.liquidityRatio[j]*100).toFixed(0):'-')+
         '</td><td class="n">'+f.gbp(R.cash[j])+'</td><td class="n">'+f.gbp(lent)+'</td><td class="n">'+f.gbp(rep)+'</td></tr>';
    }
    $('tbl').innerHTML=h+'</tbody>';
  }

  function downloadCSV(){
    if(!R) return;
    var rows=[S.csvHeader];
    for(var i=0;i<R.m.length;i++){
      rows.push([R.m[i], R.members[i], R.weddingsDue[i], R.weddingsFunded[i], Math.round(R.amount[i]),
        R.capitalRatio[i].toFixed(5), (isFinite(R.liquidityRatio[i])?R.liquidityRatio[i].toFixed(5):''),
        R.cash[i].toFixed(2), R.memberSavings[i].toFixed(2), R.capital[i].toFixed(2),
        R.contribIn[i].toFixed(2), R.repayIn[i].toFixed(2), R.lentOut[i].toFixed(2),
        R.cumWeddings[i], Math.round(R.cumLent[i]), Math.round(R.cumLoss[i])].join(','));
    }
    var blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=S.csvFile; a.click();
  }

  function run(){
    P=readP();
    R=window.engineA.simulate(window.SEED_500,P);
    var A=analyse();
    paintJourney(); paintStats(A); paintCharts(A); paintRunoff(A); paintTable();
  }
  function runSoon(){ clearTimeout(timer); timer=setTimeout(run,180); }

  document.addEventListener('DOMContentLoaded',function(){
    S=window.STRINGS; f=window.fmt;
    IDS.forEach(function(id){ var el=$(id); if(el) el.addEventListener('input',function(){ markCustom(); runSoon(); }); });
    for(var k in PRESET_BTN){ (function(key){ $(PRESET_BTN[key]).addEventListener('click',function(){ applyPreset(key); }); })(k); }
    $('dlBtn').addEventListener('click',downloadCSV);
    applyPreset('base');
  });
})();
