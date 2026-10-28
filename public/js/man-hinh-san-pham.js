'use strict';

/* Màn hình sản phẩm (SPEC.md #90) — trang riêng cho OBS, không dùng khung giao diện của MOZA. */

(() => {
  const khung = document.getElementById('khung');
  let henAnh = null;

  const el = (the, lop, con = []) => {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    for (const c of [].concat(con)) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  };
  const anh = (url, lop = '') => { const i = el('img', lop); if (url) i.src = url; i.alt = ''; return i; };

  /** Ảnh lướt, phóng chậm (trình chiếu). */
  function chayAnh(hop, ds, moiMs = 6000) {
    clearInterval(henAnh);
    const imgs = ds.map((a) => { const i = anh(a.url); hop.append(i); return i; });
    if (!imgs.length) return;
    let k = 0;
    imgs[0].classList.add('hien');
    if (imgs.length > 1) {
      henAnh = setInterval(() => {
        imgs[k].classList.remove('hien');
        k = (k + 1) % imgs.length;
        // Chạy lại hiệu ứng phóng
        void imgs[k].offsetWidth;
        imgs[k].classList.add('hien');
      }, moiMs);
    }
  }

  // Gom theo màu: "Trắng  S M L XL" — mỗi màu một dòng, cỡ hết hàng gạch đi.
  const chips = (s) => {
    const nhom = new Map();
    for (const p of s.con_hang) {
      const [mau, co] = p.nhan.includes('/') ? p.nhan.split('/') : [p.nhan, null];
      if (!nhom.has(mau)) nhom.set(mau, []);
      nhom.get(mau).push({ co, con: p.con, sapHet: p.sap_het });
    }
    return el('div', 'mau-ds', [...nhom].map(([mau, ds]) => el('div', 'mau-dong', [
      el('b', '', mau),
      ...ds.map((x) => el('span', `chip${x.con <= 0 ? ' het' : ''}`, [x.co || (x.con > 0 ? 'còn hàng' : 'hết'), x.sapHet ? el('i', '', `còn ${x.con}`) : null])),
    ])));
  };
  const gia = (s) => el('div', 'gia', [s.nhan_gia ? el('span', 'nhan-gia', s.nhan_gia) : null, el('b', '', s.gia), s.gia_goc ? el('s', '', s.gia_goc) : null]);
  const chot = (s) => el('div', 'chot', ['Chốt: ', el('span', '', s.cu_phap)]);
  const thanhDuoi = (s) => el('div', 'thanh-duoi', [el('span', 'so', `Số ${s.so}`), s.ten, el('b', '', s.gia)]);

  function veGioiThieu(h) {
    const s = h.san_pham;
    const trai = el('div', 'anh-lon');
    const phai = el('div', 'phai', [
      el('span', 'so', `SỐ ${s.so}`), el('div', 'ten', s.ten), gia(s),
      s.diem_noi_bat.length ? el('ul', 'diem', s.diem_noi_bat.slice(0, 3).map((d) => el('li', '', d))) : null,
      chips(s), chot(s),
    ]);
    chayAnh(trai, s.anh);
    return el('div', 'hop', [trai, phai]);
  }

  function veAnh(h) {
    const s = h.san_pham;
    const luoi = el('div', 'luoi-anh', h.anh_chon.slice(0, 3).map((a) => el('div', '', anh(a.url))));
    const phai = el('div', 'phai', [el('span', 'so', `SỐ ${s.so}`), el('div', 'tieu-de', h.mau_sac ? `Màu ${h.mau_sac}` : s.ten),
      el('div', 'phu', s.ten), gia(s), chot(s)]);
    phai.style.flex = '0 0 620px';
    return el('div', 'hop', [luoi, phai]);
  }

  function veBangSize(h) {
    const s = h.san_pham;
    const b = h.bang_size;
    const bang = el('table', '', [
      el('tr', '', [el('th', '', 'Cỡ'), ...b.ten_cot.map((c) => el('th', '', c))]),
      ...b.hang.map((r) => el('tr', (h.dong_hop || []).includes(r.co) ? 'hop-ban' : '', [el('td', '', r.co), ...b.cot.map((c) => el('td', '', r[c] || '—'))])),
    ]);
    const trai = el('div', 'anh-lon');
    trai.style.flex = '0 0 620px';
    chayAnh(trai, s.anh);
    return el('div', 'hop', [trai, el('div', 'phai', [
      el('div', 'tieu-de', `Bảng size · Số ${s.so}`),
      // F-82: không in số đo của khách lên sóng — chỉ size gợi ý.
      el('div', 'phu', h.dong_hop?.length ? `Size gợi ý: ${h.dong_hop.join(' hoặc ')}` : b.ten),
      bang, chot(s),
    ])]);
  }

  function veChiTiet(h) {
    const s = h.san_pham;
    const trai = el('div', 'anh-lon');
    trai.style.flex = '0 0 700px';
    chayAnh(trai, s.anh);
    return el('div', 'hop', [trai, el('div', 'phai', [
      el('span', 'so', `SỐ ${s.so}`), el('div', 'tieu-de', s.ten),
      el('ul', 'diem', [...h.thong_so.map((t) => el('li', '', `${t.ten}: ${t.gia_tri}`)), ...h.mo_ta.slice(0, 3).map((m) => el('li', '', m.length > 110 ? `${m.slice(0, 108)}…` : m))]),
    ])]);
  }

  function vePhoi(h) {
    const mon = (s) => el('div', 'mon', [el('div', '', anh(s.anh[0]?.url)), el('p', '', [`Số ${s.so} · ${s.ten} `, el('span', '', s.gia)])]);
    return el('div', 'phoi', [mon(h.san_pham), el('div', 'cong', '+'), mon(h.san_pham_2)]);
  }

  function veDanhSach(h) {
    return el('div', '', [
      el('div', 'dau-ds tieu-de', `${h.shop} · hôm nay có`),
      el('div', 'ds', h.san_pham_ds.map((s) => el('div', `o${s.het ? ' het' : ''}`, [anh(s.anh), el('span', 'nhan-so', s.so), el('p', '', s.ten), el('b', 'gia-o', s.het ? 'hết hàng' : s.gia)]))),
    ]);
  }

  function veTrinhChieu(h) {
    const t = el('div', 'toan');
    chayAnh(t, h.san_pham.anh, 5000);
    t.append(thanhDuoi(h.san_pham));
    return t;
  }

  function veVideo(h) {
    const v = el('video');
    // Tiếng video tắt: người dẫn / Mai đang nói trên sóng.
    Object.assign(v, { src: h.video.url, muted: true, autoplay: true, loop: true, playsInline: true });
    // F-81: video AI dựng từ ảnh — chỉ chiếu ở buổi tập, có nhãn.
    return el('div', 'toan', [v, h.video.dung_thu ? el('span', 'nhan-dung-thu', 'Video dựng thử') : null, thanhDuoi(h.san_pham)].filter(Boolean));
  }

  // F-104: "Khách mặc thật" — tối đa 4 ảnh đã duyệt (đã che mặt), mỗi ảnh ghi "Khách thật · mặc size M". Không tên, không số đo.
  function veKhachMac(h) {
    const s = h.san_pham;
    const luoi = el('div', 'luoi-anh khach-mac', h.anh_khach.slice(0, 4).map((a) => el('div', '', [anh(a.url), el('span', 'nhan-khach', a.chu)])));
    const phai = el('div', 'phai', [el('span', 'so', `SỐ ${s.so}`), el('div', 'tieu-de', 'Khách mặc thật'), el('div', 'phu', s.ten), gia(s), chot(s)]);
    phai.style.flex = '0 0 560px';
    return el('div', 'hop', [luoi, phai]);
  }

  const veCho = (h) => el('div', 'cho', [el('h1', '', h.shop || 'Moza'), el('p', '', 'Đang live — bình luận "chốt" + số sản phẩm để đặt hàng')]);

  const VE = { gioi_thieu: veGioiThieu, anh: veAnh, bang_size: veBangSize, chi_tiet: veChiTiet, phoi_do: vePhoi, danh_sach: veDanhSach,
    trinh_chieu: veTrinhChieu, video: veVideo, khach_mac: veKhachMac, cho: veCho };

  let khoaCu = '';
  function hien(h) {
    // Cùng nội dung (chỉ đổi còn hàng) thì vẽ lại không hiệu ứng mờ dần.
    const khoa = JSON.stringify([h.mau, h.san_pham?.so, h.mau_sac, h.dong_hop, h.video?.url, h.san_pham_2?.so, h.anh_khach?.map((a) => a.url)]);
    let noi;
    try { noi = (VE[h.mau] || veCho)(h); } catch (e) { console.error(e); noi = veCho(h); }
    const moi = el('div', 'canh', noi);
    const cu = [...khung.children];
    khung.append(moi);
    if (khoa === khoaCu) { moi.classList.add('hien'); cu.forEach((c) => c.remove()); return; }
    khoaCu = khoa;
    // setTimeout thay cho requestAnimationFrame: nguồn trình duyệt OBS / tab ẩn có thể ngừng vẽ khung, nội dung sẽ mờ mãi.
    setTimeout(() => moi.classList.add('hien'), 30);
    setTimeout(() => cu.forEach((c) => c.remove()), 500);
  }

  // Nhãn "Trợ lý AI · Phụ trách" (F-75): hiện suốt khi có phiên mà AI không tắt.
  function hienNhanAi(n) {
    const e = document.getElementById('nhan-ai');
    if (!e || !n) return;
    e.textContent = n.chu || '';
    e.classList.toggle('hien', !!n.hien);
  }

  // Khung dọc 9:16 (mặc định, 1080×1920) hoặc ngang 16:9 — theo Cài đặt → OBS; đổi là trang đổi bố cục ngay.
  const datKhung = (k) => document.documentElement.classList.toggle('doc', k !== 'ngang');
  datKhung(new URLSearchParams(location.search).get('khung') || 'doc');
  async function taiLai() {
    try { const r = await fetch('/api/man-hinh'); if (r.ok) { const j = await r.json(); datKhung(j.obs_cai_dat?.khung); hien(j.hien); hienNhanAi(j.nhan_ai); } } catch { /* máy chủ chưa chạy */ }
  }

  let lanThu = 0;
  function noi() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => { lanThu = 0; taiLai(); };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'mhsp.hien') hien(m);
      else if (m.type === 'mhsp.nhan_ai') hienNhanAi(m);
      else if (m.type === 'mhsp.khung') datKhung(m.khung);
    };
    ws.onclose = () => setTimeout(noi, Math.min(10000, 1000 * 2 ** lanThu++));
  }
  hien({ mau: 'cho', shop: '' });
  noi();
})();
