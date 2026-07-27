// 전시 상세 템플릿 렌더러 — exhibition.html?slug=... 로부터 전시 1건을 그린다.
import { loadData } from './data.js';
import { computeStatus, kickerOf, tagOf } from './status.js';
import {
  el, asset, escapeHtml, fillMarquee, metaStripNodes, photoGridNode, videoNode, renderSiteFooter,
} from './render.js';
import { initUI } from './ui.js';
import { openLightbox } from './lightbox.js';

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function setMeta(prop, content) {
  if (!content) return;
  let m = document.querySelector(`meta[property="${prop}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute('property', prop);
    document.head.append(m);
  }
  m.setAttribute('content', content);
}

function setCanonical(href) {
  let l = document.querySelector('link[rel="canonical"]');
  if (!l) {
    l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    document.head.append(l);
  }
  l.setAttribute('href', href);
}

function scheduleNumber(exh, settings) {
  const order = (settings.homepage && settings.homepage.scheduleOrder) || [];
  const idx = order.indexOf(exh.id);
  return idx >= 0 ? idx + 1 : null;
}

function renderDetail(exh, settings) {
  const status = computeStatus(exh);

  // 문서 메타(브라우저 탭/공유 best-effort — 크롤러용 OG는 슬러그 스텁이 담당)
  document.title = `${exh.title} — 공간리한`;
  const og = exh.og || {};
  setMeta('og:title', og.title || `${exh.title} — 공간리한`);
  setMeta('og:description', og.description || exh.lede || '');
  setMeta('og:image', asset(og.image || exh.poster));
  setCanonical(`exhibition.html?slug=${encodeURIComponent(exh.slug)}`);

  // 마퀴(전시별)
  const mq = [exh.title, exh.dateDisplay, exh.artist, 'SPACE LEEHAN · SEOUL'].filter(Boolean);
  fillMarquee(document.getElementById('marquee-track'), mq);

  // 히어로
  const num = scheduleNumber(exh, settings);
  document.getElementById('detail-hero-mount').append(
    el('div', { class: 'detail-lead' },
      el('div', { class: 'detail-kicker' },
        num ? el('b', null, String(num).padStart(2, '0')) : el('b', null, '—'),
        ` ${kickerOf(exh, status)}`),
      el('h1', { class: 'detail-title', html: exh.titleHtml || escapeHtml(exh.title) }),
      exh.artist ? el('div', { class: 'detail-artist' }, exh.artist) : null,
      exh.dateDisplay ? el('div', { class: 'detail-date' }, exh.dateDisplay) : null,
      exh.lede ? el('p', { class: 'detail-lede' }, exh.lede) : null,
    ),
    el('div', { class: 'detail-figure' },
      el('span', { class: 'detail-figure-tag' }, tagOf(exh, status)),
      el('img', { src: asset(exh.poster), alt: exh.title }),
    ),
  );

  // 메타 스트립
  const metaMount = document.getElementById('detail-meta-mount');
  if (exh.metaStrip && exh.metaStrip.length) {
    metaStripNodes(exh.metaStrip).forEach((n) => metaMount.append(n));
  } else {
    metaMount.remove();
  }

  // 본문
  const bodyMount = document.getElementById('detail-body-mount');
  bodyMount.append(
    el('div', { class: 'detail-body-eyebrow' },
      el('b', null, '—'), ` ${exh.bodyEyebrow || 'About the Exhibition'}`),
  );
  bodyMount.insertAdjacentHTML('beforeend', exh.bodyHtml || '');

  // 사진 갤러리
  const galleryMount = document.getElementById('detail-gallery-mount');
  const shots = (exh.photos || []).filter((p) => p && p.src);
  const grid = photoGridNode(exh.photos, exh.galleryLayout, (i) => {
    openLightbox(shots.map((p) => ({ src: asset(p.src), alt: p.alt || '' })), i);
  });
  if (grid) {
    galleryMount.append(
      el('div', { class: 'detail-body-eyebrow' }, el('b', null, '—'), ' Gallery'),
      grid,
    );
  } else {
    galleryMount.remove();
  }

  // 영상
  const videoMount = document.getElementById('detail-video-mount');
  const v = videoNode(exh.videoEmbedUrl);
  if (v) {
    videoMount.append(
      el('div', { class: 'detail-body-eyebrow' }, el('b', null, '—'), ' Video'),
      v,
    );
  } else {
    videoMount.remove();
  }

  // 푸터
  renderSiteFooter(document.getElementById('site-footer'), settings.visit);
}

function render404() {
  const main = document.querySelector('main.exhibition-detail');
  if (!main) return;
  main.innerHTML = '';
  main.append(
    el('div', { class: 'detail-back' },
      el('a', { href: '../index.html#exhibitions', class: 'back-link' }, '← Back to Exhibitions')),
    el('section', { class: 'detail-body', style: 'text-align:center; padding-top:120px; padding-bottom:120px;' },
      el('div', { class: 'detail-body-eyebrow', style: 'justify-content:center;' }, el('b', null, '—'), ' Not Found'),
      el('h1', { class: 'detail-title', style: 'font-size:clamp(28px,4vw,44px);' }, '전시를 찾을 수 없습니다'),
      el('p', null, '요청하신 전시가 없거나 아직 공개되지 않았습니다.'),
      el('p', null, el('a', { href: '../index.html#exhibitions', class: 'about-cta-link' }, '전시 일정 보기 →')),
    ),
  );
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    console.error(e);
    render404();
    initUI();
    return;
  }
  const slug = getParam('slug');
  const id = getParam('id');
  const preview = getParam('preview') === '1';
  const exh = (slug && data.bySlug[slug]) || (id && data.byId[id]) || null;

  if (!exh || (exh.draft && !preview)) {
    render404();
    renderSiteFooter(document.getElementById('site-footer'), data.settings.visit);
    initUI();
    return;
  }

  renderDetail(exh, data.settings);
  initUI();
}

main();
