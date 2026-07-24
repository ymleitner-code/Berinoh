/* =============================================================================
   Berinoh committee assistant - floating chat widget.
   Talks only to the Cloudflare Worker in ai/worker.js, which grounds a language
   model strictly on the presentation. To switch it on, paste your deployed
   Worker URL into ENDPOINT below and save.
   ============================================================================= */
(function () {
  'use strict';

  /* ---- SET THIS to your deployed Cloudflare Worker URL, e.g.
         "https://berinoh-assistant.<your-subdomain>.workers.dev" ---- */
  var ENDPOINT = "";

  var TEAL = '#0f7a6b', INK = '#16233a', LINE = '#dbe8e4', SOFT = '#eef7f4', MUTED = '#6b7a92';
  var history = [];

  var css = ''
    + '#bk-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:9px;'
    + 'background:' + TEAL + ';color:#fff;border:none;border-radius:999px;padding:12px 18px;font:600 14.5px/1 "Source Sans 3",system-ui,sans-serif;'
    + 'box-shadow:0 6px 20px rgba(15,35,58,.22);cursor:pointer}'
    + '#bk-btn:hover{background:#0c6b57}'
    + '#bk-btn svg{width:19px;height:19px;fill:#fff}'
    + '#bk-panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:min(400px,calc(100vw - 32px));height:min(560px,calc(100vh - 40px));'
    + 'background:#fff;border:1px solid ' + LINE + ';border-radius:16px;box-shadow:0 18px 50px rgba(15,35,58,.28);display:none;flex-direction:column;overflow:hidden;'
    + 'font-family:"Source Sans 3",system-ui,sans-serif}'
    + '#bk-panel.open{display:flex}'
    + '#bk-head{background:' + TEAL + ';color:#fff;padding:13px 16px;display:flex;align-items:center;justify-content:space-between}'
    + '#bk-head b{font:700 15px/1.2 "Fraunces",Georgia,serif}'
    + '#bk-head .sub{font-size:11.5px;opacity:.85;margin-top:2px}'
    + '#bk-close{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;opacity:.9}'
    + '#bk-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:' + SOFT + '}'
    + '.bk-m{max-width:86%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.42;white-space:pre-wrap;word-wrap:break-word}'
    + '.bk-m.u{align-self:flex-end;background:' + TEAL + ';color:#fff;border-bottom-right-radius:4px}'
    + '.bk-m.a{align-self:flex-start;background:#fff;color:' + INK + ';border:1px solid ' + LINE + ';border-bottom-left-radius:4px}'
    + '.bk-m.note{align-self:center;background:transparent;color:' + MUTED + ';font-size:12px;text-align:center;max-width:100%}'
    + '#bk-form{display:flex;gap:8px;padding:10px;border-top:1px solid ' + LINE + ';background:#fff}'
    + '#bk-in{flex:1;border:1px solid ' + LINE + ';border-radius:10px;padding:9px 11px;font:400 14px/1.3 inherit;resize:none;max-height:96px}'
    + '#bk-in:focus{outline:none;border-color:' + TEAL + '}'
    + '#bk-send{background:' + TEAL + ';color:#fff;border:none;border-radius:10px;padding:0 15px;font:700 14px inherit;cursor:pointer}'
    + '#bk-send:disabled{opacity:.5;cursor:default}'
    + '#bk-foot{font-size:11px;color:' + MUTED + ';text-align:center;padding:0 12px 9px;background:#fff}';

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }

  function boot() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);

    var btn = el('button', {id:'bk-btn', 'aria-label':'Ask a question about this presentation'},
      '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.5 1.2 4.7 3.2 6.2L4.5 21l3.6-1.9c1.2.4 2.5.6 3.9.6 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg><span>Ask a question</span>');
    var panel = el('div', {id:'bk-panel', role:'dialog', 'aria-label':'Berinoh assistant'});
    panel.appendChild(el('div', {id:'bk-head'},
      '<div><b>Ask about this proposal</b><div class="sub">Answers come only from the presentation</div></div>'));
    var closeBtn = el('button', {id:'bk-close', 'aria-label':'Close'}, '&times;');
    panel.querySelector('#bk-head').appendChild(closeBtn);
    var log = el('div', {id:'bk-log'});
    panel.appendChild(log);
    var form = el('form', {id:'bk-form'});
    var input = el('textarea', {id:'bk-in', rows:'1', placeholder:'Type your question...', 'aria-label':'Your question'});
    var send = el('button', {id:'bk-send', type:'submit'}, 'Send');
    form.appendChild(input); form.appendChild(send);
    panel.appendChild(form);
    panel.appendChild(el('div', {id:'bk-foot'}, 'Grounded in the presentation. Not legal or financial advice.'));
    document.body.appendChild(btn); document.body.appendChild(panel);

    function add(role, text) {
      var m = el('div', {class:'bk-m ' + (role === 'user' ? 'u' : role === 'note' ? 'note' : 'a')}, esc(text));
      log.appendChild(m); log.scrollTop = log.scrollHeight; return m;
    }
    var configured = !!ENDPOINT;
    add('assistant', configured
      ? 'Hello. Ask me anything about the two wedding-fund schemes, the pilot, the figures, or the tools. I answer only from this presentation, and I will say when something is not covered.'
      : 'The assistant is being set up and will be available shortly.');
    if (!configured) { input.disabled = true; send.disabled = true; }

    function toggle(open) { panel.classList.toggle('open', open); btn.style.display = open ? 'none' : ''; if (open) input.focus(); }
    btn.onclick = function () { toggle(true); };
    closeBtn.onclick = function () { toggle(false); };
    input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(96, input.scrollHeight) + 'px'; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim(); if (!q || !configured) return;
      input.value = ''; input.style.height = 'auto';
      add('user', q); history.push({role:'user', content:q});
      send.disabled = true; input.disabled = true;
      var typing = add('assistant', '...');
      fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({question:q, history:history.slice(0,-1)})})
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var ans = d && d.answer ? d.answer : (d && d.error ? d.error : 'Sorry, something went wrong.');
          typing.textContent = ans; history.push({role:'assistant', content:ans});
          history = history.slice(-10);
        })
        .catch(function () { typing.textContent = 'The assistant could not be reached. Please try again shortly.'; })
        .finally(function () { send.disabled = false; input.disabled = false; input.focus(); log.scrollTop = log.scrollHeight; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
