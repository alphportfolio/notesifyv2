/**
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