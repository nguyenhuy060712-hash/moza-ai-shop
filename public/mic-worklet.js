// Bộ xử lý tiếng micro chạy trong luồng âm thanh của trình duyệt (AudioWorklet).
// Đổi tiếng về PCM 16-bit, 16 kHz, một kênh (định dạng dịch vụ chép lời cần — SPEC.md F-21),
// gom thành từng mẩu 100 ms và gửi về trang kèm mức âm lượng (RMS) để biết người dẫn đang nói hay im.
// Bản 2.5 (F-38): ghi âm để nhân bản giọng cần 24 kHz — truyền processorOptions { tanSoRa: 24000 }.

class MicWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const tanSoRa = options?.processorOptions?.tanSoRa || 16000;
    const mauMoiMau = Math.round(tanSoRa / 10); // 100 ms
    this.buoc = sampleRate / tanSoRa; // sampleRate: tần số của AudioContext (thường 48000)
    this.viTri = 0; // vị trí đọc (theo mẫu đầu vào) của mẫu ra kế tiếp
    this.truoc = 0; // mẫu cuối của khối trước, để nội suy qua ranh giới khối
    this.dem = new Int16Array(mauMoiMau);
    this.soMau = 0;
    this.tongBinhPhuong = 0;
  }

  process(inputs) {
    const kenh = inputs[0]?.[0];
    if (!kenh) return true;
    // Nội suy tuyến tính từ tần số gốc xuống 16 kHz.
    while (this.viTri < kenh.length) {
      const i = Math.floor(this.viTri);
      const t = this.viTri - i;
      const a = i === 0 ? this.truoc : kenh[i - 1];
      const b = kenh[i];
      const x = Math.max(-1, Math.min(1, a + (b - a) * t));
      this.dem[this.soMau++] = x < 0 ? x * 0x8000 : x * 0x7fff;
      this.tongBinhPhuong += x * x;
      if (this.soMau === this.dem.length) {
        const rms = Math.sqrt(this.tongBinhPhuong / this.dem.length);
        const ban = this.dem.slice().buffer;
        this.port.postMessage({ pcm: ban, rms }, [ban]);
        this.soMau = 0;
        this.tongBinhPhuong = 0;
      }
      this.viTri += this.buoc;
    }
    this.viTri -= kenh.length;
    this.truoc = kenh[kenh.length - 1];
    return true;
  }
}

registerProcessor('mic-worklet', MicWorklet);
