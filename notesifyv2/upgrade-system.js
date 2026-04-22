/**
 * upgrade-system.js
 * Context-aware dynamic plan upgrade system.
 */

const UpgradeSystem = {
  // ── Mock User System ───────────────────────────────────────────────────
  // Change these values to test different states.
  userData: {
    plan: "starter", // "starter", "basic", "plus", "pro"
    usedCharacters: 3600,
    dailyLimit: 4000
  },

  planLadder: ["starter", "basic", "plus", "pro"],

  initStyles: function () {
    if (document.getElementById('upgrade-system-styles')) return;
    const style = document.createElement('style');
    style.id = 'upgrade-system-styles';
    style.textContent = `
        .upg-cta-container {
          font-family: 'DM Sans', sans-serif;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
          transition: all 0.3s ease;
        }
        .upg-cta-container.warning {
          background: rgba(254, 188, 46, 0.04);
          border-color: rgba(254, 188, 46, 0.2);
        }
        .upg-cta-container.critical {
          background: rgba(255, 95, 87, 0.05);
          border-color: rgba(255, 95, 87, 0.3);
          box-shadow: 0 0 15px rgba(255, 95, 87, 0.1);
          animation: upg-pulse 3s infinite ease-in-out;
        }
        @keyframes upg-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 95, 87, 0.1); }
          50% { box-shadow: 0 0 25px rgba(255, 95, 87, 0.2); }
        }
        .upg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .upg-plan-badge {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .upg-msg {
          font-size: 12px;
          color: #aaa;
        }
        .upg-cta-container.warning .upg-msg {
          color: #febc2e;
        }
        .upg-cta-container.critical .upg-msg {
          color: #ff5f57;
          font-weight: 500;
          margin-bottom: 10px;
        }
        .upg-btn {
          display: block;
          width: 100%;
          text-align: center;
          background: #fff;
          color: #000;
          font-weight: 500;
          font-size: 12px;
          padding: 8px;
          border-radius: 5px;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .upg-btn:hover {
          background: #e0e0e0;
          transform: translateY(-1px);
        }
        .upg-pro-msg {
          font-size: 11px;
          color: #888;
          font-style: italic;
        }
      `;
    document.head.appendChild(style);
  },

  /**
   * Generates the dynamic plan CTA HTML based on usage.
   * @param {string} userPlan - "starter", "basic", "plus", "pro"
   * @param {number} usedCharacters 
   * @param {number} dailyLimit 
   * @returns {string} HTML string
   */
  renderPlanCTA: function (userPlan, usedCharacters, dailyLimit) {
    this.initStyles();

    userPlan = (userPlan || "starter").toLowerCase();
    const percent = dailyLimit > 0 ? (usedCharacters / dailyLimit) : 0;
    const planIdx = this.planLadder.indexOf(userPlan);
    const nextPlan = planIdx >= 0 && planIdx < this.planLadder.length - 1 ? this.planLadder[planIdx + 1] : null;

    // Format plan name nicely
    const formatName = (p) => p.charAt(0).toUpperCase() + p.slice(1);

    // State 4: Pro (Highest Plan)
    if (userPlan === "pro" || !nextPlan) {
      return `
          <div class="upg-cta-container">
            <div class="upg-header">
              <span class="upg-plan-badge">${formatName(userPlan)} Plan</span>
            </div>
            <div class="upg-pro-msg">You're on the highest plan. Need more? Contact us.</div>
          </div>
        `;
    }

    // State 1: Normal (< 70%)
    if (percent < 0.70) {
      return `
          <div class="upg-cta-container">
            <div class="upg-header">
              <span class="upg-plan-badge">${formatName(userPlan)} Plan</span>
            </div>
            <div class="upg-msg">Enjoying Notesify? Upgrade anytime.</div>
          </div>
        `;
    }

    // State 2: Warning (70 - 90%)
    if (percent >= 0.70 && percent < 0.90) {
      return `
          <div class="upg-cta-container warning">
            <div class="upg-header">
              <span class="upg-plan-badge">${formatName(userPlan)} Plan</span>
            </div>
            <div class="upg-msg">You're nearing your daily limit.</div>
          </div>
        `;
    }

    // State 3: Critical (90 - 99%)
    if (percent >= 0.90 && percent < 1) {
      return `
          <div class="upg-cta-container critical">
            <div class="upg-header">
              <span class="upg-plan-badge">${formatName(userPlan)} Plan</span>
            </div>
            <div class="upg-msg">Almost out of characters!</div>
            <a href="pricing.html#${nextPlan}" class="upg-btn">Upgrade to ${formatName(nextPlan)}</a>
          </div>
        `;
    }

    // State 4: Exhausted (>= 100%)
    return `
        <div class="upg-cta-container critical">
          <div class="upg-header">
            <span class="upg-plan-badge">${formatName(userPlan)} Plan</span>
          </div>
          <div class="upg-msg" style="color: #ff5f57; font-weight: bold;">You've run out of characters!</div>
          <a href="pricing.html#${nextPlan}" class="upg-btn">Upgrade to ${formatName(nextPlan)}</a>
        </div>
      `;
  }
};

// Expose globally so inline scripts (like in app.html) can use it easily
window.UpgradeSystem = UpgradeSystem;
