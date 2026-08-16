/**
 * Portable Farsi kashida (کشیده) justification.
 *
 * Opt-in:  <p data-kashida>…</p>
 * Off:     <html data-kashida="off">  or  Kashida.destroy()
 *
 * Alignment is CSS, gated by this script:
 *   3+ lines  [data-kashida]                 justify, last line start/right
 *   3+ lines  [data-kashida-align="center"]  justify, last line centered
 *   1–2 lines [data-kashida-skip]            no justify, no tatweels
 */
(function (root) {
  'use strict';

  var TATWEEL = '\u0640';
  var ZWNJ = '\u200C';
  var SELECTOR = '[data-kashida]';
  var SRC_ATTR = 'data-kashida-src';
  var SKIP_ATTR = 'data-kashida-skip';
  var MAX_PER_JOIN = 5;
  var EPSILON_EM = 0.06;
  var MIN_LAST_WORDS = 4;
  var MIN_LINES = 3;
  var NBSP = '\u00A0';
  var TATWEEL_RE = /\u0640/g;

  var DUAL = new Set('بتثجحخسشصضطظعغفقکكگلمنهیيئپچ'.split(''));
  var SEEN = new Set('سشصض');
  var BEH = new Set('بتثنپ');
  var RA_YA = new Set('ریيى');
  var FINAL_3 = new Set('ةهد');
  var FINAL_4 = new Set('اأإآططلکكگ');
  var FINAL_6 = new Set('ووعقف');
  var ALEF = new Set('اأإآ');

  var observer = null;
  var io = null;
  var probe = null;
  var bound = [];
  var raf = 0;
  var resizeTimer = 0;
  var pending = [];
  var probeFontKey = '';
  var cachedTatweelW = 0;

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

  function ensureProbe() {
    if (probe && probe.isConnected) return probe;
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;display:inline-block;pointer-events:none;';
    document.body.appendChild(probe);
    return probe;
  }

  function makeMeasure(cs) {
    var p = ensureProbe();
    var key =
      cs.font +
      '|' +
      cs.letterSpacing +
      '|' +
      cs.wordSpacing +
      '|' +
      cs.direction +
      '|' +
      cs.fontFeatureSettings;
    if (key !== probeFontKey) {
      p.style.font = cs.font;
      p.style.fontSize = cs.fontSize;
      p.style.fontFamily = cs.fontFamily;
      p.style.fontWeight = cs.fontWeight;
      p.style.fontStyle = cs.fontStyle;
      p.style.letterSpacing = cs.letterSpacing;
      p.style.wordSpacing = cs.wordSpacing;
      p.style.direction = cs.direction;
      p.style.fontFeatureSettings = cs.fontFeatureSettings;
      p.style.fontKerning = cs.fontKerning;
      p.style.textTransform = cs.textTransform;
      probeFontKey = key;
      cachedTatweelW = 0;
    }
    return function measure(str) {
      p.textContent = str || '';
      return p.getBoundingClientRect().width;
    };
  }

  function tatweelWidth(measure) {
    if (cachedTatweelW > 0) return cachedTatweelW;
    var a = measure('سا');
    var b = measure('س' + TATWEEL + 'ا');
    var w = b - a;
    cachedTatweelW = w > 0.5 ? w : 4;
    return cachedTatweelW;
  }

  function innerWidthFrom(el, cs) {
    var pl = parseFloat(cs.paddingLeft) || 0;
    var pr = parseFloat(cs.paddingRight) || 0;
    return el.clientWidth - pl - pr;
  }

  function lineThresholdFrom(cs) {
    var lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh) || cs.lineHeight === 'normal') {
      lh = (parseFloat(cs.fontSize) || 16) * 1.2;
    }
    return Math.max(2, lh * 0.35);
  }

  function isUnmeasurable(el, cs) {
    if (el.clientWidth < 32) return true;
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    if (typeof el.checkVisibility === 'function') {
      try {
        if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return true;
      } catch (err) {}
    }
    return false;
  }

  function liveLineCount(el) {
    if (!el.firstChild) return 0;
    var range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects().length || 1;
  }

  function splitLiveLines(el, threshold) {
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) {
      var fallback = tidyLine(el.textContent || '');
      return fallback ? [fallback] : [];
    }
    var text = node.data;
    if (!text.length) return [];

    var range = document.createRange();
    var lines = [];
    var start = 0;
    var lastTop = null;
    var re = /\S+/g;
    var m;
    while ((m = re.exec(text))) {
      var end = m.index + m[0].length;
      range.setStart(node, end - 1);
      range.setEnd(node, end);
      var rects = range.getClientRects();
      if (!rects.length) continue;
      var top = rects[0].top;
      if (lastTop !== null && top - lastTop > threshold) {
        var chunk = tidyLine(text.slice(start, m.index));
        if (chunk) lines.push(chunk);
        start = m.index;
      }
      lastTop = top;
    }
    var last = tidyLine(text.slice(start));
    if (last) lines.push(last);
    return lines;
  }

  function fillLine(line, limit, measure, unit) {
    var words = line.split(/(\s+)/);

    function joined() {
      return words.join('');
    }

    var now = measure(joined());
    if (now >= limit || unit < 0.5) return line;

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

    var maxAdds = Math.min(
      Math.floor((limit - now) / unit),
      slots.length * MAX_PER_JOIN,
      24
    );
    if (maxAdds <= 0) return line;

    var cursor = 0;
    var added = 0;
    var stalled = 0;
    while (added < maxAdds && stalled < slots.length) {
      var slot = slots[cursor];
      cursor = (cursor + 1) % slots.length;
      if (slot.count >= MAX_PER_JOIN) {
        stalled++;
        continue;
      }
      words[slot.i] = insertTatweel(words[slot.i], slot.index);
      slot.index += 1;
      slot.count += 1;
      added++;
      stalled = 0;
    }

    var filled = joined();
    var w = measure(filled);
    var guard = 0;
    while (w > limit && filled.indexOf(TATWEEL) !== -1 && guard++ < 16) {
      filled = stripLastTatweel(filled);
      w = measure(filled);
    }
    return filled;
  }

  function restoreSrc(el, src) {
    if (el.textContent !== src) el.textContent = src;
    el._kashidaW = 0;
  }

  function finishPlain(el, src, width) {
    restoreSrc(el, src);
    el.setAttribute(SKIP_ATTR, '');
    el._kashidaW = width;
    el.setAttribute('data-kashida-ready', '1');
  }

  function applyElement(el) {
    if (isOff()) return;
    if (el._kashidaInView === false) return;

    var src = el.getAttribute(SRC_ATTR);
    if (!src) {
      src = (el.textContent || '').replace(TATWEEL_RE, '').replace(/\s+/g, ' ').trim();
      el.setAttribute(SRC_ATTR, src);
    }
    if (!src) return;

    var cs = getComputedStyle(el);
    if (isUnmeasurable(el, cs)) {
      restoreSrc(el, src);
      return;
    }

    var width = innerWidthFrom(el, cs);
    if (width < 32) {
      restoreSrc(el, src);
      return;
    }
    if (el._kashidaW === width && el.getAttribute('data-kashida-ready') === '1') return;

    el.textContent = src;

    var natural = splitLiveLines(el, lineThresholdFrom(cs));
    if (natural.length < MIN_LINES) {
      finishPlain(el, src, width);
      return;
    }

    var lines = rebalanceOrphans(natural, MIN_LAST_WORDS);
    if (lines.length < MIN_LINES) {
      finishPlain(el, src, width);
      return;
    }

    var working = glueTail(lines.join(' ').replace(/\u00A0/g, ' '), MIN_LAST_WORDS);
    var origCount = lines.length;
    var measure = makeMeasure(cs);
    var em = parseFloat(cs.fontSize) || 16;
    var limit = width - Math.max(2, em * EPSILON_EM);
    var unit = tatweelWidth(measure);

    var out = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      if (i === lines.length - 1) {
        out.push(glueTail(lines[i], MIN_LAST_WORDS));
      } else {
        out.push(fillLine(lines[i], limit, measure, unit));
      }
    }

    var text = out.join(' ');
    el.textContent = text;

    var guard = 0;
    while (liveLineCount(el) > origCount && text.indexOf(TATWEEL) !== -1 && guard++ < 16) {
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

    el.removeAttribute(SKIP_ATTR);
    el._kashidaW = width;
    el.setAttribute('data-kashida-ready', '1');
  }

  function onCopy(event) {
    var el = event.currentTarget;
    var src = el.getAttribute(SRC_ATTR);
    if (!src || !event.clipboardData) return;
    event.clipboardData.setData('text/plain', src);
    event.preventDefault();
  }

  function queue(el) {
    if (!el || el._kashidaQueued) return;
    el._kashidaQueued = 1;
    pending.push(el);
    if (!raf) {
      raf = requestAnimationFrame(flush);
    }
  }

  function flush() {
    raf = 0;
    var list = pending;
    pending = [];
    var i;
    for (i = 0; i < list.length; i++) {
      list[i]._kashidaQueued = 0;
      applyElement(list[i]);
    }
  }

  function onResize(entries) {
    var i;
    for (i = 0; i < entries.length; i++) {
      var el = entries[i].target;
      el._kashidaW = 0;
      el.removeAttribute('data-kashida-ready');
      queue(el);
    }
  }

  function onWindowResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var i;
      for (i = 0; i < bound.length; i++) {
        bound[i]._kashidaW = 0;
        bound[i].removeAttribute('data-kashida-ready');
        if (bound[i]._kashidaInView !== false) queue(bound[i]);
      }
    }, 140);
  }

  function onIntersect(entries) {
    var i;
    for (i = 0; i < entries.length; i++) {
      var el = entries[i].target;
      el._kashidaInView = entries[i].isIntersecting;
      if (entries[i].isIntersecting) queue(el);
    }
  }

  function bind(el) {
    if (el.getAttribute('data-kashida-bound') === '1') return;
    el.setAttribute('data-kashida-bound', '1');
    if (!el.getAttribute(SRC_ATTR)) {
      el.setAttribute(
        SRC_ATTR,
        (el.textContent || '').replace(TATWEEL_RE, '').replace(/\s+/g, ' ').trim()
      );
    }
    el.addEventListener('copy', onCopy);
    bound.push(el);
    if (observer) observer.observe(el);
    if (io) io.observe(el);
    else queue(el);
  }

  function targetsFrom(scope) {
    if (!scope) return bound;
    var out = [];
    var i;
    for (i = 0; i < bound.length; i++) {
      if (scope === bound[i] || (scope.contains && scope.contains(bound[i]))) {
        out.push(bound[i]);
      }
    }
    return out;
  }

  function refresh(scope) {
    if (isOff()) {
      destroy({ keepOff: true });
      return;
    }
    var list = targetsFrom(scope);
    var i;
    for (i = 0; i < list.length; i++) {
      list[i]._kashidaW = 0;
      list[i].removeAttribute('data-kashida-ready');
      queue(list[i]);
    }
  }

  function init(options) {
    options = options || {};
    if (isOff()) return;
    var selector = options.selector || SELECTOR;
    var nodes = document.querySelectorAll(selector);
    if (!observer) observer = new ResizeObserver(onResize);
    if (!io && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(onIntersect, {
        root: null,
        rootMargin: '40% 0px',
        threshold: 0.01
      });
    }
    var i;
    for (i = 0; i < nodes.length; i++) bind(nodes[i]);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        refresh();
      });
    }
    window.addEventListener('resize', onWindowResize, { passive: true });
  }

  function destroy(opts) {
    opts = opts || {};
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    pending = [];
    window.clearTimeout(resizeTimer);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (io) {
      io.disconnect();
      io = null;
    }
    window.removeEventListener('resize', onWindowResize);
    var i;
    for (i = 0; i < bound.length; i++) {
      var el = bound[i];
      var src = el.getAttribute(SRC_ATTR);
      if (src) el.textContent = src;
      el.style.removeProperty('text-align');
      el.style.removeProperty('text-align-last');
      el.removeEventListener('copy', onCopy);
      el.removeAttribute('data-kashida-bound');
      el.removeAttribute('data-kashida-ready');
      el.removeAttribute(SKIP_ATTR);
      el._kashidaQueued = 0;
      el._kashidaW = 0;
      el._kashidaInView = undefined;
    }
    bound = [];
    probeFontKey = '';
    cachedTatweelW = 0;
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
    probe = null;
    if (!opts.keepOff) {
      /* leave data-kashida-src so re-init is cheap */
    }
  }

  root.Kashida = { init: init, refresh: refresh, destroy: destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
