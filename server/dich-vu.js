'use strict';

/**
 * Nơi giữ các dịch vụ chạy suốt đời phần mềm (Facebook giả, phòng live, phòng diễn tập),
 * để các đường API dùng chung một bản. index.js tạo lúc khởi động, dọn lúc tắt.
 */

const { FacebookGia } = require('./facebook/gia');
const { PhongLive } = require('./phong-live');
const { DienTap } = require('./dien-tap');
const { PhongAi } = require('./phong-ai');
const { NguoiDongVai } = require('./agent/agents/nguoi-dong-vai');
const { ChepLoiNguoiDan } = require('./chep-loi-nguoi-dan');
const { MiengCuaMai } = require('./agent/mieng/mieng');
const { DoiAiDan } = require('./doi-ai/dan-doi');
const { KetNoiFacebook } = require('./facebook/ket-noi');
const { HopThuTuDong } = require('./hop-thu');
const { TiengGia } = require('./tieng-gia');
const { ChotDon } = require('./chot-don');
const { KhachGia } = require('./khach-gia');
const { ManHinhSanPham } = require('./man-hinh-san-pham');
const { phat, datXuLy, bus } = require('./ws');

let dv = null;

function moDichVu({ congMoza = 5173 } = {}) {
  // Phòng diễn tập: Facebook giả có độ trễ như mạng thật (docs/07 mục 2); test để 0.
  const fbGia = new FacebookGia({ treMs: [200, 800] });
  const ketNoiFb = new KetNoiFacebook({ phat });
  /**
   * Chọn bộ Kết nối Facebook (mục 5 nguyên tắc 5): phiên live hoặc hội thoại diễn tập → Facebook giả;
   * chỉ phiên / hội thoại thật (`dien_tap` = false) mới đi qua Facebook thật. Không rõ thì luôn là bản giả,
   * để dữ liệu diễn tập không bao giờ ra Facebook thật (mục 7).
   * @param {object|string|null} x  phiên live, id phiên live, hoặc { dien_tap }
   */
  const layKetNoi = (x = null) => {
    let d = x;
    if (typeof x === 'string') {
      try { d = require('./nghiep-vu/live').layPhien(x); } catch { d = null; }
    }
    return d && d.dien_tap === false ? ketNoiFb.fb : fbGia;
  };
  const phongAi = new PhongAi({ phat });
  // Màn hình sản phẩm + chuyển cảnh OBS (#90): theo đoạn kịch bản, Director, Mai trên sóng, lệnh của người dẫn.
  const manHinh = new ManHinhSanPham({ phat, bus, congMoza });
  phongAi.manHinh = manHinh;
  const chepLoi = new ChepLoiNguoiDan({ phat, phongAi });
  // F-106: Mai nói giá / phí ship thấp hơn (lỗi "chắc") → đơn chốt trong khoảng nói nhầm được giữ giá Mai nói; thẻ đã gửi thì
  // gửi thẻ mới đúng tổng (theo luật gửi hiện có: 24 giờ, giới hạn liên hệ).
  const khiNoiNham = (loi) => {
    const ds = require('./nghiep-vu/gia-noi-nham').quetKhoang(loi);
    for (const dd of ds) {
      const d = require('./nghiep-vu/don').layDon(dd.don_id);
      if (d.trang_thai === 'cho_xac_nhan' && d.the_gui && dd.chi_tiet.tong_moi !== dd.chi_tiet.tong_cu) {
        require('./gui-the-don').guiTheDon({ d, layKetNoi }).catch((e) => console.error(`  [giá nói nhầm] gửi lại thẻ: ${e.message}`));
      }
      phat('don.cap_nhat', { don_id: d.id });
    }
  };
  const mieng = new MiengCuaMai({ phat, chepLoi, phongAi, khiNoiNham });
  // F-107: MOZA nhìn qua OBS (tắt mặc định) — chỉ gợi ý chuyển món, không bao giờ tự chuyển.
  const nhinMon = new (require('./nhin-mon').NhinMon)({ phat, layObs: () => manHinh.obs });
  nhinMon.batDau();
  phongAi.mieng = mieng;
  // Đội AI dẫn (bản 2.9, #49): đọc qua cùng loa với miệng; chép lời báo người dẫn nói xen, bỏ tiếng loa lọt micro.
  const doiAi = new DoiAiDan({ phat, mieng, phongAi });
  phongAi.doiAi = doiAi;
  chepLoi.doiAi = doiAi;
  // Tin trình duyệt gửi lên qua /ws: Màn hình người dẫn nhận tiếng Mai (loa.bat); còn lại là micro (chép lời / miệng).
  datXuLy({
    nhan(ws, duLieu, laNhiPhan) {
      if (!laNhiPhan && duLieu.length < 200 && String(duLieu).includes('"loa.bat"')) return mieng.datLoa(ws);
      chepLoi.nhan(ws, duLieu, laNhiPhan);
    },
    dong(ws) {
      mieng.boLoa(ws);
      chepLoi.dong(ws);
    },
  });
  let xemLai = null; // F-94 — tạo sau khi có Hộp thư và chốt đơn
  const phongLive = new PhongLive({ layKetNoi, phat, ai: phongAi, khiKetThuc: (id) => { chepLoi.ketThuc(id); xemLai?.henMucLuc(id); } });
  // Khách giả trả lời tin nhắn trong Phòng diễn tập (#87) — buổi tập đi trọn tới lúc xác nhận đơn.
  const khachGia = new KhachGia({ fbGia, phat, bus });
  const nguoiDongVai = new NguoiDongVai({ fbGia, phat, khachGia });
  // Người dẫn giả nói có tiếng (bản 2.5, F-39): tiếng đi vào đường micro như micro thật.
  const tiengGia = new TiengGia({ chepLoi, phat });
  const dienTap = new DienTap({
    fb: fbGia, phat, nguoiDongVai, tiengGia,
    hoiMai: (cau) => {
      const p = require('./nghiep-vu/live').phienDangMo();
      if (p) phongAi.hoiMai(p.id, cau);
    },
  });
  fbGia.on('thay_doi', () => {
    // Live giả tắt thì Người đóng vai cũng thôi.
    if (!fbGia.trangThai().dang_phat) nguoiDongVai.tat();
    phat('dien_tap.trang_thai', dienTap.trangThai());
  });
  // Live của Page đổi trạng thái (webhook live_videos) → phòng live quét ngay, không đợi lượt hỏi 15 giây.
  ketNoiFb.on('su_kien', (ev) => {
    if (ev.loai === 'live_doi') phongLive.quet().catch(() => {});
  });
  const hopThu = new HopThuTuDong({ ketNoiFb, fbGia, layKetNoi, phat });
  // Chốt đơn từ bình luận live (F-53): giữ hàng, đọc tên trên sóng, Tư vấn viên nhắn riêng.
  const chotDon = new ChotDon({ phat, layHopThu: () => hopThu, phongAi, layKetNoi });
  phongLive.chotDon = chotDon;
  // F-94: bán sau live — bình luận video xem lại tới 7 ngày (webhook + quét lúc khởi động, 10 phút một lần), mục lục sau live.
  const { XemLai } = require('./xem-lai');
  xemLai = new XemLai({ layKetNoi, layChotDon: () => chotDon, layHopThu: () => hopThu, phat });
  hopThu.xemLai = xemLai;
  // F-81: thẻ nhắc người dẫn khi khách xin xem.
  const { TheNhac } = require('./the-nhac');
  const theNhac = new TheNhac({ phat, phongAi, layManHinh: () => manHinh });
  phongLive.theNhac = theNhac;
  // F-82: tư vấn size bằng mã, gọi tên người hỏi.
  const { TuVanSize } = require('./tu-van-size');
  phongLive.tuVanSize = new TuVanSize({ phat, phongAi, layManHinh: () => manHinh });
  // F-86: bình chọn bằng bình luận, không quà.
  const { BinhChon } = require('./binh-chon');
  const binhChon = new BinhChon({ phat, phongAi, layManHinh: () => manHinh, layTheNhac: () => theNhac });
  phongLive.binhChon = binhChon;
  // F-109: Mai tự nhận là trợ lý AI bằng lời khi bắt đầu buổi và mỗi 15 phút.
  const { TuNhanAi } = require('./tu-nhan-ai');
  phongLive.tuNhanAi = new TuNhanAi({ phat, phongAi });
  // F-85: một gợi ý nhịp bán cho người dẫn.
  const { NhipBan } = require('./nhip-ban');
  const nhipBan = new NhipBan({ phongAi, phat });
  nhipBan.batDau();
  // F-116: bảng huấn luyện người dẫn — số liệu theo phút + cảnh báo bằng mã.
  const { HuanLuyen } = require('./huan-luyen');
  const huanLuyen = new HuanLuyen({ phat });
  huanLuyen.batDau();
  // Đơn Chờ xác nhận quá giờ giữ → tự hủy, trả hàng (F-52): kiểm mỗi phút và lúc khởi động.
  const huyQuaGio = () => {
    try {
      const ds = require('./nghiep-vu/don').huyQuaGio();
      if (ds.length) { phat('don.cap_nhat', {}); phat('kho.cap_nhat', {}); }
    } catch (e) { console.error('  [đơn] tự hủy quá giờ lỗi: ' + e.message); }
  };
  huyQuaGio();
  // F-72: "Dừng AI" tự tắt khi hết lý do và không có buổi live đang chạy (kiểm mỗi phút cùng nhịp tự hủy).
  const tuTat = () => {
    try { if (require('./nghiep-vu/chi-phi').tuTatDungAi()) phat('dung_ai', { bat: false, tu_tat: true }); } catch { /* chưa mở cơ sở dữ liệu */ }
  };
  const henHuy = setInterval(() => { huyQuaGio(); tuTat(); }, 60 * 1000);
  // F-73: hỏi Meta Page có bị hạn chế nhắn tin không — lúc mở phiên live và mỗi giờ.
  const { kiemPages, dsPage } = require('./kiem-page');
  const kiemPage = () => kiemPages(dsPage({ ketNoiFb, fbGia }), phat).catch(() => {});
  phongLive.khiGan = (p) => { kiemPage(); hopThu.nhacLive(p).catch((e) => console.error('  [báo live] ' + e.message)); }; // F-73, F-97
  const henKiemPage = setInterval(kiemPage, 3600 * 1000);
  henKiemPage.unref?.();
  // F-80: nhật ký buổi live giữ 90 ngày — dọn lúc khởi động và mỗi ngày.
  const donNhatKy = () => { try { require('./nghiep-vu/nhat-ky-song').don(); } catch (e) { console.error('  [nhật ký] dọn lỗi: ' + e.message); } };
  donNhatKy();
  const henDonNhatKy = setInterval(donNhatKy, 86400 * 1000);
  henDonNhatKy.unref?.();
  // Page giả của Phòng diễn tập có tên trong bảng Page để Hộp thư hiện đúng tên (#37).
  for (const p of fbGia.pages) require('./nghiep-vu/fb-page').luu(p.id, p.ten);
  phongLive.batDau();
  mieng.batDau();
  doiAi.batDau();
  hopThu.batDau();
  chotDon.batDau();
  xemLai.batDau();
  ketNoiFb.batDau().catch((e) => console.error('  [facebook] ' + e.message));
  dv = { fbGia, ketNoiFb, phongLive, phongAi, chepLoi, mieng, doiAi, dienTap, nguoiDongVai, khachGia, tiengGia, layKetNoi, hopThu, chotDon, xemLai, theNhac, nhipBan, huanLuyen, binhChon, henHuy, henKiemPage, henDonNhatKy, manHinh, nhinMon };
  return dv;
}

function dichVu() {
  if (!dv) throw new Error('Dịch vụ chưa mở');
  return dv;
}

function dongDichVu() {
  if (!dv) return;
  dv.dienTap.dung();
  dv.manHinh.dong();
  dv.nguoiDongVai.tat();
  dv.khachGia.tat();
  dv.mieng.dung();
  dv.doiAi.dung();
  dv.chepLoi.tat();
  datXuLy(null);
  dv.phongAi.datLai(null);
  dv.phongLive.dung();
  dv.hopThu.dung();
  dv.chotDon.dung();
  dv.xemLai?.dung();
  dv.nhinMon?.dung();
  clearInterval(dv.henHuy);
  clearInterval(dv.henKiemPage);
  dv.nhipBan?.dung();
  dv.huanLuyen?.dung();
  dv.binhChon?.dung();
  clearInterval(dv.henDonNhatKy);
  dv.ketNoiFb.dung().catch(() => {});
  dv = null;
}

module.exports = { moDichVu, dichVu, dongDichVu };
