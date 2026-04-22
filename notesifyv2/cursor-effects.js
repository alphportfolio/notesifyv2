/* ═══════════════════════════════════════════
   cursor-effects.js — Custom magnetic cursor
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer  = window.matchMedia('(pointer: fine)').matches;

  /* Only activate on desktop with a real pointer */
  if (!isFinePointer || prefersReduced) return;

  /* ── Inject styles immediately (head is available) ── */
  const style = document.createElement('style');
  style.textContent = `
    body.hm-active,
    body.hm-active a,
    body.hm-active button { cursor: none !important; }

    /* Lagging ring */
    #hm-cursor {
      position: fixed;
      top: 0; left: 0;
      width: 32px; height: 32px;
      border: 1px solid rgba(255,255,255,0.55);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99997;
      transform: translate(-50%, -50%) scale(1);
      transition:
        transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
        border-color 0.2s ease,
        opacity 0.3s ease;
      will-change: transform;
      opacity: 0;
    }
    #hm-cursor.hm-visible { opacity: 1; }
    #hm-cursor.hm-hover   { transform: translate(-50%, -50%) scale(1.65); border-color: rgba(255,255,255,0.9); }
    #hm-cursor.hm-click   { transform: translate(-50%, -50%) scale(0.82); }

    /* Snappy centre dot */
    #hm-dot {
      position: fixed;
      top: 0; left: 0;
      width: 5px; height: 5px;
      background: rgba(255,255,255,0.95);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99998;
      transform: translate(-50%, -50%);
      will-change: transform;
      transition: opacity 0.3s ease;
      opacity: 0;
    }
    #hm-dot.hm-visible { opacity: 1; }
  `;
  document.head.appendChild(style);

  /* ── Wait for body before injecting DOM elements ── */
  function init() {
    /* ── DOM elements ── */
    const dot  = document.createElement('div'); dot.id  = 'hm-dot';
    const ring = document.createElement('div'); ring.id = 'hm-cursor';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('hm-active');

    /* ── State ── */
    let cursorX = -300, cursorY = -300;
    let ringX   = -300, ringY   = -300;
    let visible = false;

    /* ── Mouse tracking ── */
    document.addEventListener('mousemove', e => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      dot.style.transform = `translate(calc(-50% + ${cursorX}px), calc(-50% + ${cursorY}px))`;
      if (!visible) {
        visible = true;
        dot.classList.add('hm-visible');
        ring.classList.add('hm-visible');
      }
    });

    document.addEventListener('mouseleave', () => {
      visible = false;
      dot.classList.remove('hm-visible');
      ring.classList.remove('hm-visible');
    });

    /* ── Magnetic ring animation (lerp) ── */
    (function animateRing() {
      ringX += (cursorX - ringX) * 0.12;
      ringY += (cursorY - ringY) * 0.12;
      ring.style.transform = `translate(calc(-50% + ${ringX}px), calc(-50% + ${ringY}px))`;
      requestAnimationFrame(animateRing);
    })();

    /* ── Interactive element reactions ── */
    function bindHover(el) {
      el.addEventListener('mouseenter', () => ring.classList.add('hm-hover'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hm-hover'));
    }
    document.querySelectorAll('a, button').forEach(bindHover);

    /* Watch for dynamically added elements (e.g. nav avatar after auth) */
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('a, button')) bindHover(node);
        node.querySelectorAll?.('a, button').forEach(bindHover);
      }));
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('mousedown', () => ring.classList.add('hm-click'));
    document.addEventListener('mouseup',   () => ring.classList.remove('hm-click'));
  }

  /* Run immediately if body exists, otherwise wait for DOMContentLoaded */
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }

})();
