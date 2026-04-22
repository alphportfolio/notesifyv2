/**
 * auth-navbar.js — Notesify / Voxly
 * Shared Firebase auth state → navbar updater.
 * Import this as a module on every page.
 *
 * Usage (add just before </body> on each page):
 *
 *   <script type="module" src="auth-navbar.js"></script>
 *
 * The script auto-detects the existing .nav-right element and
 * rewrites its contents based on auth state.
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// Dynamically load upgrade-system.js if not present
if (!window.UpgradeSystem) {
  const script = document.createElement('script');
  script.src = 'upgrade-system.js';
  document.head.appendChild(script);
}
// ── Firebase config (single source of truth) ─────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAu4C5LIwJACYgXT8_o5ufKv8Zhrl4ZSY0",
  authDomain:        "notesify-c716b.firebaseapp.com",
  databaseURL:       "https://notesify-c716b-default-rtdb.firebaseio.com",
  projectId:         "notesify-c716b",
  storageBucket:     "notesify-c716b.firebasestorage.app",
  messagingSenderId: "379172502803",
  appId:             "1:379172502803:web:a383644ee97dd363402ee6",
  measurementId:     "G-7WYHHWN9W9"
};

// Re-use existing app if already initialised (e.g. on login.html)
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── Inject global styles (once) ───────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('auth-navbar-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-navbar-styles';
  style.textContent = `
    /* ── Auth Avatar Button ── */
    .nav-avatar-btn {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.12);
      background: #1a1a1a;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      outline: none;
      flex-shrink: 0;
    }
    .nav-avatar-btn:hover,
    .nav-avatar-btn[aria-expanded="true"] {
      border-color: rgba(255,255,255,0.25);
      background: #242424;
      transform: translateY(-1px);
    }
    .nav-avatar-btn svg {
      width: 18px;
      height: 18px;
      color: #888;
      display: block;
      transition: color 0.2s;
    }
    .nav-avatar-btn:hover svg,
    .nav-avatar-btn[aria-expanded="true"] svg {
      color: #fff;
    }

    /* ── Dropdown Panel ── */
    .nav-dropdown {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 260px;
      max-width: calc(100vw - 32px);
      background: rgba(18, 18, 18, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      box-shadow: 
        0 4px 6px -1px rgba(0, 0, 0, 0.2), 
        0 20px 45px -10px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255, 255, 255, 0.03) inset;
      z-index: 9999;
      overflow: hidden;
      transform-origin: top right;
      transform: scale(0.96) translateY(-8px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
                  opacity 0.2s ease-out;
      padding: 6px;
    }
    .nav-dropdown.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    /* dropdown header — email */
    .nav-dropdown-header {
      padding: 14px 14px 12px;
    }
    .nav-dropdown-email {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      color: #777;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 5px;
    }
    .nav-dropdown-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #fff;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
    }
    .nav-dropdown-status::before {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #28c840;
      box-shadow: 0 0 8px rgba(40, 200, 64, 0.4);
    }

    /* ── Usage Section ── */
    .nav-usage-section {
      padding: 12px 14px;
      margin: 2px 6px 8px;
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.03);
    }
    .nav-usage-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .nav-usage-label {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
    }
    .nav-usage-value {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      color: #aaa;
    }
    .nav-usage-bar-track {
      height: 3px;
      background: rgba(255,255,255,0.08);
      border-radius: 2px;
      overflow: hidden;
    }
    .nav-usage-bar-fill {
      height: 100%;
      background: #fff;
      width: 0%;
      border-radius: 2px;
      transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* dropdown items */
    .nav-dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 400;
      color: #999;
      background: transparent;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      text-align: left;
      text-decoration: none;
      transition: all 0.15s ease;
      margin-bottom: 1px;
    }
    .nav-dropdown-item:hover {
      background: rgba(255,255,255,0.06);
      color: #fff;
      transform: translateX(2px);
    }
    .nav-dropdown-item.danger:hover {
      background: rgba(255,95,87,0.1);
      color: #ff5f57;
    }
    .nav-dropdown-item svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
      opacity: 0.5;
      transition: opacity 0.15s;
    }
    .nav-dropdown-item:hover svg { opacity: 0.9; }

    .nav-dropdown-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 6px 8px;
    }

    /* wrapper so dropdown can be positioned relative */
    .nav-avatar-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    @media (max-width: 768px) {
      .nav-dropdown {
        position: fixed;
        top: 66px;
        right: 16px;
        width: calc(100vw - 32px);
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Build the user icon + dropdown HTML ──────────────────────────────────────
function buildAvatarMenu(user) {
  const wrap = document.createElement('div');
  wrap.className = 'nav-avatar-wrap';

  const btn = document.createElement('button');
  btn.className = 'nav-avatar-btn';
  btn.setAttribute('aria-label', 'Account menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`;

  const dropdown = document.createElement('div');
  dropdown.className = 'nav-dropdown';
  const email = user.email || '';
  
  // Setup usage numbers (placeholder for future real data)
  // Setup usage numbers using the mock user system
  const currentUsage = window.UpgradeSystem ? window.UpgradeSystem.userData.usedCharacters : 0; 
  const totalLimit = window.UpgradeSystem ? window.UpgradeSystem.userData.dailyLimit : 500;
  const usagePercent = Math.min((currentUsage / totalLimit) * 100, 100);

  dropdown.innerHTML = `
    <div class="nav-dropdown-header">
      <div class="nav-dropdown-email" title="${email}">${email}</div>
      <div class="nav-dropdown-status">Signed in</div>
    </div>
    
    <!-- Dynamic Plan Upgrade CTA -->
    <div style="padding: 0 6px;" id="nav-dropdown-upgrade-cta">
      ${window.UpgradeSystem ? window.UpgradeSystem.renderPlanCTA(window.UpgradeSystem.userData.plan, currentUsage, totalLimit) : ''}
    </div>

    <div class="nav-usage-section">
      <div class="nav-usage-info">
        <span class="nav-usage-label">Daily Limit</span>
        <span class="nav-usage-value">${currentUsage} / ${totalLimit} used</span>
      </div>
      <div class="nav-usage-bar-track">
        <div class="nav-usage-bar-fill" id="nav-usage-fill" style="width: 0%;"></div>
      </div>
    </div>

    <div class="nav-dropdown-divider"></div>

    <a href="app.html" class="nav-dropdown-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      Open App
    </a>
    
    <div class="nav-dropdown-divider"></div>

    <button class="nav-dropdown-item danger" id="nav-signout-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Log Out
    </button>`;

  wrap.appendChild(btn);
  wrap.appendChild(dropdown);

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      dropdown.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      
      // Animate progress bar slightly after opening
      setTimeout(() => {
        const fill = dropdown.querySelector('#nav-usage-fill');
        if (fill) fill.style.width = usagePercent + '%';
      }, 100);
    }
  });

  // Close on outside click
  document.addEventListener('click', closeAllDropdowns);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });

  function closeAllDropdowns() {
    document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.nav-avatar-btn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  // Sign out
  dropdown.querySelector('#nav-signout-btn').addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Sign out error:', err);
    }
  });

  return wrap;
}

// ── Main: update navbar based on auth state ───────────────────────────────────
export function updateNavbar(user) {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  if (user && user.emailVerified) {
    // ── LOGGED IN: replace login btn with avatar icon ──────────────
    // Keep the "Start Writing" / CTA button if it exists
    const ctaBtn = navRight.querySelector('.btn-nav, .btn-nav-cta');
    navRight.innerHTML = '';
    navRight.appendChild(buildAvatarMenu(user));
    if (ctaBtn) navRight.appendChild(ctaBtn);
  } else {
    // ── LOGGED OUT: ensure login button is present ─────────────────
    if (!navRight.querySelector('.btn-nav-login')) {
      const loginBtn = document.createElement('a');
      loginBtn.href = 'login.html';
      loginBtn.className = 'btn-nav-login';
      loginBtn.textContent = 'Log In';
      navRight.insertBefore(loginBtn, navRight.firstChild);
    }
    // Remove any stale avatar
    navRight.querySelectorAll('.nav-avatar-wrap').forEach(el => el.remove());
  }
}

// ── Auto-run on every page ─────────────────────────────────────────────────────
injectStyles();
onAuthStateChanged(auth, user => updateNavbar(user));