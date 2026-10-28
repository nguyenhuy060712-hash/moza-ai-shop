// Micro của Màn hình người dẫn (SPEC.md F-21, #33).
//  - Bật micro với khử tiếng vọng, lọc ồn, tự cân âm lượng của trình duyệt.
//  - Mỗi 100 ms: một mẩu PCM 16 kHz (gửi lên máy chủ để chép lời) và mức âm lượng.
//  - "Người dẫn đang nói" tính ngay trên máy từ mức âm lượng: nhanh, không tốn tiền, vẫn chạy khi chép lời hỏng.

// Ngưỡng "đang nói": cao hơn hẳn tiếng ồn nền (tự học trong lúc im), và không thấp hơn một mức tối thiểu.
const NGUONG_TOI_THIEU = 0.012;
const GAP_NEN = 3;
const BAT_SAU = 2; // 2 mẩu (200 ms) to liên tiếp → bắt đầu nói
const TAT_SAU = 8; // 8 mẩu (800 ms) nhỏ liên tiếp → thôi nói

export class Micro {
  /**
   * @param {object} o
   * @param {(pcm: ArrayBuffer) => void} o.khiCoTieng   mỗi mẩu 100 ms
   * @param {(dangNoi: boolean) => void} o.khiDoiNoi   khi người dẫn bắt đầu / thôi nói
   * @param {(rms: number) => void} [o.khiMuc]          mức âm lượng, để vẽ vạch
   */
  constructor({ khiCoTieng, khiDoiNoi, khiMuc = () => {} }) {
    Object.assign(this, { khiCoTieng, khiDoiNoi, khiMuc });
    this.nen = 0.005;
    this.dangNoi = false;
    this.demTo = 0;
    this.demNho = 0;
  }

  async bat() {
    this.luong = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.ac = new AudioContext();
    await this.ac.audioWorklet.addModule('/mic-worklet.js');
    this.nguon = this.ac.createMediaStreamSource(this.luong);
    this.xuLy = new AudioWorkletNode(this.ac, 'mic-worklet');
    this.xuLy.port.onmessage = (e) => this.nhan(e.data);
    this.nguon.connect(this.xuLy);
    return this.luong.getAudioTracks()[0]?.label || 'micro mặc định';
  }

  nhan({ pcm, rms }) {
    this.khiCoTieng(pcm);
    this.khiMuc(rms);
    const nguong = Math.max(NGUONG_TOI_THIEU, this.nen * GAP_NEN);
    if (rms > nguong) {
      this.demTo += 1;
      this.demNho = 0;
      if (!this.dangNoi && this.demTo >= BAT_SAU) this.doi(true);
    } else {
      this.demNho += 1;
      this.demTo = 0;
      // Học tiếng ồn nền chậm rãi trong lúc im.
      this.nen = this.nen * 0.95 + rms * 0.05;
      if (this.dangNoi && this.demNho >= TAT_SAU) this.doi(false);
    }
  }

  doi(dangNoi) {
    this.dangNoi = dangNoi;
    this.khiDoiNoi(dangNoi);
  }

  tat() {
    this.nguon?.disconnect();
    this.xuLy?.disconnect();
    this.luong?.getTracks().forEach((t) => t.stop());
    this.ac?.close().catch(() => {});
    this.luong = null;
    this.ac = null;
    if (this.dangNoi) this.doi(false);
  }
}
