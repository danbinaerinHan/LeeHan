// 렌더 후 호출되는 UI 동작 모음(헤더 스크롤/모바일 메뉴/스크롤 리빌/히어로 패럴럭스)
// 동적으로 주입된 DOM에 바인딩해야 하므로 렌더가 끝난 뒤 initUI()를 호출한다.

export function initUI() {
  initMobileNav();
  initHeaderScroll();
  initReveal();
  initParallax();
  initRentalToggle();
}

// 대관 플로팅 토글: 스크롤하면 페이지와 함께 위로 올라가다가,
// 가로 배너가 사라지는 지점(헤더 바로 아래)에 닿으면 그 자리에 고정(sticky)된다.
function initRentalToggle() {
  const fab = document.querySelector('.rental-fab');
  if (!fab) return;
  const header = document.querySelector('header');
  const GAP = 8;
  let start = 148;
  let stick = 95;

  const update = () => {
    const y = window.scrollY || window.pageYOffset || 0;
    fab.style.top = `${Math.max(stick, start - y)}px`;
  };

  const measure = () => {
    fab.style.top = ''; // 인라인 제거 후 CSS(미디어쿼리) 기본 top 값을 읽는다
    start = parseInt(getComputedStyle(fab).top, 10) || 148;
    const h = header ? header.getBoundingClientRect().height : 80;
    stick = Math.round(h) + GAP;
    update();
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', measure);
  measure();
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
  if (reduce) return;
  document.querySelectorAll('.hero').forEach((hero) => {
    const figure = hero.querySelector('.hero-figure');
    if (!figure) return;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      figure.style.transform = `translate(${dx * 14}px, ${dy * 14}px)`;
    });
    hero.addEventListener('pointerleave', () => {
      figure.style.transform = '';
    });
  });
}

// 다른 페이지에서 index.html#schedule 처럼 해시를 달고 들어오면, 브라우저는 JS 렌더가
// 끝나기 전에 점프를 시도한다. 그 시점엔 히어로·전시 카드가 아직 비어 있어 문서가 짧고,
// 결국 엉뚱한 위치(대개 맨 위)에 멈춘다. 렌더가 끝난 뒤 목표 위치로 다시 맞춘다.
export function scrollToHash() {
  const { hash } = window.location;
  if (!hash || hash.length < 2) return;

  let target = null;
  try {
    target = document.querySelector(hash);
  } catch (e) {
    return; // 선택자로 쓸 수 없는 해시는 무시
  }
  if (!target) return;

  let done = false;
  // behavior: 'instant' 필수 — 'auto' 는 CSS scroll-behavior(=smooth)를 따르는데,
  // 아래에서 100ms마다 위치를 다시 잡으므로 그때마다 애니메이션이 처음부터 다시 시작해
  // 목적지에 영영 도달하지 못한다. 다른 페이지에서 넘어온 진입이라 즉시 이동이 자연스럽다.
  // scroll-margin-top 으로 고정 헤더 높이를 비켜 간다(style.css 참고)
  const jump = () => {
    if (!done) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  jump();

  // 렌더 직후엔 이미지가 아직 로드되지 않아 문서가 짧다. 지연 로딩 이미지가 뒤늦게
  // 채워지면 목표 위치가 아래로 밀리므로, 잠시 동안 주기적으로 다시 맞춘다.
  const timer = setInterval(jump, 100);

  // 사용자가 직접 스크롤을 시작하면 즉시 손을 뗀다. 그렇지 않아도 2.5초 뒤엔 멈춘다.
  const stop = () => {
    done = true;
    clearInterval(timer);
  };
  const opts = { once: true, passive: true };
  window.addEventListener('wheel', stop, opts);
  window.addEventListener('touchstart', stop, opts);
  window.addEventListener('pointerdown', stop, opts);
  window.addEventListener('keydown', stop, { once: true });
  setTimeout(stop, 2500);
}
