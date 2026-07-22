/* =============================================================================
   cycle.js  -  builds the money-cycle diagram.

   The diagram is generated rather than hand-written so that a single set of
   coordinates serves both languages. For a right-to-left page every x value is
   mirrored across the 640-unit canvas, so money flows right to left and the
   boxes swap ends. Previously this markup existed twice, once per language.
   ============================================================================= */
(function (root) {
  'use strict';
  var VW = 640;

  function build(el, dir, S) {
    var rtl = (dir === 'rtl');
    function X(x) { return rtl ? VW - x : x; }
    function boxX(x, w) { return rtl ? VW - x - w : x; }
    function anchor(a) { return rtl ? (a === 'start' ? 'end' : a === 'end' ? 'start' : a) : a; }
    function ln(x1, y1, x2, y2) { return 'M' + X(x1) + ' ' + y1 + ' L' + X(x2) + ' ' + y2; }
    function cu(x1, y1, a1, b1, a2, b2, x2, y2) {
      return 'M' + X(x1) + ' ' + y1 + ' C' + X(a1) + ' ' + b1 + ', ' + X(a2) + ' ' + b2 + ', ' + X(x2) + ' ' + y2;
    }
    function box(x, y, w, h, extra) {
      return '<rect class="node-box" x="' + boxX(x, w) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12"' + (extra || '') + '/>';
    }
    function txt(cls, x, y, cont, id, anc, extra) {
      return '<text class="' + cls + '"' + (id ? ' id="' + id + '"' : '') + ' x="' + X(x) + '" y="' + y +
             '" text-anchor="' + anchor(anc || 'middle') + '"' + (extra || '') + '>' + cont + '</text>';
    }
    function marker(id, fill, w, h, op) {
      return '<marker id="' + id + '" markerUnits="userSpaceOnUse" markerWidth="' + w + '" markerHeight="' + h +
             '" refX="' + (w - 1) + '" refY="' + (h / 2) + '" orient="auto"><path d="M0,0 L' + (w - 1) + ',' + (h / 2) +
             ' L0,' + h + ' z" fill="' + fill + '"' + (op ? ' opacity="' + op + '"' : '') + '/></marker>';
    }
    var N = S.nodes;
    el.innerHTML =
      '<svg class="cycle-svg" viewBox="0 0 ' + VW + ' 344" role="img" aria-label="' + N.aria + '">' +
      '<defs>' +
        marker('ah-new', '#dd7d33', 20, 26) + marker('ah-out', '#b8395e', 20, 26) +
        marker('ah-rec', '#10897c', 20, 26) + marker('ah-cost', '#b8395e', 14, 18) +
        marker('ah-join', '#dd7d33', 10, 12, '.6') +
      '</defs>' +
      box(16, 126, 136, 72) +
      txt('node-title', 84, 150, N.families) + txt('node-sub', 84, 167, N.familiesSub) +
      txt('node-amt', 84, 187, '&#160;', 'cycFam') +
      box(250, 120, 140, 86, ' style="stroke:#16233a;stroke-width:2"') +
      txt('node-title', 320, 146, N.fund) + txt('node-sub', 320, 164, N.fundSub) +
      txt('node-amt lg', 320, 189, '&#160;', 'cycPot') +
      box(488, 126, 136, 72) +
      txt('node-title', 556, 150, N.loans) + txt('node-sub', 556, 167, N.loansSub) +
      txt('node-amt', 556, 187, '&#160;', 'cycLoansN') +
      '<path id="fNew" class="flow-line" d="' + ln(152, 152, 244, 152) + '" stroke="#dd7d33" stroke-width="6" marker-end="url(#ah-new)"/>' +
      '<path class="flow-dash" d="' + ln(152, 152, 214, 152) + '" stroke="#fff" stroke-width="2.2"/>' +
      txt('flow-label', 199, 104, N.flowNew, null, 'middle', ' fill="#dd7d33"') +
      txt('flow-amt', 199, 120, '&#160;', 'fNewAmt', 'middle', ' fill="#dd7d33"') +
      '<path id="fOut" class="flow-line" d="' + ln(390, 152, 482, 152) + '" stroke="#b8395e" stroke-width="9" marker-end="url(#ah-out)"/>' +
      '<path class="flow-dash" d="' + ln(390, 152, 452, 152) + '" stroke="#fff" stroke-width="2.2"/>' +
      txt('flow-label', 437, 104, N.flowOut, null, 'middle', ' fill="#b8395e"') +
      txt('flow-amt', 437, 120, '&#160;', 'fOutAmt', 'middle', ' fill="#b8395e"') +
      '<path id="fRec" class="flow-line" d="' + cu(556, 200, 556, 285, 320, 296, 320, 211) + '" stroke="#10897c" stroke-width="6" marker-end="url(#ah-rec)"/>' +
      '<path class="flow-dash" d="' + cu(556, 200, 556, 285, 320, 296, 320, 240) + '" stroke="#fff" stroke-width="2.2"/>' +
      txt('flow-label', 440, 300, N.flowRec, null, 'middle', ' fill="#10897c"') +
      txt('flow-amt', 440, 316, '&#160;', 'fRecAmt', 'middle', ' fill="#10897c"') +
      '<g id="gCost" style="display:none">' +
        '<path id="fCost" class="flow-line" d="' + cu(280, 207, 280, 246, 250, 258, 188, 258) + '" stroke="#b8395e" stroke-width="4" marker-end="url(#ah-cost)"/>' +
        '<path class="flow-dash" d="' + cu(280, 207, 280, 246, 250, 258, 208, 258) + '" stroke="#fff" stroke-width="2"/>' +
        '<rect class="cost-box" x="' + boxX(24, 160) + '" y="228" width="160" height="70" rx="11"/>' +
        txt('node-title', 104, 251, N.costs, null, 'middle', ' style="font-size:14.5px"') +
        txt('node-sub', 104, 268, N.costsSub) +
        txt('node-amt', 104, 288, '&#160;', 'cycCostAmt', 'middle', ' style="fill:#b8395e"') +
      '</g>' +
      '<path class="flow-line" d="' + cu(210, 50, 140, 50, 84, 66, 84, 116) + '" stroke="#dd7d33" stroke-width="2" stroke-dasharray="5 5" opacity=".5" marker-end="url(#ah-join)"/>' +
      txt('flow-label', 222, 46, N.flowJoin, null, 'start', ' fill="#dd7d33" opacity=".85"') +
      '</svg><p class="cyc-cap" id="cycCap">&#160;</p>';
  }

  root.cycle = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
