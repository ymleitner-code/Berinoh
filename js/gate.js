/* =============================================================================
   Berinoh committee - shared password gate.
   Loaded synchronously in the <head> of every page so content is hidden before
   it renders. One shared password for the whole committee. Only a SHA-256 hash
   of the password lives here, never the password itself. Once entered correctly,
   the unlock is remembered on that device (localStorage) so it is not re-asked
   on every page. This is a deterrent for a public static host, not strong
   security: the files are still served by GitHub Pages.
   To change the password: replace the HASH value below with the SHA-256 hex of
   the new password (any "sha256" tool, or ask the site's maintainer).
   ============================================================================= */
(function () {
  'use strict';

  // SHA-256 (hex) of the shared committee password.
  var HASH = '12ef0f428aed07a3b4b24761df7c88decc25c11d950a03c00d4a953e454e2031';
  var KEY = 'berinoh_gate';

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, HASH); } catch (e) {} }

  if (stored() === HASH) return; // already unlocked on this device

  // Hide the page immediately, before <body> renders, to avoid any content flash.
  var root = document.documentElement;
  root.classList.add('bk-gated');
  var st = document.createElement('style');
  st.id = 'bk-gate-style';
  st.textContent =
    '.bk-gated body{visibility:hidden!important}'
    + '#bk-gate{visibility:visible!important;position:fixed;inset:0;z-index:2147483600;'
    + 'display:flex;align-items:center;justify-content:center;padding:20px;'
    + 'background:linear-gradient(160deg,#0f3f37,#0f7a6b);'
    + 'font-family:"Source Sans 3",system-ui,-apple-system,sans-serif}'
    + '#bk-gate .card{background:#fff;border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.32);'
    + 'padding:32px 28px;width:min(370px,calc(100vw - 40px));text-align:center;box-sizing:border-box}'
    + '#bk-gate .eyebrow{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#0f7a6b;font-weight:700;margin-bottom:10px}'
    + '#bk-gate h1{font:700 21px/1.25 "Fraunces",Georgia,serif;color:#16233a;margin:0 0 7px}'
    + '#bk-gate p{font-size:13.5px;color:#6b7a92;margin:0 0 18px;line-height:1.5}'
    + '#bk-gate input{width:100%;box-sizing:border-box;border:1px solid #dbe8e4;border-radius:10px;'
    + 'padding:12px 13px;font-size:15px;margin-bottom:10px;text-align:center}'
    + '#bk-gate input:focus{outline:none;border-color:#0f7a6b}'
    + '#bk-gate button{width:100%;background:#0f7a6b;color:#fff;border:none;border-radius:10px;'
    + 'padding:12px;font:700 15px inherit;cursor:pointer}'
    + '#bk-gate button:hover{background:#0c6b57}'
    + '#bk-gate .err{color:#b23a48;font-size:13px;min-height:18px;margin-top:4px}';
  (document.head || document.documentElement).appendChild(st);

  async function sha256(s) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function build() {
    if (document.getElementById('bk-gate')) return;
    var wrap = document.createElement('div');
    wrap.id = 'bk-gate';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Committee password');
    wrap.innerHTML = '<div class="card">'
      + '<div class="eyebrow">Berinoh committee</div>'
      + '<h1>This page is private</h1>'
      + '<p>Please enter the committee password to continue.</p>'
      + '<input id="bk-gate-in" type="password" placeholder="Password" autocomplete="current-password" aria-label="Committee password">'
      + '<button id="bk-gate-go" type="button">Enter</button>'
      + '<div class="err" id="bk-gate-err" role="alert"></div>'
      + '</div>';
    document.body.appendChild(wrap);
    var inp = wrap.querySelector('#bk-gate-in');
    var go = wrap.querySelector('#bk-gate-go');
    var err = wrap.querySelector('#bk-gate-err');
    inp.focus();
    var busy = false;
    async function tryit() {
      if (busy) return;
      busy = true; err.textContent = '';
      var h;
      try { h = await sha256(inp.value); } catch (e) { h = ''; }
      if (h === HASH) {
        save();
        root.classList.remove('bk-gated');
        var s = document.getElementById('bk-gate-style'); if (s) s.remove();
        wrap.remove();
      } else {
        err.textContent = 'That password is not correct.';
        inp.select();
        busy = false;
      }
    }
    go.onclick = tryit;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tryit(); } });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
