/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  NOTESIFY — USAGE LIMIT SYSTEM                              ║
 * ║  Modular, future-proof daily usage tracking                  ║
 * ║                                                              ║
 * ║  To plug in backend later:                                   ║
 * ║  - Replace getStoredUsage() / saveStoredUsage() with Firestore║
 * ║  - Replace getCurrentUserPlan() with subscription lookup     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/* ─── 1. PLAN CONFIG ───────────────────────────────────────────
   Central config. Add/change limits here only.
   Later: fetch this from backend or Firebase Remote Config.
──────────────────────────────────────────────────────────────── */
const PLAN_CONFIG = {
    starter: {
        id: 'starter',
        label: 'Starter',
        dailyLimit: 500,    // characters per day
        voices: 'standard',
        active: true,
    },
    basic: {
        id: 'basic',
        label: 'Basic',
        dailyLimit: 1500,
        voices: 'standard',
        active: false,      // not yet wired to payment
    },
    plus: {
        id: 'plus',
        label: 'Plus',
        dailyLimit: 4000,
        voices: 'all',
        active: false,
    },
    pro: {
        id: 'pro',
        label: 'Pro',
        dailyLimit: 10000,
        voices: 'all',
        active: false,
    },
};

/* ─── 2. STORAGE ADAPTER ────────────────────────────────────────
   Swap this out for Firestore / backend later by replacing
   _storageRead() and _storageWrite() only.
──────────────────────────────────────────────────────────────── */
const USAGE_STORAGE_KEY = 'notesify_usage_v2';

function _storageRead() {
    try {
        const raw = localStorage.getItem(USAGE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function _storageWrite(data) {
    try {
        localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
}

/* ─── 3. DATE HELPER ────────────────────────────────────────── */
function _getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ─── 4. PLAN HELPERS ───────────────────────────────────────── */

/**
 * getPlanConfig(planName) → plan object
 * Later: replace with backend plan fetch
 */
function getPlanConfig(planName) {
    return PLAN_CONFIG[planName] || PLAN_CONFIG.starter;
}

/**
 * getCurrentUserPlan() → plan name string
 * Later: replace with Firebase/subscription lookup
 * e.g. return (await getDoc(userRef)).data().plan || 'starter'
 */
function getCurrentUserPlan() {
    // TODO: replace with real subscription data
    return 'starter';
}

/* ─── 5. USAGE STORAGE ─────────────────────────────────────── */

/**
 * getStoredUsage() → { plan, usedToday, dailyLimit, lastResetDate }
 */
function getStoredUsage() {
    const plan = getCurrentUserPlan();
    const config = getPlanConfig(plan);
    const today = _getTodayString();
    const stored = _storageRead();

    if (!stored || stored.lastResetDate !== today) {
        // First visit today — reset
        return {
            plan,
            usedToday: 0,
            dailyLimit: config.dailyLimit,
            lastResetDate: today,
        };
    }

    // If plan changed (e.g. upgrade), update limit
    return {
        plan: stored.plan || plan,
        usedToday: typeof stored.usedToday === 'number' ? stored.usedToday : 0,
        dailyLimit: config.dailyLimit, // always from config, not stored (stays in sync)
        lastResetDate: stored.lastResetDate,
    };
}

/**
 * saveStoredUsage(usageObj)
 * Later: replace body with Firestore updateDoc()
 */
function saveStoredUsage(usageObj) {
    return _storageWrite(usageObj);
}

/* ─── 6. DAILY RESET ───────────────────────────────────────── */

/**
 * resetUsageIfNeeded() → updated usage object
 * Call this on page load and before any dictation check.
 */
function resetUsageIfNeeded() {
    const usage = getStoredUsage();
    const today = _getTodayString();

    if (usage.lastResetDate !== today) {
        const fresh = {
            plan: getCurrentUserPlan(),
            usedToday: 0,
            dailyLimit: getPlanConfig(getCurrentUserPlan()).dailyLimit,
            lastResetDate: today,
        };
        saveStoredUsage(fresh);
        return fresh;
    }

    return usage;
}

/* ─── 7. CHARACTER COUNT ───────────────────────────────────── */

/**
 * countCharacters(text) → integer
 * Counts every character including spaces and punctuation.
 */
function countCharacters(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.length;
}

/* ─── 8. USAGE CHECKS & APPLY ──────────────────────────────── */

/**
 * canUseCharacters(charCount) → { allowed: bool, usage: usageObj, remaining: int }
 */
function canUseCharacters(charCount) {
    const usage = resetUsageIfNeeded();
    const remaining = usage.dailyLimit - usage.usedToday;
    return {
        allowed: charCount <= remaining,
        usage,
        remaining,
        charCount,
    };
}

/**
 * applyCharacterUsage(charCount) → updated usage object
 * Call this only after canUseCharacters() confirms allowed.
 */
function applyCharacterUsage(charCount) {
    const usage = resetUsageIfNeeded();
    usage.usedToday = Math.min(usage.usedToday + charCount, usage.dailyLimit);
    saveStoredUsage(usage);
    updateUsageUI(usage);
    return usage;
}

/* ─── 9. UI UPDATE ─────────────────────────────────────────── */

/**
 * updateUsageUI(usageObj?)
 * Updates all .nav-dd-usage-* elements in the DOM.
 * Call after applyUsage() or on dropdown open.
 */
function updateUsageUI(usageObj) {
    const usage = usageObj || resetUsageIfNeeded();
    const { usedToday, dailyLimit } = usage;
    const remaining = Math.max(0, dailyLimit - usedToday);
    const pct = dailyLimit > 0 ? Math.min(100, (usedToday / dailyLimit) * 100) : 0;

    // Progress bar fill
    document.querySelectorAll('.nav-dd-usage-bar-fill').forEach(el => {
        el.style.width = pct.toFixed(1) + '%';
    });

    // "120 / 500" count label
    document.querySelectorAll('.nav-dd-usage-count').forEach(el => {
        el.textContent = usedToday + ' / ' + dailyLimit;
    });

    // "380 characters remaining today"
    document.querySelectorAll('.nav-dd-usage-sub').forEach(el => {
        el.textContent = remaining + ' character' + (remaining !== 1 ? 's' : '') + ' remaining today';
    });

    // Colour bar red when near limit
    document.querySelectorAll('.nav-dd-usage-bar-fill').forEach(el => {
        el.style.background = pct >= 90 ? '#ff5f57' : pct >= 70 ? '#febc2e' : '#ffffff';
    });
}

/* ─── 10. EXPOSE GLOBALLY ──────────────────────────────────── */
window.NotesifyUsage = {
    getPlanConfig,
    getCurrentUserPlan,
    countCharacters,
    getStoredUsage,
    saveStoredUsage,
    resetUsageIfNeeded,
    canUseCharacters,
    applyCharacterUsage,
    updateUsageUI,
};