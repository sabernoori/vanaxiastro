/**
 * Six logo tiles, each with exactly two faces.
 * Rolls one step at a time like a mechanical odometer wheel.
 */
(function () {
  'use strict';

  const SECTION_SEL = '.section_logos';
  const REEL_SEL = '[data-logo-reel]';
  const TICK_MS_MIN = 3200;
  const TICK_MS_MAX = 4800;
  const ROLL_DURATION = 0.62;
  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function preload(src) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }

  function makeCell(face, height) {
    const cell = document.createElement('div');
    cell.className = 'logos_reel-cell';
    cell.style.height = height + 'px';
    const img = document.createElement('img');
    img.className = 'image';
    img.alt = face.alt;
    img.src = face.src;
    img.decoding = 'async';
    img.draggable = false;
    cell.appendChild(img);
    return cell;
  }

  function cellHeight(reel) {
    return Math.round(reel.windowEl.clientHeight) || Math.round(reel.item.clientHeight);
  }

  function wrapItem(item) {
    const img = item.querySelector('img');
    const pairSrc = item.getAttribute('data-logo-pair');
    if (!img || !pairSrc || item.querySelector('.logos_reel-window')) return null;

    const home = { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' };
    const extra = { src: pairSrc, alt: item.getAttribute('data-logo-pair-alt') || '' };
    preload(extra.src);
    img.remove();

    const windowEl = document.createElement('div');
    windowEl.className = 'logos_reel-window';
    const drum = document.createElement('div');
    drum.className = 'logos_reel';
    windowEl.appendChild(drum);
    item.appendChild(windowEl);

    const reel = {
      item,
      windowEl,
      drum,
      home,
      extra,
      showingExtra: false,
      rolling: false
    };

    buildDrum(reel);
    return reel;
  }

  function buildDrum(reel) {
    const h = cellHeight(reel);
    if (h < 8) return;
    reel.cellH = h;
    // Always roll forward: home → extra → home
    reel.drum.replaceChildren(
      makeCell(reel.home, h),
      makeCell(reel.extra, h),
      makeCell(reel.home, h)
    );
    const y = reel.showingExtra ? -h : 0;
    if (typeof gsap !== 'undefined') gsap.set(reel.drum, { y: y, force3D: true });
    else reel.drum.style.transform = 'translate3d(0,' + y + 'px,0)';
  }

  function settle(reel, showingExtra) {
    reel.showingExtra = showingExtra;
    reel.rolling = false;
    buildDrum(reel);
  }

  function roll(reel) {
    if (reel.rolling) return;

    if (REDUCE_MOTION || typeof gsap === 'undefined') {
      settle(reel, !reel.showingExtra);
      return;
    }

    const h = reel.cellH || cellHeight(reel);
    if (h < 8) return;

    reel.rolling = true;
    const fromY = reel.showingExtra ? -h : 0;
    const toY = fromY - h;

    gsap.fromTo(
      reel.drum,
      { y: fromY },
      {
        y: toY,
        duration: ROLL_DURATION,
        ease: 'power1.inOut',
        overwrite: true,
        onComplete: () => settle(reel, !reel.showingExtra)
      }
    );
  }

  function init() {
    const section = document.querySelector(SECTION_SEL);
    if (!section) return;

    const reels = Array.from(section.querySelectorAll(REEL_SEL)).map(wrapItem).filter(Boolean);
    if (!reels.length) return;

    const timers = new Map();
    let inView = false;

    function clearTimers() {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    }

    function arm(reel) {
      window.clearTimeout(timers.get(reel));
      if (!inView || document.visibilityState === 'hidden') return;
      timers.set(
        reel,
        window.setTimeout(() => {
          roll(reel);
          arm(reel);
        }, randInt(TICK_MS_MIN, TICK_MS_MAX))
      );
    }

    function onEnter() {
      if (inView) return;
      inView = true;
      reels.forEach((reel, i) => {
        window.setTimeout(() => {
          if (!inView) return;
          roll(reel);
          arm(reel);
        }, 380 + i * 240);
      });
    }

    function onLeave() {
      inView = false;
      clearTimers();
    }

    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 82%',
        end: 'bottom 18%',
        onEnter: onEnter,
        onEnterBack: onEnter,
        onLeave: onLeave,
        onLeaveBack: onLeave
      });
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) onEnter();
            else onLeave();
          });
        },
        { threshold: 0.35 }
      );
      io.observe(section);
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        reels.forEach((reel) => {
          if (reel.rolling) return;
          buildDrum(reel);
        });
      }, 160);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        clearTimers();
      } else if (inView) {
        reels.forEach(arm);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
