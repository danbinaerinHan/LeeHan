// 홈(index.html) 렌더러 — data/*.json 으로부터 마퀴/히어로/예정/스케줄/소개/푸터를 그린다.
import { loadData } from './data.js';
import { computeStatus, kickerOf, tagOf, STATUS_BADGE } from './status.js';
import { el, asset, escapeHtml, fillMarquee, renderSiteFooter } from './render.js';
import { initUI } from './ui.js';

function detailHref(exh) {
  return `exhibitions/${exh.slug}.html`;
}

// 공간 오프닝 — 사진이 전면인 전폭 배너.
// 아래로 갈수록 블러+흰색으로 페이지에 녹아들고, 글자는 그 위에 작게 얹힌다.
// 여러 장이면 7초마다 크로스페이드(마퀴와 운동이 겹치지 않는 점진 전환).
function renderSpaceOpening(space) {
  const mount = document.getElementById('space-opening');
  if (!mount) return;
  const sp = space || {};
  const photos = (sp.photos || []).filter((p) => p && p.src);
  if (!photos.length) { mount.remove(); return; }

  const metaNodes = [];
  (sp.heroMeta || []).filter(Boolean).forEach((m, i) => {
    if (i) metaNodes.push(el('span', { class: 'div' }));
    metaNodes.push(el('span', null, m));
  });

  const slides = photos.map((p, i) => {
    const img = el('img', {
      class: 'so-slide' + (i === 0 ? ' is-active' : ''),
      src: asset(p.src),
      alt: p.alt || '',
    });
    // focusY(%): cover 크롭 시 세로 초점 — 숫자가 클수록 사진의 아래쪽을 보여준다
    if (typeof p.focusY === 'number') img.style.objectPosition = `center ${p.focusY}%`;
    return img;
  });
  const dots = photos.length > 1
    ? photos.map((_, i) => el('button', {
      class: 'so-dot' + (i === 0 ? ' is-active' : ''),
      type: 'button',
      'aria-label': `${i + 1}번째 공간 사진`,
    }))
    : [];

  mount.append(
    el('div', { class: 'so-banner' },
      ...slides,
      el('div', { class: 'so-fade', 'aria-hidden': 'true' }),
      el('div', { class: 'so-banner-text' },
        el('div', { class: 'hero-kicker' },
          el('b', null, '01'), ' The Space',
          el('span', { class: 'rule' }),
        ),
        el('h1', { class: 'so-title', html: sp.titleHtml || escapeHtml(sp.title || '공간리한') }),
        el('div', { class: 'so-meta-row' },
          metaNodes.length ? el('div', { class: 'hero-meta so-meta' }, metaNodes) : null,
          el('a', { class: 'space-more', href: 'about.html' }, '공간 소개 ', el('span', { class: 'arr' }, '→')),
        ),
      ),
      dots.length ? el('div', { class: 'so-dots' }, ...dots) : null,
    ),
  );

  // 크로스페이드 순환 — 점 클릭 시 해당 장으로, 모션 축소 설정이면 자동 전환 없음
  if (slides.length > 1) {
    let cur = 0;
    let timer = null;
    const show = (i) => {
      slides[cur].classList.remove('is-active');
      dots[cur].classList.remove('is-active');
      cur = i;
      slides[cur].classList.add('is-active');
      dots[cur].classList.add('is-active');
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = () => {
      if (!reduce) timer = setInterval(() => show((cur + 1) % slides.length), 7000);
    };
    dots.forEach((d, i) => d.addEventListener('click', () => {
      clearInterval(timer);
      show(i);
      start();
    }));
    start();
  }
}

// 전시 히어로 — 진행 중 전시의 포스터와 소개 (오프닝 배너 아래)
function renderHero(exh) {
  const mount = document.getElementById('hero-mount');
  if (!mount) return;
  if (!exh) { mount.remove(); return; }
  const status = computeStatus(exh);
  mount.href = detailHref(exh);

  const metaItems = (exh.heroMeta && exh.heroMeta.length ? exh.heroMeta : [exh.dateDisplay]).filter(Boolean);
  const metaNodes = [];
  metaItems.forEach((m, i) => {
    if (i) metaNodes.push(el('span', { class: 'div' }));
    metaNodes.push(el('span', null, m));
  });

  mount.append(
    el('div', { class: 'hero-lead', 'data-reveal': true },
      el('div', { class: 'hero-kicker' },
        el('b', null, '02'), ` ${kickerOf(exh, status)}`,
        el('span', { class: 'rule' }),
      ),
      el('h2', { class: 'hero-title', html: exh.titleHtml || escapeHtml(exh.title) }),
      el('div', { class: 'hero-meta' }, metaNodes),
      el('p', { class: 'hero-desc' }, exh.lede || ''),
      el('span', { class: 'hero-cta' }, '전시 자세히 보기 ', el('span', { class: 'arr' }, '→')),
    ),
    el('div', { class: 'hero-figure', 'data-reveal': true },
      el('span', { class: 'hero-figure-tag' }, tagOf(exh, status)),
      el('img', { src: asset(exh.poster), alt: exh.title }),
    ),
  );
}

// 공간 모드에서 02 예정 전시 자리를 대신하는 안내 카드
function renderUpcomingNotice(space) {
  const mount = document.getElementById('upcoming-mount');
  if (!mount) return;
  const n = (space && space.notice) || {};
  mount.href = 'rental.html';
  mount.classList.add('upcoming-notice');
  mount.append(
    el('div', { class: 'notice-badge' }, 'Between Exhibitions'),
    el('h3', null, n.title || '다음 전시를 준비하고 있습니다'),
    el('p', { class: 'notice-desc' }, n.desc || '전시 사이의 기간에도 공간은 대관으로 열려 있습니다.'),
    el('span', { class: 'hero-cta' }, '대관 안내 ', el('span', { class: 'arr' }, '→')),
  );
}

function renderUpcoming(exh) {
  const mount = document.getElementById('upcoming-mount');
  if (!mount) return;
  if (!exh) {
    document.getElementById('upcoming-block')?.remove();
    return;
  }
  const status = computeStatus(exh);
  mount.href = detailHref(exh);
  mount.append(
    el('div', { class: 'current-image' }, el('img', { src: asset(exh.poster), alt: exh.title })),
    el('div', { class: 'current-info' },
      el('div', { class: 'current-badge' }, STATUS_BADGE[status] || 'Upcoming'),
      el('h3', null, exh.title),
      el('div', { class: 'current-artist' }, exh.artist || ''),
      el('div', { class: 'current-date' }, exh.dateDisplay || ''),
      el('p', { class: 'current-desc' }, exh.lede || ''),
    ),
  );
}

function renderSchedule(order, byId) {
  const mount = document.getElementById('schedule-mount');
  if (!mount) return;
  mount.innerHTML = '';
  let n = 0;
  order.forEach((id) => {
    const exh = byId[id];
    if (!exh || exh.draft) return;
    n += 1;
    mount.append(
      el('a', { class: 'past-card', href: detailHref(exh) },
        el('div', { class: 'past-index' }, `No.${String(n).padStart(2, '0')}`),
        el('div', { class: 'past-image' }, el('img', { src: asset(exh.poster), alt: exh.title })),
        el('h4', null, exh.title),
        el('div', { class: 'past-artist' }, exh.artist || ''),
        el('div', { class: 'past-date' }, exh.dateDisplay || ''),
      ),
    );
  });
}

function renderAbout(about) {
  if (!about) return;
  const textMount = document.getElementById('about-text-mount');
  if (textMount) {
    textMount.append(
      el('div', { class: 'home-about-eyebrow' }, about.eyebrow || 'About'),
      el('h2', null, about.title || '공간리한'),
      about.subtitle ? el('p', { class: 'about-subtitle' }, about.subtitle) : null,
      ...(about.homeParagraphs || []).map((p) => el('p', null, p)),
      el('a', { class: 'about-more', href: 'about.html' }, '전체 소개 더 보기 ', el('span', { class: 'arr' }, '→')),
    );
  }
  const imgMount = document.getElementById('about-image-mount');
  if (imgMount && about.image) {
    imgMount.append(el('img', { src: asset(about.image), alt: '공간리한 외관' }));
  }
}

// 화면에 남은 섹션 순서대로 번호를 다시 매긴다(오프닝이 01).
// 블록이 모드에 따라 사라지므로 정적 번호는 어긋날 수 있음.
function renumberSections() {
  document.querySelectorAll('.hero-kicker b, .block-head .num').forEach((n, i) => {
    n.textContent = String(i + 1).padStart(2, '0');
  });
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    console.error(e);
    return;
  }
  const { settings, byId } = data;
  const home = settings.homepage || {};

  fillMarquee(document.getElementById('marquee-track'), (settings.marquee && settings.marquee.home) || []);

  // 스트립에 태울 '살아있는' 전시 — 지정 전시가 끝났으면 예정 전시로 대체
  const heroExh = byId[home.heroExhibitionId];
  const upcomingExh = byId[home.upcomingExhibitionId];
  const alive = (e) => (e && computeStatus(e) !== 'past' ? e : null);
  const pref = home.spaceHero || 'auto';
  const liveExh = pref === 'always' ? null : (alive(heroExh) || alive(upcomingExh));

  renderSpaceOpening(settings.space);
  if (liveExh) {
    renderHero(liveExh);
    // 히어로와 같은 전시를 Upcoming 카드에 또 보여주지 않는다
    const dup = upcomingExh && upcomingExh.id === liveExh.id;
    renderUpcoming(dup ? null : alive(upcomingExh));
  } else {
    // 진행·예정 전시가 없으면 히어로를 접고, 예정 자리에 준비 중 안내를 띄운다
    document.getElementById('hero-mount')?.remove();
    renderUpcomingNotice(settings.space);
  }
  renderSchedule(home.scheduleOrder || [], byId);
  renumberSections();
  renderAbout(settings.about);
  renderSiteFooter(document.getElementById('info'), settings.visit);

  initUI();
}

main();
