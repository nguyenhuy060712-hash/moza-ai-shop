// Ghi âm trên trình duyệt để nhân bản giọng (SPEC.md bản 2.5, F-38): tiếng 24 kHz, một kênh, 16-bit → tệp WAV
// (Google khuyên dạng này cho đoạn mẫu và câu đồng ý). Dùng lại bộ xử lý mic-worklet, đổi tần số ngay trong luồng âm thanh.
// Tắt khử tiếng vọng để giữ giọng tự nhiên; vẫn để trình duyệt lọc ồn nhẹ và tự cân âm lượng.

const TAN_SO = 24000;

export class GhiAm {
  /**
   * @param {object} [o]
   * @param {(rms:number) => void} [o.khiMuc]    mức âm lượng mỗi 100 ms, để vẽ vạch
   * @param {(giay:number) => void} [o.khiGiay]  số giây đã ghi
   */
  constructor({ khiMuc = () => {}, khiGiay = () => {} } = {}) {
    Object.assign(this, { khiMuc, khiGiay });
    this.manh = [];
    this.soMau = 0;
  }

  async bat() {
    this.manh = [];
    this.soMau = 0;
    this.luong = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.ac = new AudioContext();
    await this.ac.audioWorklet.addModule('/mic-worklet.js');
    this.nguon = this.ac.createMediaStreamSource(this.luong);
    this.xuLy = new AudioWorkletNode(this.ac, 'mic-worklet', { processorOptions: { tanSoRa: TAN_SO } });
    this.xuLy.port.onmessage = (e) => {
      const p = new Int16Array(e.data.pcm);
      this.manh.push(p);
      this.soMau += p.length;
      this.khiMuc(e.data.rms);
      this.khiGiay(this.soMau / TAN_SO);
    };
    this.nguon.connect(this.xuLy);
  }

  /** Dừng ghi; trả tệp WAV (ArrayBuffer) và số giây. */
  async dung() {
    try { this.nguon?.disconnect(); this.xuLy?.disconnect(); } catch { /* đã ngắt */ }
    this.luong?.getTracks().forEach((t) => t.stop());
    await this.ac?.close().catch(() => {});
    const pcm = new Int16Array(this.soMau);
    let i = 0;
    for (const m of this.manh) {
      pcm.set(m, i);
      i += m.length;
    }
    this.manh = [];
    return { wav: taoWav(pcm, TAN_SO), giay: pcm.length / TAN_SO };
  }
}

/** PCM 16-bit một kênh → tệp WAV (ArrayBuffer). */
export function taoWav(pcm, tanSo) {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const chu = (o, s) => { for (let k = 0; k < s.length; k += 1) v.setUint8(o + k, s.charCodeAt(k)); };
  chu(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  chu(8, 'WAVE');
  chu(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // 1 kênh
  v.setUint32(24, tanSo, true);
  v.setUint32(28, tanSo * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  chu(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return buf;
}

/** ArrayBuffer → base64 (chia khúc cho khỏi tràn ngăn xếp với tệp vài MB). */
export function sangBase64(ab) {
  const b = new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
