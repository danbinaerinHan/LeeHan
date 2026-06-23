// 공간리한 관리자 — 전시/홈/사이트 콘텐츠 편집 + GitHub 원자적 커밋
import {
  CONFIG, getToken, setToken, clearToken, validateToken, getFile, commitFiles,
} from './github.js';
import { encryptToken, decryptToken } from './crypto.js';
import { el, asset, escapeHtml, embedUrl } from '../assets/js/render.js';
import { computeStatus, STATUS_LABEL_KO } from '../assets/js/status.js';

const PREVIEW_KEY = 'leehan_preview';
const CRED_PATH = 'admin/credentials.json';

const state = {
  model: { exhibitions: [], settings: {} },
  pendingImages: new Map(), // repoPath -> { base64, objectUrl, dataUrl }
  dirty: false,
  loaded: false,
};

let _editingExh = null; // 현재 편집기에서 열린 전시(미리보기용)

const $ = (sel) => document.querySelector(sel);

// ─────────────────────────────────────── 부팅 / 인증
let _hasCred = false;

async function boot() {
  $('#token-submit').addEventListener('click', tryLogin);
  $('#token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  $('#pw-submit').addEventListener('click', tryPasswordLogin);
  $('#pw-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryPasswordLogin(); });
  $('#toggle-login-mode').addEventListener('click', (e) => { e.preventDefault(); toggleLoginMode(); });
  $('#logout').addEventListener('click', logout);
  $('#btn-publish').addEventListener('click', publish);
  $('#btn-preview').addEventListener('click', preview);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // 이 기기에 토큰이 이미 있으면 바로 입장
  if (getToken()) {
    const res = await safeValidate(getToken());
    if (res && res.ok) return enterApp(res);
    clearToken();
  }

  // 비밀번호 로그인 설정 여부 확인
  _hasCred = !!(await fetchCredentials());
  setLoginMode(_hasCred ? 'password' : 'token');
}

async function fetchCredentials() {
  try {
    const res = await fetch(`credentials.json?v=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function setLoginMode(mode) {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#login-err').textContent = '';
  const pw = mode === 'password';
  $('#login-pw').classList.toggle('hidden', !pw);
  $('#login-token').classList.toggle('hidden', pw);
  $('#login-help-token').style.display = pw ? 'none' : 'block';
  $('#login-desc').textContent = pw
    ? '관리자 비밀번호를 입력하세요.'
    : (_hasCred ? 'GitHub 토큰으로 로그인합니다.' : '처음 설정: GitHub 토큰으로 로그인한 뒤, 사이트 정보 탭에서 비밀번호를 정하면 다음부터 비밀번호로 로그인할 수 있어요.');
  $('#toggle-login-mode').textContent = pw ? 'GitHub 토큰으로 로그인 (관리자 설정용)' : '비밀번호로 로그인';
  // credentials 가 없으면 비밀번호 모드로 못 가게
  $('#toggle-login-mode').style.display = _hasCred ? 'inline' : (pw ? 'inline' : 'none');
  (pw ? $('#pw-input') : $('#token-input')).focus();
}

function toggleLoginMode() {
  const pwVisible = !$('#login-pw').classList.contains('hidden');
  setLoginMode(pwVisible ? 'token' : 'password');
}

async function safeValidate(token) {
  try { return await validateToken(token); } catch (e) { return { ok: false, error: e.message }; }
}

async function tryLogin() {
  const token = $('#token-input').value.trim();
  $('#login-err').textContent = '';
  if (!token) { $('#login-err').textContent = '토큰을 입력하세요.'; return; }
  $('#token-submit').disabled = true;
  const res = await safeValidate(token);
  $('#token-submit').disabled = false;
  if (!res.ok) {
    $('#login-err').textContent = res.error
      ? `검증 실패: ${res.error}`
      : '이 저장소에 쓰기 권한이 없는 토큰입니다. 권한(Contents: Read and write)을 확인하세요.';
    return;
  }
  setToken(token);
  enterApp(res);
}

async function tryPasswordLogin() {
  const pw = $('#pw-input').value;
  $('#login-err').textContent = '';
  if (!pw) { $('#login-err').textContent = '비밀번호를 입력하세요.'; return; }
  $('#pw-submit').disabled = true;
  try {
    const cred = await fetchCredentials();
    if (!cred) { $('#login-err').textContent = '비밀번호 로그인이 아직 설정되지 않았습니다.'; return; }
    let token;
    try {
      token = await decryptToken(cred, pw);
    } catch (e) {
      $('#login-err').textContent = '비밀번호가 올바르지 않습니다.';
      return;
    }
    const res = await safeValidate(token);
    if (!res.ok) {
      $('#login-err').textContent = '저장된 토큰이 만료되었어요. 관리자가 GitHub 토큰으로 로그인해 비밀번호를 다시 설정해야 합니다.';
      return;
    }
    setToken(token);
    enterApp(res);
  } finally {
    $('#pw-submit').disabled = false;
  }
}

function logout() {
  if (state.dirty && !confirm('저장하지 않은 변경 사항이 있습니다. 정말 로그아웃할까요?')) return;
  clearToken();
  location.reload();
}

async function enterApp(auth) {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who').textContent = auth.login ? `@${auth.login}` : '';
  $('#branch-tag').textContent = CONFIG.branch === 'main' ? 'LIVE · main' : `TEST · ${CONFIG.branch}`;
  await loadModel();
}

// ─────────────────────────────────────── 데이터 로드
async function loadModel() {
  setStatus('불러오는 중…');
  try {
    const [exhFile, setFile] = await Promise.all([
      getFile('data/exhibitions.json'),
      getFile('data/settings.json'),
    ]);
    const exhDoc = exhFile ? JSON.parse(exhFile.content) : { exhibitions: [] };
    state.model.exhibitions = exhDoc.exhibitions || [];
    state.model.settings = setFile ? JSON.parse(setFile.content) : {};
    state.loaded = true;
    state.dirty = false;
    setStatus('변경 사항 없음');
    showView('exhibitions');
  } catch (e) {
    console.error(e);
    setStatus('데이터 로드 실패: ' + e.message, 'err');
  }
}

// ─────────────────────────────────────── 상태표시 / 더티
function markDirty() {
  state.dirty = true;
  setStatus('저장하지 않은 변경 사항', 'dirty');
}
function setStatus(text, cls) {
  const elx = $('#save-status');
  elx.textContent = text;
  elx.className = 'status' + (cls ? ' ' + cls : '');
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ─────────────────────────────────────── 뷰 전환
function showView(view) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.panel-view').forEach((v) => v.classList.remove('active'));
  if (view === 'exhibitions') { renderList(); $('#view-exhibitions').classList.add('active'); }
  else if (view === 'editor') { $('#view-editor').classList.add('active'); }
  else if (view === 'homepage') { renderHomepage(); $('#view-homepage').classList.add('active'); }
  else if (view === 'site') { renderSite(); $('#view-site').classList.add('active'); }
}

// ─────────────────────────────────────── 이미지 헬퍼
function imgSrc(path) {
  if (!path) return '';
  const p = state.pendingImages.get(path);
  return p ? p.objectUrl : asset(path);
}

async function compressImage(file, maxEdge = 2000, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const long = Math.max(width, height);
  if (long > maxEdge) {
    const s = maxEdge / long;
    width = Math.round(width * s);
    height = Math.round(height * s);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close && bitmap.close();
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

async function ingestImage(file, slug, kind) {
  const blob = await compressImage(file);
  const base64 = await blobToBase64(blob);
  const year = (slug && getYearForSlug(slug)) || new Date().getFullYear();
  const safeSlug = (slug || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  const path = `uploads/${year}/${safeSlug}/${kind}-${Date.now()}.jpg`;
  state.pendingImages.set(path, { base64, objectUrl: URL.createObjectURL(blob), dataUrl: `data:image/jpeg;base64,${base64}` });
  return path;
}

function getYearForSlug(slug) {
  const exh = state.model.exhibitions.find((e) => e.slug === slug);
  return exh && exh.startDate ? exh.startDate.slice(0, 4) : null;
}

// ─────────────────────────────────────── 작은 폼 헬퍼
function field(label, obj, key, opts = {}) {
  const { type = 'text', hint = '', textarea = false, placeholder = '' } = opts;
  const input = textarea
    ? el('textarea', { placeholder })
    : el('input', { type, placeholder });
  input.value = obj[key] == null ? '' : obj[key];
  input.addEventListener('input', () => { obj[key] = input.value; markDirty(); opts.onInput && opts.onInput(input.value); });
  return el('div', { class: 'field' },
    el('label', null, label, hint ? el('span', { class: 'hint' }, hint) : null),
    input);
}

function linesField(label, obj, key, hint) {
  const input = el('textarea', { placeholder: '한 줄에 하나씩' });
  input.value = (obj[key] || []).join('\n');
  input.addEventListener('input', () => {
    obj[key] = input.value.split('\n').map((s) => s.trim()).filter(Boolean);
    markDirty();
  });
  return el('div', { class: 'field' },
    el('label', null, label, hint ? el('span', { class: 'hint' }, hint) : null),
    input);
}

function selectField(label, value, options, onChange, hint) {
  const sel = el('select');
  options.forEach((o) => {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    sel.append(opt);
  });
  sel.addEventListener('change', () => { onChange(sel.value); markDirty(); });
  return el('div', { class: 'field' },
    el('label', null, label, hint ? el('span', { class: 'hint' }, hint) : null),
    sel);
}

// ─────────────────────────────────────── 전시 목록
function renderList() {
  const root = $('#view-exhibitions');
  root.innerHTML = '';
  root.append(
    el('div', { class: 'inline-actions' },
      el('button', { class: 'btn btn-primary', onclick: newExhibition }, '+ 새 전시'),
    ),
    el('p', { class: 'section-title' }, `전시 ${state.model.exhibitions.length}개`),
  );
  const list = el('div', { class: 'exh-list' });
  state.model.exhibitions.forEach((exh) => {
    const status = computeStatus(exh);
    list.append(
      el('div', { class: 'exh-row' },
        el('img', { src: imgSrc(exh.poster), alt: '' }),
        el('div', { class: 'meta' },
          el('div', { class: 't' }, exh.title || '(제목 없음)'),
          el('div', { class: 'd' }, exh.dateDisplay || exh.startDate || ''),
        ),
        exh.draft ? el('span', { class: 'badge draft' }, '비공개') : null,
        el('span', { class: `badge ${status}` }, STATUS_LABEL_KO[status]),
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn-sm', onclick: () => openEditor(exh) }, '편집'),
          el('button', { class: 'btn btn-sm btn-danger', onclick: () => deleteExhibition(exh) }, '삭제'),
        ),
      ),
    );
  });
  root.append(list);
}

function newExhibition() {
  const exh = {
    id: `exh_${Date.now()}`,
    slug: '',
    title: '',
    titleHtml: '',
    artist: '',
    startDate: '',
    endDate: '',
    dateDisplay: '',
    statusOverride: null,
    kicker: null,
    figureTag: null,
    poster: '',
    photos: [],
    videoEmbedUrl: '',
    lede: '',
    heroMeta: [],
    metaStrip: [],
    bodyEyebrow: 'About the Exhibition',
    bodyHtml: '',
    og: { title: '', description: '', image: '' },
    draft: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.model.exhibitions.push(exh);
  markDirty();
  openEditor(exh);
}

function deleteExhibition(exh) {
  if (!confirm(`"${exh.title || '이 전시'}"를 목록에서 삭제할까요? (발행해야 사이트에 반영됩니다)`)) return;
  state.model.exhibitions = state.model.exhibitions.filter((e) => e !== exh);
  // 홈 참조 정리
  const hp = state.model.settings.homepage || {};
  if (hp.heroExhibitionId === exh.id) hp.heroExhibitionId = '';
  if (hp.upcomingExhibitionId === exh.id) hp.upcomingExhibitionId = '';
  if (Array.isArray(hp.scheduleOrder)) hp.scheduleOrder = hp.scheduleOrder.filter((id) => id !== exh.id);
  markDirty();
  showView('exhibitions');
}

// ─────────────────────────────────────── 전시 편집
function openEditor(exh) {
  _editingExh = exh;
  const root = $('#view-editor');
  root.innerHTML = '';

  root.append(
    el('div', { class: 'inline-actions' },
      el('button', { class: 'btn', onclick: () => showView('exhibitions') }, '← 전시 목록'),
      el('button', { class: 'btn btn-danger', onclick: () => deleteExhibition(exh) }, '이 전시 삭제'),
    ),
  );

  // 기본 정보
  const basics = el('div', { class: 'card' },
    el('h3', null, '기본 정보'),
    field('제목', exh, 'title', { hint: '목록·카드·탭에 표시', onInput: () => { if (!exh.titleHtml) {} } }),
    field('큰 제목 줄바꿈 (선택)', exh, 'titleHtml', { hint: '예: 니가가라<br>하와이 사진전', placeholder: '비우면 제목 그대로 사용' }),
    field('부제 / 작가', exh, 'artist', { hint: '예: 작가 9인 · …' }),
    field('URL 주소(slug)', exh, 'slug', { hint: '영문/숫자/-, 예: hawaii-photo', placeholder: 'hawaii-photo' }),
  );

  // 날짜 + 상태
  const dates = el('div', { class: 'card' },
    el('h3', null, '날짜 · 상태'),
    el('div', { class: 'grid-2' },
      field('시작일', exh, 'startDate', { type: 'date', hint: '자동 상태 계산용' }),
      field('종료일', exh, 'endDate', { type: 'date', hint: '대략값도 가능' }),
    ),
    field('표시용 기간', exh, 'dateDisplay', { hint: '예: 2026.06.17(수) — 07.06(월)' }),
    selectField('상태', exh.statusOverride || '', [
      { value: '', label: '자동 (날짜로 판단)' },
      { value: 'current', label: '현재 전시 (강제)' },
      { value: 'upcoming', label: '예정 전시 (강제)' },
      { value: 'past', label: '지난 전시 (강제)' },
    ], (v) => { exh.statusOverride = v || null; }, '자동이면 오늘 날짜로 현재/예정/지난을 판단'),
    el('div', { class: 'grid-2' },
      field('상단 라벨 (선택)', exh, 'kicker', { hint: '비우면 상태 기본값', placeholder: '예: Opening Exhibition' }),
      field('포스터 태그 (선택)', exh, 'figureTag', { hint: '비우면 상태 기본값', placeholder: '예: NOW SHOWING' }),
    ),
  );

  // 포스터
  const posterCard = el('div', { class: 'card' }, el('h3', null, '포스터'));
  const posterThumb = el('img', { class: 'thumb', src: imgSrc(exh.poster), alt: '' });
  const posterInput = el('input', { type: 'file', accept: 'image/*' });
  posterInput.addEventListener('change', async () => {
    const f = posterInput.files[0];
    if (!f) return;
    const path = await ingestImage(f, exh.slug || exh.id, 'poster');
    exh.poster = path;
    if (!exh.og) exh.og = {};
    if (!exh.og.image) exh.og.image = path;
    posterThumb.src = imgSrc(path);
    markDirty();
  });
  posterCard.append(el('div', { class: 'img-field' }, posterThumb, posterInput));

  // 사진 갤러리
  const photoCard = el('div', { class: 'card' }, el('h3', null, '사진 (상세 페이지 갤러리)'));
  const photoGrid = el('div', { class: 'photo-grid' });
  function renderPhotos() {
    photoGrid.innerHTML = '';
    (exh.photos || []).forEach((p, i) => {
      const altInput = el('input', { type: 'text', placeholder: '설명(alt)' });
      altInput.value = p.alt || '';
      altInput.addEventListener('input', () => { p.alt = altInput.value; markDirty(); });
      photoGrid.append(
        el('div', { class: 'photo-cell' },
          el('img', { src: imgSrc(p.src), alt: '' }),
          el('button', { class: 'x', onclick: () => { exh.photos.splice(i, 1); markDirty(); renderPhotos(); } }, '×'),
          altInput,
        ),
      );
    });
  }
  renderPhotos();
  const photoInput = el('input', { type: 'file', accept: 'image/*', multiple: true });
  photoInput.addEventListener('change', async () => {
    for (const f of photoInput.files) {
      const path = await ingestImage(f, exh.slug || exh.id, 'photo');
      if (!exh.photos) exh.photos = [];
      exh.photos.push({ src: path, alt: '' });
    }
    photoInput.value = '';
    markDirty();
    renderPhotos();
  });
  photoCard.append(photoGrid, el('div', { class: 'field', style: 'margin-top:12px' }, photoInput));

  // 영상
  const videoCard = el('div', { class: 'card' }, el('h3', null, '영상 (유튜브/비메오)'));
  const videoPrev = el('div', { class: 'embed-preview hidden' });
  function syncVideoPrev(url) {
    const src = embedUrl(url);
    if (src) { videoPrev.innerHTML = ''; videoPrev.append(el('iframe', { src, allowfullscreen: true })); videoPrev.classList.remove('hidden'); }
    else videoPrev.classList.add('hidden');
  }
  videoCard.append(
    field('영상 링크', exh, 'videoEmbedUrl', { type: 'url', hint: '유튜브/비메오 주소 붙여넣기', placeholder: 'https://youtu.be/...', onInput: syncVideoPrev }),
    videoPrev,
  );
  syncVideoPrev(exh.videoEmbedUrl);

  // 소개 / 본문
  const introCard = el('div', { class: 'card' },
    el('h3', null, '소개 글'),
    field('짧은 소개 (lede)', exh, 'lede', { textarea: true, hint: '히어로·카드·상세 도입부' }),
    linesField('히어로 메타 (선택)', exh, 'heroMeta', '메인 배너일 때 제목 아래 작은 항목들'),
  );

  const bodyCard = el('div', { class: 'card' }, el('h3', null, '본문'));
  bodyCard.append(field('본문 머리말', exh, 'bodyEyebrow', { hint: '예: About the Exhibition' }));
  bodyCard.append(buildBodyEditor(exh));

  // 메타 스트립
  const metaCard = el('div', { class: 'card' }, el('h3', null, '정보 표 (Dates / Venue …)'));
  metaCard.append(buildMetaStrip(exh));

  // 공유(OG)
  const ogCard = el('div', { class: 'card' }, el('h3', null, '공유 미리보기 (카톡·인스타)'));
  if (!exh.og) exh.og = { title: '', description: '', image: '' };
  const ogPrev = el('div', { class: 'og-card' });
  function renderOgPrev() {
    ogPrev.innerHTML = '';
    ogPrev.append(
      el('img', { src: imgSrc(exh.og.image || exh.poster), alt: '' }),
      el('div', { class: 'og-body' },
        el('div', { class: 'u' }, 'spaceleehan.kr'),
        el('div', { class: 't' }, exh.og.title || `${exh.title} — 공간리한`),
        el('div', { class: 'd' }, exh.og.description || exh.lede || ''),
      ),
    );
  }
  ogCard.append(
    field('공유 제목', exh.og, 'title', { hint: '비우면 “제목 — 공간리한”', onInput: renderOgPrev }),
    field('공유 설명', exh.og, 'description', { textarea: true, hint: '비우면 짧은 소개 사용', onInput: renderOgPrev }),
    el('p', { class: 'section-title', style: 'margin-top:8px' }, '미리보기'),
    ogPrev,
  );
  renderOgPrev();

  // 공개 여부
  const pubCard = el('div', { class: 'card' }, el('h3', null, '공개'));
  const draftCb = el('input', { type: 'checkbox' });
  draftCb.checked = !!exh.draft;
  draftCb.addEventListener('change', () => { exh.draft = draftCb.checked; markDirty(); });
  pubCard.append(el('label', { style: 'display:flex; gap:8px; align-items:center; font-weight:600;' },
    draftCb, '비공개(임시저장) — 체크하면 사이트에 노출되지 않음'));

  root.append(basics, dates, posterCard, photoCard, videoCard, introCard, bodyCard, metaCard, ogCard, pubCard);
  showView('editor');
  window.scrollTo(0, 0);
}

function buildMetaStrip(exh) {
  if (!exh.metaStrip) exh.metaStrip = [];
  const list = el('div', { class: 'row-list' });
  function draw() {
    list.innerHTML = '';
    exh.metaStrip.forEach((m, i) => {
      const lab = el('input', { type: 'text', placeholder: '항목 (예: Dates)', style: 'flex:0 0 140px' });
      lab.value = m.label || '';
      lab.addEventListener('input', () => { m.label = lab.value; markDirty(); });
      const val = el('input', { type: 'text', placeholder: '내용 (줄바꿈은 <br>)' });
      val.value = m.valueHtml || '';
      val.addEventListener('input', () => { m.valueHtml = val.value; markDirty(); });
      list.append(el('div', { class: 'repeat-row' }, lab, val,
        el('button', { class: 'btn btn-sm btn-danger', onclick: () => { exh.metaStrip.splice(i, 1); markDirty(); draw(); } }, '×')));
    });
  }
  draw();
  return el('div', null, list,
    el('button', { class: 'btn btn-sm', style: 'margin-top:10px', onclick: () => { exh.metaStrip.push({ label: '', valueHtml: '' }); markDirty(); draw(); } }, '+ 행 추가'));
}

function buildBodyEditor(exh) {
  const ed = el('div', { class: 'editor', contenteditable: 'true' });
  ed.innerHTML = exh.bodyHtml || '<p></p>';
  const sync = () => {
    ed.querySelectorAll('h2').forEach((h) => h.classList.add('detail-subhead'));
    exh.bodyHtml = ed.innerHTML.trim();
    markDirty();
  };
  ed.addEventListener('input', sync);
  ed.addEventListener('focus', () => { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {} }, { once: true });
  const cmd = (c, v) => { ed.focus(); document.execCommand(c, false, v); sync(); };
  const toolbar = el('div', { class: 'editor-toolbar' },
    el('button', { class: 'btn btn-sm', onclick: () => cmd('bold') }, '굵게'),
    el('button', { class: 'btn btn-sm', onclick: () => cmd('formatBlock', 'p') }, '본문 문단'),
    el('button', { class: 'btn btn-sm', onclick: () => cmd('formatBlock', 'h2') }, '소제목'),
  );
  return el('div', null, toolbar, ed);
}

// ─────────────────────────────────────── 홈 배치
function renderHomepage() {
  const root = $('#view-homepage');
  root.innerHTML = '';
  const hp = state.model.settings.homepage || (state.model.settings.homepage = {});
  const opts = [{ value: '', label: '— 없음 —' }].concat(
    state.model.exhibitions.map((e) => ({ value: e.id, label: e.title || e.slug || e.id })));

  root.append(
    el('div', { class: 'card' },
      el('h3', null, '메인 배너 / Now Showing'),
      selectField('큰 배너(히어로) 전시', hp.heroExhibitionId || '', opts, (v) => { hp.heroExhibitionId = v; }, '맨 위 큰 영역에 노출'),
      selectField('Upcoming 강조 전시', hp.upcomingExhibitionId || '', opts, (v) => { hp.upcomingExhibitionId = v; }, '“Upcoming” 카드에 노출'),
    ),
    buildScheduleOrder(hp),
  );
}

function buildScheduleOrder(hp) {
  if (!Array.isArray(hp.scheduleOrder)) hp.scheduleOrder = [];
  const card = el('div', { class: 'card' }, el('h3', null, 'Schedule 목록 순서'));
  const list = el('div', { class: 'order-list' });
  const titleOf = (id) => {
    const e = state.model.exhibitions.find((x) => x.id === id);
    return e ? (e.title || e.slug) : '(삭제됨)';
  };
  function draw() {
    list.innerHTML = '';
    hp.scheduleOrder.forEach((id, i) => {
      list.append(el('div', { class: 'order-item' },
        el('span', { class: 't' }, `No.${String(i + 1).padStart(2, '0')} · ${titleOf(id)}`),
        el('div', { class: 'ord' },
          el('button', { class: 'btn btn-sm', disabled: i === 0, onclick: () => { move(i, -1); } }, '↑'),
          el('button', { class: 'btn btn-sm', disabled: i === hp.scheduleOrder.length - 1, onclick: () => { move(i, 1); } }, '↓'),
          el('button', { class: 'btn btn-sm btn-danger', onclick: () => { hp.scheduleOrder.splice(i, 1); markDirty(); draw(); } }, '제외'),
        )));
    });
  }
  function move(i, d) {
    const j = i + d;
    [hp.scheduleOrder[i], hp.scheduleOrder[j]] = [hp.scheduleOrder[j], hp.scheduleOrder[i]];
    markDirty(); draw();
  }
  draw();

  const remaining = () => state.model.exhibitions.filter((e) => !hp.scheduleOrder.includes(e.id));
  const addSel = el('select');
  function drawAdd() {
    addSel.innerHTML = '';
    addSel.append(el('option', { value: '' }, '+ 전시 추가…'));
    remaining().forEach((e) => addSel.append(el('option', { value: e.id }, e.title || e.slug || e.id)));
  }
  drawAdd();
  addSel.addEventListener('change', () => {
    if (addSel.value) { hp.scheduleOrder.push(addSel.value); markDirty(); draw(); drawAdd(); }
  });

  card.append(list, el('div', { class: 'field', style: 'margin-top:12px' }, addSel));
  return card;
}

// ─────────────────────────────────────── 사이트 정보
function renderSite() {
  const root = $('#view-site');
  root.innerHTML = '';
  const s = state.model.settings;
  s.marquee = s.marquee || { home: [] };
  s.about = s.about || {};
  s.visit = s.visit || {};

  root.append(
    el('div', { class: 'card' },
      el('h3', null, '상단 흐르는 문구 (마퀴)'),
      linesField('문구 목록', s.marquee, 'home', '한 줄에 하나씩'),
    ),
    el('div', { class: 'card' },
      el('h3', null, '소개 (홈 하단)'),
      field('머리말', s.about, 'eyebrow'),
      field('제목', s.about, 'title'),
      field('부제', s.about, 'subtitle'),
      linesField('문단', s.about, 'homeParagraphs', '한 줄에 한 문단'),
      field('소개 이미지 경로', s.about, 'image', { hint: '예: 공간 사진.jpeg' }),
    ),
    el('div', { class: 'card' },
      el('h3', null, '방문 · 연락처'),
      field('주소(HTML 가능)', s.visit, 'addressHtml', { hint: '줄바꿈은 <br>' }),
      el('div', { class: 'grid-2' },
        field('이메일', s.visit, 'email'),
        field('전화(표시)', s.visit, 'phoneDisplay'),
      ),
      el('div', { class: 'grid-2' },
        field('전화(tel: 링크)', s.visit, 'phoneTel', { hint: '예: +821049305912' }),
        field('인스타 아이디', s.visit, 'instagramHandle', { hint: '@ 없이' }),
      ),
      field('문의 안내(HTML)', s.visit, 'inquiryHtml'),
      el('div', { class: 'grid-2' },
        field('사업자 정보', s.visit, 'businessNumber'),
        field('소속', s.visit, 'affiliation'),
      ),
      field('저작권 문구', s.visit, 'copyright'),
    ),
    buildPasswordCard(),
  );
}

function buildPasswordCard() {
  const card = el('div', { class: 'card' }, el('h3', null, '관리자 로그인 비밀번호'));
  const input = el('input', { type: 'password', placeholder: '새 비밀번호 (12자 이상 권장)', autocomplete: 'new-password' });
  const input2 = el('input', { type: 'password', placeholder: '비밀번호 다시 입력', autocomplete: 'new-password' });
  const btn = el('button', { class: 'btn btn-primary' }, _hasCred ? '비밀번호 변경' : '비밀번호 설정');
  btn.addEventListener('click', async () => {
    const pw = input.value;
    if (pw.length < 8) { toast('비밀번호는 8자 이상으로 해주세요.'); return; }
    if (pw !== input2.value) { toast('두 비밀번호가 일치하지 않습니다.'); return; }
    btn.disabled = true;
    try {
      const cred = await encryptToken(getToken(), pw);
      await commitFiles('관리자: 로그인 비밀번호 설정', [{ path: CRED_PATH, text: JSON.stringify(cred, null, 2) }]);
      _hasCred = true;
      input.value = ''; input2.value = '';
      btn.textContent = '비밀번호 변경';
      toast('비밀번호 설정 완료! 약 1분 뒤부터 다른 기기에서도 이 비밀번호로 로그인할 수 있어요.');
    } catch (e) {
      console.error(e);
      toast('실패: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });
  card.append(
    el('p', { class: 'field', style: 'color:var(--muted); font-size:13px;' },
      '이 비밀번호로 다른 사람도 어느 기기에서나 ', el('b', null, 'spaceleehan.kr/admin/'),
      ' 에 로그인할 수 있어요. 비밀번호가 곧 열쇠이니 충분히 길게 정하고, 새어나가면 바로 변경하세요.'),
    el('div', { class: 'field' }, input),
    el('div', { class: 'field' }, input2),
    btn,
  );
  return card;
}

// ─────────────────────────────────────── 미리보기
function buildPreviewModel() {
  const clone = JSON.parse(JSON.stringify({ exhibitions: state.model.exhibitions, settings: state.model.settings }));
  const map = {};
  for (const [p, img] of state.pendingImages) map[p] = img.dataUrl;
  const swap = (s) => (s && map[s]) ? map[s] : s;
  clone.exhibitions.forEach((e) => {
    e.poster = swap(e.poster);
    (e.photos || []).forEach((ph) => { ph.src = swap(ph.src); });
  });
  if (clone.settings.about) clone.settings.about.image = swap(clone.settings.about.image);
  return clone;
}

function preview() {
  const model = buildPreviewModel();
  const editorActive = $('#view-editor').classList.contains('active');
  const slug = editorActive && _editingExh ? _editingExh.slug : null;
  const url = slug
    ? `../exhibitions/exhibition.html?slug=${encodeURIComponent(slug)}&preview=1`
    : '../index.html?preview=1';
  try {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(model));
  } catch (e) {
    // 이미지가 너무 커서 용량 초과 → 이미지 없이 저장(레이아웃/텍스트만 미리보기)
    const lite = JSON.parse(JSON.stringify({ exhibitions: state.model.exhibitions, settings: state.model.settings }));
    try { sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(lite)); toast('이미지가 커서 새 이미지는 미리보기에서 생략됩니다.'); }
    catch (e2) { toast('미리보기 데이터가 너무 큽니다.'); return; }
  }
  window.open(url, '_blank');
}

// ─────────────────────────────────────── 검증 / 발행
function validateModel() {
  const errs = [];
  const slugs = new Set();
  for (const e of state.model.exhibitions) {
    if (!e.title) errs.push('제목이 비어 있는 전시가 있습니다.');
    if (!e.slug) { errs.push(`"${e.title || e.id}"의 URL 주소(slug)가 비어 있습니다.`); continue; }
    if (!/^[a-zA-Z0-9_-]+$/.test(e.slug)) errs.push(`slug "${e.slug}"에 영문/숫자/-만 사용하세요.`);
    if (slugs.has(e.slug)) errs.push(`slug "${e.slug}"가 중복됩니다.`);
    slugs.add(e.slug);
  }
  return errs;
}

function stubHtml(exh) {
  const slug = exh.slug;
  const target = `exhibition.html?slug=${encodeURIComponent(slug)}`;
  const url = `${CONFIG.siteOrigin}/exhibitions/${slug}.html`;
  const title = (exh.og && exh.og.title) || `${exh.title} — 공간리한`;
  const desc = (exh.og && exh.og.description) || exh.lede || '';
  const rawImg = (exh.og && exh.og.image) || exh.poster || '';
  const img = /^https?:/.test(rawImg) ? rawImg : `${CONFIG.siteOrigin}/${String(rawImg).replace(/^\//, '')}`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="공간리한 LEEHAN">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(img)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${escapeHtml(url)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body></body>
</html>
`;
}

async function publish() {
  if (!state.loaded) return;
  const errs = validateModel();
  if (errs.length) { toast(errs[0]); return; }
  if (CONFIG.branch !== 'main' && !confirm(`테스트 브랜치 '${CONFIG.branch}'에 저장합니다. 계속할까요?`)) return;

  $('#btn-publish').disabled = true;
  setStatus('저장 중…');
  try {
    state.model.settings.buildId = new Date().toISOString();
    state.model.exhibitions.forEach((e) => { e.updatedAt = new Date().toISOString(); });

    const files = [
      { path: 'data/exhibitions.json', text: JSON.stringify({ schemaVersion: 1, exhibitions: state.model.exhibitions }, null, 2) },
      { path: 'data/settings.json', text: JSON.stringify(state.model.settings, null, 2) },
    ];
    for (const [path, img] of state.pendingImages) files.push({ path, base64: img.base64 });
    for (const exh of state.model.exhibitions) {
      if (exh.draft || !exh.slug) continue;
      files.push({ path: `exhibitions/${exh.slug}.html`, text: stubHtml(exh) });
    }

    const sha = await commitFiles(`관리자: 콘텐츠 업데이트`, files);
    state.pendingImages.clear();
    state.dirty = false;
    setStatus(`발행 완료 (${sha.slice(0, 7)}) — 약 1분 뒤 반영`, 'ok');
    toast('발행 완료! 약 1분 뒤 사이트에 반영됩니다.');
  } catch (e) {
    console.error(e);
    setStatus('저장 실패: ' + e.message, 'err');
    toast('저장 실패: ' + e.message);
  } finally {
    $('#btn-publish').disabled = false;
  }
}

boot();
