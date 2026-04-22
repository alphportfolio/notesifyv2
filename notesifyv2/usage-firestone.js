/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  NOTESIFY — USAGE SYSTEM (Firestore)                         ║
 * ║  ES Module. Import into any page that needs usage tracking.  ║
 * ║  All functions take `db` (Firestore instance) as param 1.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Firestore document path: users/{uid}
 * Fields: usedToday (number), dailyLimit (number), lastReset (YYYY-MM-DD)
 */

import {
  doc, getDoc, setDoc, runTransaction, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const DEFAULT_LIMIT = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function countCharacters(text) {
  return (!text || typeof text !== 'string') ? 0 : text.length;
}

// ── Firestore CRUD ────────────────────────────────────────────────────────────

/**
 * Ensure a user doc exists. Creates with defaults if missing.
 * Returns the current document data.
 */
export async function getOrCreateUserDoc(db, uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const fresh = { usedToday: 0, dailyLimit: DEFAULT_LIMIT, lastReset: todayString() };
  await setDoc(ref, fresh);
  return fresh;
}

/**
 * If lastReset ≠ today, reset usedToday to 0 in Firestore.
 * Returns the up-to-date data object.
 */
export async function resetIfNeeded(db, uid, data) {
  const today = todayString();
  if (data.lastReset === today) return data;
  const reset = { usedToday: 0, lastReset: today, dailyLimit: data.dailyLimit ?? DEFAULT_LIMIT };
  await setDoc(doc(db, 'users', uid), reset, { merge: true });
  return reset;
}

/**
 * Pure synchronous check. Does NOT write to Firestore.
 * Call with the latest cached snapshot data.
 */
export function canUseCharacters(data, newChars) {
  const used  = data?.usedToday  ?? 0;
  const limit = data?.dailyLimit ?? DEFAULT_LIMIT;
  return {
    allowed:   (used + newChars) <= limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Atomically increment usedToday in Firestore.
 * Uses a transaction — safe against race conditions / rapid clicks.
 */
export async function updateUsage(db, uid, newChars) {
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const d     = snap.data();
    const today = todayString();
    const base  = d.lastReset === today ? (d.usedToday ?? 0) : 0;
    const limit = d.dailyLimit ?? DEFAULT_LIMIT;
    tx.update(ref, { usedToday: Math.min(base + newChars, limit), lastReset: today });
  });
}

/**
 * Subscribe to real-time usage updates for a user.
 * `callback` receives the data object on every Firestore write.
 * Returns an unsubscribe function — always call on logout.
 */
export function subscribeToUsage(db, uid, callback) {
  return onSnapshot(
    doc(db, 'users', uid),
    snap  => { if (snap.exists()) callback(snap.data()); },
    err   => console.warn('[Notesify] Usage snapshot error:', err),
  );
}

// ── UI ────────────────────────────────────────────────────────────────────────

/**
 * Update every usage UI element on the page.
 * Safe to call even if elements don't exist on the current page.
 */
export function updateUsageUI(data) {
  const used      = data?.usedToday  ?? 0;
  const limit     = data?.dailyLimit ?? DEFAULT_LIMIT;
  const remaining = Math.max(0, limit - used);
  const pct       = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const barColor  = pct >= 90 ? '#ff5f57' : pct >= 70 ? '#febc2e' : '#ffffff';

  document.querySelectorAll('.nav-dd-usage-bar-fill').forEach(el => {
    el.style.width      = pct.toFixed(1) + '%';
    el.style.background = barColor;
  });
  document.querySelectorAll('.nav-dd-usage-count').forEach(el => {
    el.textContent = `${used} / ${limit}`;
  });
  document.querySelectorAll('.nav-dd-usage-sub').forEach(el => {
    el.textContent = `${remaining} character${remaining !== 1 ? 's' : ''} remaining today`;
  });
  document.querySelectorAll('.usage-inline-fill').forEach(el => {
    el.style.width      = pct.toFixed(1) + '%';
    el.style.background = barColor;
  });
  document.querySelectorAll('.usage-inline-text').forEach(el => {
    el.textContent = `${remaining} / ${limit}`;
  });
}
