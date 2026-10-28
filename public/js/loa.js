// Loa của Màn hình người dẫn (SPEC.md F-22): phát tiếng Mai máy chủ gửi qua /ws ra loa mặc định của Windows.
// Trình duyệt chỉ cho phát tiếng sau khi người dùng đã bấm vào trang; chưa được thì màn hình hiện nút "Bật loa".

export class Loa {
  /** @param {{ khiDoiPhat?: (dangPhat: boolean) => void }} o */
  constructor({ khiDoiPhat = () => {} } = {}) {
    this.khiDoiPhat = khiDoiPhat;
    this.ac = null;
    this.nut = null;
    this.chanDen = 0;
  }

  async bat() {
    if (!this.ac) {
      this.ac = new AudioContext({ sampleRate: 24000 });
      await this.ac.audioWorklet.addModule('/player-worklet.js');
      this.nut = new AudioWorkletNode(this.ac, 'player-worklet', { outputChannelCount: [1] });
      this.nut.port.onmessage = (e) => this.khiDoiPhat(!!e.data.phat);
      this.nut.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') await this.ac.resume().catch(() => {});
    return this.duocPhat();
  }

  /** Trình duyệt đã cho phát tiếng chưa. */
  duocPhat() {
    return this.ac?.state === 'running';
  }

  phat(pcm) {
    if (!this.nut || Date.now() < this.chanDen) return;
    this.nut.port.postMessage({ pcm }, [pcm]);
  }

  /** Bỏ sạch tiếng đang chờ. `chanMs`: bỏ luôn các gói tiếng đang trên đường tới (DỪNG AI). */
  xoa(chanMs = 0) {
    this.chanDen = Date.now() + chanMs;
    this.nut?.port.postMessage({ xoa: true });
  }

  tat() {
    this.nut?.disconnect();
    this.ac?.close().catch(() => {});
    this.ac = null;
    this.nut = null;
  }
}
