/**
 * Portable Farsi kashida (کشیده) justification.
 *
 * Opt-in:  <p data-kashida>…</p>
 * Off:     <html data-kashida="off">  or  Kashida.destroy()
 * Drop-in: load this file; no other dependencies.
 *
 * Goal is even justification: kashida fills the line, not word-spacing.
 * Each word still gets at most one join; tatweels are added in priority
 * order until the line is visually full. Wrap is frozen from live layout.
 * Alignment is CSS/HTML, not this script:
 *   [data-kashida]                 justify, last line start/right
 *   [data-kashida-align="center"]  justify, last line centered

 */
(function (root) {
  'use strict';

  var TATWEEL = '\u0640';
  var ZWNJ = '\u200C';
  var SELECTOR = '[data-kashida]';
  var SRC_ATTR = 'data-kashida-src';
  var MAX_PER_JOIN = 5;
  var EPSILON_EM = 0.06;
  var MIN_LAST_WORDS = 4;
  var NBSP = '\u00A0';

  var DUAL = new Set(
    'بتثجحخسشصضطظعغفقکكگلمنهیيئپچ'.split('')
  );
  var SEEN = new Set('سشصض');
  var BEH = new Set('بتثنپ');
  var RA_YA = new Set('ریيى');
  var FINAL_3 = new Set('ةهد');
  var FINAL_4 = new Set('اأإآططلکكگ');
  var FINAL_6 = new Set('ووعقف');
  var ALEF = new Set('اأإآ');

  var observer = null;
  var probe = null;
  var bound = [];
  var raf = 0;

  function isOff() {
    return document.documentElement.getAttribute('data-kashida') === 'off';
  }

  function isTransparent(ch) {
    var c = ch.charCodeAt(0);
    return (c >= 0x064b && c <= 0x065f) || c === 0x0670 || (c >= 0x06d6 && c <= 0x06ed);
  }

  function isDual(ch) {
    return DUAL.has(ch);
  }

  function canReceiveJoin(ch) {
    return isDual(ch) || 'ادذرزژوآأؤإة'.indexOf(ch) !== -1;
  }

  function skipMarks(word, i) {
    while (i < word.length && isTransparent(word.charAt(i))) i++;
    return i;
  }

  function isWordStart(word, i) {
    var k = i - 1;
    while (k >= 0 && isTransparent(word.charAt(k))) k--;
    return k < 0;
  }

  /**
   * Microsoft / IE connection priority. One join per word; equal
   * priority prefers the later join (toward the end of the word).
   * 110 after a user tatweel
   * 100 after initial/medial Seen/Sad
   *  90 before final teh marbuta / heh / dal
   *  80 before final alef / tah / lam / kaf / gaf
   *  70 before medial beh-shape followed by reh / yeh / alef maqsura
   *  60 before final waw / ain / qaf / feh
   *  50 before final of any other connecting letter
   *  20 last resort: any other valid medial join
   */
  function bestJoin(word) {
    var existing = word.lastIndexOf(TATWEEL);
    if (existing !== -1 && existing < word.length - 1) {
      return { index: existing + 1, prio: 110 };
    }

    var best = null;
    var i;
    for (i = 0; i < word.length - 1; i++) {
      var a = word.charAt(i);
      if (isTransparent(a) || a === TATWEEL || a === ZWNJ) continue;
      if (!isDual(a)) continue;

      var j = skipMarks(word, i + 1);
      if (j >= word.length) break;
      var b = word.charAt(j);
      if (b === ZWNJ || b === TATWEEL) continue;
      if (!canReceiveJoin(b)) continue;
      if (a === 'ل' && ALEF.has(b)) continue;

      var k = skipMarks(word, j + 1);
      var bIsFinal = k >= word.length;
      var prio = 0;

      if (SEEN.has(a)) prio = 100;
      else if (bIsFinal && FINAL_3.has(b)) prio = 90;
      else if (bIsFinal && FINAL_4.has(b)) prio = 80;
      else if (BEH.has(a) && RA_YA.has(b) && !isWordStart(word, i)) prio = 70;
      else if (bIsFinal && FINAL_6.has(b)) prio = 60;
      else if (bIsFinal) prio = 50;
      else prio = 20;

      if (!best || prio > best.prio || (prio === best.prio && j >= best.index)) {
        best = { index: j, prio: prio };
      }
    }
    return best;
  }

  function insertTatweel(word, index) {
    return word.slice(0, index) + TATWEEL + word.slice(index);
  }

  function stripLastTatweel(text) {
    var i = text.lastIndexOf(TATWEEL);
    if (i === -1) return text;
    return text.slice(0, i) + text.slice(i + 1);
  }

  function splitWords(text) {
    return String(text || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
  }

  function tidyLine(text) {
    return String(text || '')
      .replace(/[ \t\r\n\f\v]+/g, ' ')
      .replace(/^ | $/g, '');
  }

  function glueTail(text, min) {
    var words = splitWords(text);
    if (!words.length) return '';
    if (words.length <= min) return words.join(NBSP);
    return words.slice(0, -min).join(' ') + ' ' + words.slice(-min).join(NBSP);
  }

  function rebalanceOrphans(lines, min) {
    if (lines.length < 2) return lines;
    var filled = [];
    var i;
    for (i = 0; i < lines.length - 1; i++) {
      filled.push(splitWords(lines[i]));
    }
    var last = splitWords(lines[lines.length - 1]);
    var minKeep = 2;
    var attempts = 0;
    var maxAttempts = filled.length * 16;

    while (last.length < min && attempts++ < maxAttempts) {
      var best = -1;
      var bestLen = minKeep;
      for (i = 0; i < filled.length; i++) {
        if (filled[i].length > bestLen) {
          bestLen = filled[i].length;
          best = i;
        }
      }
      if (best === -1) {
        if (minKeep <= 1) break;
        minKeep = 1;
        continue;
      }
      last.unshift(filled[best].pop());
    }

    for (i = 0; i < filled.length; i++) {
      lines[i] = filled[i].join(' ');
    }
    lines[lines.length - 1] = glueTail(last.join(' '), min);
    return lines.filter(function (line) {
      return splitWords(line).length > 0;
    });
  }

  function copyFont(fromEl, toEl) {
    var cs = getComputedStyle(fromEl);
    toEl.style.font = cs.font;
    toEl.style.fontSize = cs.fontSize;
    toEl.style.fontFamily = cs.fontFamily;
    toEl.style.fontWeight = cs.fontWeight;
    toEl.style.fontStyle = cs.fontStyle;
    toEl.style.letterSpacing = cs.letterSpacing;
    toEl.style.wordSpacing = cs.wordSpacing;
    toEl.style.direction = cs.direction;
    toEl.style.fontFeatureSettings = cs.fontFeatureSettings;
    toEl.style.fontKerning = cs.fontKerning;
    toEl.style.textTransform = cs.textTransform;
  }

  function ensureProbe() {
    if (probe && probe.isConnected) return probe;
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;display:inline-block;pointer-events:none;';
    document.body.appendChild(probe);
    return probe;
  }

  function makeMeasure(el) {
    var p = ensureProbe();
    copyFont(el, p);
    return function measure(str) {
      p.textContent = str || '';
      return p.getBoundingClientRect().width;
    };
  }

  function innerWidth(el) {
    var cs = getComputedStyle(el);
    var pl = parseFloat(cs.paddingLeft) || 0;
    var pr = parseFloat(cs.paddingRight) || 0;
    return el.clientWidth - pl - pr;
  }

  function lineThreshold(el) {
    var cs = getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh) || cs.lineHeight === 'normal') {
      lh = (parseFloat(cs.fontSize) || 16) * 1.2;
    }
    return Math.max(2, lh * 0.35);
  }

  function liveLineCount(el) {
    if (!el.firstChild) return 0;
    var range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects().length || 1;
  }

  function splitLiveLines(el) {
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) {
      var fallback = tidyLine(el.textContent || '');
      return fallback ? [fallback] : [];
    }
    var text = node.data;
    var len = text.length;
    if (!len) return [];

    var threshold = lineThreshold(el);
    var range = document.createRange();
    var lines = [];
    var start = 0;
    var lastTop = null;
    var i;
    for (i = 0; i < len; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      var rects = range.getClientRects();
      if (!rects.length) continue;
      var top = rects[0].top;
      if (lastTop !== null && top - lastTop > threshold) {
        var chunk = tidyLine(text.slice(start, i));
        if (chunk) lines.push(chunk);
        start = i;
      }
      lastTop = top;
    }
    var last = tidyLine(text.slice(start));
    if (last) lines.push(last);
    return lines;
  }

  function fillLine(line, width, measure, epsilon) {
    var limit = width - epsilon;
    var words = line.split(/(\s+)/);

    function ink() {
      return measure(words.join(''));
    }

    if (ink() >= limit) return line;

    var slots = [];
    var i;
    for (i = 0; i < words.length; i++) {
      if (!words[i] || /^\s+$/.test(words[i])) continue;
      var join = bestJoin(words[i]);
      if (join) slots.push({ i: i, prio: join.prio, index: join.index, count: 0 });
    }
    if (!slots.length) return line;

    slots.sort(function (a, b) {
      if (b.prio !== a.prio) return b.prio - a.prio;
      return b.i - a.i;
    });

    var cursor = 0;
    var stalled = 0;
    var guard = 0;
    while (ink() < limit && stalled < slots.length && guard++ < 80) {
      var slot = slots[cursor];
      cursor = (cursor + 1) % slots.length;
      if (slot.count >= MAX_PER_JOIN) {
        stalled++;
        continue;
      }
      var trialWord = insertTatweel(words[slot.i], slot.index);
      var trial = words.slice();
      trial[slot.i] = trialWord;
      if (measure(trial.join('')) > limit) {
        stalled++;
        continue;
      }
      words[slot.i] = trialWord;
      slot.index += 1;
      slot.count += 1;
      stalled = 0;
    }
    return words.join('');
  }

  function applyElement(el) {
    if (isOff()) return;
    var src = el.getAttribute(SRC_ATTR);
    if (!src) {
      src = (el.textContent || '').replace(new RegExp(TATWEEL, 'g'), '').replace(/\s+/g, ' ').trim();
      el.setAttribute(SRC_ATTR, src);
    }
    if (!src) return;

    if (el.clientWidth < 32 || getComputedStyle(el).display === 'none') {
      el.textContent = src;
      return;
    }

    var width = innerWidth(el);
    if (width < 32) {
      el.textContent = src;
      return;
    }

    el.textContent = src;

    var lines = rebalanceOrphans(splitLiveLines(el), MIN_LAST_WORDS);
    if (lines.length < 2) {
      el.textContent = src;
      return;
    }

    var working = lines.join(' ').replace(new RegExp(NBSP, 'g'), ' ');
    working = glueTail(working, MIN_LAST_WORDS);

    var origCount = lines.length;
    var measure = makeMeasure(el);
    var em = parseFloat(getComputedStyle(el).fontSize) || 16;
    var epsilon = Math.max(2, em * EPSILON_EM);

    var out = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      if (i === lines.length - 1) {
        out.push(glueTail(lines[i], MIN_LAST_WORDS));
      } else {
        var filled = fillLine(lines[i], width, measure, epsilon);
        while (measure(filled) > width - 1 && filled.indexOf(TATWEEL) !== -1) {
          filled = stripLastTatweel(filled);
        }
        out.push(filled);
      }
    }

    var text = out.join(' ');
    el.textContent = text;

    var guard = 0;
    while (liveLineCount(el) > origCount && text.indexOf(TATWEEL) !== -1 && guard++ < 24) {
      var cut = -1;
      for (i = 0; i < out.length - 1; i++) {
        if (out[i].indexOf(TATWEEL) !== -1) {
          cut = i;
          break;
        }
      }
      if (cut === -1) break;
      out[cut] = stripLastTatweel(out[cut]);
      text = out.join(' ');
      el.textContent = text;
    }

    if (liveLineCount(el) > origCount) {
      el.textContent = working;
    }
  }

  function onCopy(event) {
    var el = event.currentTarget;
    var src = el.getAttribute(SRC_ATTR);
    if (!src || !event.clipboardData) return;
    event.clipboardData.setData('text/plain', src);
    event.preventDefault();
  }

  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      raf = 0;
      refresh();
    });
  }

  function bind(el) {
    if (el.getAttribute('data-kashida-bound') === '1') return;
    el.setAttribute('data-kashida-bound', '1');
    if (!el.getAttribute(SRC_ATTR)) {
      el.setAttribute(
        SRC_ATTR,
        (el.textContent || '').replace(new RegExp(TATWEEL, 'g'), '').replace(/\s+/g, ' ').trim()
      );
    }
    el.addEventListener('copy', onCopy);
    bound.push(el);
    if (observer) observer.observe(el);
  }

  function refresh() {
    if (isOff()) {
      destroy({ keepOff: true });
      return;
    }
    var i;
    for (i = 0; i < bound.length; i++) applyElement(bound[i]);
  }

  function init(options) {
    options = options || {};
    if (isOff()) return;
    var selector = options.selector || SELECTOR;
    var nodes = document.querySelectorAll(selector);
    if (!observer) {
      observer = new ResizeObserver(schedule);
    }
    var i;
    for (i = 0; i < nodes.length; i++) bind(nodes[i]);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule);
    }
    window.addEventListener('resize', schedule);
    refresh();
  }

  function destroy(opts) {
    opts = opts || {};
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    window.removeEventListener('resize', schedule);
    var i;
    for (i = 0; i < bound.length; i++) {
      var el = bound[i];
      var src = el.getAttribute(SRC_ATTR);
      if (src) el.textContent = src;
      el.style.removeProperty('text-align');
      el.style.removeProperty('text-align-last');
      el.removeEventListener('copy', onCopy);
      el.removeAttribute('data-kashida-bound');
    }
    bound = [];
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
    probe = null;
    if (!opts.keepOff) {
      /* leave data-kashida-src so re-init is cheap */
    }
  }

  var api = { init: init, refresh: refresh, destroy: destroy };
  root.Kashida = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
