// 전시 상태 계산 — 사이트와 관리자가 공유
// computeStatus: 강제 지정(statusOverride)이 있으면 그것, 없으면 오늘 날짜로 자동 계산

export function todayISO(d) {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeStatus(exh, today) {
  const t = today || todayISO();
  if (exh && exh.statusOverride) return exh.statusOverride;
  const start = (exh && exh.startDate) || '';
  const end = (exh && exh.endDate) || '';
  // ISO 날짜(YYYY-MM-DD)는 사전식 비교로 시간 순서가 보장됨
  if (start && t < start) return 'upcoming';
  if (end && t > end) return 'past';
  return 'current';
}

export const STATUS_KICKER = {
  current: 'Current Exhibition',
  upcoming: 'Upcoming Exhibition',
  past: 'Past Exhibition',
};

export const STATUS_TAG = {
  current: 'NOW SHOWING',
  upcoming: 'UPCOMING',
  past: 'CLOSED',
};

export const STATUS_BADGE = {
  current: 'Now Showing',
  upcoming: 'Upcoming',
  past: 'Closed',
};

export const STATUS_LABEL_KO = {
  current: '현재 전시',
  upcoming: '예정 전시',
  past: '지난 전시',
};

export function kickerOf(exh, status) {
  return (exh && exh.kicker) || STATUS_KICKER[status] || '';
}

export function tagOf(exh, status) {
  return (exh && exh.figureTag) || STATUS_TAG[status] || '';
}
