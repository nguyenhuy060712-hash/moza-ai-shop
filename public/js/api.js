// Gọi API của MOZA. Lỗi luôn được dịch thành câu người dùng hiểu được.

// fetch ném lỗi khi không kết nối được; trình duyệt chỉ nói "Failed to fetch".
const DA_TAT = 'Phần mềm đã tắt nên trang này không gọi được. Bấm đúp CHAY PHAN MEM.bat để mở lại, rồi tải lại trang.';

async function goi(duongDan, tuyChon = {}) {
  let r;
  try {
    r = await fetch('/api' + duongDan, tuyChon);
  } catch {
    throw new Error(DA_TAT);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.loi?.thong_diep || `Có lỗi xảy ra (mã ${r.status}).`);
    e.ma = j.loi?.ma;
    throw e;
  }
  return j;
}

const gui = (phuongThuc) => (duongDan, than) => goi(duongDan, {
  method: phuongThuc,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(than ?? {}),
});

export const api = {
  get: (duongDan) => goi(duongDan),
  post: gui('POST'),
  put: gui('PUT'),
  del: gui('DELETE'),
};
