// So sánh bản cũ / bản mới (GD1, F-125): so theo dòng bằng thuật toán dãy con chung dài nhất (tự viết, không thư viện).
// Kết quả: dòng Thêm / Sửa / Bỏ có màu; đoạn dài không đổi được gập lại.

import { h } from './ui.js';

/** Tách chữ thành các dòng (bỏ dòng thừa ở cuối). */
const dong = (s) => String(s ?? '').replace(/\r\n/g, '\n').split('\n');

/**
 * Dãy con chung dài nhất của hai mảng dòng → danh sách thao tác.
 * @returns {{loai:'giu'|'them'|'bo'|'sua', chu?:string, cu?:string, moi?:string}[]}
 */
export function soSanhDong(cuChu, moiChu) {
  const a = dong(cuChu);
  const b = dong(moiChu);
  const n = a.length;
  const m = b.length;
  // bảng độ dài dãy con chung của hậu tố a[i..], b[j..]
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);

  const ops = [];
  let i = 0;
  let j = 0;
  let boTam = [];
  let themTam = [];
  const xaKhoi = () => {
    const k = Math.min(boTam.length, themTam.length);
    for (let x = 0; x < k; x++) ops.push({ loai: 'sua', cu: boTam[x], moi: themTam[x] });
    for (const c of boTam.slice(k)) ops.push({ loai: 'bo', chu: c });
    for (const c of themTam.slice(k)) ops.push({ loai: 'them', chu: c });
    boTam = [];
    themTam = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { xaKhoi(); ops.push({ loai: 'giu', chu: a[i] }); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { themTam.push(b[j]); j++; }
    else { boTam.push(a[i]); i++; }
  }
  xaKhoi();
  return ops;
}

/** Đếm số dòng đổi: { them, sua, bo }. */
export function demDoi(ops) {
  const kq = { them: 0, sua: 0, bo: 0 };
  for (const o of ops) if (o.loai !== 'giu') kq[o.loai] += 1;
  return kq;
}

/** Khối so sánh: dòng đổi có màu, đoạn không đổi dài hơn `nguong` dòng thì gập lại ("… 12 dòng không đổi"). */
export function veSoSanh(cuChu, moiChu, { nguong = 4 } = {}) {
  const ops = soSanhDong(cuChu, moiChu);
  const d = demDoi(ops);
  if (!d.them && !d.sua && !d.bo) return h('p', { class: 'hint' }, 'Không có gì khác bản trước.');
  const hang = (dau, lop, chu) => h('div', { class: `ss-dong ${lop}` }, h('span', { class: 'dau', 'aria-hidden': 'true' }, dau), h('span', {}, chu || ' '));
  const ra = [];
  for (let k = 0; k < ops.length;) {
    if (ops[k].loai !== 'giu') {
      const o = ops[k++];
      if (o.loai === 'them') ra.push(hang('+', 'ss-them', o.chu));
      else if (o.loai === 'bo') ra.push(hang('−', 'ss-bo', o.chu));
      else { ra.push(hang('−', 'ss-bo', o.cu)); ra.push(hang('+', 'ss-them', o.moi)); }
      continue;
    }
    let e = k;
    while (e < ops.length && ops[e].loai === 'giu') e++;
    const run = ops.slice(k, e);
    if (run.length > nguong) {
      // giữ 1 dòng làm ngữ cảnh ở hai đầu (trừ đầu / cuối văn bản)
      if (k > 0) ra.push(hang(' ', 'ss-giu', run[0].chu));
      ra.push(hang('⋯', 'ss-giu', `${run.length - (k > 0 ? 1 : 0) - (e < ops.length ? 1 : 0)} dòng không đổi`));
      if (e < ops.length) ra.push(hang(' ', 'ss-giu', run.at(-1).chu));
    } else for (const o of run) ra.push(hang(' ', 'ss-giu', o.chu));
    k = e;
  }
  const tomTat = [d.them && `${d.them} dòng thêm`, d.sua && `${d.sua} dòng sửa`, d.bo && `${d.bo} dòng bỏ`].filter(Boolean).join(' · ');
  return h('div', {}, h('p', { class: 'hint' }, tomTat), h('div', { class: 'so-sanh' }, ra));
}

/**
 * Bảng hai cột cho việc "Nói với Mai" có dạng "… cũ → mới" (xem trước của công cụ quản lý).
 * Dòng không có mũi tên giữ nguyên là một dòng chữ.
 */
export function tachCuMoi(chu) {
  const k = String(chu).lastIndexOf(' → ');
  if (k < 0) return null;
  return { truoc: chu.slice(0, k), sau: chu.slice(k + 3) };
}

export function veBangCuMoi(dsChu) {
  const cap = dsChu.map((x) => ({ x, p: tachCuMoi(x) }));
  if (!cap.some((c) => c.p)) return h('ul', {}, dsChu.map((x) => h('li', {}, x)));
  return h('table', { class: 'bang-du-lieu' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Việc'), h('th', {}, 'Sẽ thành'))),
    h('tbody', {}, cap.map(({ x, p }) => (p
      ? h('tr', {}, h('td', {}, p.truoc), h('td', {}, h('b', {}, p.sau)))
      : h('tr', {}, h('td', { colspan: 2 }, x))))));
}
