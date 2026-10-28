// Đường dẫn cũ → đường dẫn mới (GD1): giữ phần đuôi và ?tham_số để liên kết cũ vẫn mở đúng.

/** Trả về địa chỉ mới, hoặc null nếu không phải đường cũ. */
export function doiDuongCu(hash) {
  const m = /^#\/?([^/?]*)(.*)$/.exec(hash || '');
  if (!m) return null;
  const [, dau, duoi] = m;
  if (dau === 'tong-quan') return `#/hom-nay${duoi}`;
  if (dau === 'hop-thu') return `#/tin-nhan${duoi}`;
  if (dau === 'agent') return `#/cai-dat/tro-ly-ai${duoi}`;
  return null;
}
