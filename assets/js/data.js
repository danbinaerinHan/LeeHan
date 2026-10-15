// 데이터 로더 — exhibitions.json + settings.json + rentals.json
// 미리보기 모드(window.__LEEHAN_PREVIEW_DATA__)가 있으면 그것을 우선 사용

// assets/js/data.js → data/
const DATA_DIR = new URL('../../data/', import.meta.url);

function normalize(raw) {
  const exhibitions = (raw && raw.exhibitions) || [];
  const settings = (raw && raw.settings) || {};
  const rentals = (raw && raw.rentals) || [];
  const byId = {};
  const bySlug = {};
  exhibitions.forEach((e) => {
    if (e && e.id) byId[e.id] = e;
    if (e && e.slug) bySlug[e.slug] = e;
  });
  return { exhibitions, settings, rentals, byId, bySlug };
}

export async function loadData() {
  if (window.__LEEHAN_PREVIEW_DATA__) {
    return normalize(window.__LEEHAN_PREVIEW_DATA__);
  }
  // 관리자 미리보기: ?preview=1 일 때만 sessionStorage 데이터를 사용(공개 사이트엔 영향 없음)
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('preview') === '1') {
      const sess = sessionStorage.getItem('leehan_preview');
      if (sess) return normalize(JSON.parse(sess));
    }
  } catch (e) { /* ignore */ }
  // GitHub Pages 캐시 우회
  const bust = `?v=${Date.now()}`;
  const [exhRes, setRes, rentRes] = await Promise.all([
    fetch(new URL('exhibitions.json' + bust, DATA_DIR)),
    fetch(new URL('settings.json' + bust, DATA_DIR)),
    fetch(new URL('rentals.json' + bust, DATA_DIR)),
  ]);
  if (!exhRes.ok || !setRes.ok) {
    throw new Error(`데이터 로드 실패: exhibitions ${exhRes.status}, settings ${setRes.status}`);
  }
  const exhibitionsDoc = await exhRes.json();
  const settings = await setRes.json();
  // 대관 일정은 없어도 사이트가 돌아가야 하므로 실패하면 빈 목록
  const rentalsDoc = rentRes.ok ? await rentRes.json() : {};
  return normalize({ exhibitions: exhibitionsDoc.exhibitions, settings, rentals: rentalsDoc.rentals });
}
