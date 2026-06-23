// 렌더 후 호출되는 UI 동작 모음(헤더 스크롤/모바일 메뉴/스크롤 리빌/히어로 패럴럭스)
// 동적으로 주입된 DOM에 바인딩해야 하므로 렌더가 끝난 뒤 initUI()를 호출한다.

export function initUI() {
  initMobileNav();
  initHeaderScroll();
  initReveal();
  initParallax();
}

function initMobileNav() {
  document.querySelectorAll('nav a').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelector('nav')?.classList.remove('open');
    });
  });
}

function initHeaderScroll() {
  const header = document.querySelector('header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

function initParallax() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');
  const figure = hero && hero.querySelector('.hero-figure');
  if (reduce || !hero || !figure) return;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    figure.style.transform = `translate(${dx * 14}px, ${dy * 14}px)`;
  });
  hero.addEventListener('pointerleave', () => {
    figure.style.transform = '';
  });
}
