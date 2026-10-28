'use strict';

/**
 * Nối OBS Studio (SPEC.md #90) qua obs-websocket v5 — có sẵn trong OBS từ bản 28, cổng mặc định 4455, có mật khẩu.
 * MOZA chỉ nói chuyện với OBS trên CHÍNH máy này (127.0.0.1). Việc làm được:
 *  - chuyển cảnh lên sóng (SetCurrentProgramScene), nghe khi người dùng tự đổi cảnh trong OBS (CurrentProgramSceneChanged);
 *  - "Tạo cảnh Moza": 3 cảnh Phòng live / Sản phẩm / Cả hai, nguồn trình duyệt là Màn hình sản phẩm và Thanh chữ của MOZA.
 * Camera phòng live người dùng tự thêm vào cảnh "Moza · Phòng live" (chọn đúng thiết bị) — cảnh "Cả hai" dùng lại cảnh đó.
 * Giao thức: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md (tra 26/9/2026).
 */

const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const WebSocket = require('ws');

const CANH = { phong: 'Moza · Phòng live', san_pham: 'Moza · Sản phẩm', ca_hai: 'Moza · Cả hai' };
const NGUON = { man_hinh: 'Moza · Màn hình sản phẩm', thanh_chu: 'Moza · Thanh chữ' };
const DA_CO = 601; // ResourceAlreadyExists
// Khung hình buổi live (8/10/2026): live bán hàng trên Facebook phần lớn xem bằng điện thoại → mặc định dọc 9:16.
const KHUNG = { doc: { rong: 1080, cao: 1920 }, ngang: { rong: 1920, cao: 1080 } };
const SU_KIEN_CANH = 1 << 2; // eventSubscriptions: Scenes

const bam = (s) => crypto.createHash('sha256').update(s).digest('base64');

/** Chuỗi xác thực obs-websocket v5: base64(sha256(base64(sha256(mật khẩu + salt)) + challenge)). */
function chuoiXacThuc(matKhau, salt, challenge) {
  return bam(bam(matKhau + salt) + challenge);
}

class KetNoiObs extends EventEmitter {
  /**
   * @param {object} o
   * @param {() => {cong:number, mat_khau:string}} o.layCauHinh
   * @param {typeof WebSocket} [o.WS]  (test)
   */
  constructor({ layCauHinh, WS = WebSocket }) {
    super();
    Object.assign(this, { layCauHinh, WS });
    this.ws = null;
    this.st = { ket_noi: false, dang_noi: false, loi: null, canh: null, phien_ban: null };
    this.cho = new Map();
    this.dem = 0;
  }

  trangThai() { return { ...this.st }; }

  /** Nối (nếu chưa). Trả khi đã xác thực xong; lỗi thì ném LoiNghiepVu-dạng { ma, message }. */
  noi({ toiDaMs = 5000 } = {}) {
    if (this.st.ket_noi) return Promise.resolve(this.trangThai());
    if (this.dangNoi) return this.dangNoi;
    const { cong = 4455, mat_khau: matKhau = '' } = this.layCauHinh() || {};
    this.st.dang_noi = true;
    this.dangNoi = new Promise((ok, loi) => {
      const xong = (e) => {
        clearTimeout(hen);
        this.st.dang_noi = false;
        this.dangNoi = null;
        if (e) { this.st.loi = e.message; this.emit('thay_doi', this.trangThai()); loi(e); } else ok(this.trangThai());
      };
      const hen = setTimeout(() => { try { ws.terminate(); } catch { /* bỏ */ } xong(Object.assign(new Error('OBS không trả lời. Mở OBS, bật Công cụ → Cài đặt WebSocket Server.'), { ma: 'OBS_KHONG_TRA_LOI' })); }, toiDaMs);
      let ws;
      try { ws = new this.WS(`ws://127.0.0.1:${Number(cong) || 4455}`); } catch (e) { xong(Object.assign(new Error(e.message), { ma: 'OBS_LOI' })); return; }
      this.ws = ws;
      ws.on('error', (e) => { if (this.st.dang_noi) xong(Object.assign(new Error(`Không nối được OBS (${e.code || e.message}). OBS đã mở và bật WebSocket Server chưa?`), { ma: 'OBS_KHONG_NOI_DUOC' })); });
      ws.on('close', (ma) => {
        const dangNoi = this.st.dang_noi;
        this.st.ket_noi = false;
        for (const c of this.cho.values()) c.loi(Object.assign(new Error('OBS đã ngắt kết nối.'), { ma: 'OBS_NGAT' }));
        this.cho.clear();
        if (dangNoi) xong(Object.assign(new Error(ma === 4009 ? 'Sai mật khẩu WebSocket của OBS.' : 'OBS từ chối kết nối.'), { ma: ma === 4009 ? 'OBS_SAI_MAT_KHAU' : 'OBS_TU_CHOI' }));
        else this.emit('thay_doi', this.trangThai());
      });
      ws.on('message', (du) => {
        let m;
        try { m = JSON.parse(String(du)); } catch { return; }
        if (m.op === 0) {
          const d = { rpcVersion: 1, eventSubscriptions: SU_KIEN_CANH };
          if (m.d.authentication) d.authentication = chuoiXacThuc(matKhau, m.d.authentication.salt, m.d.authentication.challenge);
          this.st.phien_ban = m.d.obsStudioVersion || null;
          ws.send(JSON.stringify({ op: 1, d }));
        } else if (m.op === 2) {
          this.st.ket_noi = true;
          this.st.loi = null;
          this.yeuCau('GetCurrentProgramScene').then((r) => { this.st.canh = r.sceneName || r.currentProgramSceneName || null; this.emit('thay_doi', this.trangThai()); }).catch(() => {});
          xong();
        } else if (m.op === 7) {
          const c = this.cho.get(m.d.requestId);
          if (!c) return;
          this.cho.delete(m.d.requestId);
          if (m.d.requestStatus?.result) c.ok(m.d.responseData || {});
          else c.loi(Object.assign(new Error(m.d.requestStatus?.comment || `OBS lỗi ${m.d.requestStatus?.code}`), { ma: 'OBS_LOI', code: m.d.requestStatus?.code }));
        } else if (m.op === 5 && m.d.eventType === 'CurrentProgramSceneChanged') {
          this.st.canh = m.d.eventData?.sceneName || null;
          this.emit('doi_canh', this.st.canh);
          this.emit('thay_doi', this.trangThai());
        }
      });
    });
    return this.dangNoi;
  }

  yeuCau(requestType, requestData = {}, { toiDaMs = 5000 } = {}) {
    if (!this.ws || this.ws.readyState !== 1) return Promise.reject(Object.assign(new Error('Chưa nối OBS.'), { ma: 'OBS_CHUA_NOI' }));
    const requestId = `moza${++this.dem}`;
    return new Promise((ok, loi) => {
      const hen = setTimeout(() => { this.cho.delete(requestId); loi(Object.assign(new Error('OBS không trả lời lệnh.'), { ma: 'OBS_KHONG_TRA_LOI' })); }, toiDaMs);
      this.cho.set(requestId, { ok: (v) => { clearTimeout(hen); ok(v); }, loi: (e) => { clearTimeout(hen); loi(e); } });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }

  async chuyenCanh(khoa) {
    const ten = CANH[khoa];
    if (!ten) throw Object.assign(new Error(`Cảnh lạ: ${khoa}`), { ma: 'OBS_LOI' });
    await this.noi();
    await this.yeuCau('SetCurrentProgramScene', { sceneName: ten });
    this.st.canh = ten;
    return ten;
  }

  /** Bỏ qua lỗi "đã có" (601) — tạo cảnh lần hai không hỏng gì. */
  async taoNeuChua(requestType, requestData) {
    try { return await this.yeuCau(requestType, requestData); } catch (e) { if (e.code === DA_CO) return null; throw e; }
  }

  /**
   * Tạo 3 cảnh Moza và 2 nguồn trình duyệt của MOZA. Chạy lại được (thứ đã có thì giữ).
   * @param {number} congMoza  cổng giao diện MOZA (5173)
   */
  async taoCanhMoza(congMoza, khung = 'doc') {
    await this.noi();
    const k = KHUNG[khung] || KHUNG.doc;
    // Khung OBS theo khung đã chọn. OBS đang phát / ghi hình thì không cho đổi → báo rõ, không làm hỏng cảnh.
    try {
      await this.yeuCau('SetVideoSettings', { baseWidth: k.rong, baseHeight: k.cao, outputWidth: k.rong, outputHeight: k.cao });
    } catch (e) {
      const loi = new Error(`OBS chưa đổi được khung ${k.rong}×${k.cao} (${e.message}). Dừng phát / ghi hình trong OBS rồi bấm lại "Tạo cảnh Moza".`);
      loi.ma = 'OBS_KHONG_DOI_KHUNG';
      throw loi;
    }
    const goc = `http://127.0.0.1:${congMoza}`;
    for (const ten of Object.values(CANH)) await this.taoNeuChua('CreateScene', { sceneName: ten });
    const trinhDuyet = (url) => ({ url, width: k.rong, height: k.cao, fps: 30, reroute_audio: true, shutdown: false });
    // Màn hình sản phẩm: toàn khung ở cảnh Sản phẩm.
    await this.taoNeuChua('CreateInput', { sceneName: CANH.san_pham, inputName: NGUON.man_hinh, inputKind: 'browser_source', inputSettings: trinhDuyet(`${goc}/man-hinh-san-pham.html`), sceneItemEnabled: true });
    // Cả hai: cảnh Phòng live toàn khung + màn hình sản phẩm thu nhỏ góc phải trên.
    const coItem = async (canh, nguon) => (await this.yeuCau('GetSceneItemList', { sceneName: canh })).sceneItems?.find((x) => x.sourceName === nguon);
    if (!(await coItem(CANH.ca_hai, CANH.phong))) await this.yeuCau('CreateSceneItem', { sceneName: CANH.ca_hai, sourceName: CANH.phong });
    let nho = await coItem(CANH.ca_hai, NGUON.man_hinh);
    if (!nho) nho = { sceneItemId: (await this.yeuCau('CreateSceneItem', { sceneName: CANH.ca_hai, sourceName: NGUON.man_hinh })).sceneItemId };
    // Ngang: màn hình sản phẩm thu nhỏ góc phải trên. Dọc: góc phải giữa khung (phía trên là Thanh chữ, phía dưới là bình luận trên điện thoại).
    const tl = khung === 'ngang' ? 0.36 : 0.3;
    await this.yeuCau('SetSceneItemTransform', { sceneName: CANH.ca_hai, sceneItemId: nho.sceneItemId, sceneItemTransform: khung === 'ngang'
      ? { positionX: 1920 - 690 - 30, positionY: 30, scaleX: tl, scaleY: tl }
      : { positionX: 1080 - Math.round(1080 * tl) - 24, positionY: 700, scaleX: tl, scaleY: tl } });
    // Thanh chữ (nền trong suốt) ở cảnh Phòng live — cảnh Cả hai lồng cảnh Phòng live nên có sẵn — và ở cảnh Sản phẩm.
    await this.taoNeuChua('CreateInput', { sceneName: CANH.phong, inputName: NGUON.thanh_chu, inputKind: 'browser_source', inputSettings: trinhDuyet(`${goc}/thanh-chu.html`), sceneItemEnabled: true });
    if (!(await coItem(CANH.san_pham, NGUON.thanh_chu))) await this.yeuCau('CreateSceneItem', { sceneName: CANH.san_pham, sourceName: NGUON.thanh_chu });
    // Nguồn đã có từ lần trước: đổi cỡ theo khung mới.
    for (const ten of Object.values(NGUON)) await this.yeuCau('SetInputSettings', { inputName: ten, inputSettings: { width: k.rong, height: k.cao } });
    // Thanh chữ luôn trên cùng (camera thêm sau sẽ không che): chạy lại "Tạo cảnh Moza" sau khi thêm camera.
    for (const canh of [CANH.phong, CANH.san_pham]) {
      const ds = (await this.yeuCau('GetSceneItemList', { sceneName: canh })).sceneItems || [];
      const tc = ds.find((x) => x.sourceName === NGUON.thanh_chu);
      if (tc) await this.yeuCau('SetSceneItemIndex', { sceneName: canh, sceneItemId: tc.sceneItemId, sceneItemIndex: ds.length - 1 });
    }
    return { canh: Object.values(CANH), nguon: Object.values(NGUON), khung: { ten: khung === 'ngang' ? 'ngang' : 'doc', ...k } };
  }

  dong() {
    try { this.ws?.close(); } catch { /* bỏ */ }
    this.ws = null;
    this.st.ket_noi = false;
  }
}

module.exports = { KetNoiObs, CANH, NGUON, chuoiXacThuc, KHUNG };
