// 홈(index.html) 렌더러 — data/*.json 으로부터 마퀴/히어로/예정/스케줄/소개/푸터를 그린다.
import { loadData } from './data.js';
import { computeStatus, kickerOf, tagOf, STATUS_BADGE } from './status.js';
import { el, asset, escapeHtml, fillMarquee, renderSiteFooter } from './render.js';
import { initUI } from './ui.js';

function detailHref(exh) {
  return `exhibitions/${exh.slug}.html`;
}

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
        el('b', null, '01'), ` ${kickerOf(exh, status)}`,
        el('span', { class: 'rule' }),
      ),
      el('h1', { class: 'hero-title', html: exh.titleHtml || escapeHtml(exh.title) }),
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
  renderHero(byId[home.heroExhibitionId]);
  renderUpcoming(byId[home.upcomingExhibitionId]);
  renderSchedule(home.scheduleOrder || [], byId);
  renderAbout(settings.about);
  renderSiteFooter(document.getElementById('info'), settings.visit);

  initUI();
}

main();
