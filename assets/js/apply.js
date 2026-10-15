// 전시 신청서 (apply.html)
// 정적 사이트라 서버 접수가 없다: ① 입력값으로 원본 양식 docx를 채워 내려받고
// ② mailto 로 메일 창을 연다. 파일 첨부는 신청자가 직접 한다.
import { el } from './render.js';
import { buildApplyDocx } from './apply-docx.js';

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

// 양식의 체크박스 그룹 = 폼의 input name
const CHECK_GROUPS = ['type', 'package', 'genre', 'overtime', 'sale', 'docs', 'privacy'];
const TEXT_FIELDS = ['title', 'period1', 'period2', 'packageEtc', 'install', 'genreEtc', 'count',
  'maxSize', 'events', 'overtimePeriod', 'priceRange', 'goods', 'signer'];

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

function readForm(form) {
  const isInvite = checked(form, 'type')[0] === '초대전';
  const values = Object.fromEntries(TEXT_FIELDS.map((k) => [k, val(form, k)]));
  values.date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  if (isInvite) values.packageEtc = '';

  const checks = new Set(CHECK_GROUPS
    .filter((g) => !(isInvite && g === 'package'))
    .flatMap((g) => checked(form, g).map((v) => `${g}:${v}`)));
  return { values, checks, people: readPeople(form) };
}

const fileSafe = (s) => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
const fileName = (data) =>
  ['공간리한_전시신청서', data.values.title, data.people[0]?.name].filter(Boolean).map(fileSafe).join('_') + '.docx';

function mailBody(form, data) {
  const lead = data.people[0] || {};
  const docs = checked(form, 'docs');
  return [
    '안녕하세요. 공간리한 전시 신청서를 보내드립니다.',
    '',
    `- 전시명: ${data.values.title}`,
    `- 전시 유형: ${checked(form, 'type')[0]}`,
    `- 신청자: ${lead.name} (${lead.phone} / ${lead.email})`,
    '',
    '첨부',
    `- 전시 신청서 (${fileName(data)})`,
    ...docs.map((d) => `- ${d}`),
  ].join('\n');
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

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function mountApplyForm(form) {
  if (!form) return;
  const list = form.querySelector('#apply-people');
  const errorBox = form.querySelector('#apply-error');
  const docxBtn = form.querySelector('#apply-docx');

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
  const validate = () => {
    const bad = firstInvalid(form);
    showError(bad?.msg || '', bad?.node);
    return !bad;
  };

  docxBtn.addEventListener('click', async () => {
    if (!validate()) return;
    const label = docxBtn.textContent;
    docxBtn.disabled = true;
    docxBtn.textContent = '만드는 중…';
    try {
      const data = readForm(form);
      download(await buildApplyDocx(data), fileName(data));
      docxBtn.textContent = '받았습니다 ✓';
    } catch (err) {
      console.error(err);
      showError('신청서 파일을 만들지 못했습니다. 잠시 후 다시 시도하거나 메일로 문의해 주세요.');
      docxBtn.textContent = label;
    } finally {
      docxBtn.disabled = false;
      setTimeout(() => { docxBtn.textContent = label; }, 3000);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = readForm(form);
    const subject = `[전시 신청] ${data.values.title} — ${data.people[0]?.name || ''}`;
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody(form, data))}`;
  });
}
