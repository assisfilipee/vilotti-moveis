(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const hero = document.querySelector('.hero');
  const topLink = document.querySelector('.back-to-top');
  const portfolio = document.querySelector('.portfolio');
  const projectButtons = [...document.querySelectorAll('.project-button')];
  const projectFrames = [...document.querySelectorAll('.project-frame')];
  const projectImages = portfolio?.querySelector('.project-images');
  const projectCounter = portfolio?.querySelector('.project-counter');
  const processSteps = document.querySelector('.process-steps');
  const steps = [...document.querySelectorAll('.process-step')];
  const widget = document.querySelector('.whatsapp-widget');
  const year = document.getElementById('current-year');
  const mobileMenu = matchMedia('(max-width: 760px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let menuOpen = false;
  let activeProject = -1;
  let frameRequest = 0;
  let bubbleShowTimer;
  let bubbleHideTimer;
  let revealObserver;
  let bubbleAlreadyShown = false;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const headerHeight = () => header?.offsetHeight || 0;
  // Keep anchors, sticky panels and viewport budgets in sync with the actual header.
  function syncHeaderHeight() {
    if (!header) return;
    const height = `${Math.ceil(header.getBoundingClientRect().height)}px`;
    if (document.documentElement.style.getPropertyValue('--header-height') !== height) {
      document.documentElement.style.setProperty('--header-height', height);
      scheduleUpdate();
    }
  }
  const headerObserver = 'ResizeObserver' in window ? new ResizeObserver(syncHeaderHeight) : null;
  if (header) headerObserver?.observe(header);

  if (year) year.textContent = String(new Date().getFullYear());

  // A closed mobile menu leaves the tab order; desktop links are always available.
  function setMenu(open, returnFocus = false) {
    if (!menuToggle || !nav) return;
    menuOpen = open && mobileMenu.matches;
    menuToggle.setAttribute('aria-expanded', String(menuOpen));
    const label = menuToggle.querySelector('.menu-toggle-label');
    if (label) label.textContent = menuOpen ? 'Fechar' : 'Menu';
    nav.classList.toggle('is-open', menuOpen);
    nav.inert = mobileMenu.matches && !menuOpen;
    header?.classList.toggle('menu-is-open', menuOpen);
    document.body.classList.toggle('menu-open', menuOpen);
    document.querySelector('main')?.toggleAttribute('inert', menuOpen);
    document.querySelector('footer')?.toggleAttribute('inert', menuOpen);
    document.querySelector('.whatsapp-widget')?.toggleAttribute('inert', menuOpen);
    if (returnFocus) menuToggle.focus({ preventScroll: true });
  }

  if (menuToggle && nav) {
    document.documentElement.classList.add('menu-ready');
    setMenu(false);
    menuToggle.addEventListener('click', () => {
      setMenu(!menuOpen);
      if (menuOpen) nav.querySelector('a')?.focus({ preventScroll: true });
    });
    nav.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link || !menuOpen) return;
      setMenu(false);
      const href = link.getAttribute('href');
      if (href?.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        }
      } else {
        menuToggle.focus({ preventScroll: true });
      }
    });
    document.addEventListener('keydown', (event) => {
      if (!menuOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false, true);
      }
      if (event.key === 'Tab') {
        const links = [...nav.querySelectorAll('a[href]')];
        const first = menuToggle;
        const last = links.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    mobileMenu.addEventListener('change', () => setMenu(false));
  }

  function activateProject(index) {
    if (!projectFrames.length) return;
    index = (index + projectFrames.length) % projectFrames.length;
    if (index === activeProject) return;
    activeProject = index;
    projectButtons.forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
    projectFrames.forEach((figure, i) => {
      figure.classList.toggle('is-active', i === index);
      figure.setAttribute('aria-hidden', String(i !== index));
      figure.inert = i !== index;
    });
    const name = projectFrames[index].querySelector('figcaption span')?.textContent || '';
    if (projectCounter) {
      projectCounter.textContent = `${String(index + 1).padStart(2, '0')} — ${String(projectFrames.length).padStart(2, '0')}`;
      projectCounter.setAttribute('aria-label', `Projeto ${index + 1} de ${projectFrames.length}: ${name}`);
    }
    // Prepare the adjacent image without fetching every slide at page load.
    [index, (index + 1) % projectFrames.length].forEach(i => {
      const img = projectFrames[i].querySelector('img');
      if (img) img.loading = 'eager';
    });
  }

  function configurePortfolio() {
    if (!portfolio || !projectImages || !projectFrames.length) return;
    projectFrames.forEach((figure, index) => {
      figure.setAttribute('role', 'group');
      figure.setAttribute('aria-roledescription', 'slide');
      figure.setAttribute('aria-label', `${index + 1} de ${projectFrames.length}`);
    });
    activateProject(0);
    portfolio.querySelectorAll('.project-controls, .project-navigation').forEach(control => { control.hidden = false; });
    projectButtons.forEach((button, index) => button.addEventListener('click', () => activateProject(index)));
    portfolio.querySelector('.project-previous')?.addEventListener('click', () => activateProject(activeProject - 1));
    portfolio.querySelector('.project-next')?.addEventListener('click', () => activateProject(activeProject + 1));
    portfolio.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        activateProject(activeProject + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    let touchStart = null;
    projectImages.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.pointerType === 'mouse') return;
      touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
      projectImages.setPointerCapture(event.pointerId);
    });
    projectImages.addEventListener('pointerup', event => {
      if (!touchStart || touchStart.id !== event.pointerId) return;
      const dx = event.clientX - touchStart.x;
      const dy = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) activateProject(activeProject + (dx < 0 ? 1 : -1));
    });
    projectImages.addEventListener('pointercancel', () => { touchStart = null; });
    projectImages.addEventListener('lostpointercapture', () => { touchStart = null; });
  }

  function updateViewport() {
    frameRequest = 0;
    header?.classList.toggle('is-scrolled', window.scrollY > 24);
    if (hero && topLink) {
      const visible = hero.getBoundingClientRect().bottom <= headerHeight();
      topLink.classList.toggle('is-visible', visible);
      topLink.setAttribute('aria-hidden', String(!visible));
      topLink.tabIndex = visible ? 0 : -1;
    }
    if (processSteps) {
      const rect = processSteps.getBoundingClientRect();
      if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
        const progress = clamp((window.innerHeight * .62 - rect.top - 20) / Math.max(rect.height - 85, 1));
        processSteps.style.setProperty('--process-progress', String(progress));
        steps.forEach((step) => step.classList.toggle('is-passed', step.getBoundingClientRect().top < window.innerHeight * .62));
      }
    }
  }

  function scheduleUpdate() {
    if (!frameRequest) frameRequest = requestAnimationFrame(updateViewport);
  }

  // Content is visible by default. Reveals only decorate its first entrance.
  function configureReveals() {
    revealObserver?.disconnect();
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .12 });
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => revealObserver.observe(element));
  }

  function startBubble() {
    if (!widget || bubbleAlreadyShown) return;
    bubbleShowTimer = setTimeout(() => {
      bubbleAlreadyShown = true;
      widget.classList.add('show-bubble');
      bubbleHideTimer = setTimeout(() => widget.classList.remove('show-bubble'), 3000);
    }, 5000);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('resize', syncHeaderHeight, { passive: true });
  window.addEventListener('load', scheduleUpdate, { once: true });
  reducedMotion.addEventListener('change', configureReveals);
  configurePortfolio();
  syncHeaderHeight();
  configureReveals();
  startBubble();

  window.addEventListener('pagehide', () => {
    clearTimeout(bubbleShowTimer);
    clearTimeout(bubbleHideTimer);
    widget?.classList.remove('show-bubble');
    revealObserver?.disconnect();
    headerObserver?.disconnect();
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    setMenu(false);
    if (header) headerObserver?.observe(header);
    syncHeaderHeight();
    configureReveals();
    startBubble();
    scheduleUpdate();
  });
})();
