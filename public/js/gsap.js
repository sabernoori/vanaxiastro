/**
 * GSAP Animations for Vanaxi Website
 */

(function() {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP/ScrollTrigger not found — animations skipped');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ==========================================
  // START: Lenis Smooth Scroll + ScrollTrigger Sync
  // ==========================================
  // Uses Lenis (footer CDN) with GSAP ticker — not ScrollSmoother (Club plugin).
  function initLenisSmoothScroll() {
    if (window.__vanaxiLenis) return window.__vanaxiLenis;
    if (REDUCE_MOTION) return null;
    const MOBILE_MQ = window.matchMedia('(max-width: 991px)');
    // Native touch scroll on small screens — Lenis + ticker is extra main-thread work.
    if (MOBILE_MQ.matches) return null;
    if (typeof Lenis === 'undefined') return null;

    const WHEEL_DEFAULT = 0.85;
    const TOUCH_DEFAULT = 1.35;

    const lenis = new Lenis({
      // Higher duration = slower/smoother settle. Lower wheelMultiplier = less distance per tick.
      duration: 1.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      // Off by default: Lenis 1.x then uses native touch and ignores touchMultiplier.
      // Turned on in syncLenisSpeed while a mobile speed section is in view.
      syncTouch: false,
      syncTouchLerp: 0.12,
      wheelMultiplier: WHEEL_DEFAULT,
      touchMultiplier: TOUCH_DEFAULT,
      infinite: false
    });

    // data-scroll-speed="50%" → wheel 0.5 (desktop).
    // data-scroll-speed-mobile — same speed on mobile, or data-scroll-speed-mobile="70%" for a different one.
    // Omit data-scroll-speed-mobile to leave mobile at the page default.
    function parseSpeed(raw) {
      if (raw == null || raw === '') return null;
      const n = parseFloat(String(raw).trim());
      if (!Number.isFinite(n)) return null;
      return n > 1 ? n / 100 : n;
    }

    function speedForSection(el, isMobile) {
      if (isMobile) {
        if (!el.hasAttribute('data-scroll-speed-mobile')) return null;
        const mobileRaw = el.getAttribute('data-scroll-speed-mobile');
        if (mobileRaw === 'false') return null;
        if (mobileRaw === '' || mobileRaw === 'true') {
          return parseSpeed(el.getAttribute('data-scroll-speed'));
        }
        return parseSpeed(mobileRaw);
      }
      return parseSpeed(el.getAttribute('data-scroll-speed'));
    }

    function applyLenisSpeed(wheel, touch, syncTouch) {
      lenis.options.wheelMultiplier = wheel;
      lenis.options.touchMultiplier = touch;
      lenis.options.syncTouch = !!syncTouch;
      // Lenis 1.x copies multipliers onto VirtualScroll at init — options.*Multiplier is ignored after that.
      const vs = lenis.virtualScroll;
      if (vs && vs.options) {
        vs.options.wheelMultiplier = wheel;
        vs.options.touchMultiplier = touch;
      }
    }

    const speedSections = Array.from(document.querySelectorAll('[data-scroll-speed]'));
    const speedInView = new Set();

    function syncLenisSpeed() {
      const isMobile = MOBILE_MQ.matches;
      let wheel = WHEEL_DEFAULT;
      let touch = TOUCH_DEFAULT;
      let syncTouch = false;

      speedSections.forEach((el) => {
        if (!speedInView.has(el)) return;
        const speed = speedForSection(el, isMobile);
        if (speed == null) return;
        wheel = speed;
        // Keep the mobile default (1.35) as the 100% baseline, then scale it.
        touch = TOUCH_DEFAULT * speed;
        if (isMobile) syncTouch = true;
      });

      applyLenisSpeed(wheel, touch, syncTouch);
    }

    if (speedSections.length && typeof IntersectionObserver !== 'undefined') {
      const speedObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) speedInView.add(entry.target);
            else speedInView.delete(entry.target);
          });
          syncLenisSpeed();
        },
        { threshold: 0 }
      );
      speedSections.forEach((el) => speedObserver.observe(el));
    } else {
      speedSections.forEach((el) => speedInView.add(el));
    }

    if (typeof MOBILE_MQ.addEventListener === 'function') {
      MOBILE_MQ.addEventListener('change', syncLenisSpeed);
    }
    lenis.on('scroll', () => {
      ScrollTrigger.update();
    });
    syncLenisSpeed();

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    window.lenis = lenis;
    window.__vanaxiLenis = lenis;

    // Keep ScrollTrigger measurements in sync after fonts/images settle
    requestAnimationFrame(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

    return lenis;
  }

  function getScrollY() {
    if (window.lenis && typeof window.lenis.scroll === 'number') {
      return window.lenis.scroll;
    }
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function smoothScrollTo(y, options) {
    const opts = options || {};
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      window.lenis.scrollTo(y, {
        duration: opts.duration != null ? opts.duration : 1.1,
        easing: opts.easing || ((t) => 1 - Math.pow(1 - t, 3)),
        immediate: !!opts.immediate,
        onComplete: opts.onComplete
      });
      return;
    }

    if (opts.immediate) {
      window.scrollTo(0, y);
      if (opts.onComplete) opts.onComplete();
      return;
    }

    const proxy = { y: getScrollY() };
    gsap.to(proxy, {
      duration: opts.duration != null ? opts.duration : 0.9,
      y: y,
      ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, proxy.y),
      onComplete: opts.onComplete
    });
  }
  // ==========================================
  // END: Lenis Smooth Scroll + ScrollTrigger Sync
  // ==========================================

  // ==========================================
  // START: Desktop Services ScrollTrigger
  // ==========================================
  function initServicesDesktopScroll() {
    const longWrapper = document.querySelector('.services_box-desktop .services_long-wrapper');
    if (!longWrapper) return;

    let scrollTriggerInstance = null;
    let isProgrammaticScroll = false;

    function waitForServicesDesktop(callback) {
      if (window.ServicesDesktop && window.ServicesDesktop.isReady()) {
        callback();
        return;
      }

      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (window.ServicesDesktop && window.ServicesDesktop.isReady()) {
          clearInterval(timer);
          callback();
        } else if (attempts > 40) {
          clearInterval(timer);
          console.warn('GSAP: ServicesDesktop controller not ready');
        }
      }, 50);
    }

    function getScrollBounds() {
      const rect = longWrapper.getBoundingClientRect();
      const scrollY = getScrollY();
      const start = rect.top + scrollY;
      const end = start + longWrapper.offsetHeight - window.innerHeight;
      return { start: start, end: Math.max(start + 1, end) };
    }

    function scrollToIndex(index) {
      const api = window.ServicesDesktop;
      if (!api) return;

      const count = api.getItemCount();
      if (count <= 0) return;

      const clamped = Math.max(0, Math.min(count - 1, index));
      const bounds = getScrollBounds();
      const targetProgress = (clamped + 0.02) / count;
      const targetY = bounds.start + (bounds.end - bounds.start) * targetProgress;

      isProgrammaticScroll = true;
      api.setFromScroll(clamped, 0);

      smoothScrollTo(targetY, {
        duration: 1.05,
        onComplete: () => {
          isProgrammaticScroll = false;
          ScrollTrigger.update();
        }
      });
    }

    function createScrollTrigger() {
      const api = window.ServicesDesktop;
      if (!api || !api.isDesktop()) return;

      const count = api.getItemCount();
      if (count <= 0) return;

      if (scrollTriggerInstance) {
        scrollTriggerInstance.kill();
        scrollTriggerInstance = null;
      }

      scrollTriggerInstance = ScrollTrigger.create({
        trigger: longWrapper,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.35,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (isProgrammaticScroll) return;

          const progress = self.progress;
          const rawIndex = Math.min(count - 1, Math.floor(progress * count));
          const segmentStart = rawIndex / count;
          const segmentSize = 1 / count;
          const segmentProgress = segmentSize > 0
            ? (progress - segmentStart) / segmentSize
            : 0;

          api.setFromScroll(rawIndex, Math.max(0, Math.min(1, segmentProgress)));
        }
      });

      api.registerScrollToIndex(scrollToIndex);
      ScrollTrigger.refresh();
    }

    waitForServicesDesktop(() => {
      const mq = window.matchMedia('(min-width: 992px)');

      const setup = () => {
        if (mq.matches) {
          createScrollTrigger();
        } else if (scrollTriggerInstance) {
          scrollTriggerInstance.kill();
          scrollTriggerInstance = null;
        }
      };

      setup();

      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', setup);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(setup);
      }
    });
  }
  // ==========================================
  // END: Desktop Services ScrollTrigger
  // ==========================================

  // ==========================================
  // START: Services heading scale + Daylight card cover
  // Heading 3 → 1 as the section comes in, then the card
  // scales 0.8 → 1 (godaylight first-article recipe) and covers it.
  // ==========================================
  function initServicesIntroCover() {
    const section = document.querySelector('#services.section_services.is-services-cover');
    if (!section) return;

    const heading = section.querySelector(':scope > .heading-section');
    const headingScale = heading && heading.querySelector('.heading-section-scale');
    if (!heading || !headingScale) return;

    const CARD_GRAY = '#e6eaf3';
    const CARD_WHITE = '#ffffff';
    const mm = gsap.matchMedia();

    function markReady() {
      document.documentElement.classList.add('services-cover-ready');
    }

    function setupCover(shell, stage) {
      if (!shell || !stage) {
        gsap.set(headingScale, { scale: 1, clearProps: 'transform' });
        markReady();
        return;
      }

      if (REDUCE_MOTION) {
        gsap.set(headingScale, { scale: 1, clearProps: 'transform' });
        gsap.set(stage, { scale: 1, backgroundColor: CARD_WHITE, clearProps: 'transform' });
        markReady();
        return;
      }

      const isMobileShell = shell.classList.contains('is-mobile');

      gsap.set(headingScale, { scale: 3, transformOrigin: '50% 50%', force3D: true });
      gsap.set(stage, {
        scale: 0.8,
        transformOrigin: '50% 50%',
        backgroundColor: CARD_GRAY,
        force3D: !isMobileShell
      });
      markReady();

      let settled = false;
      let tl;

      function settleStage() {
        if (settled) return;
        settled = true;
        if (tl) {
          if (tl.scrollTrigger) tl.scrollTrigger.kill();
          tl.pause();
          tl.kill();
        }
        gsap.set(headingScale, { scale: 1, clearProps: 'transform' });
        gsap.set(stage, {
          scale: 1,
          yPercent: 0,
          backgroundColor: CARD_WHITE,
          clearProps: 'transform',
          willChange: 'auto'
        });
        stage.style.transform = 'none';
        stage.style.willChange = 'auto';
      }

      if (isMobileShell) {
        window.__completeServicesIntro = settleStage;
      }

      tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          endTrigger: shell,
          end: isMobileShell ? 'top 32%' : 'top 8%',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (isMobileShell && self.progress >= 0.98) settleStage();
          }
        }
      });

      tl.fromTo(headingScale, { scale: 3 }, { scale: 1, duration: 0.55 }, 0);
      tl.fromTo(
        stage,
        { scale: 0.8, yPercent: 18 },
        { scale: 1, yPercent: 0, duration: 1 },
        0
      );
      tl.fromTo(
        stage,
        { backgroundColor: CARD_GRAY },
        { backgroundColor: CARD_WHITE, duration: 0.7 },
        0.3
      );

      return () => {
        if (isMobileShell && window.__completeServicesIntro === settleStage) {
          window.__completeServicesIntro = null;
        }
        if (tl.scrollTrigger) tl.scrollTrigger.kill();
        tl.kill();
        gsap.set(headingScale, { clearProps: 'transform' });
        gsap.set(stage, { clearProps: 'transform,backgroundColor' });
      };
    }

    mm.add('(min-width: 992px)', () =>
      setupCover(
        section.querySelector('.services_box-desktop .services_cover-shell'),
        section.querySelector('.services_box-desktop .services_scale')
      )
    );

    mm.add('(max-width: 991px)', () =>
      setupCover(
        section.querySelector('.services_cover-shell.is-mobile'),
        section.querySelector('.services_cover-shell.is-mobile .services_scale')
      )
    );

    window.__servicesIntroMm = mm;
  }
  // ==========================================
  // END: Services heading scale + Daylight card cover
  // ==========================================

  // ==========================================
  // START: Why Image First-Load Scale Down
  // ==========================================
  function initWhyImgScaleDown() {
    if (REDUCE_MOTION) return;

    ScrollTrigger.matchMedia({
      // Mobile / tablet only
      '(max-width: 991px)': function() {
        const images = gsap.utils.toArray('.section_why .why_img');
        if (!images.length) return;

        const cleanups = [];

        images.forEach((img) => {
          const triggerEl =
            img.closest('.why_img-box') ||
            img.closest('.why_image-wrapper') ||
            img;

          gsap.set(img, {
            scale: 1.3,
            transformOrigin: '50% 50%',
            force3D: true
          });

          let played = false;
          const play = () => {
            if (played) return;
            played = true;
            gsap.to(img, {
              scale: 1,
              duration: 1,
              ease: 'power3.out',
              overwrite: 'auto'
            });
          };

          const armTrigger = () => {
            const st = ScrollTrigger.create({
              trigger: triggerEl,
              start: 'top 92%',
              once: true,
              invalidateOnRefresh: true,
              onEnter: play
            });

            // If already in / past the start line when armed, play immediately
            // (common on mobile — onEnter does not fire retroactively)
            if (st.start <= window.pageYOffset + window.innerHeight * 0.92) {
              play();
              st.kill();
            }

            cleanups.push(() => st.kill());
            ScrollTrigger.refresh();
          };

          if (img.complete && img.naturalWidth > 0) {
            armTrigger();
          } else {
            const onReady = () => armTrigger();
            img.addEventListener('load', onReady, { once: true });
            img.addEventListener('error', onReady, { once: true });
            cleanups.push(() => {
              img.removeEventListener('load', onReady);
              img.removeEventListener('error', onReady);
            });
          }
        });

        return function() {
          cleanups.forEach((fn) => fn());
          gsap.set(images, { clearProps: 'transform' });
        };
      }
    });
  }
  // ==========================================
  // END: Why Image First-Load Scale Down
  // ==========================================

  // ==========================================
  // START: Process Steps Sticky Scroll
  // ==========================================
  function initProcessStepsScroll() {
    // ----------------------------------------------------------
    // CONFIG — tweak these freely
    // ----------------------------------------------------------
    // vhPerStep: scroll travel (in vh) between each centered step.
    //   Total long height ≈ sticky panel height + (steps - 1) * vhPerStep
    // scrub: higher = smoother lag behind the scroll (try 0.8–1.4)
    // inactiveOpacity: opacity when a step is fully away from center (0–1)
    // fadeFalloff: how far from center (as fraction of process_center height)
    //   a step must travel before it reaches inactiveOpacity
    // snap: snap scroll progress to each step center
    // snapDuration: seconds for soft snap settle (higher = smoother)
    // stickyTop: must match CSS .process_wrapper { top: … }
    // ----------------------------------------------------------
    const PROCESS_STEPS_CONFIG = {
      vhPerStep: 100,
      scrub: 1.1,
      inactiveOpacity: 0.15,
      fadeFalloff: 0.55,
      snap: true,
      snapDuration: 0.65,
      stickyTop: '10vh'
    };

    const long = document.querySelector('.section_process .process_long');
    const wrapper = document.querySelector('.section_process .process_wrapper');
    const center = document.querySelector('.section_process .process_center');
    const track = document.querySelector('.section_process .process_steps-track');
    if (!long || !wrapper || !center || !track) return;

    const steps = gsap.utils.toArray(track.querySelectorAll('.process_step-wrapper'));
    if (steps.length < 2) return;

    let scrollTriggerInstance = null;
    let stepTargets = [];

    const getStepTargets = () => {
      // y needed so each step's vertical center sits in process_center midpoint
      const mid = center.clientHeight / 2;
      return steps.map((step) => {
        const stepMid = step.offsetTop + step.offsetHeight / 2;
        return -(stepMid - mid);
      });
    };

    const smoothstep = (t) => t * t * (3 - 2 * t);

    const applyProgress = (progress) => {
      const y = gsap.utils.interpolate(stepTargets)(progress);
      gsap.set(track, { y });

      // Fade from real position vs process_center midpoint (not step index)
      const centerRect = center.getBoundingClientRect();
      const centerMidY = centerRect.top + centerRect.height / 2;
      const falloffPx = Math.max(1, center.clientHeight * PROCESS_STEPS_CONFIG.fadeFalloff);

      steps.forEach((step) => {
        const rect = step.getBoundingClientRect();
        const stepMidY = rect.top + rect.height / 2;
        const dist = Math.abs(stepMidY - centerMidY);
        const t = smoothstep(gsap.utils.clamp(0, 1, dist / falloffPx));
        const opacity = gsap.utils.interpolate(
          1,
          PROCESS_STEPS_CONFIG.inactiveOpacity
        )(t);

        gsap.set(step, { opacity });
        step.classList.toggle('is-inactive', opacity < 0.9);
      });
    };

    const setLongHeight = () => {
      // Keep sticky panel size + one configurable vh block per step transition
      const panelHeight = wrapper.offsetHeight;
      const travelVh = (steps.length - 1) * PROCESS_STEPS_CONFIG.vhPerStep;
      long.style.height = `calc(${panelHeight}px + ${travelVh}vh)`;
    };

    const create = () => {
      if (scrollTriggerInstance) {
        scrollTriggerInstance.kill();
        scrollTriggerInstance = null;
      }

      setLongHeight();
      // Reset transform before measuring offsets
      gsap.set(track, { y: 0 });
      stepTargets = getStepTargets();
      applyProgress(0);

      const snapIncrement = steps.length > 1 ? 1 / (steps.length - 1) : 1;

      scrollTriggerInstance = ScrollTrigger.create({
        trigger: long,
        start: `top ${PROCESS_STEPS_CONFIG.stickyTop}`,
        end: 'bottom bottom',
        scrub: PROCESS_STEPS_CONFIG.scrub,
        invalidateOnRefresh: true,
        snap: PROCESS_STEPS_CONFIG.snap
          ? {
              snapTo: snapIncrement,
              duration: {
                min: PROCESS_STEPS_CONFIG.snapDuration * 0.75,
                max: PROCESS_STEPS_CONFIG.snapDuration
              },
              ease: 'power2.inOut'
            }
          : false,
        onRefresh: () => {
          setLongHeight();
          stepTargets = getStepTargets();
          applyProgress(scrollTriggerInstance ? scrollTriggerInstance.progress : 0);
        },
        onUpdate: (self) => {
          applyProgress(self.progress);
        }
      });

      ScrollTrigger.refresh();
    };

    create();

    // Rebuild targets after fonts/images settle
    window.addEventListener('load', () => {
      setLongHeight();
      ScrollTrigger.refresh();
      if (scrollTriggerInstance) applyProgress(scrollTriggerInstance.progress);
    }, { once: true });
  }
  // ==========================================
  // END: Process Steps Sticky Scroll
  // ==========================================

  // ==========================================
  // START: Why Center Content Fade In (Desktop)
  // ==========================================
  // Structure (desktop):
  //   .why_in-center        → relative, overflow:hidden, clip-path:inset(0%)
  //   .why_in-center-fixed  → position:fixed; inset:0 (full viewport, flex-centered)
  //   .why_in-center-content→ the text block sitting in screen center
  //
  // Scroll down: fade IN when content bottom hits clip top
  //              fade OUT when content bottom hits clip bottom
  // Scroll up:   fade IN when content top hits clip bottom
  //              fade OUT when content top hits clip top
  // ==========================================
  function initWhyCenterFadeIn() {
    if (REDUCE_MOTION) {
      document.querySelectorAll('.section_why .why_in-center-content').forEach((el) => {
        el.style.opacity = '1';
      });
      return;
    }

    ScrollTrigger.matchMedia({
      '(min-width: 992px)': function() {
        const centers = gsap.utils.toArray('.section_why .why_in-center');
        if (!centers.length) return;

        const cleanups = [];

        // easeOutCubic: 1 - (1 - t)^3
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        centers.forEach((center) => {
          const content = center.querySelector('.why_in-center-content');
          if (!content) return;

          const fixed = center.querySelector('.why_in-center-fixed');
          if (fixed) gsap.set(fixed, { clearProps: 'opacity' });

          gsap.set(content, { opacity: 0 });

          const applyOpacity = () => {
            const centerRect = center.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            const vh = window.innerHeight;

            const contentTop =
              contentRect.height > 1
                ? contentRect.top
                : (vh - content.offsetHeight) / 2;
            const contentBottom =
              contentRect.height > 1
                ? contentRect.bottom
                : (vh + content.offsetHeight) / 2;

            const fadeDistance = Math.max(
              center.offsetHeight * 0.35,
              vh * 0.35
            );

            // Fade IN from top (scroll down): content bottom vs clip top
            const enterTop = gsap.utils.clamp(
              0,
              1,
              (contentBottom - centerRect.top) / fadeDistance
            );

            // Fade OUT from bottom (scroll down): content bottom vs clip bottom
            // Starts at 1 when bottoms align; reaches 0 after fadeDistance
            const leaveBottom = gsap.utils.clamp(
              0,
              1,
              (centerRect.bottom - contentBottom + fadeDistance) / fadeDistance
            );

            // Fade IN from bottom (scroll up): content top vs clip bottom
            const enterBottom = gsap.utils.clamp(
              0,
              1,
              (centerRect.bottom - contentTop) / fadeDistance
            );

            // Fade OUT from top (scroll up): content top vs clip top
            const leaveTop = gsap.utils.clamp(
              0,
              1,
              (contentTop - centerRect.top + fadeDistance) / fadeDistance
            );

            const progress = Math.min(enterTop, leaveBottom, enterBottom, leaveTop);
            gsap.set(content, { opacity: easeOutCubic(progress) });
          };

          const st = ScrollTrigger.create({
            trigger: center,
            start: 'top bottom',
            end: 'bottom top',
            invalidateOnRefresh: true,
            onUpdate: applyOpacity,
            onRefresh: applyOpacity
          });

          applyOpacity();
          cleanups.push(() => {
            st.kill();
            gsap.set(content, { clearProps: 'opacity' });
            if (fixed) gsap.set(fixed, { clearProps: 'opacity' });
          });
        });

        ScrollTrigger.refresh();

        return function() {
          cleanups.forEach((fn) => fn());
        };
      }
    });
  }
  // ==========================================
  // END: Why Center Content Fade In (Desktop)
  // ==========================================


  // ==========================================
  // START: Why Image Parallax (IX3 fallback)
  // ==========================================
  // Live Webflow IX3: .why_img inside .why_image-wrapper, y 0% → -30%.
  // Only runs if html.w-mod-ix3 never appears, so parallax cannot double.
  function initWhyImgParallaxFallback() {
    const html = document.documentElement;

    const ix3Ready = () => html.classList.contains('w-mod-ix3');

    const runFallback = () => {
      if (ix3Ready()) return;

      html.classList.add('w-mod-ix3');

      if (REDUCE_MOTION) return;

      const wrappers = gsap.utils.toArray('.why_image-wrapper');
      wrappers.forEach((wrapper) => {
        const img = wrapper.querySelector('.why_img');
        if (!img) return;

        gsap.fromTo(
          img,
          { yPercent: 0 },
          {
            yPercent: -30,
            ease: 'none',
            scrollTrigger: {
              trigger: wrapper,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true
            }
          }
        );
      });
    };

    if (ix3Ready()) return;

    const observer = new MutationObserver(() => {
      if (ix3Ready()) observer.disconnect();
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });

    const schedule = () => {
      setTimeout(() => {
        observer.disconnect();
        runFallback();
      }, 400);
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }
  }
  // ==========================================
  // END: Why Image Parallax (IX3 fallback)
  // ==========================================

  function init() {
    const boot = () => {
      initLenisSmoothScroll();
      setTimeout(() => {
        const useWhyDaylight = !!document.querySelector('.section_why.is-why-daylight');
        if (useWhyDaylight) {
          initWhyImgScaleDown();
          initWhyImgParallaxFallback();
        } else {
          initWhyImgScaleDown();
          initWhyCenterFadeIn();
          initWhyImgParallaxFallback();
        }
        initServicesDesktopScroll();
        initServicesIntroCover();
        initProcessStepsScroll();
        ScrollTrigger.refresh();
      }, 100);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  init();

  window.GSAPAnimations = {
    refreshServicesDesktop: initServicesDesktopScroll,
    refreshServicesIntro: initServicesIntroCover,
    refreshWhyImgScale: initWhyImgScaleDown,
    refreshWhyCenterFade: initWhyCenterFadeIn,
    refreshWhyParallax: initWhyImgParallaxFallback,
    refreshProcessSteps: initProcessStepsScroll,
    refreshLenis: initLenisSmoothScroll,
    refresh: () => ScrollTrigger.refresh()
  };

})();