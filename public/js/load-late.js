/**
 * Load JS after first paint so the hero can become LCP without waiting on GSAP.
 * Mobile skips jQuery / Webflow / Lenis — those are desktop dropdown + smooth scroll.
 */
(function () {
  'use strict';

  var ver = '';
  try {
    ver = new URL(document.currentScript.src).searchParams.get('v') || '';
  } catch (err) {
    /* ignore */
  }
  var q = ver ? '?v=' + ver : '';

  var coreSrcs = [
    '/vendor/gsap.min.js',
    '/vendor/ScrollTrigger.min.js',
    '/js/script.js' + q,
    '/js/gsap.js' + q
  ];
  var idleSrcs = [
    '/js/kashida.js' + q,
    '/js/logos-reel.js' + q,
    '/js/why-daylight.js' + q
  ];
  // webflow.main waits on chunks 606 (dropdown) + 471 (tabs) before boot.
  // Without main (or either chunk), desktop nav hover never opens.
  var desktopSrcs = [
    '/vendor/jquery.js',
    '/vendor/webflow.schunk.1.js',
    '/vendor/webflow.schunk.2.js',
    '/vendor/webflow.main.js',
    '/vendor/lenis.min.js'
  ];

  var coreStarted = false;
  var idleStarted = false;
  var desktopStarted = false;

  function loadSeq(srcs, done) {
    var i = 0;
    function next() {
      if (i >= srcs.length) {
        if (done) done();
        return;
      }
      var s = document.createElement('script');
      s.src = srcs[i++];
      s.onload = s.onerror = next;
      document.body.appendChild(s);
    }
    next();
  }

  function loadIdle() {
    if (idleStarted) return;
    idleStarted = true;
    loadSeq(idleSrcs);
  }

  function loadDesktop() {
    if (desktopStarted) return;
    if (!window.matchMedia('(min-width: 992px)').matches) return;
    desktopStarted = true;
    loadSeq(desktopSrcs, function () {
      if (window.GSAPAnimations && typeof window.GSAPAnimations.refreshLenis === 'function') {
        window.GSAPAnimations.refreshLenis();
      }
    });
  }

  function onIdle() {
    loadIdle();
    loadDesktop();
  }

  function loadCore() {
    if (coreStarted) return;
    coreStarted = true;
    // Desktop: start Webflow/Lenis with the core stack so nav hover works
    // before the idle callback (pointerenter alone is too late on first hover).
    if (window.matchMedia('(min-width: 992px)').matches) {
      loadDesktop();
    }
    loadSeq(coreSrcs, function () {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(onIdle, { timeout: 2200 });
      } else {
        setTimeout(onIdle, 1);
      }
    });
  }

  function afterFirstPaint(fn) {
    requestAnimationFrame(function () {
      requestAnimationFrame(fn);
    });
  }

  var nav = document.getElementById('site-header');
  if (nav) {
    nav.addEventListener('pointerenter', loadDesktop, { once: true });
  }

  var desktopMq = window.matchMedia('(min-width: 992px)');
  if (typeof desktopMq.addEventListener === 'function') {
    desktopMq.addEventListener('change', function (e) {
      if (e.matches) loadDesktop();
    });
  }

  window.addEventListener('pointerdown', loadCore, { once: true, passive: true });
  window.addEventListener('keydown', loadCore, { once: true });
  afterFirstPaint(loadCore);
})();
