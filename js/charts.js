/* =============================================================================
   charts.js  -  SVG chart renderer. Line, stacked area and 100% stacked area.
   Shared by every page. Takes text from window.STRINGS, numbers from window.fmt.
   ============================================================================= */
(function (root) {
  'use strict';

  function tipEl() { return document.getElementById('tip'); }

  /* Arrowheads must always be clearly larger than the stroke they sit on,
     otherwise a thick flow swallows its own arrowhead and reads as a blunt bar. */
  function sizeArrow(id, w) {
    var mk = document.getElementById(id); if (!mk) return;
    var aw = Math.max(12, w * 1.55), ah = Math.max(14, w * 2.05);
    mk.setAttribute('markerWidth', aw.toFixed(1));
    mk.setAttribute('markerHeight', ah.toFixed(1));
    mk.setAttribute('refX', (aw - 1).toFixed(1));
    mk.setAttribute('refY', (ah / 2).toFixed(1));
    var p = mk.firstElementChild;
    if (p) p.setAttribute('d', 'M0,0 L' + aw.toFixed(1) + ',' + (ah / 2).toFixed(1) + ' L0,' + ah.toFixed(1) + ' z');
  }

  function drawChart(cfg) {
    var el = document.getElementById(cfg.el); if (!el) return;
    var f = root.fmt, S = root.STRINGS;
    var W = 780, H = cfg.tall ? 300 : 250, pl = 64, pr = 16, pt = 14, pb = 32;
    var iw = W - pl - pr, ih = H - pt - pb, xMax = cfg.xMax, SER = cfg.series;
    var n = xMax, stack = (cfg.type === 'stack' || cfg.type === 'stack100'), pct100 = (cfg.type === 'stack100');

    var tops = [];
    if (stack) for (var i = 0; i < n; i++) {
      var t0 = 0; for (var s0 = 0; s0 < SER.length; s0++) t0 += (SER[s0].y[i] || 0);
      tops.push(t0);
    }
    var yMax = 0;
    if (pct100) yMax = 1;
    else if (stack) yMax = f.niceTop(Math.max.apply(null, tops.concat([0])));
    else { SER.forEach(function (sr) { sr.y.forEach(function (v) { if (v != null && isFinite(v) && v > yMax) yMax = v; }); }); yMax = f.niceTop(yMax || 1); }

    function X(m) { return pl + (m / xMax) * iw; }
    function Y(v) { return pt + ih - (v / yMax) * ih; }

    var g = '';
    for (var k = 0; k <= 4; k++) {
      var yv = yMax * k / 4, yy = Y(yv);
      g += '<line x1="' + pl + '" y1="' + yy.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + yy.toFixed(1) + '" stroke="#e6ecf3"/>';
      g += '<text x="' + (pl - 8) + '" y="' + (yy + 3.6).toFixed(1) + '" text-anchor="end" class="axis">' + cfg.yFmt(yv) + '</text>';
    }
    var years = xMax / 12, stp = years <= 25 ? 5 : (years <= 55 ? 10 : 20);
    for (var t = 0; t <= years + 0.01; t += stp) {
      var xx = X(t * 12);
      g += '<line x1="' + xx.toFixed(1) + '" y1="' + pt + '" x2="' + xx.toFixed(1) + '" y2="' + (pt + ih) + '" stroke="#f0f4f8"/>';
      g += '<text x="' + xx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" class="axis">' + t + '</text>';
    }
    g += '<text x="' + (W - pr) + '" y="' + (H - 10) + '" text-anchor="end" class="axis">' + S.axisYears + '</text>';

    if (stack) {
      var base = new Array(n).fill(0);
      for (var s = 0; s < SER.length; s++) {
        var up = '', dn = '';
        for (i = 0; i < n; i++) {
          var raw = SER[s].y[i] || 0, denom = pct100 ? (tops[i] || 1) : 1;
          var hi = base[i] + raw / denom;
          up += (i === 0 ? 'M' : 'L') + X(i + 1).toFixed(1) + ' ' + Y(hi).toFixed(1);
          base[i] = hi;
        }
        for (i = n - 1; i >= 0; i--) {
          var prev = base[i] - ((SER[s].y[i] || 0) / (pct100 ? (tops[i] || 1) : 1));
          dn += 'L' + X(i + 1).toFixed(1) + ' ' + Y(prev).toFixed(1);
        }
        g += '<path d="' + up + dn + 'Z" fill="' + SER[s].color + '" fill-opacity="' + (SER[s].op || 0.85) + '" stroke="none"/>';
      }
    } else {
      SER.forEach(function (sr) {
        var d = '', pen = false;
        for (var i2 = 0; i2 < sr.y.length && i2 < n; i2++) {
          var v = sr.y[i2];
          if (v == null || !isFinite(v)) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + X(i2 + 1).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true;
        }
        if (d) g += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.w || 2.4) + '"' +
                    (sr.dash ? ' stroke-dasharray="6 5"' : '') + ' stroke-linejoin="round"/>';
      });
    }
    if (cfg.markX) {
      var mx = X(cfg.markX);
      g += '<line x1="' + mx.toFixed(1) + '" y1="' + pt + '" x2="' + mx.toFixed(1) + '" y2="' + (pt + ih) + '" stroke="#c08f2a" stroke-width="1.6" stroke-dasharray="5 4"/>';
      g += '<text x="' + (mx + 6).toFixed(1) + '" y="' + (pt + 13) + '" class="axis" style="fill:#c08f2a;font-weight:700">' + cfg.markLabel + '</text>';
    }
    g += '<line id="' + cfg.el + '-cx" x1="0" y1="' + pt + '" x2="0" y2="' + (pt + ih) + '" stroke="#94a3b8" stroke-width="1" style="display:none"/>';

    var key = '<div class="key">' + SER.map(function (sr) {
      return '<span><i style="background:' + sr.color + (sr.dash ? ';opacity:.55' : '') + '"></i>' + sr.label + '</span>';
    }).join('') + '</div>';

    el.innerHTML = '<h3>' + cfg.title + '</h3>' + (cfg.why ? '<p class="why">' + cfg.why + '</p>' : '') + key +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + g + '</svg>' +
      (cfg.note ? '<p class="note">' + cfg.note + '</p>' : '');

    var svg = el.querySelector('svg'), cx = document.getElementById(cfg.el + '-cx'), TIP = tipEl();
    svg.addEventListener('mousemove', function (ev) {
      var r = svg.getBoundingClientRect();
      var mm = Math.round(((ev.clientX - r.left) * (W / r.width) - pl) / iw * xMax);
      if (mm < 1) mm = 1; if (mm > xMax) mm = xMax;
      var html = '<b>' + S.tipYear((mm / 12).toFixed(1)) + '</b>', tot = 0;
      if (pct100) for (var s2 = 0; s2 < SER.length; s2++) tot += (SER[s2].y[mm - 1] || 0);
      SER.forEach(function (sr) {
        var v = sr.y[mm - 1];
        if (v == null || !isFinite(v)) return;
        var shown = pct100 ? f.pc(tot > 0 ? v / tot : 0) : (cfg.yTip || cfg.yFmt)(v);
        html += '<br><i style="background:' + sr.color + '"></i>' + sr.label + ': ' + shown;
      });
      TIP.innerHTML = html; TIP.style.display = 'block';
      TIP.style.left = Math.min(ev.pageX + 16, window.innerWidth - 310) + 'px';
      TIP.style.top = (ev.pageY + 14) + 'px';
      cx.setAttribute('x1', X(mm).toFixed(1)); cx.setAttribute('x2', X(mm).toFixed(1)); cx.style.display = 'block';
    });
    svg.addEventListener('mouseleave', function () { TIP.style.display = 'none'; cx.style.display = 'none'; });
  }

  root.charts = { draw: drawChart, sizeArrow: sizeArrow };
})(typeof window !== 'undefined' ? window : globalThis);
