// 대관 일정 달력 — 날짜마다 "대관됨 / 비어 있음" 두 가지만 보여 준다
// 사이트(rental-schedule.html)와 관리자(대관 일정 탭)가 공유
//
// mountRentalCalendar(root, { getRentals, onDayClick, month, onMonthChange })
//   getRentals() → [{ start, end }]  ('YYYY-MM-DD', end 포함)
//   onDayClick(iso) → 선택. 넘기면 날짜 칸을 누를 수 있게 된다(관리자용)
//   month / onMonthChange → 선택. 처음 펼칠 달(Date)과 달을 넘길 때 알림 — 다시 그려도 보던 달을 유지하려고
// 반환값 { refresh } — 데이터가 바뀌면 다시 그린다

import { el } from './render.js';
import { todayISO } from './status.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function isBooked(rentals, iso) {
  return rentals.some((r) => r.start <= iso && iso <= r.end);
}

// 그 달과 겹치는 대관 기간만, 시작일 순으로
export function rentalsInMonth(rentals, year, month) {
  const first = todayISO(new Date(year, month, 1));
  const last = todayISO(new Date(year, month + 1, 0));
  return rentals
    .filter((r) => r.start <= last && r.end >= first)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function rangeText(r) {
  const md = (iso) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
  if (r.start === r.end) return md(r.start);
  return r.start.slice(0, 4) === r.end.slice(0, 4)
    ? `${md(r.start)} – ${md(r.end)}`
    : `${r.start.slice(0, 4)}.${md(r.start)} – ${r.end.slice(0, 4)}.${md(r.end)}`;
}

function dayCell(date, month, rentals, today, onDayClick) {
  const iso = todayISO(date);
  const outside = date.getMonth() !== month;
  const booked = !outside && isBooked(rentals, iso);
  const cls = ['cal-day',
    outside && 'is-outside',
    iso === today && 'is-today',
    iso < today && 'is-past',
    date.getDay() === 0 && 'is-sun',
    booked && 'is-booked',
  ].filter(Boolean).join(' ');

  const children = [
    el('span', { class: 'cal-num' }, date.getDate()),
    !outside && el('span', { class: 'cal-state' }, booked ? '대관' : ''),
  ];
  if (onDayClick && !outside) {
    return el('button', { type: 'button', class: cls, 'aria-label': `${iso} ${booked ? '대관됨' : '비어 있음'}`, onclick: () => onDayClick(iso) }, children);
  }
  return el('div', { class: cls, 'aria-label': outside ? null : `${iso} ${booked ? '대관됨' : '비어 있음'}` }, children);
}

function gridNode(year, month, rentals, onDayClick) {
  const today = todayISO();
  const first = new Date(year, month, 1);
  const weeks = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(year, month, 1 - first.getDay() + i));

  return el('div', { class: 'cal-grid' },
    WEEKDAYS.map((w, i) => el('div', { class: `cal-wd${i === 0 ? ' is-sun' : ''}` }, w)),
    cells.map((d) => dayCell(d, month, rentals, today, onDayClick)),
  );
}

export function mountRentalCalendar(root, { getRentals, onDayClick, month: initial, onMonthChange }) {
  const start = initial || new Date();
  let year = start.getFullYear();
  let month = start.getMonth();

  const label = el('h3', { class: 'cal-month' });
  const body = el('div', { class: 'cal-body' });
  const go = (delta) => {
    const d = new Date(year, month + delta, 1);
    year = d.getFullYear();
    month = d.getMonth();
    if (onMonthChange) onMonthChange(d);
    refresh();
  };

  root.classList.add('rental-calendar');
  root.replaceChildren(
    el('div', { class: 'cal-head' },
      el('button', { type: 'button', class: 'cal-nav', 'aria-label': '이전 달', onclick: () => go(-1) }, '←'),
      label,
      el('button', { type: 'button', class: 'cal-nav', 'aria-label': '다음 달', onclick: () => go(1) }, '→'),
    ),
    el('div', { class: 'cal-legend' },
      el('span', null, el('i', { class: 'is-booked' }), '대관됨'),
      el('span', null, el('i'), '비어 있음'),
    ),
    body,
  );

  function refresh() {
    const rentals = getRentals();
    const inMonth = rentalsInMonth(rentals, year, month);
    label.textContent = `${year}. ${String(month + 1).padStart(2, '0')}`;
    body.replaceChildren(
      gridNode(year, month, rentals, onDayClick),
      inMonth.length > 0 && el('p', { class: 'cal-summary' }, '대관됨 · ', inMonth.map(rangeText).join(', ')),
    );
  }

  refresh();
  return { refresh };
}
