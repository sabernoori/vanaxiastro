/**
 * Start Menu Toggle Animation Controller
 * Handles mobile menu open/close with smooth animations
 */

(function() {
  'use strict';

  // State management
  const MenuState = {
    isOpen: false,
    currentSubMenu: null,
    isAnimating: false,
    lastFocus: null
  };

  // DOM Elements
  const elements = {
    burgerIcon: null,
    closeIconMain: null,
    menuWrapper: null,
    navBurger: null,
    mainMenu: null,
    servicesMenu: null,
    aboutMenu: null,
    backIcon: null,
    menuItems: {
      services: null,
      plans: null,
      drivers: null,
      about: null
    }
  };

  // Animation timing constants
  const TIMING = {
    menuOpen: 500,
    menuClose: 400,
    staggerDelay: 50,
    subMenuTransition: 300
  };

  /**
   * Initialize all DOM element references
   */
  function initElements() {
    elements.burgerIcon = document.querySelector('.burger-icon');
    elements.closeIconMain = document.querySelector('[icon-action="close-main"].close-icon.is-step1');
    elements.menuWrapper = document.querySelector('.menu_open-wrapper');
    elements.navBurger = document.querySelector('.nav_burger');
    elements.mainMenu = document.querySelector('.menu_open.is-main');
    elements.servicesMenu = document.querySelector('.menu_open.is-services');
    elements.aboutMenu = document.querySelector('.menu_open.is-about');
    elements.backIcon = document.querySelector('[icon-action="back"].back-icon');

    // Menu items
    elements.menuItems.services = document.querySelector('#nav-services');
    elements.menuItems.plans = document.querySelector('#nav-plans');
    elements.menuItems.drivers = document.querySelector('#nav-drivers');
    elements.menuItems.about = document.querySelector('#nav-about');

    return validateElements();
  }

  /**
   * Validate that all required elements exist
   */
  function validateElements() {
    const required = [
      'burgerIcon',
      'closeIconMain',
      'menuWrapper',
      'navBurger',
      'mainMenu'
    ];

    const missing = required.filter(key => !elements[key]);

    if (missing.length > 0) {
      console.warn('Menu: Missing required elements:', missing);
      return false;
    }

    return true;
  }

  function syncMenuAria(isOpen) {
    if (elements.burgerIcon) {
      elements.burgerIcon.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      elements.burgerIcon.setAttribute(
        'aria-label',
        isOpen ? 'بستن منو' : 'باز کردن منو'
      );
    }
    if (elements.menuWrapper) {
      elements.menuWrapper.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (isOpen) {
        elements.menuWrapper.removeAttribute('inert');
      } else {
        elements.menuWrapper.setAttribute('inert', '');
      }
    }
  }

  /**
   * Open the mobile menu with animations
   */
  function openMenu() {
    // Safety reset - clear any stuck animation state
    MenuState.isAnimating = false;

    if (MenuState.isOpen) return;

    MenuState.isAnimating = true;
    MenuState.isOpen = true;
    MenuState.lastFocus = document.activeElement;

    // Add classes for animations (CSS handles visibility)
    elements.menuWrapper.classList.add('is-visible');
    syncMenuAria(true);

    // Small delay to ensure visibility is applied before animation
    requestAnimationFrame(() => {
      // Add classes for animations
      elements.navBurger.classList.add('is-menu-open');
      elements.menuWrapper.classList.add('is-open');

      // Prevent body scroll (+ pause Lenis if active)
      document.body.style.overflow = 'hidden';
      if (window.lenis && typeof window.lenis.stop === 'function') {
        window.lenis.stop();
      }

      // Reset any sub-menu state
      closeSubMenu(false);

      // Move focus into the open menu
      const firstFocusable = elements.menuWrapper.querySelector(
        'a[href], button, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) firstFocusable.focus({ preventScroll: true });

      // Set animation complete
      setTimeout(() => {
        MenuState.isAnimating = false;
      }, TIMING.menuOpen);
    });
  }

  /**
   * Close the mobile menu with animations
   * @param {boolean} animate - Whether to animate the close
   */
  function closeMenu(animate = true) {
    if (MenuState.isAnimating || !MenuState.isOpen) return;

    MenuState.isAnimating = true;
    MenuState.isOpen = false;

    const duration = animate ? TIMING.menuClose : 0;

    // Remove open class to trigger close animation
    elements.navBurger.classList.remove('is-menu-open');
    elements.menuWrapper.classList.remove('is-open');
    syncMenuAria(false);

    // Re-enable body scroll (+ resume Lenis if active)
    document.body.style.overflow = '';
    if (window.lenis && typeof window.lenis.start === 'function') {
      window.lenis.start();
    }

    // Add class for fade-only closing (no slide)
    if (elements.servicesMenu) {
      elements.servicesMenu.classList.add('is-closing');
      elements.servicesMenu.classList.remove('is-active');
    }
    if (elements.aboutMenu) {
      elements.aboutMenu.classList.add('is-closing');
      elements.aboutMenu.classList.remove('is-active');
    }

    // Toggle all icons back
    toggleNavBurgerIcons(false);
    toggleNavAccountIcons(false);
    toggleLogoAndTitle(null, false);

    // Restore focus to the control that opened the menu
    if (MenuState.lastFocus && typeof MenuState.lastFocus.focus === 'function') {
      MenuState.lastFocus.focus({ preventScroll: true });
    } else if (elements.burgerIcon) {
      elements.burgerIcon.focus({ preventScroll: true });
    }

    // After animation completes, reset everything completely
    setTimeout(() => {
      elements.menuWrapper.classList.remove('is-visible');
      elements.mainMenu.classList.remove('is-pushed');
      MenuState.isAnimating = false;

      // Remove closing class
      if (elements.servicesMenu) {
        elements.servicesMenu.classList.remove('is-closing');
      }
      if (elements.aboutMenu) {
        elements.aboutMenu.classList.remove('is-closing');
      }
    }, duration);

    // Reset submenu state
    MenuState.currentSubMenu = null;
  }

  /**
   * Toggle menu open/close
   */
  function toggleMenu() {
    if (MenuState.isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  /**
   * Open a sub-menu (services or about)
   * @param {string} subMenuType - 'services' or 'about'
   */
  function openSubMenu(subMenuType) {
    if (MenuState.isAnimating) return;

    MenuState.currentSubMenu = subMenuType;

    // Toggle icons and title first
    toggleNavBurgerIcons(true);
    toggleNavAccountIcons(true);
    toggleLogoAndTitle(subMenuType, true);

    // Push main menu to left (CSS handles the slide)
    elements.mainMenu.classList.add('is-pushed');

    // Show the appropriate sub-menu (slides in from right)
    if (subMenuType === 'services' && elements.servicesMenu) {
      elements.servicesMenu.classList.add('is-active');
      animateSubMenuItems(elements.servicesMenu);
    } else if (subMenuType === 'about' && elements.aboutMenu) {
      elements.aboutMenu.classList.add('is-active');
      animateSubMenuItems(elements.aboutMenu);
    }
  }

  /**
   * Close the current sub-menu
   * @param {boolean} animate - Whether to animate
   */
  function closeSubMenu(animate = true) {
    if (!MenuState.currentSubMenu) return;

    // Slide submenu back to right (CSS handles the animation)
    if (elements.servicesMenu) {
      elements.servicesMenu.classList.remove('is-active');
    }

    if (elements.aboutMenu) {
      elements.aboutMenu.classList.remove('is-active');
    }

    // Bring main menu back from left
    elements.mainMenu.classList.remove('is-pushed');

    // Toggle icons and title
    toggleNavBurgerIcons(false);
    toggleNavAccountIcons(false);
    toggleLogoAndTitle(null, false);

    MenuState.currentSubMenu = null;
  }

  /**
   * Animate sub-menu items with stagger effect
   * @param {HTMLElement} menuContainer - The sub-menu container
   */
  function animateSubMenuItems(menuContainer) {
    const items = menuContainer.querySelectorAll('.menu_item, .nav_services-card');

    items.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';

      setTimeout(() => {
        item.style.transition = `opacity ${TIMING.subMenuTransition}ms cubic-bezier(0.83, 0, 0.17, 1),
                                  transform ${TIMING.subMenuTransition}ms cubic-bezier(0.83, 0, 0.17, 1)`;
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, 100 + (index * TIMING.staggerDelay));
    });
  }

  /**
   * Update menu title visibility based on active sub-menu
   * @param {string} subMenuType - 'services' or 'about'
   */
  function updateMenuTitles(subMenuType) {
    const servicesTitle = document.querySelector('.menu_title.is-services');
    const aboutTitle = document.querySelector('.menu_title.is-about');

    if (servicesTitle) {
      if (subMenuType === 'services') {
        servicesTitle.classList.add('is-visible');
        servicesTitle.style.display = 'block';
      } else {
        servicesTitle.classList.remove('is-visible');
        servicesTitle.style.display = 'none';
      }
    }

    if (aboutTitle) {
      if (subMenuType === 'about') {
        aboutTitle.classList.add('is-visible');
        aboutTitle.style.display = 'block';
      } else {
        aboutTitle.classList.remove('is-visible');
        aboutTitle.style.display = 'none';
      }
    }
  }

  /**
   * Hide all menu titles
   */
  function hideMenuTitles() {
    const servicesTitle = document.querySelector('.menu_title.is-services');
    const aboutTitle = document.querySelector('.menu_title.is-about');

    if (servicesTitle) servicesTitle.style.display = 'none';
    if (aboutTitle) aboutTitle.style.display = 'none';
  }

  /**
   * Toggle nav_burger icons using attribute selectors
   * @param {boolean} isSubMenuOpen - true if submenu is open
   */
  function toggleNavBurgerIcons(isSubMenuOpen) {
    const closeMain = document.querySelector('[icon-action="close-main"]');
    const backIcon = document.querySelector('[icon-action="back"]');
    const burgerIcon = document.querySelector('.burger-icon');

    if (isSubMenuOpen) {
      // Hide close-main and burger, show back icon
      if (closeMain) {
        closeMain.style.opacity = '0';
        closeMain.style.pointerEvents = 'none';
      }
      if (burgerIcon) {
        burgerIcon.classList.add('is-hidden');
      }
      if (backIcon) {
        backIcon.style.opacity = '1';
        backIcon.style.transform = 'scale(1) rotate(0deg)';
        backIcon.style.pointerEvents = 'auto';
      }
    } else {
      // Show close-main and burger, hide back icon
      if (closeMain) {
        closeMain.style.opacity = '';
        closeMain.style.pointerEvents = '';
      }
      if (burgerIcon) {
        burgerIcon.classList.remove('is-hidden');
      }
      if (backIcon) {
        backIcon.style.opacity = '';
        backIcon.style.transform = '';
        backIcon.style.pointerEvents = '';
      }
    }
  }

  /**
   * Toggle nav_account-mob icons (icon-24 and close-layers)
   * @param {boolean} showCloseLayers - true to show close-layers, false to show icon-24
   */
  function toggleNavAccountIcons(showCloseLayers) {
    const navAccountMob = document.querySelector('.nav_account-mob');
    if (!navAccountMob) return;

    const icon24 = navAccountMob.querySelector('.icon-24');
    const closeLayers = navAccountMob.querySelector('[icon-action="close-layers"]');

    if (showCloseLayers) {
      // Hide icon-24 and show close-layers
      if (icon24) icon24.classList.add('is-hidden');
      if (closeLayers) closeLayers.classList.add('is-visible');
    } else {
      // Show icon-24 and hide close-layers
      if (icon24) icon24.classList.remove('is-hidden');
      if (closeLayers) closeLayers.classList.remove('is-visible');
    }
  }

  /**
   * Toggle logo and menu title visibility
   * @param {string|null} subMenuType - 'services', 'about', or null
   * @param {boolean} showTitle - true to show title, false to show logo
   */
  function toggleLogoAndTitle(subMenuType, showTitle) {
    const logo = document.querySelector('.nav_logo-link-center');
    const servicesTitle = document.querySelector('.menu_title.is-services');
    const aboutTitle = document.querySelector('.menu_title.is-about');

    if (showTitle) {
      // Hide logo first
      if (logo) logo.classList.add('is-hidden');

      // Hide all titles first
      if (servicesTitle) servicesTitle.classList.remove('is-visible');
      if (aboutTitle) aboutTitle.classList.remove('is-visible');

      // Show the specific title after a short delay
      setTimeout(() => {
        if (subMenuType === 'services' && servicesTitle) {
          servicesTitle.classList.add('is-visible');
        } else if (subMenuType === 'about' && aboutTitle) {
          aboutTitle.classList.add('is-visible');
        }
      }, 100);
    } else {
      // Hide titles first
      if (servicesTitle) servicesTitle.classList.remove('is-visible');
      if (aboutTitle) aboutTitle.classList.remove('is-visible');

      // Show logo immediately (no delay needed for closing)
      if (logo) logo.classList.remove('is-hidden');
    }
  }

  /**
   * Handle menu item clicks
   * @param {Event} event - Click event
   */
  function handleMenuItemClick(event) {
    const menuItem = event.currentTarget;
    const menuItemId = menuItem.id;

    switch (menuItemId) {
      case 'nav-services':
        openSubMenu('services');
        break;
      case 'nav-about':
        openSubMenu('about');
        break;
      case 'nav-plans':
        // Handle plans click - could navigate or show sub-menu
        console.log('Plans clicked');
        break;
      case 'nav-drivers':
        // Handle drivers click
        console.log('Drivers clicked');
        break;
      default:
        break;
    }
  }

  /**
   * Handle back button click
   */
  function handleBackClick() {
    closeSubMenu();
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (!MenuState.isOpen) return;

    switch (event.key) {
      case 'Escape':
        if (MenuState.currentSubMenu) {
          closeSubMenu();
        } else {
          closeMenu();
        }
        break;
      case 'Tab':
        // Trap focus within menu when open
        trapFocus(event);
        break;
    }
  }

  /**
   * Trap focus within the menu for accessibility
   * @param {KeyboardEvent} event
   */
  function trapFocus(event) {
    const focusableElements = elements.menuWrapper.querySelectorAll(
      'a[href], button, [tabindex]:not([tabindex="-1"]), input, select, textarea'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  /**
   * Set up event listeners
   */
  function bindActivate(el, handler) {
    if (!el) return;
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handler(event);
    });
  }

  function setupEventListeners() {
    // Burger icon click / keyboard
    bindActivate(elements.burgerIcon, (e) => {
      e.preventDefault();
      toggleMenu();
    });

    // Close icon click / keyboard
    bindActivate(elements.closeIconMain, (e) => {
      e.preventDefault();
      closeMenu();
    });

    // Back icon click / keyboard
    bindActivate(elements.backIcon, (e) => {
      e.preventDefault();
      handleBackClick();
    });

    // Close layers icon click (in nav_account-mob) - closes entire menu
    const closeLayersIcon = document.querySelector('[icon-action="close-layers"]');
    bindActivate(closeLayersIcon, (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    });

    // Menu items clicks
    Object.values(elements.menuItems).forEach(item => {
      if (item) {
        item.addEventListener('click', handleMenuItemClick);
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', handleKeydown);

    // Close menu on window resize (if width becomes large)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991 && MenuState.isOpen) {
        closeMenu(false);
      }
    });

    // Close menu when clicking outside
    elements.menuWrapper?.addEventListener('click', (e) => {
      if (e.target === elements.menuWrapper) {
        closeMenu();
      }
    });
  }

  /**
   * Initialize the menu system
   */
  function init() {
    if (!initElements()) {
      console.error('Menu: Could not initialize - missing elements');
      return;
    }

    if (elements.menuWrapper && !elements.menuWrapper.id) {
      elements.menuWrapper.id = 'mobile-menu';
    }
    syncMenuAria(false);

    setupEventListeners();
    setupScrollHide();
    console.log('Menu: Initialized successfully');
  }

  /**
   * Setup scroll-based navbar hide/show
   */
  function setupScrollHide() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let lastScrollTop = 0;
    let scrollThreshold = 10; // Minimum scroll amount to trigger hide/show
    let ticking = false;

    // Monitor mobile menu state
    const observer = new MutationObserver(() => {
      if (MenuState.isOpen) {
        navbar.classList.add('menu-open');
      } else {
        navbar.classList.remove('menu-open');
      }
    });

    // Observe menu wrapper for class changes
    const menuWrapper = document.querySelector('.menu_open-wrapper');
    if (menuWrapper) {
      observer.observe(menuWrapper, { attributes: true, attributeFilter: ['class'] });
    }

    // Monitor desktop dropdowns
    const dropdowns = document.querySelectorAll('.w-dropdown');
    dropdowns.forEach(dropdown => {
      const dropdownObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const isOpen = dropdown.classList.contains('w-dropdown--open');
            if (isOpen) {
              navbar.classList.add('menu-open');
            } else {
              // Check if any other dropdown is still open
              const anyOpen = document.querySelector('.w-dropdown--open');
              if (!anyOpen && !MenuState.isOpen) {
                navbar.classList.remove('menu-open');
              }
            }
          }
        });
      });

      dropdownObserver.observe(dropdown, { attributes: true, attributeFilter: ['class'] });
    });

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Don't hide if menu is open
          if (navbar.classList.contains('menu-open')) {
            lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            ticking = false;
            return;
          }

          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollDelta = scrollTop - lastScrollTop;

          // Scrolling down and past the threshold
          if (scrollDelta > scrollThreshold && scrollTop > 100) {
            navbar.classList.add('is-hidden');
          }
          // Scrolling up
          else if (scrollDelta < -scrollThreshold) {
            navbar.classList.remove('is-hidden');
          }

          lastScrollTop = scrollTop;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API for external use
  window.MenuController = {
    open: openMenu,
    close: closeMenu,
    toggle: toggleMenu,
    isOpen: () => MenuState.isOpen,
    openSubMenu: openSubMenu,
    closeSubMenu: closeSubMenu
  };

})();


/**
 * End of Menu Toggle Animation Controller
*/

// ==========================================
// START: Desktop Services Accordion Controller
// ==========================================
(function() {
  'use strict';

  const DESKTOP_MQ = '(min-width: 992px)';
  const IMAGE_KEYS = ['on-demand', 'city-to-city', 'transfer', 'personal'];

  const state = {
    activeIndex: 0,
    activeImageIndex: -1,
    items: [],
    images: [],
    isDesktop: false,
    isReady: false,
    scrollToIndex: null,
    imageTween: null
  };

  function queryDesktopRoot() {
    return document.querySelector('.services_box-desktop');
  }

  function collectItems(root) {
    return Array.from(root.querySelectorAll('.services_list > .services_item')).map((item) => {
      return {
        el: item,
        title: item.querySelector('.services_item-title-holder'),
        content: item.querySelector('.services_item-content-holder'),
        progress: item.querySelector('.services_progress')
      };
    });
  }

  function collectImages(root) {
    const wrapper = root.querySelector('.services_img-wrapper-desk');
    if (!wrapper) return [];

    return IMAGE_KEYS.map((key) => wrapper.querySelector(`.services_img.${key}`)).filter(Boolean);
  }

  function setProgressFill(progressEl, amount) {
    if (!progressEl) return;
    const value = Math.max(0, Math.min(1, amount));
    progressEl.style.transform = `scaleX(${value})`;
  }

  function setActiveImage(index, immediate) {
    if (!state.images.length) return;
    if (index === state.activeImageIndex && !immediate) return;

    const nextImg = state.images[index];
    if (!nextImg) return;

    // Stop any previous GSAP transforms/tweens so nothing can slide/scale
    if (typeof gsap !== 'undefined') {
      if (state.imageTween) {
        state.imageTween.kill();
        state.imageTween = null;
      }
      gsap.killTweensOf(state.images);
      gsap.set(state.images, {
        clearProps: 'transform,translate,x,y,xPercent,yPercent,scale,scaleX,scaleY,rotation'
      });
    }

    state.images.forEach((img, i) => {
      const isActive = i === index;
      img.classList.toggle('is-active', isActive);
      img.style.transform = 'none';
      img.style.translate = 'none';

      if (immediate) {
        img.style.transition = 'none';
        img.style.opacity = isActive ? '1' : '0';
        // Force reflow then restore CSS transition for later fades
        void img.offsetWidth;
        img.style.transition = '';
      } else {
        img.style.opacity = isActive ? '1' : '0';
      }
    });

    state.activeImageIndex = index;
  }

  function setItemClasses(entry, isActive) {
    entry.el.classList.toggle('is-open', isActive);

    if (entry.title) {
      entry.title.classList.toggle('is-active', isActive);
      entry.title.classList.toggle('is-not-active', !isActive);
    }

    if (entry.content) {
      entry.content.classList.toggle('is-not-active', !isActive);
    }

    if (entry.progress) {
      entry.progress.classList.toggle('is-visible', isActive);
      entry.progress.classList.toggle('is-hidden', !isActive);
      if (!isActive) {
        setProgressFill(entry.progress, 0);
      }
    }
  }

  function activate(index, options) {
    if (!state.isReady || !state.isDesktop) return;
    if (index < 0 || index >= state.items.length) return;

    const opts = options || {};
    const previous = state.activeIndex;
    const next = index;

    if (previous !== next) {
      state.items.forEach((entry, i) => {
        setItemClasses(entry, i === next);
      });
      setActiveImage(next, false);
      state.activeIndex = next;
    } else {
      setItemClasses(state.items[next], true);
    }

    state.items.forEach((entry, i) => {
      if (!entry.el) return;
      const active = i === state.activeIndex;
      entry.el.setAttribute('aria-pressed', active ? 'true' : 'false');
      entry.el.setAttribute('aria-current', active ? 'true' : 'false');
    });

    const progressAmount = typeof opts.progress === 'number' ? opts.progress : (previous === next ? undefined : 0);
    if (typeof progressAmount === 'number' && state.items[next]) {
      setProgressFill(state.items[next].progress, progressAmount);
    }

    if (opts.scroll && typeof state.scrollToIndex === 'function') {
      state.scrollToIndex(next);
    }
  }

  function setFromScroll(index, progress) {
    activate(index, { progress: progress, scroll: false });
  }

  function onItemClick(event) {
    if (!state.isDesktop) return;
    if (event.target.closest('a, button')) return;

    const item = event.currentTarget;
    const index = state.items.findIndex((entry) => entry.el === item);
    if (index < 0 || index === state.activeIndex) return;

    activate(index, { progress: 0, scroll: true });
  }

  function bindClicks() {
    state.items.forEach((entry) => {
      if (!entry.el) return;
      entry.el.addEventListener('click', onItemClick);
      entry.el.setAttribute('role', 'button');
      entry.el.setAttribute('tabindex', '0');
      entry.el.setAttribute('aria-pressed', 'false');
      entry.el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onItemClick(event);
        }
      });
    });
  }

  function syncDesktopFlag() {
    state.isDesktop = window.matchMedia(DESKTOP_MQ).matches;
  }

  function init() {
    const root = queryDesktopRoot();
    if (!root) return;

    state.items = collectItems(root);
    state.images = collectImages(root);

    if (state.items.length === 0) {
      console.warn('ServicesDesktop: No service items found');
      return;
    }

    syncDesktopFlag();
    bindClicks();

    // Initial UI state from markup / first item
    let initial = state.items.findIndex((entry) => entry.title && entry.title.classList.contains('is-active'));
    if (initial < 0) initial = 0;

    state.isReady = true;
    if (state.isDesktop) {
      setActiveImage(initial, true);
      activate(initial, { progress: 0, scroll: false });
    }

    const mq = window.matchMedia(DESKTOP_MQ);
    const onMqChange = () => {
      syncDesktopFlag();
      if (state.isDesktop) {
        setActiveImage(state.activeIndex, true);
        activate(state.activeIndex, { progress: 0, scroll: false });
      }
    };

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onMqChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onMqChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ServicesDesktop = {
    activate: activate,
    setFromScroll: setFromScroll,
    setProgressFill: setProgressFill,
    getActiveIndex: () => state.activeIndex,
    getItemCount: () => state.items.length,
    isReady: () => state.isReady,
    isDesktop: () => state.isDesktop,
    registerScrollToIndex: (fn) => {
      state.scrollToIndex = fn;
    },
    getItems: () => state.items
  };
})();
// ==========================================
// END: Desktop Services Accordion Controller
// ==========================================

// ==========================================
// START: FAQ Accordion
// ==========================================
(function() {
  'use strict';

  function getParts(item) {
    return {
      answer: item.querySelector('.faq_answer'),
      icon: item.querySelector('.faq_question-group .icon-24')
    };
  }

  function clearHeightListener(answer) {
    if (!answer) return;
    if (answer._faqHeightHandler) {
      answer.removeEventListener('transitionend', answer._faqHeightHandler);
      answer._faqHeightHandler = null;
    }
    if (answer._faqFallbackTimer) {
      window.clearTimeout(answer._faqFallbackTimer);
      answer._faqFallbackTimer = null;
    }
  }

  function setAnswerHeight(answer, px) {
    // Override CSS height: 0 !important via setProperty priority
    answer.style.setProperty('height', px, 'important');
  }

  function collapseAnswer(answer, immediate) {
    if (!answer) return;
    clearHeightListener(answer);

    if (immediate) {
      setAnswerHeight(answer, '0px');
      answer.classList.add('is-hide');
      return;
    }

    const start = answer.scrollHeight || answer.offsetHeight || 0;
    setAnswerHeight(answer, start + 'px');
    void answer.offsetHeight;

    const finish = () => {
      clearHeightListener(answer);
      answer.classList.add('is-hide');
      setAnswerHeight(answer, '0px');
    };

    answer._faqHeightHandler = (event) => {
      if (event.target !== answer) return;
      if (event.propertyName && event.propertyName !== 'height') return;
      finish();
    };
    answer.addEventListener('transitionend', answer._faqHeightHandler);
    answer._faqFallbackTimer = window.setTimeout(finish, 400);
    setAnswerHeight(answer, '0px');
  }

  function expandAnswer(answer, immediate) {
    if (!answer) return;
    clearHeightListener(answer);

    answer.classList.remove('is-hide');
    if (window.Kashida && typeof window.Kashida.refresh === 'function') {
      window.requestAnimationFrame(function () {
        window.Kashida.refresh(answer);
      });
    }

    if (immediate) {
      setAnswerHeight(answer, 'auto');
      return;
    }

    setAnswerHeight(answer, '0px');
    void answer.offsetHeight;
    const target = answer.scrollHeight;
    setAnswerHeight(answer, Math.max(target, 1) + 'px');

    const finish = () => {
      clearHeightListener(answer);
      // Keep pixel height (auto + !important fights); remeasure if needed
      setAnswerHeight(answer, answer.scrollHeight + 'px');
    };

    answer._faqHeightHandler = (event) => {
      if (event.target !== answer) return;
      if (event.propertyName && event.propertyName !== 'height') return;
      finish();
    };
    answer.addEventListener('transitionend', answer._faqHeightHandler);
    answer._faqFallbackTimer = window.setTimeout(finish, 400);
  }

  function setExpandedState(item, expanded) {
    const question = item.querySelector('.faq_question-group');
    const answer = item.querySelector('.faq_answer');
    const value = expanded ? 'true' : 'false';
    item.removeAttribute('role');
    item.removeAttribute('tabindex');
    item.removeAttribute('aria-expanded');
    item.removeAttribute('aria-controls');
    if (question) question.setAttribute('aria-expanded', value);
    if (answer) {
      if (expanded) answer.removeAttribute('aria-hidden');
      else answer.setAttribute('aria-hidden', 'true');
    }
  }

  function closeItem(item, immediate) {
    const parts = getParts(item);
    item.classList.remove('is-active');
    setExpandedState(item, false);
    if (parts.icon) parts.icon.classList.remove('is-open');
    collapseAnswer(parts.answer, immediate);
  }

  function openItem(item, list, immediate) {
    list.querySelectorAll('.faq_item.is-active').forEach((active) => {
      if (active !== item) closeItem(active, immediate);
    });

    const parts = getParts(item);
    item.classList.add('is-active');
    setExpandedState(item, true);
    if (parts.icon) parts.icon.classList.add('is-open');
    expandAnswer(parts.answer, immediate);
  }

  function toggleItem(item, list) {
    if (item.classList.contains('is-active')) closeItem(item, false);
    else openItem(item, list, false);
  }

  function bindItem(item, list, index) {
    if (item.dataset.faqBound === 'true') return;
    item.dataset.faqBound = 'true';

    const parts = getParts(item);
    const question = item.querySelector('.faq_question-group');
    const answerId = 'faq-answer-' + (index + 1);

    item.classList.remove('is-active');
    item.removeAttribute('role');
    item.removeAttribute('tabindex');
    item.removeAttribute('aria-expanded');
    item.removeAttribute('aria-controls');

    if (parts.icon) parts.icon.classList.remove('is-open');
    if (parts.answer) {
      parts.answer.id = answerId;
      parts.answer.setAttribute('role', 'region');
      parts.answer.setAttribute('aria-hidden', 'true');
      clearHeightListener(parts.answer);
      parts.answer.classList.add('is-hide');
      setAnswerHeight(parts.answer, '0px');
    }

    if (question) {
      if (!question.id) question.id = 'faq-question-' + (index + 1);
      question.setAttribute('role', 'button');
      question.setAttribute('tabindex', '0');
      question.setAttribute('aria-expanded', 'false');
      question.setAttribute('aria-controls', answerId);
      if (parts.answer) parts.answer.setAttribute('aria-labelledby', question.id);
    }

    const onActivate = (event) => {
      if (event.target.closest('a, button, input, textarea, select')) return;
      event.preventDefault();
      toggleItem(item, list);
    };

    item.addEventListener('click', onActivate);
    if (question) {
      question.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        onActivate(event);
      });
    }
  }

  function initFaqList(list) {
    const items = Array.from(list.querySelectorAll('.faq_item'));
    items.forEach((item, index) => {
      bindItem(item, list, index);
    });

    // First item open by default
    if (items[0] && !list.dataset.faqOpenedDefault) {
      list.dataset.faqOpenedDefault = 'true';
      openItem(items[0], list, true);
    }
  }

  function init() {
    document.querySelectorAll('.faq_list').forEach(initFaqList);
  }

  function boot() {
    init();
    window.setTimeout(init, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.FaqAccordion = {
    refresh: init
  };
})();
// ==========================================
// END: FAQ Accordion
// ==========================================

// ==========================================
// START: Story Card Background Videos
// ==========================================
(function() {
  'use strict';

  function resolveStorySrc(host) {
    const urlField = host.closest('.story_item')?.querySelector('.story_video-url');
    const urlFromProp = urlField ? (urlField.textContent || '').trim() : '';
    const existingEl = host.querySelector('source[src], video[src]');
    const fromDom = existingEl ? existingEl.getAttribute('src') : '';
    const dataSrc = (host.getAttribute('data-video-src') || '').trim();
    return urlFromProp || fromDom || dataSrc;
  }

  function prepareVideo(host, video) {
    video.classList.add('story_video-el');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'none');
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('data-wf-ignore', 'true');
    video.removeAttribute('autoplay');
    video.removeAttribute('id');
  }

  function loadAndPlay(video, src, reduceMotion) {
    if (video.getAttribute('src') !== src) {
      video.src = src;
    }
    if (reduceMotion) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }
    video.autoplay = true;
    video.setAttribute('autoplay', '');
    const play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(function() {});
    }
  }

  function isFeaturedHost(host) {
    const item = host.closest('.story_item');
    if (!item) return false;
    if (item.classList.contains('featured')) return true;
    if (item.closest('.is-story-featured, .story_featured-slot')) return true;
    return Array.from(item.classList).some(function(cls) {
      return cls.indexOf('d6f6e90e') !== -1;
    });
  }

  function bindHoverPlayback(card, video, src, reduceMotion) {
    if (card.getAttribute('data-story-hover-bound') === '1') return;
    card.setAttribute('data-story-hover-bound', '1');

    const start = function() {
      loadAndPlay(video, src, reduceMotion);
    };
    const stop = function() {
      if (video.getAttribute('src')) {
        video.pause();
        video.removeAttribute('autoplay');
      }
    };

    // mouseenter/leave match CSS :hover, including sticky tap-hover on touch.
    // pointerleave fires on finger-up and would cancel the video immediately.
    card.addEventListener('mouseenter', start);
    card.addEventListener('focusin', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('focusout', function(event) {
      if (!card.contains(event.relatedTarget)) stop();
    });
  }

  function mountStoryVideos() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hosts = document.querySelectorAll('.section_story .story_video');

    if (!window.__storyVideoObserver) {
      window.__storyVideoObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          const host = entry.target;
          if (!isFeaturedHost(host)) return;
          const video = host.querySelector('video');
          const src = host.getAttribute('data-video-src');
          if (!video || !src) return;
          if (entry.isIntersecting) {
            loadAndPlay(video, src, reduceMotion);
          } else if (video.getAttribute('src')) {
            video.pause();
          }
        });
      }, { rootMargin: '200px 0px', threshold: 0.01 });
    }

    hosts.forEach((host) => {
      const src = resolveStorySrc(host);
      if (!src) return;

      host.setAttribute('data-video-src', src);
      host.setAttribute('data-autoplay', 'false');

      let video = host.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        host.insertBefore(video, host.firstChild);
      }

      prepareVideo(host, video);

      if (video.getAttribute('src') && video.getAttribute('src') !== src) {
        video.removeAttribute('src');
        video.load();
      }

      const card = host.closest('.story_item') || host;
      if (isFeaturedHost(host)) {
        window.__storyVideoObserver.observe(host);
      } else {
        bindHoverPlayback(card, video, src, reduceMotion);
      }
    });
  }

  function initStoryVideos() {
    mountStoryVideos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStoryVideos);
  } else {
    initStoryVideos();
  }

  window.StoryVideos = {
    refresh: mountStoryVideos
  };
})();
// ==========================================
// END: Story Card Background Videos
// ==========================================

// ==========================================
// START: Story Featured Desktop Pin
// ==========================================
(function() {
  'use strict';

  // Desktop only (≥992). Under 991: clear any leftover markers/placement
  // and do nothing — Webflow owns tablet/mobile story layout.
  const FEATURED_VARIANT_TOKEN = 'd6f6e90e';
  const DESKTOP_MQ = '(min-width: 992px)';

  function isFeaturedCell(cell) {
    if (cell.classList.contains('story_featured-slot')) return true;

    const content = cell.matches('.story_content')
      ? cell
      : cell.querySelector('.story_content');
    if (!content) return false;

    if (content.classList.contains('featured')) return true;

    const roots = [cell, cell.querySelector('.story_item')].filter(Boolean);
    if (
      roots.some((node) =>
        Array.from(node.classList).some(
          (cls) => cls.includes(FEATURED_VARIANT_TOKEN) || cls === 'featured'
        )
      )
    ) {
      return true;
    }

    return window.getComputedStyle(content).position === 'sticky';
  }

  function clearCell(cell) {
    cell.classList.remove('is-story-featured');
    cell.style.removeProperty('grid-row');
    cell.style.removeProperty('grid-column');
  }

  function pinFeaturedStoryCells() {
    const isDesktop = window.matchMedia(DESKTOP_MQ).matches;

    document.querySelectorAll('.section_story .story_grid').forEach((grid) => {
      const cells = Array.from(grid.children);
      let featuredCell = null;

      cells.forEach((cell) => {
        clearCell(cell);
        if (!isFeaturedCell(cell)) return;
        // Mark on all breakpoints (mobile overlay CSS); place only on desktop
        cell.classList.add('is-story-featured');
        featuredCell = cell;
      });

      if (!featuredCell || !isDesktop) return;

      const others = Math.max(0, cells.length - 1);
      const rows = Math.max(1, Math.ceil(others / 2));
      featuredCell.style.gridColumn = '1 / 2';
      featuredCell.style.gridRow = '1 / span ' + rows;
    });

    if (window.StoryVideos && typeof window.StoryVideos.refresh === 'function') {
      window.StoryVideos.refresh();
    }
  }

  function init() {
    pinFeaturedStoryCells();
    window.setTimeout(pinFeaturedStoryCells, 100);
    window.setTimeout(pinFeaturedStoryCells, 500);
    window.addEventListener('resize', pinFeaturedStoryCells);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StoryBentoGrid = {
    refresh: pinFeaturedStoryCells
  };
})();
// ==========================================
// END: Story Featured Desktop Pin
// ==========================================

// ==========================================
// START: SEO Show More / Less
// ==========================================
(function() {
  'use strict';

  const LABEL_MORE = 'مشاهده بیشتر';
  const LABEL_LESS = 'مشاهده کمتر';
  const COLLAPSED_HEIGHT = '5rem';

  function getLabelEl(link) {
    // Label is the non-icon child of .seo_link (div wrapping the string)
    const icon = link.querySelector('.icon-24');
    if (icon && icon.nextElementSibling) return icon.nextElementSibling;
    return Array.from(link.children).find((el) => !el.classList.contains('icon-24')) || null;
  }

  function setLabel(link, text) {
    const labelEl = getLabelEl(link);
    if (!labelEl) return;
    labelEl.textContent = text;
  }

  function clearHeightListener(el) {
    if (!el) return;
    if (el._seoHeightHandler) {
      el.removeEventListener('transitionend', el._seoHeightHandler);
      el._seoHeightHandler = null;
    }
    if (el._seoFallbackTimer) {
      window.clearTimeout(el._seoFallbackTimer);
      el._seoFallbackTimer = null;
    }
  }

  function expandText(textEl) {
    clearHeightListener(textEl);
    textEl.style.height = textEl.offsetHeight + 'px';
    void textEl.offsetHeight;
    textEl.style.height = textEl.scrollHeight + 'px';

    const finish = () => {
      clearHeightListener(textEl);
      textEl.style.height = 'auto';
    };

    textEl._seoHeightHandler = (event) => {
      if (event.target !== textEl) return;
      if (event.propertyName && event.propertyName !== 'height') return;
      finish();
    };
    textEl.addEventListener('transitionend', textEl._seoHeightHandler);
    textEl._seoFallbackTimer = window.setTimeout(finish, 500);
  }

  function collapseText(textEl) {
    clearHeightListener(textEl);
    textEl.style.height = textEl.scrollHeight + 'px';
    void textEl.offsetHeight;
    textEl.style.height = COLLAPSED_HEIGHT;

    const finish = () => {
      clearHeightListener(textEl);
      textEl.style.height = COLLAPSED_HEIGHT;
    };

    textEl._seoHeightHandler = (event) => {
      if (event.target !== textEl) return;
      if (event.propertyName && event.propertyName !== 'height') return;
      finish();
    };
    textEl.addEventListener('transitionend', textEl._seoHeightHandler);
    textEl._seoFallbackTimer = window.setTimeout(finish, 500);
  }

  function toggleSeo(wrapper) {
    const textEl = wrapper.querySelector('.seo_text');
    const link = wrapper.querySelector('.seo_link');
    if (!textEl || !link) return;

    const isOpen = wrapper.classList.contains('is-seo-open');

    if (isOpen) {
      wrapper.classList.remove('is-seo-open');
      setLabel(link, LABEL_MORE);
      link.setAttribute('aria-expanded', 'false');
      collapseText(textEl);
    } else {
      wrapper.classList.add('is-seo-open');
      setLabel(link, LABEL_LESS);
      link.setAttribute('aria-expanded', 'true');
      expandText(textEl);
    }
  }

  function initSeoBlock(wrapper) {
    if (wrapper.dataset.seoBound === 'true') return;
    wrapper.dataset.seoBound = 'true';

    const link = wrapper.querySelector('.seo_link');
    const textEl = wrapper.querySelector('.seo_text');
    if (!link || !textEl) return;

    link.setAttribute('role', 'button');
    link.setAttribute('tabindex', '0');
    link.setAttribute('aria-expanded', 'false');
    if (!textEl.id) textEl.id = 'seo-expand-text';
    link.setAttribute('aria-controls', textEl.id);
    setLabel(link, LABEL_MORE);

    // Ensure collapsed height matches Webflow default
    textEl.style.height = COLLAPSED_HEIGHT;

    link.addEventListener('click', (event) => {
      event.preventDefault();
      toggleSeo(wrapper);
    });

    link.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleSeo(wrapper);
    });
  }

  function init() {
    document.querySelectorAll('.section_seo .seo_wrapper').forEach(initSeoBlock);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SeoExpand = {
    refresh: init
  };
})();
// ==========================================
// END: SEO Show More / Less
// ==========================================

// ==========================================
// START: Accessibility Enhancements
// ==========================================
(function() {
  'use strict';

  const SOCIAL_LABELS = [
    { test: /instagram|instagr\.am/i, label: 'اینستاگرام ونکسی' },
    { test: /linkedin|lnkd\.in/i, label: 'لینکدین ونکسی' },
    { test: /t\.me|telegram/i, label: 'تلگرام ونکسی' },
    { test: /x\.com|twitter/i, label: 'اکس (توییتر) ونکسی' },
    { test: /youtube|youtu\.be/i, label: 'یوتیوب ونکسی' },
    { test: /whatsapp|wa\.me/i, label: 'واتساپ ونکسی' },
    { test: /aparat/i, label: 'آپارات ونکسی' }
  ];

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function ensureDocumentLang() {
    const html = document.documentElement;
    if (!html) return;
    // Site content is Persian; keep lang aligned for AT / SEO
    if (!html.lang || html.lang.toLowerCase() === 'en' || html.lang.toLowerCase() === 'en-us') {
      html.lang = 'fa';
    }
    // Do not set dir=rtl on <html> — Webflow layout owns direction
  }

  function injectSkipLink() {
    if (document.querySelector('.skip-link')) return;
    const main = document.getElementById('main-content') || document.querySelector('main');
    if (!main) return;
    if (!main.id) main.id = 'main-content';

    const link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + main.id;
    link.textContent = 'پرش به محتوای اصلی';
    document.body.insertBefore(link, document.body.firstChild);
  }

  function hideDecorativeSvgs() {
    document.querySelectorAll('.icon-24 svg, .burger-icon svg, .close-icon svg, .back-icon svg, .faq_icon svg').forEach((svg) => {
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
    });
  }

  function labelSocialLinks() {
    document.querySelectorAll('.footer_social-item').forEach((link, index) => {
      const href = link.getAttribute('href') || '';
      const match = SOCIAL_LABELS.find((item) => item.test.test(href));
      const current = link.getAttribute('aria-label') || '';
      const isGeneric = !current || /^شبکه اجتماعی\s*\d+$/i.test(current);
      if (match) {
        link.setAttribute('aria-label', match.label);
      } else if (isGeneric) {
        link.setAttribute('aria-label', 'شبکه اجتماعی ' + (index + 1));
      }
      if (/^https?:/i.test(href)) {
        link.setAttribute('rel', 'noopener noreferrer');
        if (!link.getAttribute('target')) link.setAttribute('target', '_blank');
      }
    });
  }

  function enhanceStoryCards() {
    document.querySelectorAll('.story_video video, .story_video-url').forEach((el) => {
      el.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.section_story .story_item').forEach((card) => {
      if (!card.getAttribute('aria-label')) {
        const title =
          card.querySelector('.story_heading:not(.featured)') ||
          card.querySelector('.story_heading');
        const label = (title && title.textContent || '').replace(/\s+/g, ' ').trim();
        if (label) card.setAttribute('aria-label', label);
      }
    });
  }

  function init() {
    ensureDocumentLang();
    injectSkipLink();
    hideDecorativeSvgs();
    labelSocialLinks();
    enhanceStoryCards();

    if (prefersReducedMotion()) {
      document.documentElement.classList.add('reduce-motion');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
// ==========================================
// END: Accessibility Enhancements
// ==========================================
