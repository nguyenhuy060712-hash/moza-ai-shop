'use strict';

/**
 * Đọc số đo khách nói trong bình luận / câu người dẫn (SPEC.md F-82, #110) — MỘT hàm dùng chung cho tư vấn size bằng mã, ô số
 * đo của Director và lệnh người mẫu, để hai chỗ không đọc ra hai kết quả. Không gọi AI.
 *  - chiều cao: "1m58", "1m6" (= 160), "1.58m", "1,58 m", "m58", "158cm", "cao 158", "1 mét 58";
 *  - cân nặng: "50kg", "50 ký / kí / ki / ky / kilo / cân", "nặng 50"; "1m58 50" (số ngay sau chiều cao) cũng là cân nặng.
 * Không nhầm "chốt 12 đen M x2", "giá 150k", "áo 12 size M", số điện thoại. Ngoài khoảng hợp lý (cao 100–210 cm, nặng 25–150 kg)
 * thì bỏ.
 * @returns {{chieu_cao:number|null, can_nang:number|null}|null}
 */
function docSoDo(noiDung) {
  const s = ` ${String(noiDung || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')} `
    .replace(/(\d),(\d)/g, '$1.$2');
  if (/\d{9,}/.test(s.replace(/[\s.-]/g, ''))) {
    // Có dãy số dài (số điện thoại): chỉ đọc phần có đơn vị rõ, bỏ số trơn.
  }
  let chieuCao = null;
  let canNang = null;
  let viTriCao = -1;
  const datCao = (cm, i) => { if (chieuCao == null && cm >= 100 && cm <= 210) { chieuCao = Math.round(cm); viTriCao = i; } };
  let m;
  // 1m58, 1m6, 1 m 58, 1 met 58, 1m (= 100)
  const reM = /(?<![\d.])([12])\s*(?:met|m)\s*(\d{1,2})?(?![\d])/g;
  while ((m = reM.exec(s))) {
    const sau = m[2] == null ? 0 : m[2].length === 1 ? Number(m[2]) * 10 : Number(m[2]);
    datCao(Number(m[1]) * 100 + sau, m.index + m[0].length);
  }
  // 1.58m, 1.6 m
  const reThapPhan = /(?<![\d])([12]\.\d{1,2})\s*m(?![a-z])/g;
  while ((m = reThapPhan.exec(s))) datCao(Number(m[1]) * 100, m.index + m[0].length);
  // m58 (cách viết tắt "m58" = 1m58)
  const reMTat = /(?<![a-z\d])m(\d{1,2})(?![\d])/g;
  while ((m = reMTat.exec(s))) datCao(100 + (m[1].length === 1 ? Number(m[1]) * 10 : Number(m[1])), m.index + m[0].length);
  // 158cm, 158 cm
  const reCm = /(?<![\d.])(\d{3})\s*cm(?![a-z])/g;
  while ((m = reCm.exec(s))) datCao(Number(m[1]), m.index + m[0].length);
  // cao 158, cao 1m58 (đã bắt ở trên), cao 1.58
  const reCao = /(?<![a-z])cao\s*(?:la\s*)?(\d{3}|[12]\.\d{1,2})(?![\d])/g;
  while ((m = reCao.exec(s))) datCao(m[1].includes('.') ? Number(m[1]) * 100 : Number(m[1]), m.index + m[0].length);

  const datNang = (kg) => { if (canNang == null && kg >= 25 && kg <= 150) canNang = Math.round(kg * 10) / 10; };
  // 50kg, 50 ky, 50 kí, 50 kilo, 50 can
  const reKg = /(?<![\d.])(\d{2,3}(?:\.\d)?)\s*(?:kg|kgs|ky|ki|kilo|kilogam|can|cân)(?![a-z])/g;
  while ((m = reKg.exec(s))) datNang(Number(m[1]));
  // nặng 50
  const reNang = /(?<![a-z])nang\s*(?:la\s*)?(\d{2,3}(?:\.\d)?)(?![\d])/g;
  while ((m = reNang.exec(s))) datNang(Number(m[1]));
  // "1m58 50": số trơn 2 chữ số ngay sau chiều cao
  if (canNang == null && viTriCao >= 0) {
    const sau = /^\s*[,/-]?\s*(\d{2,3})(?![\d]|\s*(?:k\b|nghin|ngan|tr|d\b|cm|%|cai|chiec|x))/.exec(s.slice(viTriCao));
    if (sau) datNang(Number(sau[1]));
  }
  if (chieuCao == null && canNang == null) return null;
  return { chieu_cao: chieuCao, can_nang: canNang };
}

module.exports = { docSoDo };
