#!/usr/bin/env node
/**
 * Notesify DSR Integration Patcher v2
 * Run: node apply-dsr-patch.js app.html
 * Output: app.html is updated in-place (original backed up to app.html.bak)
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'app.html';
if (!fs.existsSync(target)) {
  console.error(`File not found: ${target}`);
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');
const backup = target + '.bak';
fs.writeFileSync(backup, html);
console.log(`Backed up original to ${backup}`);

let changed = 0;

function inject(label, find, replacement, mode) {
  if (!html.includes(find)) {
    console.error(`FAIL [${label}]: anchor not found:\n  ${find.slice(0,80)}`);
    return false;
  }
  if (mode === 'before') {
    html = html.replace(find, replacement + '\n' + find);
  } else if (mode === 'replace') {
    html = html.replace(find, replacement);
  } else if (mode === 'replace_block') {
    // Replace from find to matching closing brace
    const start = html.indexOf(find);
    let depth = 0, i = start, foundOpen = false;
    while (i < html.length) {
      if (html[i] === '{') { depth++; foundOpen = true; }
      else if (html[i] === '}') { depth--; if (foundOpen && depth === 0) { i++; break; } }
      i++;
    }
    html = html.slice(0, start) + replacement + html.slice(i);
  }
  console.log(`OK  [${label}]`);
  changed++;
  return true;
}


/* ── PATCH 1: DSR CSS ── */
inject(
  'DSR CSS',
  `    ::-webkit-scrollbar {`,
  `
    /* ── DSR Structure Preview Modal ─────────────────────────────── */
    #dsr-modal-backdrop {
      position: fixed; inset: 0; z-index: 8500;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.78); backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      opacity: 0; pointer-events: none;
      transition: opacity .28s cubic-bezier(.4,0,.2,1)
    }
    #dsr-modal-backdrop.visible { opacity: 1; pointer-events: all }
    .dsr-modal {
      background: #111; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px; padding: 0; width: 100%; max-width: 600px;
      margin: 24px; display: flex; flex-direction: column;
      max-height: 80vh; overflow: hidden;
      animation: lgModalUp .3s cubic-bezier(.22,.61,.36,1) both
    }
    .dsr-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0
    }
    .dsr-modal-title {
      font-family: "DM Mono", monospace; font-size: 11px;
      letter-spacing: .1em; text-transform: uppercase; color: var(--text2)
    }
    .dsr-modal-stats {
      font-family: "DM Mono", monospace; font-size: 10px; color: var(--text3); letter-spacing: .04em
    }
    .dsr-modal-body { overflow-y: auto; padding: 24px; flex: 1 }
    .dsr-modal-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0
    }
    .dsr-heading {
      font-family: "Instrument Serif", serif; font-size: 20px; font-weight: 400;
      color: var(--white); letter-spacing: -.01em; margin: 20px 0 8px;
      padding-bottom: 6px; border-bottom: 1px solid var(--line)
    }
    .dsr-heading:first-child { margin-top: 0 }
    .dsr-paragraph {
      font-family: "DM Sans", sans-serif; font-size: 14px; line-height: 1.75;
      color: var(--text); margin: 0 0 14px
    }
    .dsr-list, ol.dsr-list {
      font-family: "DM Sans", sans-serif; font-size: 14px; line-height: 1.75;
      color: var(--text); margin: 0 0 14px; padding-left: 22px
    }
    .dsr-list li { margin-bottom: 4px }
    .dsr-uncertain {
      opacity: 0.72; border-left: 2px solid rgba(254,188,46,0.4); padding-left: 10px
    }
    .dsr-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .08em;
      text-transform: uppercase; padding: 3px 8px; border-radius: 2px; margin-bottom: 16px;
      background: rgba(255,255,255,0.05); border: 1px solid var(--line); color: var(--text3)
    }
    .btn-dsr-cancel {
      font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: .05em;
      text-transform: uppercase; padding: 10px 18px; border-radius: 2px;
      border: 1px solid var(--line2); background: transparent; color: var(--text2); cursor: pointer;
      transition: all .15s
    }
    .btn-dsr-cancel:hover { color: var(--text); border-color: rgba(255,255,255,0.25) }
    .btn-dsr-confirm {
      font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: .05em;
      text-transform: uppercase; padding: 10px 18px; border-radius: 2px;
      background: var(--accent); color: #000; border: none; cursor: pointer;
      transition: background .15s, transform .1s;
      display: inline-flex; align-items: center; gap: 8px
    }
    .btn-dsr-confirm:hover { background: var(--accent2); transform: translateY(-1px) }
    .dsr-edit-hint {
      font-family: "DM Mono", monospace; font-size: 10px; color: var(--text3);
      letter-spacing: .04em; flex: 1
    }
`,
  'before'
);

/* ── PATCH 2: DSR Modal HTML ── */
inject(
  'DSR Modal HTML',
  `  <div class="loader-wrap" id="loader">`,
  `<!-- DSR Structure Preview Modal -->
  <div id="dsr-modal-backdrop">
    <div class="dsr-modal">
      <div class="dsr-modal-header">
        <span class="dsr-modal-title">Document structure detected</span>
        <span class="dsr-modal-stats" id="dsr-stats"></span>
      </div>
      <div class="dsr-modal-body" id="dsr-modal-body"></div>
      <div class="dsr-modal-footer">
        <span class="dsr-edit-hint">Edit the text tab if anything looks wrong</span>
        <button class="btn-dsr-cancel" onclick="closeDsrModal()">Edit first</button>
        <button class="btn-dsr-confirm" onclick="confirmDsrAndStart()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>Start Dictation
        </button>
      </div>
    </div>
  </div>\n`,
  'before'
);

/* ── PATCH 3: DSR Module JS ── */
inject(
  'DSR Module',
  `    /* ── App variables ── */`,
  `/**
 * Notesify DSR — Document Structure Recognition
 * Version 2.0 — Backend-portable, mixed OCR optimized
 *
 * Zero DOM dependencies. Works identically in:
 *   - Browser <script> tag  (exposes window.DSR)
 *   - Node.js require()     (module.exports = DSR)
 *   - Node.js import        (export default DSR)
 *   - Python via PyExecJS   (call DSR.parse / DSR.flatten)
 *
 * Usage:
 *   const blocks  = DSR.parse(rawOcrText, options);
 *   const ttsText = DSR.flatten(blocks);
 *   const html    = DSR.renderHTML(blocks);   // browser only — safe to call server-side too
 *
 * Output block schema:
 *   {
 *     type:       "heading" | "paragraph" | "list" | "numbered_list",
 *     content:    string,          // non-empty for heading/paragraph
 *     items:      string[],        // non-empty for list/numbered_list
 *     confidence: number,          // 0.0 – 1.0
 *     fallback:   boolean,         // true when rule confidence was below threshold
 *     rawLines:   string[]         // original OCR lines that formed this block
 *   }
 */

(function (root, factory) {
  /* UMD wrapper — works in browser globals, CommonJS (Node), and AMD */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();                  // Node.js / CommonJS
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);                         // AMD / RequireJS
  } else {
    root.DSR = factory();                        // Browser global
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════════
     DEFAULT CONFIG
     All tunable values in one place. Pass overrides via options arg.
  ════════════════════════════════════════════════════════════════ */
  var DEFAULTS = {
    /* Confidence below this → fallback to paragraph */
    confidenceThreshold: 0.58,

    /* Heading heuristic weights (must sum to a sensible total) */
    headingWeights: {
      singleLine:     2.0,   // block is exactly one line — strong signal
      twoLines:       0.8,   // two lines — weak signal
      shortText:      1.0,   // total chars < maxHeadingChars
      noTerminalPunct:1.2,   // no . ! ? at end
      fewWords:       0.8,   // word count <= maxHeadingWords
      allCaps:        1.5,   // ALL CAPS block
      titleCase:      0.8,   // >= titleCaseRatio% words capitalized
      colonEnd:       0.6,   // ends with colon (e.g. "Key Concepts:")
    },
    headingWeightTotal:    7.9,   // denominator for heading score
    headingThreshold:      0.54,  // heading score / total >= this
    maxHeadingChars:       90,    // chars (generous for OCR drift)
    maxHeadingWords:       12,
    titleCaseRatio:        0.62,  // fraction of long words that start uppercase

    /* List detection */
    bulletRatioThreshold:  0.5,   // fraction of lines that must be bullet-like
    numRatioThreshold:     0.45,

    /* Paragraph merge: merge adjacent paragraphs? */
    mergeParagraphs:       true,

    /* OCR noise tolerance — strip these patterns from line starts before classifying */
    ocrNoisePatterns: [
      /^[|Il!]{1,3}\s/,         // OCR misreads of bullet characters
      /^\s*[o0O]\s+/,            // Circle OCR'd as o/0/O
      /^['"]\s*/,                // Leading stray quote
    ],
  };

  /* ════════════════════════════════════════════════════════════════
     STAGE 1 — CLEAN
     Normalize encoding artifacts from Vision API output.
     Mixed OCR specific: handle partial word splits, stray pipes,
     broken Unicode, and double-spaced handwriting output.
  ════════════════════════════════════════════════════════════════ */
  function clean(raw) {
    return raw
      /* Line endings */
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      /* Unicode normalization */
      .replace(/\u00a0|\u202f|\u2009/g, ' ')    // various non-breaking spaces
      .replace(/[\u2018\u2019\u0060\u00b4]/g, "'")
      .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
      .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u00ae\u2122]/g, '')            // ® ™ — common OCR garbage

      /* Handwriting OCR often produces extra spaces inside words */
      /* Heuristic: collapse spaces between single letters (e.g. "t h e" → "the") */
      .replace(/\b([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b/g, '$1$2$3')
      .replace(/\b([A-Za-z]) ([A-Za-z])\b/g, '$1$2')

      /* Horizontal whitespace */
      .replace(/[ \t]+/g, ' ')

      /* Collapse 3+ blank lines → 2 */
      .replace(/\n{3,}/g, '\n\n')

      /* Remove stray page numbers (common in textbook screenshots) */
      /* Pattern: line that is ONLY digits, optionally with spaces */
      .replace(/^\s*\d{1,4}\s*$/mg, '')

      .replace(/^\s+|\s+$/g, '');
  }

  /* ════════════════════════════════════════════════════════════════
     STAGE 2 — SPLIT INTO RAW BLOCKS
     Each blank-line-separated chunk = one classification unit.
     Also handles single-newline-separated content (common in printed
     OCR where paragraphs have internal line breaks).
  ════════════════════════════════════════════════════════════════ */
  function splitBlocks(text) {
    return text
      .split(/\n{2,}/)
      .map(function (c) { return c.trim(); })
      .filter(function (c) { return c.length > 1; }); // skip lone chars
  }

  /* ════════════════════════════════════════════════════════════════
     STAGE 3 — CLASSIFY
     Rules tested in priority order. Returns classification object.
  ════════════════════════════════════════════════════════════════ */

  /* Compiled regexes — defined once for performance */
  var REGEXES = {
    /* Standard Unicode bullets + common OCR misreads */
    bullet: /^[\u2022\u2023\u2024\u2043\u25aa\u25cf\u25e6\u2666\u2715\u2713\u2714\u25ba\u27a4\u2192\-\*\u2013\u2014][ \t]/,
    /* "a)" "B." "(a)" style alpha lists */
    alphaList: /^(\([a-zA-Z]\)|[a-zA-Z][.)]) /,
    /* "1." "2)" "i." "iv)" numbered lists */
    numList: /^(\d{1,3}[.)]\s|[ivxIVX]{1,6}[.)]\s|\(\d{1,3}\)\s)/,
    /* Sentence-terminal punctuation */
    sentEnd: /[.!?…]\s*$/,
    /* All-caps line (allow digits, spaces, basic punctuation) */
    allCaps: /^[A-Z0-9\s\-\u2013:,!?()&/]{3,}$/,
    /* Lines that are almost certainly OCR noise (not real content) */
    pureNoise: /^[\-_=*#~]{3,}$|^\s*[|\\/]{1,3}\s*$/,
  };

  function isNoiseOnlyLine(line, cfg) {
    if (REGEXES.pureNoise.test(line)) return true;
    for (var i = 0; i < cfg.ocrNoisePatterns.length; i++) {
      if (cfg.ocrNoisePatterns[i].test(line) && line.replace(cfg.ocrNoisePatterns[i], '').trim().length < 3) {
        return true;
      }
    }
    return false;
  }

  function isBulletLine(line) {
    var t = line.trim();
    return REGEXES.bullet.test(t) || REGEXES.alphaList.test(t);
  }

  function isNumLine(line) {
    return REGEXES.numList.test(line.trim());
  }

  function titleCaseRatio(text, minWordLen, threshold) {
    var words = text.split(/\s+/).filter(function (w) { return w.length >= minWordLen; });
    if (!words.length) return 0;
    var capped = words.filter(function (w) { return /^[A-Z]/.test(w); }).length;
    return capped / words.length;
  }

  function classifyBlock(raw, cfg) {
    var allLines = raw.split('\n').map(function (l) { return l.trim(); });
    /* Filter out pure noise lines before classification */
    var lines = allLines.filter(function (l) {
      return l.length > 0 && !isNoiseOnlyLine(l, cfg);
    });
    if (!lines.length) return null;

    var full = lines.join(' ');

    /* ── NUMBERED LIST ─────────────────────────────────────────── */
    var numCount = lines.filter(isNumLine).length;
    if (numCount >= 1) {
      var numRatio = numCount / lines.length;
      if (numRatio >= cfg.numRatioThreshold) {
        return {
          type: 'numbered_list',
          rawLines: lines,
          confidence: Math.min(0.65 + numRatio * 0.35, 1.0)
        };
      }
    }

    /* ── BULLET LIST ───────────────────────────────────────────── */
    var bulletCount = lines.filter(isBulletLine).length;
    if (bulletCount >= 1) {
      var bulletRatio = bulletCount / lines.length;
      if (bulletRatio >= cfg.bulletRatioThreshold) {
        return {
          type: 'list',
          rawLines: lines,
          confidence: Math.min(0.65 + bulletRatio * 0.35, 1.0)
        };
      }
    }

    /* ── HEADING ───────────────────────────────────────────────── */
    var w = cfg.headingWeights;
    var score = 0;

    if (lines.length === 1)                                    score += w.singleLine;
    else if (lines.length === 2)                               score += w.twoLines;
    if (full.length <= cfg.maxHeadingChars)                    score += w.shortText;
    if (!REGEXES.sentEnd.test(full))                           score += w.noTerminalPunct;
    if (full.split(/\s+/).filter(Boolean).length <= cfg.maxHeadingWords) score += w.fewWords;
    if (REGEXES.allCaps.test(full.trim()))                     score += w.allCaps;
    else if (titleCaseRatio(full, 3, cfg.titleCaseRatio) >= cfg.titleCaseRatio) score += w.titleCase;
    if (/:\s*$/.test(full))                                    score += w.colonEnd;

    var headConf = score / cfg.headingWeightTotal;
    if (headConf >= cfg.headingThreshold && lines.length <= 2) {
      return {
        type: 'heading',
        rawLines: lines,
        confidence: Math.min(headConf, 1.0)
      };
    }

    /* ── PARAGRAPH (default) ───────────────────────────────────── */
    return {
      type: 'paragraph',
      rawLines: lines,
      confidence: 0.75
    };
  }

  /* ════════════════════════════════════════════════════════════════
     STAGE 4 — CONFIDENCE THRESHOLD
     Low-confidence non-paragraph types fall back to paragraph.
  ════════════════════════════════════════════════════════════════ */
  function applyFallback(block, cfg) {
    if (block.type !== 'paragraph' && block.confidence < cfg.confidenceThreshold) {
      return {
        type: 'paragraph',
        rawLines: block.rawLines,
        confidence: 0.50,
        fallback: true
      };
    }
    return block;
  }

  /* ════════════════════════════════════════════════════════════════
     STAGE 5 — BUILD OUTPUT BLOCKS
     Strip prefixes, join lines, return public schema.
  ════════════════════════════════════════════════════════════════ */
  var STRIP_BULLET = /^[\u2022\u2023\u2024\u2043\u25aa\u25cf\u25e6\u2666\u2715\u2713\u2714\u25ba\u27a4\u2192\-\*\u2013\u2014][ \t]+/;
  var STRIP_ALPHA  = /^(\([a-zA-Z]\)|[a-zA-Z][.)]) +/;
  var STRIP_NUM    = /^(\d{1,3}[.)]\s*|[ivxIVX]{1,6}[.)]\s*|\(\d{1,3}\)\s*)/;

  function stripBulletPrefix(line) {
    return line.replace(STRIP_BULLET, '').replace(STRIP_ALPHA, '').trim();
  }
  function stripNumPrefix(line) {
    return line.replace(STRIP_NUM, '').trim();
  }

  function buildBlock(classified) {
    var lines = classified.rawLines;
    var type  = classified.type;
    var base  = {
      type:       type,
      content:    '',
      items:      [],
      confidence: classified.confidence,
      fallback:   classified.fallback || false,
      rawLines:   lines
    };

    if (type === 'heading') {
      base.content = lines.join(' ').trim();
      return base;
    }
    if (type === 'list') {
      base.items = lines.map(stripBulletPrefix).filter(function (s) { return s.length > 0; });
      return base;
    }
    if (type === 'numbered_list') {
      base.items = lines.map(stripNumPrefix).filter(function (s) { return s.length > 0; });
      return base;
    }
    /* paragraph */
    base.content = lines.join(' ').trim();
    return base;
  }

  /* ════════════════════════════════════════════════════════════════
     STAGE 6 — MERGE ADJACENT SAME-TYPE BLOCKS
     - Adjacent lists of same type → merge items[]
     - Adjacent paragraphs → merge content (common in printed OCR)
     - Headings never merge
  ════════════════════════════════════════════════════════════════ */
  function mergeBlocks(blocks, cfg) {
    if (!blocks.length) return [];
    var out = [assign({}, blocks[0])];

    for (var i = 1; i < blocks.length; i++) {
      var prev = out[out.length - 1];
      var curr = blocks[i];

      /* Merge same-type lists */
      if (prev.type === curr.type &&
          (curr.type === 'list' || curr.type === 'numbered_list') &&
          curr.items.length) {
        prev.items = prev.items.concat(curr.items);
        prev.rawLines = prev.rawLines.concat(curr.rawLines);
        prev.confidence = Math.min(prev.confidence, curr.confidence);
        continue;
      }

      /* Merge adjacent paragraphs (configurable) */
      if (cfg.mergeParagraphs &&
          prev.type === 'paragraph' && curr.type === 'paragraph') {
        prev.content = (prev.content + ' ' + curr.content).trim();
        prev.rawLines = prev.rawLines.concat(curr.rawLines);
        prev.confidence = Math.min(prev.confidence, curr.confidence);
        continue;
      }

      out.push(assign({}, curr));
    }
    return out;
  }

  /* ════════════════════════════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════════════════════════════ */

  /**
   * parse(rawOcrText, options?) → block[]
   *
   * @param {string} rawOcrText  - Raw string from Vision API / Google Cloud OCR
   * @param {object} [options]   - Overrides for DEFAULTS config
   * @returns {Array}            - Array of structured block objects
   */
  function parse(rawOcrText, options) {
    if (!rawOcrText || typeof rawOcrText !== 'string') return [];
    var cfg = merge(DEFAULTS, options || {});
    var cleaned    = clean(rawOcrText);
    var rawBlocks  = splitBlocks(cleaned);
    var classified = rawBlocks.map(function (b) { return classifyBlock(b, cfg); }).filter(Boolean);
    var withFallback = classified.map(function (b) { return applyFallback(b, cfg); });
    var built      = withFallback.map(buildBlock);
    var merged     = mergeBlocks(built, cfg);
    return merged;
  }

  /**
   * flatten(blocks) → string
   *
   * Converts structured blocks back to a single TTS-ready plain text string.
   * - Headings: appends period so TTS engine pauses after them
   * - Lists: reads as natural sentences ("1. First item. 2. Second item.")
   * - Paragraphs: joined as-is
   *
   * @param {Array} blocks  - Output of parse()
   * @returns {string}      - Clean text for the TTS engine
   */
  function flatten(blocks) {
    if (!blocks || !blocks.length) return '';
    return blocks
      .map(function (b) {
        if (b.type === 'heading') {
          /* Append period only if heading doesn't already end with punctuation */
          var c = b.content.trim();
          return REGEXES.sentEnd.test(c) ? c : c + '.';
        }
        if (b.type === 'paragraph') {
          return b.content;
        }
        if (b.type === 'list') {
          return b.items.join('. ') + (b.items.length ? '.' : '');
        }
        if (b.type === 'numbered_list') {
          return b.items.map(function (item, i) {
            return (i + 1) + '. ' + item;
          }).join('. ') + (b.items.length ? '.' : '');
        }
        return b.content || b.items.join('. ');
      })
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * renderHTML(blocks) → string
   *
   * Returns an HTML string for the DSR preview modal.
   * Low-confidence blocks get class "dsr-uncertain".
   * Safe to call server-side — no DOM reads/writes.
   *
   * @param {Array} blocks  - Output of parse()
   * @returns {string}      - HTML string
   */
  function renderHTML(blocks) {
    if (!blocks || !blocks.length) {
      return '<p class="dsr-paragraph">No content detected.</p>';
    }
    return blocks.map(function (b) {
      var uncertain = b.confidence < 0.75 ? ' dsr-uncertain' : '';
      if (b.type === 'heading') {
        return '<h3 class="dsr-heading' + uncertain + '">' + esc(b.content) + '</h3>';
      }
      if (b.type === 'paragraph') {
        return '<p class="dsr-paragraph' + uncertain + '">' + esc(b.content) + '</p>';
      }
      if (b.type === 'list') {
        return '<ul class="dsr-list' + uncertain + '">' +
          b.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') +
          '</ul>';
      }
      if (b.type === 'numbered_list') {
        return '<ol class="dsr-list' + uncertain + '">' +
          b.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') +
          '</ol>';
      }
      return '<p class="dsr-paragraph">' + esc(b.content || b.items.join(', ')) + '</p>';
    }).join('\n');
  }

  /**
   * hasStructure(rawOcrText, options?) → boolean
   *
   * Quick check: does this text contain any detectable non-paragraph structure?
   * Use this to decide whether to show the preview modal.
   *
   * @param {string} rawOcrText
   * @returns {boolean}
   */
  function hasStructure(rawOcrText, options) {
    var blocks = parse(rawOcrText, options);
    return blocks.some(function (b) {
      return b.type === 'heading' || b.type === 'list' || b.type === 'numbered_list';
    });
  }

  /* ════════════════════════════════════════════════════════════════
     FUTURE: AI FALLBACK HOOK
     When you move to backend, call this to identify blocks that
     need AI classification and batch-send them to OpenAI/Claude.

     Usage (Node.js backend route):
       const flagged = DSR.getFallbackBlocks(blocks);
       // POST flagged to OpenAI with prompt:
       // "Classify each block as: heading | paragraph | list | numbered_list"
       // Then call DSR.applyAIResults(blocks, aiResults) to patch the types.
  ════════════════════════════════════════════════════════════════ */

  /**
   * getFallbackBlocks(blocks) → Array of {index, block}
   * Returns blocks that were low-confidence and need AI review.
   */
  function getFallbackBlocks(blocks) {
    return blocks
      .map(function (b, i) { return { index: i, block: b }; })
      .filter(function (entry) { return entry.block.fallback === true; });
  }

  /**
   * applyAIResults(blocks, aiResults) → block[]
   * Patches AI-classified types back into the block array.
   * aiResults: Array of {index, type} from your AI endpoint.
   */
  function applyAIResults(blocks, aiResults) {
    var patched = blocks.map(function (b, i) { return assign({}, b); });
    (aiResults || []).forEach(function (result) {
      if (result && typeof result.index === 'number' && patched[result.index]) {
        patched[result.index].type = result.type;
        patched[result.index].aiClassified = true;
        patched[result.index].fallback = false;
      }
    });
    return patched;
  }

  /* ── Tiny utils (no lodash dependency) ─────────────────────── */
  function assign(target, source) {
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
    return target;
  }
  function merge(defaults, overrides) {
    var out = assign({}, defaults);
    for (var key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        if (key === 'headingWeights' && typeof overrides[key] === 'object') {
          out.headingWeights = assign(assign({}, defaults.headingWeights), overrides[key]);
        } else {
          out[key] = overrides[key];
        }
      }
    }
    return out;
  }
  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* Public surface */
  return {
    parse:              parse,
    flatten:            flatten,
    renderHTML:         renderHTML,
    hasStructure:       hasStructure,
    getFallbackBlocks:  getFallbackBlocks,
    applyAIResults:     applyAIResults,
    DEFAULTS:           DEFAULTS         // expose for runtime config inspection
  };

}));
\n    /* ── App variables ── */`,
  'replace'
);

/* ── PATCH 4: Replace handleStart() ── */
inject(
  'handleStart()',
  `    async function handleStart() {`,
  `    async function handleStart() {
      var rawText = document.getElementById('notes-input').value.trim();
      if (!rawText) { toast('Please enter some text first.'); return; }
      if (!window._voxlyAuthed) { showLoginGate(); return; }

      /* ── CHARACTER USAGE CHECK ──────────────────────────────── */
      if (window.NotesifyUsage) {
        var charCount = window.NotesifyUsage.countCharacters(rawText);
        if (window.NotesifyUsage.isReady()) {
          var check = window.NotesifyUsage.canUseCharacters(charCount);
          if (!check.allowed) {
            var limit = check.limit, used = check.used, msg;
            if (used >= limit) {
              msg = '\u26a0\ufe0f You\u2019ve reached your daily limit (' + limit + ' characters). Resets at midnight or upgrade your plan.';
              showToast(msg, 'toast-limit-reached', 6000);
            } else {
              var remaining = check.remaining;
              msg = '\u270d\ufe0f Too many characters for today. You can use up to ' + remaining + ' more character' + (remaining !== 1 ? 's' : '') + ' \u2014 shorten your text or try again tomorrow.';
              showToast(msg, 'toast-limit-over', 6000);
            }
            var ta = document.getElementById('notes-input');
            if (ta) { ta.classList.remove('limit-shake'); void ta.offsetWidth; ta.classList.add('limit-shake'); ta.addEventListener('animationend', function () { ta.classList.remove('limit-shake'); }, { once: true }); }
            return;
          }
        }
        var startBtns = document.querySelectorAll('.btn-start');
        startBtns.forEach(function (b) { b.disabled = true; });
        try { await window.NotesifyUsage.applyCharacterUsage(charCount); }
        catch (err) { console.warn('[Notesify] Usage write failed (offline?):', err); }
        finally { startBtns.forEach(function (b) { b.disabled = false; }); }
      }
      /* ────────────────────────────────────────────────────────── */

      /* DSR: show structure preview if text has headings or lists */
      if (DSR.hasStructure(rawText)) {
        showDsrModal(rawText);
        return;
      }
      /* Plain text → go straight to dictation */
      setFlyingWordsEnabled(false);
      await _doStartDictation(rawText);
      setTimeout(function () { if (window.DictationCoach) window.DictationCoach.maybeStart(); }, 180);
    }`,
  'replace_block'
);

/* ── PATCH 5: _doStartDictation + modal helpers ── */
inject(
  '_doStartDictation + modal',
  `    function renderWords(words, sentMap) {`,
  `
    /* ── _doStartDictation ──────────────────────────────────────────
       Single entry point that ALL code paths call to begin dictation.
       Applies DSR flattening then boots the player.
       Keeping this separate from handleStart means the restore flow
       (restoreSavedSession) still works without going through DSR.
    ─────────────────────────────────────────────────────────────── */
    async function _doStartDictation(rawText) {
      var blocks  = DSR.parse(rawText);
      var ttsText = DSR.flatten(blocks);
      /* Safety: if flattening produced nothing, fall back to raw */
      if (!ttsText || !ttsText.trim()) ttsText = rawText;
      setFlyingWordsEnabled(false);
      await _bootPlayer(ttsText, null);
      setTimeout(function () { if (window.DictationCoach) window.DictationCoach.maybeStart(); }, 180);
    }

    /* ── DSR Preview Modal helpers ──────────────────────────────── */
    var _dsrPendingText = null;

    function showDsrModal(rawText) {
      _dsrPendingText = rawText;
      var blocks = DSR.parse(rawText);
      var body   = document.getElementById('dsr-modal-body');
      var stats  = document.getElementById('dsr-stats');
      if (!body) return;
      /* Build stats summary */
      var counts = {};
      blocks.forEach(function (b) { counts[b.type] = (counts[b.type] || 0) + 1; });
      var parts = [];
      if (counts.heading)       parts.push(counts.heading + ' heading' + (counts.heading > 1 ? 's' : ''));
      if (counts.paragraph)     parts.push(counts.paragraph + ' para' + (counts.paragraph > 1 ? 's' : ''));
      if (counts.list)          parts.push(counts.list + ' list' + (counts.list > 1 ? 's' : ''));
      if (counts.numbered_list) parts.push(counts.numbered_list + ' ordered list' + (counts.numbered_list > 1 ? 's' : ''));
      if (stats) stats.textContent = parts.join(' \u00b7 ');
      body.innerHTML = '<div class="dsr-badge">Preview \u2014 how your document will be read aloud</div>'
                     + DSR.renderHTML(blocks);
      document.getElementById('dsr-modal-backdrop').classList.add('visible');
    }

    function closeDsrModal() {
      document.getElementById('dsr-modal-backdrop').classList.remove('visible');
      _dsrPendingText = null;
    }

    async function confirmDsrAndStart() {
      if (!_dsrPendingText) return;
      var text = _dsrPendingText;
      closeDsrModal();
      setFlyingWordsEnabled(false);
      await _doStartDictation(text);
      setTimeout(function () { if (window.DictationCoach) window.DictationCoach.maybeStart(); }, 180);
    }

    document.getElementById('dsr-modal-backdrop').addEventListener('click', function (e) {
      if (e.target === this) closeDsrModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('dsr-modal-backdrop').classList.contains('visible')) {
        closeDsrModal();
      }
    });
    function renderWords(words, sentMap) {`,
  'replace'
);


fs.writeFileSync(target, html);
console.log(`\nDone! ${changed}/5 patches applied.`);
if (changed < 5) {
  console.log('WARNING: Some patches failed. Check anchors above.');
  console.log(`Original preserved at ${backup}`);
} else {
  console.log('All patches applied successfully.');
}