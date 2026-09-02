/**
 * Load below-the-fold scripts after first paint.
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

  var idleSrcs = [
    '/js/kashida.js' + q,
    '/js/logos-reel.js' + q,
    '/js/why-daylight.js' + q
  ];
  var desktopSrcs = [
    '/vendor/jquery.js',
    '/vendor/webflow.schunk.1.js',
    '/vendor/lenis.min.js'
  ];

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

  if ('requestIdleCallback' in window) {
    requestIdleCallback(onIdle, { timeout: 2200 });
  } else if (document.readyState === 'complete') {
    setTimeout(onIdle, 1);
  } else {
    window.addEventListener('load', function () {
      setTimeout(onIdle, 1);
    });
  }
})();
