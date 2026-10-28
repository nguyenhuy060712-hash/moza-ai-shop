// Định dạng chung (GD1): tiền "10.000đ", ngày dd/mm/yyyy, giờ Việt Nam, USD kèm tiền Việt theo tỷ giá cài đặt.

export const TY_GIA_MAC_DINH = 26000;
let tyGia = TY_GIA_MAC_DINH;
/** Màn hình nạp tỷ giá từ cài đặt `ty_gia_vnd` một lần (app.js); chưa nạp thì dùng mặc định. */
export function datTyGia(n) { const x = Number(n); if (x > 0) tyGia = x; }
export const layTyGia = () => tyGia;

const cham = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 10000 → "10.000đ". Rỗng / null → "" khi `traRong`, ngược lại "0đ". */
export function tien(n, traRong = false) {
  if (n == null || n === '') return traRong ? '' : '0đ';
  const x = Number(n);
  return Number.isFinite(x) ? `${x < 0 ? '-' : ''}${cham(Math.abs(x))}đ` : '';
}

/** Đọc giá gõ tay giống máy chủ ("289k", "1tr2", "289.000") → số; không đọc được → NaN; rỗng → null. */
export function docTien(s) {
  const x = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/\s+/g, '').replace(/(vnd|dong|d)$/, '');
  if (!x) return null;
  let m = /^(\d+)(?:[.,](\d+))?(tr|trieu|m)(\d{0,3})$/.exec(x);
  if (m) { const le = m[2] ?? m[4] ?? ''; return Number(m[1]) * 1e6 + (le ? Math.round(Number(`0.${le}`) * 1e6) : 0); }
  m = /^(\d+)(?:[.,](\d+))?k$/.exec(x);
  if (m) return Math.round(Number(`${m[1]}.${m[2] || 0}`) * 1000);
  if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return Number(x.replace(/[.,]/g, ''));
  if (/^\d+$/.test(x)) return Number(x);
  return NaN;
}

/** USD → "0,05 USD" (đủ số lẻ cho khoản nhỏ). */
export function usd(x) {
  const n = Number(x) || 0;
  return `${n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: n >= 1 ? 2 : 4 })} USD`;
}

/** USD → "≈ 1.300đ" theo tỷ giá cài đặt. */
export const vnd = (u) => `≈ ${cham((Number(u) || 0) * tyGia)}đ`;
/** "0,05 USD ≈ 1.300đ". */
export const usdVnd = (u) => `${usd(u)} ${vnd(u)}`;

const PHAN = (iso, tuy) => Object.fromEntries(new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23', ...tuy })
  .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));

/** ISO (UTC) → "27/09/2026" theo giờ Việt Nam. */
export function ngay(iso) {
  if (!iso) return '';
  const x = PHAN(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${x.day}/${x.month}/${x.year}`;
}

/** ISO (UTC) → "23/09 18:14" (hoặc "23/09/2026 18:14" khi coNam). Ghép từng phần: vi-VN không năm in "23-09". */
export function gioPhut(iso, coNam = false) {
  if (!iso) return '';
  const x = PHAN(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${x.day}/${x.month}${coNam ? `/${x.year}` : ''} ${x.hour}:${x.minute}`;
}

/** "27/09/2026" (gõ tay, cũng nhận 27-9-2026 hoặc 27/9) → "2026-09-27"; sai → null. Thiếu năm lấy năm nay. */
export function docNgay(s, namMacDinh = new Date().getFullYear()) {
  const m = /^\s*(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?\s*$/.exec(String(s ?? ''));
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3] || namMacDinh)];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** "2026-09-27" → "27/09/2026". */
export const ngayTuIso = (s) => (/^(\d{4})-(\d{2})-(\d{2})$/.test(s || '') ? s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') : '');
