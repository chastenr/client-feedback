(function () {
  if (window.__kazeWidgetLoaded) return;
  window.__kazeWidgetLoaded = true;

  var script = document.currentScript || Array.prototype.slice.call(document.scripts).find(function (s) {
    return s.src && s.src.indexOf('/widget.js') !== -1;
  });
  if (!script) { console.warn('[Kaze] widget.js could not locate its own script tag.'); return; }

  var projectId = script.getAttribute('data-project-id');
  if (!projectId) { console.error('[Kaze] data-project-id attribute is missing.'); return; }

  var appOrigin = new URL(script.src).origin;

  // ─── Review-session gate ───────────────────────────────────────────────────
  function isReviewSession() {
    try { if (sessionStorage.getItem('kaze_review') === '1') return true; } catch (_) {}
    return new URLSearchParams(window.location.search).get('feedback') === '1';
  }
  if (!isReviewSession()) return;
  try { sessionStorage.setItem('kaze_review', '1'); } catch (_) {}

  // ─── State ─────────────────────────────────────────────────────────────────
  var state = { active: false, selected: null, hoverEl: null, pinCount: 0 };

  // ─── Shadow DOM ────────────────────────────────────────────────────────────
  var host = document.createElement('div');
  host.id = 'kaze-widget-host';
  document.documentElement.appendChild(host);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var style = document.createElement('style');
  style.textContent = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
    '.tab{position:fixed;right:0;top:50%;z-index:2147483645;border:0;background:#7c3aed;color:#fff;padding:14px 10px;border-radius:10px 0 0 10px;box-shadow:0 8px 24px rgba(124,58,237,.35);font-size:13px;font-weight:700;cursor:pointer;writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg);letter-spacing:.04em;transition:background .15s}',
    '.tab:hover{background:#6d28d9}',
    '.tab.pulse{animation:kazePulseTab 0.7s ease-in-out 4}',
    '@keyframes kazePulseTab{0%,100%{box-shadow:0 8px 24px rgba(124,58,237,.35)}50%{box-shadow:0 0 0 8px rgba(124,58,237,.25),0 8px 28px rgba(124,58,237,.5)}}',
    '.bar{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483646;background:#1c1917;color:#fff;border-radius:999px;padding:10px 16px;font-size:13px;font-weight:650;box-shadow:0 12px 30px rgba(28,25,23,.25);display:flex;gap:10px;align-items:center}',
    '.bar button{border:0;background:#44403c;color:#fff;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s}',
    '.bar button:hover{background:#57534e}',
    '.outline{position:absolute;z-index:2147483644;pointer-events:none;border:2px solid #7c3aed;background:rgba(124,58,237,.08);border-radius:4px}',
    // Existing pins (saved)
    '.epin{position:absolute;z-index:2147483643;transform:translate(-50%,-50%);cursor:pointer}',
    '.epin-dot{width:26px;height:26px;border-radius:999px;background:#7c3aed;border:3px solid #fff;box-shadow:0 4px 16px rgba(124,58,237,.45);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800;transition:transform .15s}',
    '.epin:hover .epin-dot{transform:scale(1.18)}',
    '.epin-tooltip{position:absolute;bottom:34px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fff;border-radius:10px;padding:8px 12px;font-size:12px;line-height:1.4;white-space:pre-wrap;max-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none;opacity:0;transition:opacity .15s;z-index:2147483648}',
    '.epin:hover .epin-tooltip{opacity:1}',
    '.epin-tooltip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#1c1917}',
    // New pin (being placed)
    '.pin{position:absolute;z-index:2147483647;transform:translate(-50%,-50%);pointer-events:none}',
    '.pin-dot{width:22px;height:22px;border-radius:999px;background:#7c3aed;border:3px solid #fff;box-shadow:0 4px 16px rgba(124,58,237,.5);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800}',
    '.pin-ring{position:absolute;left:50%;top:50%;width:38px;height:38px;border-radius:999px;background:rgba(124,58,237,.2);transform:translate(-50%,-50%);animation:kazePing 1.6s cubic-bezier(0,0,.2,1) infinite}',
    '@keyframes kazePing{0%{opacity:.7;transform:translate(-50%,-50%) scale(.7)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.9)}}',
    '.modal-backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(28,25,23,.25)}',
    '.modal{position:fixed;right:22px;bottom:22px;z-index:2147483647;width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid #e7e5e4;border-radius:16px;box-shadow:0 24px 70px rgba(28,25,23,.2);overflow:hidden;color:#1c1917}',
    '.modal header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px;border-bottom:1px solid #f5f5f4}',
    '.modal-title{display:flex;align-items:center;gap:8px}',
    '.modal-badge{width:8px;height:8px;border-radius:999px;background:#7c3aed;display:inline-block}',
    '.modal h2{margin:0;font-size:14px;font-weight:800;color:#1c1917}',
    '.modal .close{border:0;background:transparent;color:#a8a29e;font-size:20px;line-height:1;cursor:pointer;padding:2px;border-radius:6px;transition:background .15s}',
    '.modal .close:hover{background:#f5f5f4;color:#1c1917}',
    '.form{padding:16px 18px;display:grid;gap:12px}',
    '.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    'label{display:grid;gap:5px;font-size:11px;font-weight:700;color:#78716c;letter-spacing:.03em;text-transform:uppercase}',
    'input,textarea{width:100%;border:1.5px solid #e7e5e4;border-radius:10px;padding:9px 11px;font-size:13px;color:#1c1917;background:#fafaf9;outline:none;transition:border-color .15s,box-shadow .15s}',
    'textarea{min-height:90px;resize:vertical;line-height:1.5}',
    'input:focus,textarea:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12);background:#fff}',
    '.meta-row{font-size:11px;color:#a8a29e;background:#fafaf9;border:1.5px solid #e7e5e4;border-radius:10px;padding:8px 11px;display:flex;justify-content:space-between;gap:8px;overflow:hidden}',
    '.meta-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.actions{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 18px 16px}',
    '.status{font-size:12px;color:#a8a29e}',
    '.error-msg{color:#dc2626}',
    '.success-msg{color:#16a34a}',
    '.submit{border:0;background:#7c3aed;color:white;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;transition:background .15s}',
    '.submit:hover{background:#6d28d9}',
    '.submit:disabled{opacity:.5;cursor:not-allowed}',
    '@media(max-width:520px){.tab{top:auto;right:14px;bottom:14px;writing-mode:horizontal-tb;transform:none;border-radius:999px;padding:12px 16px}.bar{width:calc(100vw - 28px);justify-content:center}.modal{left:16px;right:16px;bottom:16px;width:auto}.row{grid-template-columns:1fr}}',
  ].join('');
  root.appendChild(style);

  var tab = document.createElement('button');
  tab.className = 'tab';
  tab.type = 'button';
  tab.textContent = 'Feedback';
  tab.addEventListener('click', enterSelectMode);
  root.appendChild(tab);

  var outline = document.createElement('div');
  outline.className = 'outline';
  var lastKnownPath = window.location.pathname;

  // ─── Load and render existing pins ────────────────────────────────────────
  function loadExistingPins() {
    var requestedPath = window.location.pathname;
    removeByClass('epin');
    state.pinCount = 0;

    try {
      fetch(appOrigin + '/api/public/project-tasks?project_id=' + encodeURIComponent(projectId) + '&page_path=' + encodeURIComponent(requestedPath), {
        mode: 'cors',
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (window.location.pathname !== requestedPath) return;
          if (!data || !data.tasks) return;
          var tasks = data.tasks.filter(taskBelongsToCurrentPage);
          tasks.forEach(function (task, i) {
            renderExistingPin(task, i + 1);
          });
          state.pinCount = tasks.length;
        })
        .catch(function () {});
    } catch (_) {}
  }

  function normalizePath(value) {
    if (!value) return '';
    var path = String(value);
    try {
      path = new URL(path, window.location.origin).pathname;
    } catch (_) {
      path = path.split('?')[0].split('#')[0];
    }
    if (path.charAt(0) !== '/') path = '/' + path;
    return path.length > 1 ? path.replace(/\/+$/, '') : path;
  }

  function taskBelongsToCurrentPage(task) {
    var currentPath = normalizePath(window.location.pathname);
    return normalizePath(task.page_path) === currentPath || normalizePath(task.page_url) === currentPath;
  }

  function handlePathChange() {
    if (lastKnownPath === window.location.pathname) return;
    lastKnownPath = window.location.pathname;
    removeByClass('epin');
    removeByClass('pin');
    loadExistingPins();
  }

  function watchPathChanges() {
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = history[method];
      if (typeof original !== 'function') return;
      history[method] = function () {
        var result = original.apply(this, arguments);
        setTimeout(handlePathChange, 0);
        return result;
      };
    });
    window.addEventListener('popstate', function () { setTimeout(handlePathChange, 0); });
    setInterval(handlePathChange, 700);
  }

  function renderExistingPin(task, number) {
    var pin = document.createElement('div');
    pin.className = 'epin';
    var absX = Number(task.x) + Number(task.scroll_x || 0);
    var absY = Number(task.y) + Number(task.scroll_y || 0);
    pin.style.left = absX + 'px';
    pin.style.top = absY + 'px';

    var comment = String(task.comment || '').trim();
    var reporter = task.reporter_name ? task.reporter_name : 'Anonymous';
    var tooltipText = '#' + number + ' ' + reporter + '\n' + (comment.length > 120 ? comment.slice(0, 120) + '…' : comment);

    pin.innerHTML = '<div class="epin-dot">' + number + '</div><div class="epin-tooltip">' + escapeHtml(tooltipText) + '</div>';
    root.appendChild(pin);
  }

  // ─── Install-check ping ────────────────────────────────────────────────────
  function pingInstallCheck() {
    try {
      fetch(appOrigin + '/api/widget/install-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, page_url: window.location.href }),
        mode: 'cors',
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  }

  function init() {
    pingInstallCheck();
    loadExistingPins();
    watchPathChanges();
    if (new URLSearchParams(window.location.search).get('feedback') === '1') {
      tab.classList.add('pulse');
      tab.addEventListener('animationend', function () { tab.classList.remove('pulse'); }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Selection mode ────────────────────────────────────────────────────────
  function renderBar() {
    removeByClass('bar');
    if (!state.active) return;
    var bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = '<span>Click any element to leave feedback</span>';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', exitSelectMode);
    bar.appendChild(cancel);
    root.appendChild(bar);
  }

  function removeByClass(className) {
    Array.prototype.slice.call(root.querySelectorAll('.' + className)).forEach(function (el) { el.remove(); });
  }

  function enterSelectMode() {
    state.active = true;
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    root.appendChild(outline);
    renderBar();
  }

  function exitSelectMode() {
    state.active = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    outline.remove();
    renderBar();
  }

  function isWidgetNode(el) {
    return el === host || (host.contains && host.contains(el));
  }

  function handleMouseMove(event) {
    if (!state.active || isWidgetNode(event.target)) return;
    var el = event.target;
    if (!el || el.nodeType !== 1) return;
    state.hoverEl = el;
    var rect = el.getBoundingClientRect();
    outline.style.left = rect.left + window.scrollX + 'px';
    outline.style.top = rect.top + window.scrollY + 'px';
    outline.style.width = rect.width + 'px';
    outline.style.height = rect.height + 'px';
  }

  function handleClick(event) {
    if (!state.active || isWidgetNode(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    var target = event.target && event.target.nodeType === 1 ? event.target : state.hoverEl;
    state.selected = {
      x: event.clientX,
      y: event.clientY,
      scrollX: window.scrollX || window.pageXOffset || 0,
      scrollY: window.scrollY || window.pageYOffset || 0,
      selector: target ? getCssSelector(target) : null,
      elementText: target ? (target.innerText || '').slice(0, 200).trim() : null,
    };
    exitSelectMode();
    renderNewPin(state.selected);
    renderModal();
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function getCssSelector(element) {
    if (!element || element.nodeType !== 1) return null;
    if (element.id) return '#' + cssEscape(element.id);
    var path = [];
    var el = element;
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      var selector = el.tagName.toLowerCase();
      var classes = Array.prototype.slice.call(el.classList || []).filter(Boolean).slice(0, 3).map(function (cls) { return '.' + cssEscape(cls); }).join('');
      selector += classes;
      var parent = el.parentElement;
      if (parent) {
        var sameTag = Array.prototype.filter.call(parent.children, function (child) { return child.tagName === el.tagName; });
        if (sameTag.length > 1) selector += ':nth-of-type(' + (sameTag.indexOf(el) + 1) + ')';
      }
      path.unshift(selector);
      if (path.length >= 6) break;
      el = parent;
    }
    return path.join(' > ');
  }

  function renderNewPin(point) {
    removeByClass('pin');
    var num = state.pinCount + 1;
    var pin = document.createElement('div');
    pin.className = 'pin';
    pin.style.left = point.x + point.scrollX + 'px';
    pin.style.top = point.y + point.scrollY + 'px';
    pin.innerHTML = '<div class="pin-ring"></div><div class="pin-dot">' + num + '</div>';
    root.appendChild(pin);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }

  function renderModal() {
    removeByClass('modal-backdrop');
    removeByClass('modal');
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    var modal = document.createElement('form');
    modal.className = 'modal';
    modal.innerHTML = [
      '<header><div class="modal-title"><span class="modal-badge"></span><h2>Leave feedback</h2></div>',
      '<button class="close" type="button" aria-label="Close">&times;</button></header>',
      '<div class="form">',
      '<label>Comment<textarea name="comment" required maxlength="5000" placeholder="What would you like to change or report?"></textarea></label>',
      '<div class="row">',
      '<label>Name (optional)<input name="name" maxlength="120" placeholder="Your name"></label>',
      '<label>Email (optional)<input name="email" type="email" maxlength="180" placeholder="your@email.com"></label>',
      '</div>',
      '<div class="meta-row"><span>' + escapeHtml(window.location.pathname) + '</span><span>' + escapeHtml(state.selected.selector || '') + '</span></div>',
      '</div>',
      '<div class="actions"><span class="status"></span><button class="submit" type="submit">Send feedback</button></div>',
    ].join('');
    modal.querySelector('.close').addEventListener('click', function () {
      backdrop.remove(); modal.remove(); removeByClass('pin');
    });
    modal.addEventListener('submit', submitFeedback);
    root.appendChild(backdrop);
    root.appendChild(modal);
  }

  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = appOrigin + '/html2canvas.min.js';
      s.async = true;
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  async function captureScreenshot() {
    try {
      var h2c = await loadHtml2Canvas();
      if (!h2c) return null;
      var canvas = await h2c(document.documentElement, {
        useCORS: true, allowTaint: false, logging: false,
        scale: Math.min(1, window.devicePixelRatio || 1),
        x: window.scrollX || 0, y: window.scrollY || 0,
        width: window.innerWidth, height: window.innerHeight,
        windowWidth: window.innerWidth, windowHeight: window.innerHeight,
        ignoreElements: function (el) { return el === host || (host.contains && host.contains(el)); },
      });
      return canvas.toDataURL('image/jpeg', 0.65);
    } catch (_) { return null; }
  }

  function humanizeError(status, body) {
    if (status === 403) return 'This domain is not authorised for this project.';
    if (status === 404) return 'Project ID "' + projectId + '" was not found.';
    if (status === 422) return 'Please fill in the comment field and try again.';
    if (status >= 500) return 'Server error. Please try again in a moment.';
    if (body && body.error) return body.error;
    return 'Could not send feedback. Please check your connection and try again.';
  }

  async function submitFeedback(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var statusEl = form.querySelector('.status');
    var button = form.querySelector('.submit');
    button.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = 'Capturing screenshot…';

    var screenshot = await captureScreenshot();
    statusEl.textContent = 'Sending…';

    var formData = new FormData(form);
    var payload = {
      project_id: projectId,
      comment: String(formData.get('comment') || '').trim(),
      reporter_name: String(formData.get('name') || '').trim() || null,
      reporter_email: String(formData.get('email') || '').trim() || null,
      page_url: window.location.href,
      page_path: window.location.pathname,
      selector: state.selected.selector,
      element_text: state.selected.elementText,
      x: state.selected.x,
      y: state.selected.y,
      scroll_x: state.selected.scrollX,
      scroll_y: state.selected.scrollY,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      user_agent: navigator.userAgent,
      screenshot: screenshot,
    };

    try {
      var response = await fetch(appOrigin + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });
      var body = null;
      try { body = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(humanizeError(response.status, body));

      // Promote the temporary new pin to a saved existing pin
      removeByClass('pin');
      state.pinCount += 1;
      renderExistingPin({
        x: state.selected.x,
        y: state.selected.y,
        scroll_x: state.selected.scrollX,
        scroll_y: state.selected.scrollY,
        comment: String(formData.get('comment') || '').trim(),
        reporter_name: String(formData.get('name') || '').trim() || null,
      }, state.pinCount);

      statusEl.className = 'status success-msg';
      statusEl.textContent = 'Feedback sent. Thank you!';
      button.textContent = 'Done';
      setTimeout(function () {
        removeByClass('modal');
        removeByClass('modal-backdrop');
      }, 1000);
    } catch (err) {
      button.disabled = false;
      statusEl.className = 'status error-msg';
      statusEl.textContent = err && err.message ? err.message : 'Could not send feedback. Please try again.';
    }
  }
})();
