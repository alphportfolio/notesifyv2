(() => {
  const STYLE_ID = 'auth-transition-style';
  const OVERLAY_ID = 'auth-transition-overlay';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #auth-transition-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0a0a0a;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #auth-transition-overlay.at-visible {
        opacity: 1;
        pointer-events: all;
      }
      .at-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        opacity: 0;
        transform: translateY(8px);
        transition:
          opacity 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) 0.08s,
          transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) 0.08s;
      }
      #auth-transition-overlay.at-visible .at-inner {
        opacity: 1;
        transform: translateY(0);
      }
      .at-wordmark {
        font-family: 'Instrument Serif', serif;
        font-size: 24px;
        font-weight: 400;
        letter-spacing: -0.02em;
        color: #ffffff;
        margin-bottom: 24px;
        line-height: 1;
      }
      .at-bar-track {
        width: 120px;
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1px;
        overflow: hidden;
        margin-bottom: 18px;
      }
      .at-bar-fill {
        height: 100%;
        width: 0%;
        background: #ffffff;
        border-radius: 1px;
        transition: width 0s;
      }
      .at-bar-fill.at-run {
        width: 100%;
        transition: width 1.0s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .at-status {
        font-family: 'DM Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #666666;
        opacity: 0;
        transition: opacity 0.3s ease 0.3s;
      }
      #auth-transition-overlay.at-visible .at-status {
        opacity: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        #auth-transition-overlay,
        .at-inner,
        .at-bar-fill,
        .at-status {
          transition: none !important;
          animation: none !important;
        }
        .at-bar-fill { width: 100%; }
        .at-status { opacity: 1; }
      }
    `;
    document.head.appendChild(s);
  }

  function createOverlay(statusText) {
    let el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('aria-hidden', 'true');
    // Order: wordmark → bar → status text below the bar
    el.innerHTML = `
      <div class="at-inner">
        <span class="at-wordmark">notesify</span>
        <div class="at-bar-track"><div class="at-bar-fill" id="at-bar-fill"></div></div>
        <span class="at-status">${statusText}</span>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  /**
   * Show a full-screen auth transition overlay.
   * @param {'login'|'logout'} type
   * @returns {Promise<void>} resolves after the animation (~1.1s)
   */
  function showAuthTransition(type) {
    injectStyle();
    const statusText = type === 'login' ? 'logging you in' : 'signing you out';
    const el = createOverlay(statusText);

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add('at-visible');

          // Kick off the progress bar slightly after fade-in starts
          setTimeout(() => {
            const fill = document.getElementById('at-bar-fill');
            if (fill) fill.classList.add('at-run');
          }, 60);

          // Resolve when bar is done — caller then does signOut + redirect
          setTimeout(resolve, 1050);
        });
      });
    });
  }

  // Expose globally so both module and non-module scripts can call it
  window.showAuthTransition = showAuthTransition;
})();
