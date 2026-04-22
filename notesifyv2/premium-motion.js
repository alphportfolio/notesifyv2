(() => {
    if (window.__premiumMotionLoaded) return;
    window.__premiumMotionLoaded = true;

    const doc = document;
    const win = window;
    const reducedMotion = !!(
        win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    function injectStyles() {
        if (doc.getElementById('premium-motion-style')) return;
        const style = doc.createElement('style');
        style.id = 'premium-motion-style';
        style.textContent = `
      :root{
        --pm-ease:cubic-bezier(.22,.61,.36,1);
      }
      .pm-premium-card{
        transition:
          transform .42s var(--pm-ease),
          box-shadow .42s var(--pm-ease),
          border-color .26s ease,
          background .26s ease;
        will-change:transform,box-shadow;
        transform:translateZ(0);
      }
      @media (hover:hover) and (pointer:fine){
        .pm-premium-card:hover{
          transform:translateY(-4px);
          box-shadow:
            0 12px 28px rgba(0,0,0,0.28),
            0 0 0 1px rgba(255,255,255,0.04) inset;
        }
      }
      .pm-parallax{
        transform:translate3d(0,var(--pm-shift,0px),0);
        transition:transform .18s linear;
        will-change:transform;
      }
      @media (prefers-reduced-motion: reduce){
        .pm-premium-card,.pm-parallax{
          transition:none!important;
          animation:none!important;
        }
      }
    `;
        doc.head.appendChild(style);
    }

    function enhanceCards() {
        const selectors = [
            '.prob-card',
            '.feat-card',
            '.step',
            '.pc-row',
            '.plan-card',
            '.login-card',
            '.app-card',
            '.controls-wrap',
            '.notes-panel'
        ];
        selectors.forEach((selector) => {
            doc.querySelectorAll(selector).forEach((el) => el.classList.add('pm-premium-card'));
        });
    }

    function setupParallax() {
        if (reducedMotion) return;
        const nodes = Array.prototype.slice.call(doc.querySelectorAll('[data-pm-parallax]'));
        if (!nodes.length) return;

        const isCoarse = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
        const entries = nodes.map((el) => {
            const baseSpeed = parseFloat(el.getAttribute('data-pm-parallax')) || 12;
            const baseMax = parseFloat(el.getAttribute('data-pm-max')) || 26;
            const speed = isCoarse ? baseSpeed * 0.65 : baseSpeed;
            const max = isCoarse ? baseMax * 0.72 : baseMax;
            el.classList.add('pm-parallax');
            return { el, speed, max };
        });

        let ticking = false;
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        function paint() {
            const vh = win.innerHeight || 1;
            entries.forEach((entry) => {
                const rect = entry.el.getBoundingClientRect();
                if (rect.bottom < -50 || rect.top > vh + 50) return;
                const center = rect.top + rect.height * 0.5;
                const delta = (center - vh * 0.5) / vh;
                const shift = clamp(-delta * entry.speed, -entry.max, entry.max);
                entry.el.style.setProperty('--pm-shift', `${shift.toFixed(2)}px`);
            });
            ticking = false;
        }

        function requestPaint() {
            if (ticking) return;
            ticking = true;
            win.requestAnimationFrame(paint);
        }

        win.addEventListener('scroll', requestPaint, { passive: true });
        win.addEventListener('resize', requestPaint, { passive: true });
        requestPaint();
        win.setTimeout(requestPaint, 420);
    }

    function init() {
        injectStyles();
        enhanceCards();
        setupParallax();
        // Page transitions removed — page-loader.js handles all loading animations
    }

    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();