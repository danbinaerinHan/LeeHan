// 전시 신청서 docx 생성 — 원본 양식(assets/forms/apply-template.docx)의 {{키}} 자리를 채운다.
// 체크박스는 {{cb:그룹:값}} → ☑/☐. 신청자 표는 작가 수만큼 복제한다.
const TEMPLATE_URL = new URL('../forms/apply-template.docx', import.meta.url);
const JSZIP_URL = new URL('./vendor/jszip.min.js', import.meta.url);

let jszipLoading = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  jszipLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP_URL;
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => { jszipLoading = null; reject(new Error('JSZip 로드 실패')); };
    document.head.append(s);
  });
  return jszipLoading;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 여러 줄 입력은 Word 줄바꿈으로
const xmlText = (v) => esc(v || '').replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');

function fill(xml, values, checks) {
  return xml.replace(/\{\{([^}]+)\}\}/g, (_, key) =>
    key.startsWith('cb:') ? (checks.has(key.slice(3)) ? '☑' : '☐') : xmlText(values[key]));
}

function peopleTables(xml, people) {
  const at = xml.indexOf('{{p.name}}');
  const start = xml.lastIndexOf('<w:tbl>', at);
  const end = xml.indexOf('</w:tbl>', at) + '</w:tbl>'.length;
  const table = xml.slice(start, end);

  const tables = people.map((p, i) => {
    const label = people.length === 1 ? '항목' : i === 0 ? '대표 신청자' : `작가 ${i + 1}`;
    const values = Object.fromEntries(Object.entries({ ...p, label }).map(([k, v]) => [`p.${k}`, v]));
    const checks = new Set(p.newcomer ? [`p.newcomer:${p.newcomer}`] : []);
    const filled = fill(table, values, checks);
    // 복제본은 문단 ID가 겹치지 않게 지운다
    return i === 0 ? filled : filled.replace(/ w14:(paraId|textId)="[^"]*"/g, '');
  });
  return xml.slice(0, start) + tables.join('<w:p/>') + xml.slice(end);
}

export async function buildApplyDocx({ values, checks, people }) {
  const [JSZip, buf] = await Promise.all([
    loadJSZip(),
    fetch(TEMPLATE_URL).then((r) => {
      if (!r.ok) throw new Error(`양식 파일을 불러오지 못했습니다 (${r.status})`);
      return r.arrayBuffer();
    }),
  ]);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', fill(peopleTables(xml, people), values, checks));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}
