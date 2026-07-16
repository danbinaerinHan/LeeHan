// 공유 DOM/렌더 헬퍼 — 사이트와 관리자가 공유

// assets/js/render.js → 사이트 루트
export const SITE_ROOT = new URL('../../', import.meta.url);

// 저장소 루트 기준 경로(예: "posters/x.png")를 어느 페이지에서나 올바른 절대 URL로 변환
export function asset(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return new URL(String(path).replace(/^\//, ''), SITE_ROOT).href;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 간단한 DOM 빌더: el('div', {class:'x'}, child1, child2)
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) { append(node, c); continue; }
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

// 마퀴 띠: 줄 배열을 span/dot 으로 펼치고 두 번 반복(무한 루프 이음매)
export function fillMarquee(track, lines) {
  if (!track) return;
  track.innerHTML = '';
  const doubled = [...lines, ...lines];
  doubled.forEach((line) => {
    track.append(el('span', null, line));
    track.append(el('span', { class: 'dot' }, '·'));
  });
}

// 메타 스트립(Dates/Venue/…) → div 노드 배열
export function metaStripNodes(strip) {
  return (strip || []).map((m) =>
    el('div', null,
      el('span', { class: 'meta-label' }, m.label || ''),
      el('span', { class: 'meta-value', html: m.valueHtml || '' }),
    ),
  );
}

// 사진 그리드(라이트박스 없음)
export function photoGridNode(photos) {
  const list = (photos || []).filter((p) => p && p.src);
  if (!list.length) return null;
  const grid = el('div', { class: 'detail-gallery-grid' });
  grid.style.setProperty('--cols', String(Math.min(4, list.length)));
  list.forEach((p) => {
    grid.append(el('figure', null, el('img', { src: asset(p.src), alt: p.alt || '', loading: 'lazy' })));
  });
  return grid;
}

// 유튜브/비메오 URL을 안전한 임베드 URL로 정규화. 허용되지 않으면 null.
export function embedUrl(raw) {
  if (!raw) return null;
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
    if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).pop();
    if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  return null;
}

export function videoNode(rawUrl) {
  const src = embedUrl(rawUrl);
  if (!src) return null;
  return el('div', { class: 'detail-video-frame' },
    el('iframe', {
      src,
      title: '전시 영상',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: true,
      loading: 'lazy',
    }),
  );
}

// 공통 푸터(방문 정보)를 #site-footer 안에 채움 — 모든 페이지 공유
export function renderSiteFooter(container, visit) {
  if (!container || !visit) return;
  const mail = visit.email || '';
  const igUrl = visit.instagramUrl || (visit.instagramHandle ? `https://instagram.com/${visit.instagramHandle}` : '#');
  const igHandle = visit.instagramHandle ? `@${visit.instagramHandle}` : visit.instagramUrl || '';

  container.innerHTML = '';
  container.append(
    el('div', { class: 'info-brand' },
      el('div', { class: 'info-brand-logo' },
        el('img', { src: asset('공간리한_국문_sg1.png'), alt: '공간리한' }),
      ),
    ),
    el('div', { class: 'info-details' },
      el('div', { class: 'info-blocks' },
        el('div', null,
          el('h3', null, 'Location'),
          el('p', { html: visit.addressHtml || '' }),
        ),
        el('div', null,
          el('h3', null, 'Contact'),
          el('p', null,
            el('a', { href: `mailto:${mail}` }, mail),
            el('br'),
            el('a', { href: `tel:${visit.phoneTel || ''}` }, visit.phoneDisplay || ''),
          ),
        ),
        el('div', null,
          el('h3', null, 'Inquiry'),
          el('p', null,
            el('span', { html: visit.inquiryHtml || '' }),
            el('br'),
            el('a', { href: `mailto:${mail}` }, mail),
          ),
        ),
        el('div', null,
          el('h3', null, 'Instagram'),
          el('p', null, el('a', { href: igUrl, target: '_blank', rel: 'noopener' }, igHandle)),
        ),
      ),
      el('div', { class: 'info-bottom' },
        el('span', { class: 'info-copyright' },
          el('span', { class: 'info-affiliation' }, visit.affiliation || ''),
          el('span', null, visit.businessNumber || ''),
          el('span', null, visit.copyright || ''),
        ),
        el('div', { class: 'info-social' },
          el('a', { href: igUrl, target: '_blank', rel: 'noopener' }, 'Instagram'),
          el('a', { href: `mailto:${mail}` }, 'Email'),
        ),
      ),
    ),
  );
}
