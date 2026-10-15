// 전시 신청서 (apply.html) — 입력값을 정리해 메일 본문으로 넘긴다.
// 정적 사이트라 서버 접수가 없다: mailto 로 메일 창을 열고, 첨부는 신청자가 직접 붙인다.
import { el } from './render.js';

const TO = 'spaceleehan@gmail.com';

const PERSON_FIELDS = [
  { key: 'name', label: '성명 (단체명)', required: true },
  { key: 'rep', label: '대표자 (단체인 경우)' },
  { key: 'birth', label: '생년월일 / 사업자등록번호' },
  { key: 'phone', label: '연락처', required: true, type: 'tel' },
  { key: 'email', label: '이메일', required: true, type: 'email' },
  { key: 'address', label: '주소', full: true },
  { key: 'web', label: '홈페이지 / SNS', full: true },
];

let personSeq = 0;

function personBlock(index, onRemove) {
  const id = ++personSeq;
  const block = el('div', { class: 'apply-person', 'data-person': '' },
    el('div', { class: 'apply-person-head' },
      el('span', { class: 'apply-person-title' }, index === 0 ? '대표 신청자' : `작가 ${index + 1}`),
      index > 0 && el('button', { type: 'button', class: 'apply-remove', onclick: () => onRemove(block) }, '삭제'),
    ),
    el('div', { class: 'apply-grid' },
      PERSON_FIELDS.map((f) => {
        // 추가 작가는 이름만 필수 — 연락은 대표 신청자에게
        const required = f.required && (index === 0 || f.key === 'name');
        return el('label', { class: `apply-field${f.full ? ' full' : ''}` },
          el('span', null, f.label, required && el('i', null, ' *')),
          el('input', { 'data-key': f.key, type: f.type || 'text', required }),
        );
      }),
    ),
    el('div', { class: 'apply-field full' },
      el('span', null, '신진·학생 해당 여부'),
      el('div', { class: 'apply-chips' },
        ['해당', '미해당'].map((v) => el('label', null,
          el('input', { type: 'radio', name: `newcomer-${id}`, value: v, 'data-key': 'newcomer' }), v)),
      ),
      el('small', { class: 'apply-hint' }, '해당할 경우 포트폴리오와 재학증명서 PDF를 첨부해 주세요.'),
    ),
  );
  return block;
}

function renumber(list) {
  list.querySelectorAll('[data-person]').forEach((b, i) => {
    b.querySelector('.apply-person-title').textContent = i === 0 ? '대표 신청자' : `작가 ${i + 1}`;
  });
}

const val = (form, name) => (form.elements[name]?.value || '').trim();
const checked = (form, name) =>
  [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
const withEtc = (items, etc) => items.map((v) => (v === '기타' && etc ? `기타(${etc})` : v));

function readPeople(form) {
  return [...form.querySelectorAll('[data-person]')].map((b) => {
    const p = {};
    b.querySelectorAll('input[data-key]').forEach((i) => {
      if (i.type === 'radio') { if (i.checked) p[i.dataset.key] = i.value; }
      else p[i.dataset.key] = i.value.trim();
    });
    return p;
  });
}

function buildBody(form) {
  const line = (label, v) => `- ${label}: ${v || '-'}`;
  const people = readPeople(form);
  const type = checked(form, 'type')[0] || '';
  const out = ['[공간리한 전시 신청서]', '', '1. 전시 유형', line('유형', type), '', '2. 신청자 정보'];

  people.forEach((p, i) => {
    out.push(i === 0 ? '(대표 신청자)' : `(작가 ${i + 1})`);
    PERSON_FIELDS.forEach((f) => out.push(line(f.label, p[f.key])));
    out.push(line('신진·학생 해당 여부', p.newcomer), '');
  });

  out.push(
    '3. 전시 개요',
    line('전시명 (가제)', val(form, 'title')),
    line('희망 기간 1지망', val(form, 'period1')),
    line('희망 기간 2지망', val(form, 'period2')),
  );
  if (type !== '초대전') {
    out.push(line('이용 패키지', withEtc(checked(form, 'package'), val(form, 'packageEtc')).join(', ')));
  }
  const overtime = checked(form, 'overtime').join(', ');
  const overtimePeriod = val(form, 'overtimePeriod');
  const docs = checked(form, 'docs');
  out.push(
    line('설치·철수 예정일 및 시간', val(form, 'install')),
    line('장르', withEtc(checked(form, 'genre'), val(form, 'genreEtc')).join(', ')),
    line('예상 출품 수량', val(form, 'count')),
    line('최대 작품 크기·무게', val(form, 'maxSize')),
    line('오프닝·부대행사 계획', val(form, 'events')),
    line('시간 외 사용', [overtime, overtimePeriod && `기간: ${overtimePeriod}`].filter(Boolean).join(' / ')),
    '',
    '4. 판매 계획',
    line('작품 판매 여부', checked(form, 'sale')[0]),
    line('예상 판매가 범위', val(form, 'priceRange')),
    line('굿즈 판매 여부 및 품목', val(form, 'goods')),
    '',
    '5. 첨부 서류 (메일에 첨부)',
    ...(docs.length ? docs.map((d) => `- ${d}`) : ['- 없음']),
    '',
    '6. 개인정보 수집·이용 동의: 동의함',
    '7. 확인: 위 내용이 사실이며, 공간리한 대관 안내 및 이용 규정을 확인하였습니다.',
    line('신청일', new Date().toLocaleDateString('ko-KR')),
    line('신청인', val(form, 'signer')),
  );
  return { subject: `[전시 신청] ${val(form, 'title')} — ${people[0]?.name || ''}`, body: out.join('\n') };
}

function firstInvalid(form) {
  if (!checked(form, 'type').length) return { msg: '전시 유형을 선택해 주세요.', node: form.querySelector('input[name="type"]') };
  const missing = [...form.querySelectorAll('input[required], textarea[required]')]
    .filter((i) => i.type !== 'checkbox' && i.type !== 'radio')
    .find((i) => !i.value.trim() || !i.checkValidity());
  if (missing) return { msg: '필수 항목(*)을 확인해 주세요.', node: missing };
  if (!form.elements.privacy.checked) return { msg: '개인정보 수집·이용에 동의해야 신청할 수 있습니다.', node: form.elements.privacy };
  if (!form.elements.confirm.checked) return { msg: '확인 항목에 체크해 주세요.', node: form.elements.confirm };
  return null;
}

export function mountApplyForm(form) {
  if (!form) return;
  const list = form.querySelector('#apply-people');
  const errorBox = form.querySelector('#apply-error');

  const remove = (block) => { block.remove(); renumber(list); };
  list.append(personBlock(0, remove));
  form.querySelector('#apply-add-person').addEventListener('click', () => {
    list.append(personBlock(list.children.length, remove));
  });

  // 패키지는 대관전에만 해당
  const pkg = form.querySelector('[data-show-when="대관전"]');
  const syncType = () => { pkg.hidden = checked(form, 'type')[0] === '초대전'; };
  form.querySelectorAll('input[name="type"]').forEach((i) => i.addEventListener('change', syncType));

  const showError = (msg, node) => {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
    if (node) { node.scrollIntoView({ behavior: 'instant', block: 'center' }); node.focus({ preventScroll: true }); }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = firstInvalid(form);
    if (bad) { showError(bad.msg, bad.node); return; }
    showError('');
    const { subject, body } = buildBody(form);
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  const copyBtn = form.querySelector('#apply-copy');
  copyBtn.addEventListener('click', async () => {
    const { subject, body } = buildBody(form);
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      copyBtn.textContent = '복사됨 ✓';
    } catch {
      copyBtn.textContent = '복사 실패 — 직접 선택해 주세요';
    }
    setTimeout(() => { copyBtn.textContent = '내용 복사'; }, 2400);
  });
}
