/* =============================================================================
   format.js  -  number, currency and duration formatting.
   Language-neutral except for durations and year labels, which it delegates to
   whichever strings file the page loaded.
   ============================================================================= */
(function (root) {
  'use strict';

  function ci(v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function gbp(v) {
    var s = v < 0 ? '-' : ''; v = Math.abs(v);
    if (v >= 1e9) return s + '\u00a3' + (v / 1e9).toFixed(2) + root.STRINGS.unitBn;
    if (v >= 1e6) return s + '\u00a3' + (v / 1e6).toFixed(1) + root.STRINGS.unitM;
    if (v >= 1e3) return s + '\u00a3' + (v / 1e3).toFixed(0) + root.STRINGS.unitK;
    return s + '\u00a3' + ci(v);
  }

  function gbpFull(v) { return (v < 0 ? '-\u00a3' : '\u00a3') + ci(Math.abs(v)); }

  function shortN(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + root.STRINGS.unitM;
    if (v >= 1e3) return (v / 1e3).toFixed(0) + root.STRINGS.unitK;
    return Math.round(v);
  }

  function pc(v, dp) { return (v * 100).toFixed(dp === undefined ? 1 : dp) + '%'; }

  function wy(mo) {
    if (mo == null || !isFinite(mo)) return root.STRINGS.durationNone;
    var t = Math.round(mo);
    return root.STRINGS.duration(Math.floor(t / 12), t % 12);
  }

  function yr(m) { return root.STRINGS.yearOf(Math.ceil(m / 12)); }

  /* Rounds an axis maximum up to a readable value. */
  function niceTop(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  root.fmt = { ci: ci, gbp: gbp, gbpFull: gbpFull, shortN: shortN,
               pc: pc, wy: wy, yr: yr, niceTop: niceTop };
})(typeof window !== 'undefined' ? window : globalThis);
