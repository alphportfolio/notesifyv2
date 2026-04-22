(() => {
  if (window.__pageLoaderLoaded) return;
  window.__pageLoaderLoaded = true;

  const STYLE_ID    = 'page-loader-style';
  const BODY_HIDE_ID = 'page-loader-body-hide';
  const LOADER_ID   = 'page-loader';
  const FILL_ID     = 'pl-bar-fill';

  let _progress = 0; // 0–100
  let _rafId    = null;

  // ── Immediately hide body from <head> so nothing flashes before the
  //    loader div is inserted.
  function injectBodyHide() {
    if (document.getElementById(BODY_HIDE_ID)) return;
    const s = document.createElement('style');
    s.id = BODY_HIDE_ID;
    s.textContent = `html { background: #0a0a0a; } body { opacity: 0 !important; }`;
    document.head.appendChild(s);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #page-loader {
        position: fixed;
        inset: 0;
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0a0a0a;
        opacity: 1;
        transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: all;
      }
      #page-loader.pl-hidden {
        opacity: 0;
        pointer-events: none;
      }
      .pl-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        transform: translateY(0);
        transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
                    opacity 0.5s ease;
      }
      #page-loader.pl-hidden .pl-inner {
        transform: translateY(-6px);
        opacity: 0;
      }
      .pl-wordmark {
        font-family: 'Instrument Serif', serif;
        font-size: 22px;
        font-weight: 400;
        letter-spacing: -0.02em;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 28px;
        line-height: 1;
      }
      .pl-bar-track {
        width: 120px;
        height: 1px;
        background: rgba(255, 255, 255, 0.07);
        border-radius: 1px;
        overflow: hidden;
      }
      /* No CSS animation — JS drives the width for a smooth feel */
      #pl-bar-fill {
        height: 100%;
        width: 0%;
        background: rgba(255, 255, 255, 0.75);
        border-radius: 1px;
        will-change: width;
      }
      @media (prefers-reduced-motion: reduce) {
        #page-loader, .pl-inner {
          transition: none !important;
        }
        #pl-bar-fill { width: 100% !important; transition: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Asymptotic progress simulation
  //    Each RAF tick: advance by (cap - current) × rate.
  //    Result: fast at start, naturally decelerates → feels alive, never stalls.
  function startProgress() {
    const CAP  = 88;   // natural ceiling while waiting for load
    const RATE = 0.045; // fraction of remaining gap closed per frame

    function tick() {
      const fill = document.getElementById(FILL_ID);
      if (!fill) return;
      const gap  = CAP - _progress;
      _progress += gap * RATE;
      if (_progress > CAP) _progress = CAP;
      fill.style.width = _progress + '%';
      if (_progress < CAP - 0.05) {
        _rafId = requestAnimationFrame(tick);
      }
    }
    _rafId = requestAnimationFrame(tick);
  }

  // ── Snap to 100 % with a short CSS ease, then fade the overlay out
  function completeAndDismiss() {
    cancelAnimationFrame(_rafId);
    const fill = document.getElementById(FILL_ID);
    const el   = document.getElementById(LOADER_ID);
    if (!fill || !el) return;

    // Quick ease to 100 %
    fill.style.transition = 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
    fill.style.width = '100%';

    // After the bar reaches 100 %, fade the whole overlay out
    setTimeout(() => {
      el.classList.add('pl-hidden');
      setTimeout(() => el.remove(), 560);
    }, 220);
  }

  function injectLoader() {
    if (document.getElementById(LOADER_ID)) return;
    const el = document.createElement('div');
    el.id = LOADER_ID;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="pl-inner">
        <span class="pl-wordmark">notesify</span>
        <div class="pl-bar-track"><div id="${FILL_ID}"></div></div>
      </div>
    `;
    document.body.insertBefore(el, document.body.firstChild);

    // Loader now covers the page — reveal body
    document.body.style.opacity = '';
    const hideStyle = document.getElementById(BODY_HIDE_ID);
    if (hideStyle) hideStyle.remove();

    // Begin simulated progress immediately
    startProgress();
  }

  function init() {
    injectStyle();
    injectLoader();

    if (document.readyState === 'complete') {
      setTimeout(completeAndDismiss, 80);
    } else {
      window.addEventListener('load', () => setTimeout(completeAndDismiss, 80), { once: true });
    }
  }

  // ── Entry point — runs from <head>
  injectBodyHide();
  injectStyle();

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }

  // ── bfcache restore — clean up any leftover loader
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      cancelAnimationFrame(_rafId);
      const el = document.getElementById(LOADER_ID);
      if (el) el.remove();
      document.body.style.opacity = '';
      const hideStyle = document.getElementById(BODY_HIDE_ID);
      if (hideStyle) hideStyle.remove();
    }
  });
})();