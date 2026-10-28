// Bộ phát tiếng Mai chạy trong luồng âm thanh của trình duyệt (AudioWorklet), SPEC.md F-22.
// Tiếng miệng là PCM 16-bit 24 kHz, một kênh; trang tạo AudioContext 24 kHz nên phát thẳng, trình duyệt tự đổi
// sang tần số của loa. Đệm vòng 30 giây: Gemini gửi tiếng nhanh hơn thời gian thực.
//  - { pcm: ArrayBuffer }: thêm tiếng vào đệm.
//  - { xoa: true }: bỏ sạch tiếng đang chờ ngay (DỪNG AI, người dẫn nói chen).
// Chỉ báo về trang khi đổi trạng thái (bắt đầu / hết tiếng nói), không báo mỗi khối 128 mẫu. "Tiếng nói" tính theo
// độ to: GPT Live gửi cả khoảng lặng theo thời gian thực.
//
// Đệm chống vấp (24/9/2026, chủ dự án nghe Mai "nói vấp, lộp bộp"): GPT Live 1 gửi gói 100 ms theo nhịp nói nhưng
// không đều — đo thẳng từ OpenAI trên máy chủ dự án: cả dòng chậm hơn nhịp nói khoảng 5%, gói trễ thường tới
// 0,3–0,6 giây, có lần khựng 2 giây. Phát ngay khi nhận thì tiếng hụt giữa câu hàng chục lần mỗi phút. Nên:
//  - đủ đệm (0,4 giây lúc đầu) mới phát;
//  - tới mỗi chỗ ngắt giữa hai ý (dấu phẩy, hết câu) mà đệm vơi thì chờ ở đó cho đầy lại — khoảng nghỉ dài thêm vài
//    chục phần nghìn giây, không cắt giữa từ;
//  - vẫn cạn giữa câu (mạng khựng) thì chờ 0,2 giây rồi phát tiếp, và tăng mức đệm thêm 0,1 giây (tối đa 0,8);
//    phát êm 30 giây liền thì hạ dần về 0,4 — mạng tốt thì Mai đáp nhanh, mạng kém thì Mai nói liền mạch;
//  - vào tiếng tăng dần, cạn tiếng tắt dần — không kêu "bụp".

const TAN_SO = 24000;
const DO_DAI = TAN_SO * 30;
const KHOI_IM_LA_HET = 60; // 60 khối (~320 ms) không có tiếng nói thì coi là hết, để chỗ ngắt giữa hai từ không làm nhấp nháy
const DO_TO_TOI_THIEU = 0.01;
const DEM_DAU = TAN_SO * 0.4; // mức đệm lúc đầu: đủ chừng này mới phát (đầu câu, và bù lại ở mỗi chỗ ngắt giữa hai ý)
const DEM_TOI_DA = TAN_SO * 0.8;
const DEM_TANG = TAN_SO * 0.1; // mỗi lần vẫn hụt giữa câu thì tăng mức đệm chừng này
const DEM_LAI = TAN_SO * 0.2; // cạn hẳn giữa câu thì chờ chừng này rồi phát tiếp
const EM_DE_HA = 30; // giây phát êm liền thì hạ mức đệm một nấc
const LANG_TOI_THIEU = TAN_SO * 0.05; // chỗ ngắt giữa hai ý: lặng ít nhất 50 ms cả trước và sau
const CHO_TOI_DA = 0.2; // giây không có gói nào tới: coi như hết câu, phát nốt phần đang có
const LAN_VAO = 96; // số mẫu (~4 ms) tăng dần âm lượng khi bắt đầu phát lại
const TAT_DAN = 0.85; // cạn giữa khối: tiếng tắt dần theo hệ số này mỗi mẫu thay vì rơi thẳng về 0

class PlayerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.dem = new Float32Array(DO_DAI);
    this.doc = 0;
    this.ghi = 0;
    this.dangPhat = false;
    this.khoiIm = 0;
    this.mucDem = DEM_DAU; // mức đệm hiện tại, tự tăng khi mạng khựng
    this.cho = true; // đang chờ đệm đầy
    this.canDu = this.mucDem;
    this.lanNhan = 0;
    this.emTu = 0; // lúc bắt đầu chuỗi phát êm (không hụt giữa câu)
    this.am = 0; // âm lượng 0 → 1 khi vừa phát lại
    this.mauCuoi = 0;
    this.langDaPhat = 0; // số mẫu lặng liền nhau vừa phát ra
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.xoa) {
        this.doc = this.ghi = 0;
        this.cho = true;
        this.canDu = this.mucDem;
        if (this.dangPhat) this.doi(false);
        return;
      }
      if (!d.pcm) return;
      const mau = new Int16Array(d.pcm);
      for (let i = 0; i < mau.length; i++) {
        this.dem[this.ghi] = mau[i] / 32768;
        this.ghi = (this.ghi + 1) % DO_DAI;
        if (this.ghi === this.doc) this.doc = (this.doc + 1) % DO_DAI; // đầy thì bỏ tiếng cũ nhất
      }
      this.lanNhan = currentTime;
    };
  }

  doi(dangPhat) {
    this.dangPhat = dangPhat;
    this.khoiIm = 0;
    this.port.postMessage({ phat: dangPhat });
  }

  conLai() {
    return (this.ghi - this.doc + DO_DAI) % DO_DAI;
  }

  /** n mẫu sắp phát đều gần như im lặng. */
  sapLang(n) {
    if (this.conLai() < n) return false;
    for (let i = 0, j = this.doc; i < n; i++, j = (j + 1) % DO_DAI) if (Math.abs(this.dem[j]) > DO_TO_TOI_THIEU) return false;
    return true;
  }

  process(_vao, ra) {
    const kenh = ra[0][0];
    if (!kenh) return true;
    const con = this.conLai();
    const conToi = currentTime - this.lanNhan <= CHO_TOI_DA; // gói còn đang tới
    if (currentTime - this.emTu > EM_DE_HA && this.mucDem > DEM_DAU) {
      this.mucDem = Math.max(DEM_DAU, this.mucDem - DEM_TANG);
      this.emTu = currentTime;
    }
    if (this.cho) {
      if (con >= this.canDu || (con > 0 && !conToi)) {
        this.cho = false;
        this.am = 0;
      }
    } else if (con < this.mucDem && conToi && this.langDaPhat >= LANG_TOI_THIEU && this.sapLang(Math.min(LANG_TOI_THIEU, con))) {
      // Đang ở chỗ ngắt giữa hai ý mà đệm vơi: chờ ở đây cho đầy lại, người nghe chỉ thấy khoảng nghỉ dài hơn chút.
      this.cho = true;
      this.canDu = this.mucDem;
    }
    let to = 0;
    for (let i = 0; i < kenh.length; i++) {
      if (!this.cho && this.doc === this.ghi) {
        // Cạn: chờ đệm lại thay vì phát vụn từng mẩu.
        this.cho = true;
        if (this.langDaPhat < LANG_TOI_THIEU) {
          // Cạn ngay giữa tiếng nói (không phải chỗ lặng cuối câu) là mạng khựng — GPT Live gửi cả khoảng lặng nên
          // hết câu thì trước đó đã có lặng: phát tiếp sau 0,2 giây, và từ giờ giữ đệm nhiều hơn.
          this.canDu = DEM_LAI;
          this.mucDem = Math.min(DEM_TOI_DA, this.mucDem + DEM_TANG);
          this.emTu = currentTime;
        } else {
          this.canDu = this.mucDem;
        }
      }
      if (this.cho) {
        this.mauCuoi *= TAT_DAN;
        kenh[i] = this.mauCuoi;
        continue;
      }
      if (this.am < 1) this.am = Math.min(1, this.am + 1 / LAN_VAO);
      const m = this.dem[this.doc] * this.am;
      this.doc = (this.doc + 1) % DO_DAI;
      this.mauCuoi = m;
      kenh[i] = m;
      const tuyetDoi = Math.abs(m);
      this.langDaPhat = tuyetDoi > DO_TO_TOI_THIEU ? 0 : this.langDaPhat + 1;
      to = Math.max(to, tuyetDoi);
    }
    if (to > DO_TO_TOI_THIEU) {
      this.khoiIm = 0;
      if (!this.dangPhat) this.doi(true);
    } else if (this.dangPhat && ++this.khoiIm >= KHOI_IM_LA_HET) {
      this.doi(false);
    }
    return true;
  }
}

registerProcessor('player-worklet', PlayerWorklet);
