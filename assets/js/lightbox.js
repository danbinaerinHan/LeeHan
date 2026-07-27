// 갤러리 확대 보기 — 사진을 누르면 전체 화면으로 열리고, 인스타 카드뉴스처럼 옆으로 넘긴다.
// 화살표 버튼 · 키보드(←/→/Esc) · 손가락 드래그 모두로 이동한다.
import { el } from './render.js';

let box = null; // 오버레이 루트 (한 번 만들어 재사용)
let view = null; // 현재 열린 상태 { photos, i, ... }

// 열려 있는 동안 뒤 페이지가 같이 스크롤되지 않게 잠근다.
// 스크롤바가 사라지며 레이아웃이 옆으로 튀는 것도 함께 막는다.
function lockScroll(on) {
  const gap = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = on ? 'hidden' : '';
  document.body.style.paddingRight = on && gap > 0 ? `${gap}px` : '';
}

function build() {
  const track = el('div', { class: 'lb-track' });
  const stage = el('div', { class: 'lb-stage' }, track);
  const counter = el('div', { class: 'lb-counter' });
  const prev = el('button', { class: 'lb-nav lb-prev', type: 'button', 'aria-label': '이전 사진' }, '‹');
  const next = el('button', { class: 'lb-nav lb-next', type: 'button', 'aria-label': '다음 사진' }, '›');
  const close = el('button', { class: 'lb-close', type: 'button', 'aria-label': '닫기' }, '✕');

  box = el('div', {
    class: 'lb',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '사진 확대 보기',
    hidden: true,
  }, stage, prev, next, close, counter);
  document.body.append(box);

  close.addEventListener('click', closeLightbox);
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  // 사진 바깥(무대 여백)을 누르면 닫는다
  stage.addEventListener('click', (e) => { if (e.target === stage || e.target.classList.contains('lb-item')) closeLightbox(); });

  bindDrag(stage, track);
  window.addEventListener('resize', () => { if (view) place(false); });
  document.addEventListener('keydown', (e) => {
    if (!view) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  });

  view = null;
  return { track, stage, counter, prev, next, close };
}

// 트랙 위치를 현재 장에 맞춘다. px 기준 — 드래그 중 손가락 이동량과 단위를 맞추기 위해.
function place(animate, dx = 0) {
  const { track, stage, i } = view;
  track.style.transition = animate ? '' : 'none';
  track.style.transform = `translateX(${-i * stage.clientWidth + dx}px)`;
}

// 지금 보는 장과 그 앞뒤만 실제로 내려받는다 (한 갤러리에 사진이 열 장 넘게 있다)
function hydrate() {
  view.items.forEach((img, k) => {
    if (Math.abs(k - view.i) <= 1 && !img.src) img.src = img.dataset.src;
  });
}

function go(i, animate = true) {
  const n = view.photos.length;
  view.i = Math.max(0, Math.min(n - 1, i));
  hydrate();
  place(animate);
  view.counter.textContent = `${view.i + 1} / ${n}`;
  view.prev.disabled = view.i === 0;
  view.next.disabled = view.i === n - 1;
}

function step(d) {
  if (view) go(view.i + d);
}

function bindDrag(stage, track) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let moved = false;

  stage.addEventListener('pointerdown', (e) => {
    if (!view || e.button != null && e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    // 세로로 크게 움직였으면 넘기려는 손짓이 아니다
    if (!moved && Math.abs(dx) < 8 && Math.abs(e.clientY - startY) < 8) return;
    moved = true;
    // 손가락이 화면 밖으로 나가도 끝까지 이 요소가 이벤트를 받게 한다
    try { stage.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 잡을 수 없는 경우 */ }
    // 양 끝에서는 저항을 줘서 더 넘어갈 곳이 없다는 걸 손으로 알 수 있게 한다
    const edge = (view.i === 0 && dx > 0) || (view.i === view.photos.length - 1 && dx < 0);
    place(false, edge ? dx * 0.3 : dx);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    const dx = e.clientX - startX;
    const threshold = Math.min(90, stage.clientWidth * 0.15);
    if (dx <= -threshold) go(view.i + 1);
    else if (dx >= threshold) go(view.i - 1);
    else go(view.i);
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  // 드래그 직후 클릭으로 닫히지 않게
  stage.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); moved = false; } }, true);
  track.addEventListener('dragstart', (e) => e.preventDefault());
}

export function openLightbox(photos, index) {
  if (!photos || !photos.length) return;
  const parts = box ? {
    track: box.querySelector('.lb-track'),
    stage: box.querySelector('.lb-stage'),
    counter: box.querySelector('.lb-counter'),
    prev: box.querySelector('.lb-prev'),
    next: box.querySelector('.lb-next'),
    close: box.querySelector('.lb-close'),
  } : build();

  parts.track.innerHTML = '';
  const items = photos.map((p) => {
    const img = el('img', { alt: p.alt || '' });
    img.dataset.src = p.src;
    parts.track.append(el('div', { class: 'lb-item' }, img));
    return img;
  });

  view = { photos, items, i: 0, opener: document.activeElement, ...parts };
  box.hidden = false;
  lockScroll(true);
  go(index || 0, false);
  parts.close.focus({ preventScroll: true });
}

export function closeLightbox() {
  if (!view) return;
  const { opener } = view;
  box.hidden = true;
  lockScroll(false);
  view = null;
  if (opener && opener.focus) opener.focus({ preventScroll: true });
}
