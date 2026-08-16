/**
 * Why section — Daylight USP motion copy
 *
 * Mirrors godaylight.com UspMotion:
 *   desktop = one scrubbed timeline (y conveyor + exclusive autoAlpha + masked line rise)
 *   mobile  = per-item play-once (line rise + clip-path aperture + image scale 1.8 → 1)
 *
 * Scoped to `.section_why.is-why-daylight` so the previous Why GSAP can be restored
 * by removing that class and this script.
 */
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('Why Daylight: GSAP/ScrollTrigger not found');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SECTION_SEL = '.section_why.is-why-daylight';

  function maskEl(el) {
    if (!el) return null;
    if (el.dataset.whyMask === '1') {
      return el.querySelector(':scope > .why-split-inner');
    }
    const inner = document.createElement('span');
    inner.className = 'why-split-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
    el.classList.add('why-split-mask');
    el.dataset.whyMask = '1';
    return inner;
  }

  function collectItem(item) {
    const content = item.querySelector('.why_in-center-content');
    const fixed = item.querySelector('.why_in-center-fixed');
    const heading = content && content.querySelector('.heading-section');
    const subhead = content && content.querySelector('.why_sub-head');
    const wrapper = item.querySelector('.why_image-wrapper');
    const img = item.querySelector('.why_img');
    return {
      item: item,
      content: content,
      fixed: fixed || content,
      heading: heading,
      subhead: subhead,
      headingInner: maskEl(heading),
      subheadInner: maskEl(subhead),
      wrapper: wrapper,
      img: img
    };
  }

  function initWhyDaylight() {
    const section = document.querySelector(SECTION_SEL);
    if (!section) return;

    const list = section.querySelector('.why_list');
    const items = gsap.utils.toArray(section.querySelectorAll('.why_item'));
    if (!list || items.length < 2) return;

    document.documentElement.classList.add('why-daylight-ready');

    const cards = items.map(collectItem).filter((card) => card.content);

    if (REDUCE_MOTION) {
      gsap.set(
        cards.map((card) => card.content),
        { autoAlpha: 1, y: 0, clearProps: 'clipPath' }
      );
      return;
    }

    const mm = gsap.matchMedia();

    // Desktop: one scrubbed timeline. Playhead is 0–100% of SCROLL_START → SCROLL_END.
    mm.add('(min-width: 992px)', () => {
      // fadeIn: 0 cannot start before this window. Change START to come in sooner.
      // start = list TOP vs viewport. Higher % = sooner (80% is near the bottom).
      // end   = list BOTTOM vs viewport. Lower % = later finish.
      const SCROLL_START = 'top 54%';
      const SCROLL_END = 'bottom 50%';

      // Default fade / Y length, in % of that scroll. Per-card fadeInDur overrides.
      const FADE_IN_PCT = 12;
      const FADE_OUT_PCT = 12;
      const Y_DUR_PCT = 30;

      const pct = (value) => value / 100;

      // Per-card times, in % of the section (0–100).
      // fadeIn / fadeOut = when that tween STARTS. Last card fadeOut: null = stay.
      //
      //  card | fadeIn | fadeOut | fadeInDur | yAt | yDur | yFrom | yTo
      //  -----|--------|---------|-----------|-----|------|-------|------
      //    1  |    0   |   16    |    15     |  0  |  30  |  100  | -100
      //    2  |   30   |   47    |    15     | 25  |  30  |   50  | -150
      //    3  |   63   |   78    |    15     | 50  |  30  |  -50  | -250
      //    4  |   90   |  stay   |    15     | 70  |  30  |   50  | -150
      const MOTION = [
        { fadeIn: 0,  fadeOut: 16,   fadeInDur: 15, yAt: 0,  yDur: 30, yFrom: 100,  yTo: -100 },
        { fadeIn: 30, fadeOut: 47,   fadeInDur: 15, yAt: 25, yDur: 30, yFrom: 50,   yTo: -150 },
        { fadeIn: 65, fadeOut: 78,   fadeInDur: 15, yAt: 50, yDur: 30, yFrom: -50,  yTo: -250 },
        { fadeIn: 90, fadeOut: null, fadeInDur: 15, yAt: 60, yDur: 30, yFrom: 50,   yTo: -150 }
      ];

      gsap.set(
        cards.map((card) => card.content),
        { autoAlpha: 0, transformOrigin: '50% 50%' }
      );
      gsap.set(
        cards.flatMap((card) => [card.headingInner, card.subheadInner].filter(Boolean)),
        { yPercent: 60, autoAlpha: 0 }
      );

      const tl = gsap.timeline({
        paused: true,
        scrollTrigger: {
          trigger: list,
          start: SCROLL_START,
          end: SCROLL_END,
          scrub: true,
          invalidateOnRefresh: true
        }
      });

      tl.to({}, { duration: 1 }, 0);

      cards.forEach((card, i) => {
        const motion = MOTION[i];
        if (!motion) return;

        tl.fromTo(
          card.content,
          { y: motion.yFrom },
          { y: motion.yTo, duration: pct(motion.yDur != null ? motion.yDur : Y_DUR_PCT), ease: 'none' },
          pct(motion.yAt)
        );

        const fadeInDur = pct(motion.fadeInDur != null ? motion.fadeInDur : FADE_IN_PCT);
        const titleY = motion.titleY != null ? motion.titleY : 60;

        tl.fromTo(
          card.content,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: fadeInDur, ease: 'power2.out' },
          pct(motion.fadeIn)
        );

        if (card.headingInner) {
          tl.fromTo(
            card.headingInner,
            { yPercent: titleY, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: fadeInDur, ease: 'power3.out' },
            pct(motion.fadeIn)
          );
        }

        if (card.subheadInner) {
          tl.fromTo(
            card.subheadInner,
            { yPercent: titleY, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: fadeInDur, ease: 'power3.out' },
            pct(motion.fadeIn) + 0.01
          );
        }

        if (motion.fadeOut != null) {
          tl.to(
            card.content,
            { autoAlpha: 0, duration: pct(FADE_OUT_PCT), ease: 'power2.in' },
            pct(motion.fadeOut)
          );
        }
      });

      return () => {
        if (tl.scrollTrigger) tl.scrollTrigger.kill();
        tl.kill();
        gsap.set(
          cards.map((card) => card.content),
          { clearProps: 'transform,opacity,visibility' }
        );
        gsap.set(
          cards.flatMap((card) => [card.headingInner, card.subheadInner].filter(Boolean)),
          { clearProps: 'transform,opacity,visibility' }
        );
      };
    });

    // Mobile: per-card enter (Godaylight mobile matchMedia)
    mm.add('(max-width: 991px)', () => {
      const triggers = [];

      cards.forEach((card) => {
        const lineTargets = [card.headingInner, card.subheadInner].filter(Boolean);

        if (lineTargets.length) {
          gsap.set(lineTargets, { yPercent: 100 });
          triggers.push(
            gsap.fromTo(
              lineTargets,
              { yPercent: 100 },
              {
                yPercent: 0,
                duration: 0.66,
                ease: 'expo.out',
                stagger: 0.15,
                scrollTrigger: {
                  trigger: card.item,
                  start: 'top 70%',
                  once: true
                }
              }
            )
          );
        }

        // Images stay on the original Why GSAP (scale + parallax).
      });

      return () => {
        triggers.forEach((tween) => {
          if (tween.scrollTrigger) tween.scrollTrigger.kill();
          tween.kill();
        });
        gsap.set(
          cards.flatMap((card) => [card.headingInner, card.subheadInner].filter(Boolean)),
          { clearProps: 'transform' }
        );
      };
    });

    requestAnimationFrame(() => ScrollTrigger.refresh());
    window.addEventListener(
      'load',
      () => {
        ScrollTrigger.refresh();
      },
      { once: true }
    );

    window.__whyDaylightMm = mm;
  }

  function boot() {
    initWhyDaylight();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.initWhyDaylight = initWhyDaylight;
})();
