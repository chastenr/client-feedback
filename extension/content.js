(function () {
  if (window.__gomegaExtensionFeedbackLoaded) return;
  window.__gomegaExtensionFeedbackLoaded = true;

  const params = new URLSearchParams(window.location.search);
  const feedbackRequested = params.get('feedback') === '1';
  const projectTokenFromUrl = params.get('gomega_project');
  const apiOriginFromUrl = params.get('gomega_api');
  const feedbackTaskId = params.get('feedbackTask');

  function storageKeyForHostname(hostname) {
    return `gomega_feedback_${hostname}`;
  }

  function getConfigForHostname(hostname) {
    const key = storageKeyForHostname(hostname);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (data) => resolve(data[key] || null));
    });
  }

  function setConfigForWebsite(websiteUrl, config) {
    try {
      const hostname = new URL(websiteUrl).hostname;
      const key = storageKeyForHostname(hostname);
      return new Promise((resolve) => chrome.storage.local.set({ [key]: config }, resolve));
    } catch (_) {
      return Promise.resolve();
    }
  }

  function setCurrentConfig(config) {
    const key = storageKeyForHostname(window.location.hostname);
    return new Promise((resolve) => chrome.storage.local.set({ [key]: config }, resolve));
  }

  function removeCurrentConfig() {
    const key = storageKeyForHostname(window.location.hostname);
    return new Promise((resolve) => chrome.storage.local.remove([key], resolve));
  }

  function captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GOMEGA_CAPTURE_SCREENSHOT' }, (response) => {
        resolve(response?.ok ? response.screenshot : null);
      });
    });
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function getCssSelector(element) {
    if (!element || element.nodeType !== 1) return null;
    if (element.id) return `#${cssEscape(element.id)}`;
    const path = [];
    let el = element;
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      let selector = el.tagName.toLowerCase();
      const classes = Array.from(el.classList || [])
        .filter(Boolean)
        .slice(0, 3)
        .map((cls) => `.${cssEscape(cls)}`)
        .join('');
      selector += classes;
      const parent = el.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
        if (sameTag.length > 1) selector += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
      }
      path.unshift(selector);
      if (path.length >= 7) break;
      el = parent;
    }
    return path.join(' > ');
  }

  function browserName() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome/')) return 'Chrome';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    if (ua.includes('Firefox/')) return 'Firefox';
    return 'Unknown';
  }

  function osName() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function installReviewPageBridge() {
    if (!/\/review\/[^/?#]+/.test(window.location.pathname)) return false;

    document.documentElement.setAttribute('data-gomega-extension-installed', 'true');
    window.postMessage({ type: 'GOMEGA_EXTENSION_READY' }, '*');

    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.type === 'GOMEGA_REVIEW_PAGE_READY') {
        window.postMessage({ type: 'GOMEGA_EXTENSION_READY' }, '*');
      }
      if (data?.type === 'GOMEGA_ACTIVATE_REVIEW' && data.projectToken && data.apiOrigin && data.websiteUrl) {
        await setConfigForWebsite(data.websiteUrl, {
          projectToken: data.projectToken,
          reviewToken: data.projectToken,
          apiOrigin: data.apiOrigin,
          websiteUrl: data.websiteUrl,
        });
        window.postMessage({ type: 'GOMEGA_REVIEW_ACTIVATED' }, '*');
      }
    });

    return true;
  }

  function init(config) {
    if (!config?.projectToken || !config?.apiOrigin) return;
    if (document.getElementById('gomega-extension-feedback-host')) return;

    const host = document.createElement('div');
    host.id = 'gomega-extension-feedback-host';
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      *{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .tab{position:fixed;right:0;top:45%;z-index:2147483647;border:0;background:#2563eb;color:#fff;padding:12px 10px;border-radius:8px 0 0 8px;box-shadow:0 8px 24px rgba(15,23,42,.24);font-size:13px;font-weight:800;cursor:pointer;writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg)}
      .exit{position:fixed;right:14px;bottom:14px;z-index:2147483647;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:999px;padding:8px 11px;box-shadow:0 8px 24px rgba(15,23,42,.16);font-size:12px;font-weight:700;cursor:pointer}
      .bar{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;box-shadow:0 12px 30px rgba(15,23,42,.22)}
      .overlay{position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:rgba(37,99,235,.04)}
      .outline{position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2563eb;background:rgba(37,99,235,.08);border-radius:4px}
      .pin{position:fixed;z-index:2147483647;transform:translate(-50%,-50%);pointer-events:none}
      .pin:before{content:"";position:absolute;left:50%;top:50%;width:42px;height:42px;border-radius:999px;background:rgba(37,99,235,.22);transform:translate(-50%,-50%);animation:ping 1.5s infinite}
      .pin span{position:relative;display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:#2563eb;border:3px solid white;color:white;font-size:11px;font-weight:900;box-shadow:0 4px 16px rgba(37,99,235,.45)}
      .pinLabel{position:fixed;z-index:2147483647;transform:translate(16px,-50%);max-width:240px;border-radius:7px;background:#1d4ed8;color:white;padding:7px 10px;font-size:12px;font-weight:800;box-shadow:0 12px 24px rgba(37,99,235,.3);pointer-events:none}
      @keyframes ping{0%{opacity:.75;transform:translate(-50%,-50%) scale(.7)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.9)}}
      .modal{position:fixed;right:22px;bottom:22px;z-index:2147483647;width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden;color:#111827}
      .modal header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #eef2f7}
      .modal h2{margin:0;font-size:14px;font-weight:900}
      .modal button.close{border:0;background:transparent;font-size:20px;color:#64748b;cursor:pointer}
      .form{padding:14px 16px;display:grid;gap:10px}
      input,textarea,select{width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:9px 10px;font-size:13px;color:#111827;background:#fff}
      textarea{min-height:110px;resize:vertical}
      .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 16px 16px}
      .status{font-size:12px;color:#64748b}
      .error{color:#dc2626}.success{color:#15803d}
      .submit{border:0;background:#2563eb;color:#fff;border-radius:7px;padding:9px 13px;font-size:13px;font-weight:900;cursor:pointer}
      @media(max-width:520px){.tab{top:auto;right:14px;bottom:14px;writing-mode:horizontal-tb;transform:none;border-radius:999px;padding:12px 14px}.exit{left:14px;right:auto}.modal{left:16px;right:16px;bottom:16px;width:auto}.row{grid-template-columns:1fr}}
    `;
    root.appendChild(style);

    let selected = null;
    let selecting = false;
    let hoverEl = null;
    let replayDocPoint = null;
    const consoleErrors = [];
    const originalConsoleError = console.error;
    console.error = function () {
      try {
        consoleErrors.push(Array.from(arguments).map(String).join(' ').slice(0, 2000));
        while (consoleErrors.length > 20) consoleErrors.shift();
      } catch (_) {}
      originalConsoleError.apply(console, arguments);
    };

    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.type = 'button';
    tab.textContent = 'Feedback';
    root.appendChild(tab);

    const exit = document.createElement('button');
    exit.className = 'exit';
    exit.type = 'button';
    exit.textContent = 'Exit feedback mode';
    root.appendChild(exit);

    const outline = document.createElement('div');
    outline.className = 'outline';

    function cleanupSelect() {
      selecting = false;
      root.querySelector('.overlay')?.remove();
      root.querySelector('.bar')?.remove();
      outline.remove();
      document.removeEventListener('mousemove', onMouseMove, true);
    }

    function onMouseMove(event) {
      if (!selecting) return;
      const el = event.target;
      if (!el || el.nodeType !== 1) return;
      hoverEl = el;
      const rect = el.getBoundingClientRect();
      outline.style.left = `${rect.left}px`;
      outline.style.top = `${rect.top}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
    }

    function renderViewportPin(point, label) {
      root.querySelector('.pin')?.remove();
      root.querySelector('.pinLabel')?.remove();
      const pin = document.createElement('div');
      pin.className = 'pin';
      pin.style.left = `${point.x}px`;
      pin.style.top = `${point.y}px`;
      pin.innerHTML = '<span>1</span>';
      root.appendChild(pin);
      if (label) {
        const pinLabel = document.createElement('div');
        pinLabel.className = 'pinLabel';
        pinLabel.textContent = label;
        pinLabel.style.left = `${point.x}px`;
        pinLabel.style.top = `${point.y}px`;
        root.appendChild(pinLabel);
      }
    }

    function updateReplayPin() {
      if (!replayDocPoint) return;
      const viewportPoint = {
        x: replayDocPoint.x - window.scrollX,
        y: replayDocPoint.y - window.scrollY,
      };
      renderViewportPin(viewportPoint, 'Saved feedback location');
    }

    function renderModal() {
      root.querySelector('.modal')?.remove();
      const modal = document.createElement('form');
      modal.className = 'modal';
      modal.innerHTML = `
        <header><h2>Give feedback</h2><button class="close" type="button">&times;</button></header>
        <div class="form">
          <textarea name="comment" required maxlength="5000" placeholder="Type your comment"></textarea>
          <div class="row"><input name="name" maxlength="120" placeholder="Name optional" /><input name="email" type="email" maxlength="180" placeholder="Email optional" /></div>
          <select name="priority"><option value="medium">Medium priority</option><option value="low">Low priority</option><option value="high">High priority</option><option value="urgent">Urgent priority</option></select>
        </div>
        <div class="actions"><span class="status">Screenshot will be captured on submit.</span><button class="submit" type="submit">Submit</button></div>
      `;
      modal.querySelector('.close').addEventListener('click', () => {
        modal.remove();
        root.querySelector('.pin')?.remove();
        root.querySelector('.pinLabel')?.remove();
      });
      modal.addEventListener('submit', submitFeedback);
      root.appendChild(modal);
      modal.querySelector('textarea')?.focus();
    }

    function startSelecting() {
      selecting = true;
      const overlay = document.createElement('button');
      overlay.className = 'overlay';
      overlay.type = 'button';
      overlay.setAttribute('aria-label', 'Place feedback pin');
      overlay.addEventListener('click', (event) => {
        const target = hoverEl || document.elementFromPoint(event.clientX, event.clientY);
        const rect = target?.getBoundingClientRect?.() || null;
        selected = {
          x: event.clientX,
          y: event.clientY,
          documentX: event.clientX + window.scrollX,
          documentY: event.clientY + window.scrollY,
          scrollX: window.scrollX || window.pageXOffset || 0,
          scrollY: window.scrollY || window.pageYOffset || 0,
          selector: target ? getCssSelector(target) : null,
          elementText: target?.innerText?.trim?.().slice(0, 500) || target?.textContent?.trim?.().slice(0, 500) || null,
          elementOffsetX: rect ? event.clientX - rect.left : null,
          elementOffsetY: rect ? event.clientY - rect.top : null,
          elementWidth: rect ? rect.width : null,
          elementHeight: rect ? rect.height : null,
        };
        cleanupSelect();
        renderViewportPin(selected);
        renderModal();
      });
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.textContent = 'Click the page area to leave feedback';
      root.appendChild(overlay);
      root.appendChild(bar);
      root.appendChild(outline);
      document.addEventListener('mousemove', onMouseMove, true);
    }

    async function submitFeedback(event) {
      event.preventDefault();
      if (!selected) return;
      const form = event.currentTarget;
      const status = form.querySelector('.status');
      const button = form.querySelector('.submit');
      const formData = new FormData(form);
      const comment = String(formData.get('comment') || '').trim();
      if (!comment) return;
      const title = comment.split('\n')[0].slice(0, 120) || 'Website feedback';

      button.disabled = true;
      status.textContent = 'Capturing screenshot...';
      const screenshot = await captureScreenshot();
      status.textContent = 'Submitting feedback...';

      const payload = {
        projectToken: config.projectToken,
        reviewToken: config.reviewToken || config.projectToken,
        title,
        description: comment,
        comment,
        pageUrl: window.location.href,
        pagePath: window.location.pathname + window.location.search,
        pageTitle: document.title || null,
        selector: selected.selector,
        elementText: selected.elementText,
        x: selected.x,
        y: selected.y,
        elementOffsetX: selected.elementOffsetX,
        elementOffsetY: selected.elementOffsetY,
        elementWidth: selected.elementWidth,
        elementHeight: selected.elementHeight,
        scrollX: selected.scrollX,
        scrollY: selected.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        screenshot,
        browser: browserName(),
        os: osName(),
        device: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        userAgent: navigator.userAgent,
        consoleErrors,
        priority: String(formData.get('priority') || 'medium'),
        reporterName: String(formData.get('name') || '').trim() || null,
        reporterEmail: String(formData.get('email') || '').trim() || null,
      };

      try {
        const response = await fetch(`${config.apiOrigin}/api/public/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Submit failed');
        status.className = 'status success';
        status.textContent = 'Feedback submitted.';
        button.textContent = 'Done';
        window.setTimeout(() => form.remove(), 1200);
      } catch (_) {
        button.disabled = false;
        status.className = 'status error';
        status.textContent = 'Could not submit. Try again.';
      }
    }

    async function showSavedTaskPin(taskId) {
      try {
        const response = await fetch(`${config.apiOrigin}/api/public/tasks/${taskId}`);
        if (!response.ok) return;
        const task = await response.json();
        let docX = Number(task.x) + Number(task.scrollX || 0);
        let docY = Number(task.y) + Number(task.scrollY || 0);

        if (task.selector) {
          let target = null;
          try {
            target = document.querySelector(task.selector);
          } catch (_) {
            target = null;
          }
          const rect = target?.getBoundingClientRect?.();
          if (rect) {
            const offsetX = task.elementOffsetX !== null && task.elementOffsetX !== undefined ? Number(task.elementOffsetX) : rect.width / 2;
            const offsetY = task.elementOffsetY !== null && task.elementOffsetY !== undefined ? Number(task.elementOffsetY) : rect.height / 2;
            docX = rect.left + window.scrollX + offsetX;
            docY = rect.top + window.scrollY + offsetY;
          }
        }

        replayDocPoint = { x: docX, y: docY };
        window.scrollTo({ left: Math.max(0, Number(task.scrollX || 0)), top: Math.max(0, docY - window.innerHeight / 2), behavior: 'smooth' });
        window.setTimeout(updateReplayPin, 250);
        window.addEventListener('scroll', updateReplayPin, { passive: true });
        window.addEventListener('resize', updateReplayPin, { passive: true });
      } catch (_) {}
    }

    tab.addEventListener('click', startSelecting);
    exit.addEventListener('click', async () => {
      await removeCurrentConfig();
      host.remove();
      window.__gomegaExtensionFeedbackLoaded = false;
    });

    if (feedbackTaskId) {
      showSavedTaskPin(feedbackTaskId);
    }
  }

  (async function boot() {
    if (installReviewPageBridge()) return;

    if (feedbackRequested && projectTokenFromUrl && apiOriginFromUrl) {
      const config = {
        projectToken: projectTokenFromUrl,
        reviewToken: projectTokenFromUrl,
        apiOrigin: apiOriginFromUrl,
        websiteUrl: window.location.origin,
      };
      await setCurrentConfig(config);
      init(config);
      return;
    }

    const stored = await getConfigForHostname(window.location.hostname);
    if (stored && (feedbackRequested || stored.projectToken)) init(stored);
  })();
})();
