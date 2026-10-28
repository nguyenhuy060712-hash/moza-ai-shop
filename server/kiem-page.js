'use strict';

/**
 * Hỏi Meta Page có đang bị hạn chế nhắn tin không (SPEC.md F-73, #102) — Page Integrity API (`/{page}/page_status`, tra 27/9/2026).
 * Chạy lúc mở phiên live và mỗi giờ. Bị hạn chế → ghi `page_bi_cam` (Hook giới hạn liên hệ dừng mọi tin chủ động, chốt đơn gom
 * công khai + danh sách Nhắn bù); hết hạn chế → gỡ. Hỏi lỗi (thiếu quyền, mất mạng) thì giữ nguyên trạng thái cũ.
 */

const fbPage = require('./nghiep-vu/fb-page');

/**
 * @param {{pageId:string, kiem:() => Promise<{bi_han_che:boolean, ly_do:string|null}>}[]} ds
 * @param {Function} [phat]
 * @returns {Promise<{page_id:string, bi_han_che?:boolean, doi?:boolean, loi?:string}[]>}
 */
async function kiemPages(ds, phat = () => {}) {
  const kq = [];
  for (const p of ds) {
    try {
      const r = await p.kiem();
      const doi = fbPage.datBiCam(p.pageId, r.bi_han_che, r.bi_han_che ? `Page Integrity: ${r.ly_do || 'Meta hạn chế nhắn tin'}` : null);
      kq.push({ page_id: p.pageId, bi_han_che: r.bi_han_che, doi });
    } catch (e) {
      kq.push({ page_id: p.pageId, loi: e.message });
    }
  }
  if (kq.some((x) => x.doi)) phat('ket_noi.trang_thai', {});
  return kq;
}

/** Danh sách Page để hỏi: Page thật đang nối + Page giả của Phòng diễn tập. */
function dsPage({ ketNoiFb, fbGia }) {
  const that = (ketNoiFb?.pagesDangChay?.() || []).map((p) => ({ pageId: p.pageId, kiem: () => p.kiemHanChePage() }));
  const gia = (fbGia?.pages || []).map((p) => ({ pageId: p.id, kiem: () => fbGia.kiemHanChePage({ page_id: p.id }) }));
  return [...that, ...gia];
}

module.exports = { kiemPages, dsPage };
