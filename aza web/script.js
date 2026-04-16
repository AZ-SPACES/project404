/* =============================================
   AZA — Website JavaScript
   Animations powered by Motion (motionone.dev)
   — same engine as Framer Motion, for vanilla JS
   ============================================= */

const { animate, stagger, inView, scroll } = Motion;

// Easing curves
const ease      = [0.22, 1, 0.36, 1];   // ease-out-quint — snappy entrances
const easeIn    = [0.64, 0, 0.78, 0];   // ease-in-quint
const spring    = { type: 'spring', stiffness: 300, damping: 28 };
const springSnap= { type: 'spring', stiffness: 500, damping: 35 };

/* -----------------------------------------------
   THEME TOGGLE
----------------------------------------------- */
const html      = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');

const savedTheme = localStorage.getItem('aza-theme') || 'light';
html.setAttribute('data-theme', savedTheme);
themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('aza-theme', next);

  animate(themeToggle, { rotate: [0, 20, -10, 0] }, { duration: 0.4, ease });
});

/* -----------------------------------------------
   HAMBURGER / MOBILE MENU
----------------------------------------------- */
const hamburger  = document.getElementById('hamburger');
const navLinks   = document.getElementById('navLinks');
const mobileMenu = document.getElementById('navLinks-mobile');

function buildMobileMenu() {
  mobileMenu.innerHTML = '';
  navLinks.querySelectorAll('a').forEach(link => {
    const clone = link.cloneNode(true);
    clone.classList.remove('btn', 'btn--sm', 'btn--accent');
    clone.classList.add('nav__link');
    mobileMenu.appendChild(clone);
  });

  const divider = document.createElement('div');
  divider.className = 'nav__mobile-divider';
  mobileMenu.appendChild(divider);

  const login = document.createElement('a');
  login.href = '#'; login.className = 'nav__login'; login.textContent = 'Log in';
  mobileMenu.appendChild(login);

  const cta = document.createElement('a');
  cta.href = '#download'; cta.className = 'btn btn--accent'; cta.textContent = 'Get the app';
  mobileMenu.appendChild(cta);

  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
}

function closeMenu() {
  hamburger.classList.remove('open');
  animate(mobileMenu, { opacity: 0, scaleY: 0.92, y: -8 }, { duration: 0.18, ease: easeIn })
    .finished.then(() => mobileMenu.classList.remove('open'));
}

hamburger.addEventListener('click', () => {
  const isOpen = !mobileMenu.classList.contains('open');
  hamburger.classList.toggle('open', isOpen);
  if (isOpen) {
    mobileMenu.classList.add('open');
    animate(mobileMenu, { opacity: [0, 1], scaleY: [0.9, 1], y: [-12, 0] },
      { duration: 0.3, ease });
    animate(mobileMenu.querySelectorAll('a, .nav__mobile-divider'),
      { opacity: [0, 1], x: [-8, 0] },
      { delay: stagger(0.04, { start: 0.1 }), duration: 0.25, ease });
  } else {
    closeMenu();
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.nav__island') && !e.target.closest('.nav__mobile-menu')) closeMenu();
});

buildMobileMenu();

/* -----------------------------------------------
   NAVBAR SCROLL STATE
----------------------------------------------- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* -----------------------------------------------
   ENTRANCE: NAV ISLAND
----------------------------------------------- */
animate('#navIsland',
  { opacity: [0, 1], y: [-24, 0], scale: [0.96, 1] },
  { duration: 0.6, ease, delay: 0.1 }
);

/* -----------------------------------------------
   ENTRANCE: HERO  (staggered sequence)
----------------------------------------------- */
// Badge
animate('.badge',
  { opacity: [0, 1], y: [12, 0], scale: [0.92, 1] },
  { duration: 0.5, ease, delay: 0.3 }
);

// Title — each word slides up from behind
const heroTitle = document.querySelector('.hero__title');
if (heroTitle) {
  const words = heroTitle.innerHTML
    .split(/(\s+|<br\s*\/?>)/g)
    .map(w => w.match(/^(\s+|<br)/) ? w : `<span class="word-wrap"><span class="word">${w}</span></span>`)
    .join('');
  heroTitle.innerHTML = words;
  animate('.hero__title .word',
    { opacity: [0, 1], y: ['1em', 0] },
    { delay: stagger(0.06, { start: 0.45 }), duration: 0.55, ease }
  );
}

// Subtitle, CTA, stats
animate('.hero__subtitle',
  { opacity: [0, 1], y: [16, 0] },
  { duration: 0.55, ease, delay: 0.72 }
);
animate('.hero__cta .btn',
  { opacity: [0, 1], y: [14, 0] },
  { delay: stagger(0.1, { start: 0.82 }), duration: 0.5, ease }
);
animate('.stat',
  { opacity: [0, 1], y: [10, 0] },
  { delay: stagger(0.1, { start: 1.0 }), duration: 0.45, ease }
);

// Phone mockup — scale in with a subtle spring
animate('.phone-mockup__frame',
  { opacity: [0, 1], scale: [0.88, 1], y: [30, 0] },
  { duration: 0.8, ease, delay: 0.5 }
);

// Hero glow — fade in
animate('.hero__glow',
  { opacity: [0, 1], scale: [0.6, 1] },
  { duration: 1.2, ease, delay: 0.6 }
);

/* -----------------------------------------------
   SCROLL PARALLAX — phone mockup drifts upward
----------------------------------------------- */
const phoneEl = document.querySelector('.phone-mockup');
if (phoneEl) {
  scroll(
    animate(phoneEl, { y: [0, -40] }, { ease: 'linear' }),
    { target: document.querySelector('.hero'), offset: ['start start', 'end start'] }
  );
}

/* -----------------------------------------------
   SCROLL PARALLAX — hero glow drifts
----------------------------------------------- */
const glowEl = document.querySelector('.hero__glow');
if (glowEl) {
  scroll(
    animate(glowEl, { y: [0, 60] }, { ease: 'linear' }),
    { target: document.querySelector('.hero'), offset: ['start start', 'end start'] }
  );
}

/* -----------------------------------------------
   IN-VIEW: SECTION HEADERS
----------------------------------------------- */
inView('.section-header', ({ target }) => {
  animate(target.querySelector('.section-eyebrow'),
    { opacity: [0, 1], y: [10, 0] },
    { duration: 0.45, ease }
  );
  animate(target.querySelector('.section-title'),
    { opacity: [0, 1], y: [18, 0] },
    { duration: 0.55, ease, delay: 0.1 }
  );
  const desc = target.querySelector('.section-desc');
  if (desc) animate(desc, { opacity: [0, 1], y: [14, 0] }, { duration: 0.5, ease, delay: 0.2 });
}, { amount: 0.6 });

/* -----------------------------------------------
   IN-VIEW: FEATURE CARDS
----------------------------------------------- */
inView('.features__grid', ({ target }) => {
  animate(target.querySelectorAll('.feature-card'),
    { opacity: [0, 1], y: [28, 0], scale: [0.97, 1] },
    { delay: stagger(0.08), duration: 0.55, ease }
  );
}, { amount: 0.15 });

// Hover lift on feature cards
document.querySelectorAll('.feature-card').forEach(card => {
  card.addEventListener('mouseenter', () =>
    animate(card, { y: -6, boxShadow: 'var(--card-shadow-hover)' },
      { duration: 0.3, ...spring })
  );
  card.addEventListener('mouseleave', () =>
    animate(card, { y: 0, boxShadow: 'var(--card-shadow)' },
      { duration: 0.3, ...spring })
  );
});

/* -----------------------------------------------
   IN-VIEW: HOW IT WORKS STEPS
----------------------------------------------- */
inView('.steps', ({ target }) => {
  animate(target.querySelectorAll('.step'),
    { opacity: [0, 1], y: [24, 0] },
    { delay: stagger(0.15), duration: 0.55, ease }
  );
  animate(target.querySelectorAll('.step__connector'),
    { opacity: [0, 1], scaleX: [0, 1] },
    { delay: stagger(0.15, { start: 0.3 }), duration: 0.5, ease }
  );
}, { amount: 0.3 });

/* -----------------------------------------------
   IN-VIEW: SECURITY
----------------------------------------------- */
inView('.security__content', ({ target }) => {
  animate(target.querySelectorAll('.security__item'),
    { opacity: [0, 1], x: [-20, 0] },
    { delay: stagger(0.1, { start: 0.2 }), duration: 0.5, ease }
  );
}, { amount: 0.2 });

inView('.security__visual', ({ target }) => {
  animate(target.querySelector('.security-card'),
    { opacity: [0, 1], x: [30, 0], scale: [0.95, 1] },
    { duration: 0.65, ease, delay: 0.15 }
  );
  animate(target.querySelectorAll('.security-badge'),
    { opacity: [0, 1], scale: [0.8, 1] },
    { delay: stagger(0.07, { start: 0.4 }), duration: 0.35, ease }
  );
}, { amount: 0.3 });

/* -----------------------------------------------
   IN-VIEW: HUB APPS
----------------------------------------------- */
inView('.hub__apps', ({ target }) => {
  animate(target.querySelectorAll('.hub-app'),
    { opacity: [0, 1], scale: [0.8, 1], y: [16, 0] },
    { delay: stagger(0.05), duration: 0.4, ease }
  );
}, { amount: 0.2 });

// Hub app bounce on hover
document.querySelectorAll('.hub-app').forEach(app => {
  app.addEventListener('mouseenter', () =>
    animate(app.querySelector('.hub-app__icon'), { scale: 1.12, y: -4 },
      { duration: 0.25, ...spring })
  );
  app.addEventListener('mouseleave', () =>
    animate(app.querySelector('.hub-app__icon'), { scale: 1, y: 0 },
      { duration: 0.3, ...spring })
  );
  app.addEventListener('click', () => {
    animate(app.querySelector('.hub-app__icon'),
      { scale: [1, 0.88, 1.05, 1] },
      { duration: 0.35, ease }
    );
  });
});

/* -----------------------------------------------
   IN-VIEW: TESTIMONIALS
----------------------------------------------- */
inView('.testimonials__grid', ({ target }) => {
  animate(target.querySelectorAll('.testimonial-card'),
    { opacity: [0, 1], y: [30, 0], scale: [0.96, 1] },
    { delay: stagger(0.12), duration: 0.6, ease }
  );
}, { amount: 0.2 });

/* -----------------------------------------------
   IN-VIEW: DOWNLOAD CTA
----------------------------------------------- */
inView('.download__inner', ({ target }) => {
  animate(target.querySelector('.download__content'),
    { opacity: [0, 1], x: [-24, 0] },
    { duration: 0.6, ease, delay: 0.1 }
  );
  animate(target.querySelectorAll('.store-btn'),
    { opacity: [0, 1], y: [14, 0] },
    { delay: stagger(0.1, { start: 0.35 }), duration: 0.45, ease }
  );
  const qr = target.querySelector('.qr-card');
  if (qr) animate(qr, { opacity: [0, 1], scale: [0.85, 1], rotate: [-4, 0] },
    { duration: 0.65, ease, delay: 0.25 }
  );
}, { amount: 0.3 });

/* -----------------------------------------------
   IN-VIEW: FOOTER
----------------------------------------------- */
inView('.footer__top', ({ target }) => {
  animate(target.querySelectorAll('.footer__brand, .footer__links-group'),
    { opacity: [0, 1], y: [16, 0] },
    { delay: stagger(0.08), duration: 0.5, ease }
  );
}, { amount: 0.2 });

/* -----------------------------------------------
   BUTTON PRESS FEEDBACK (spring scale)
----------------------------------------------- */
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('mousedown', () =>
    animate(btn, { scale: 0.95 }, { duration: 0.12, ease: easeIn })
  );
  btn.addEventListener('mouseup', () =>
    animate(btn, { scale: 1 }, { duration: 0.25, ...springSnap })
  );
  btn.addEventListener('mouseleave', () =>
    animate(btn, { scale: 1 }, { duration: 0.2, ...spring })
  );
});

/* -----------------------------------------------
   PHONE SCREEN CAROUSEL
----------------------------------------------- */
const dots    = document.querySelectorAll('.phone-nav-dots .dot');
const screens = document.querySelectorAll('.phone-screen .screen');
let currentScreen = 0;
let autoplayTimer;

function showScreen(index) {
  const prev = screens[currentScreen];
  const next = screens[index];

  animate(prev, { opacity: 0, x: -16 }, { duration: 0.25, ease: easeIn })
    .finished.then(() => prev.classList.remove('active'));

  next.classList.add('active');
  animate(next, { opacity: [0, 1], x: [16, 0] }, { duration: 0.3, ease });

  dots.forEach(d => d.classList.remove('active'));
  dots[index].classList.add('active');
  animate(dots[index], { scale: [0.8, 1] }, { duration: 0.25, ...spring });

  currentScreen = index;
}

function nextScreen() { showScreen((currentScreen + 1) % screens.length); }

function startAutoplay() { autoplayTimer = setInterval(nextScreen, 3200); }
function stopAutoplay()  { clearInterval(autoplayTimer); }

dots.forEach((dot, i) => {
  dot.addEventListener('click', () => { stopAutoplay(); showScreen(i); startAutoplay(); });
});
startAutoplay();

/* -----------------------------------------------
   HUB CATEGORY FILTER (animated swap)
----------------------------------------------- */
const catBtns = document.querySelectorAll('.hub__cat');
const hubApps = document.querySelectorAll('.hub-app');

catBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    catBtns.forEach(b => b.classList.remove('hub__cat--active'));
    btn.classList.add('hub__cat--active');
    animate(btn, { scale: [0.94, 1] }, { duration: 0.25, ...spring });

    const cat = btn.getAttribute('data-cat');
    const visible = [], hidden = [];
    hubApps.forEach(app =>
      (cat === 'all' || app.getAttribute('data-cat') === cat ? visible : hidden).push(app)
    );

    // Fade out hidden
    if (hidden.length) {
      await animate(hidden, { opacity: 0, scale: 0.85 }, { duration: 0.18, ease: easeIn }).finished;
      hidden.forEach(a => a.classList.add('hidden'));
    }

    // Reveal visible with stagger
    visible.forEach(a => a.classList.remove('hidden'));
    animate(visible, { opacity: [0, 1], scale: [0.85, 1], y: [10, 0] },
      { delay: stagger(0.04), duration: 0.3, ease }
    );
  });
});

/* -----------------------------------------------
   ACTIVE NAV LINK HIGHLIGHT ON SCROLL
----------------------------------------------- */
const sections   = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav__links a[href^="#"]');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navAnchors.forEach(a => {
        const isActive = a.getAttribute('href') === `#${id}`;
        animate(a, { opacity: isActive ? 1 : 0.55 }, { duration: 0.2 });
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

/* -----------------------------------------------
   STORE BUTTON FEEDBACK
----------------------------------------------- */
document.querySelectorAll('.store-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const label = btn.querySelector('.store-btn__main');
    const original = label.textContent;
    animate(label, { opacity: [1, 0] }, { duration: 0.15 }).finished.then(() => {
      label.textContent = 'Coming soon!';
      animate(label, { opacity: [0, 1] }, { duration: 0.15 });
    });
    setTimeout(() => {
      animate(label, { opacity: [1, 0] }, { duration: 0.15 }).finished.then(() => {
        label.textContent = original;
        animate(label, { opacity: [0, 1] }, { duration: 0.15 });
      });
    }, 2200);
  });
});

/* -----------------------------------------------
   NAV LINK HOVER — subtle spring highlight
----------------------------------------------- */
document.querySelectorAll('.nav__link:not(.nav__link--dev)').forEach(link => {
  link.addEventListener('mouseenter', () =>
    animate(link, { x: 1 }, { duration: 0.2, ...spring })
  );
  link.addEventListener('mouseleave', () =>
    animate(link, { x: 0 }, { duration: 0.2, ...spring })
  );
});

/* -----------------------------------------------
   HERO BADGE PULSE every ~6s
----------------------------------------------- */
setInterval(() => {
  const badge = document.querySelector('.badge');
  if (badge) animate(badge, { scale: [1, 1.04, 1] }, { duration: 0.5, ease });
}, 6000);
