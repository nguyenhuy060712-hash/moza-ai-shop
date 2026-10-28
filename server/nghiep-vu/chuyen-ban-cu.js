'use strict';

/**
 * Lần chạy đầu trên máy có dữ liệu bản bán hàng (SPEC.md mục 1, F-02):
 *  - `data/db.json` được ĐỔI TÊN thành `data/db.json.ban-hang-cu` (không xóa, không nạp nữa);
 *  - chỉ chuyển sang bản mới giọng và model người dùng đã chọn trong `settings.providers`.
 * Sản phẩm, đơn hàng, kịch bản, kỹ năng bán hàng không được chuyển.
 */

const fs = require('node:fs');
const path = require('node:path');
const caiDat = require('./cai-dat');
const giong = require('../giong');
const { gio } = require('./chung');

function chuyenBanCu(thuMuc) {
  const cu = path.join(thuMuc, 'db.json');
  if (!fs.existsSync(cu)) return null;

  let providers = {};
  try {
    providers = JSON.parse(fs.readFileSync(cu, 'utf8'))?.settings?.providers || {};
  } catch {
    // File hỏng thì vẫn đổi tên giữ lại, chỉ là không chuyển được giọng.
  }

  const daChuyen = { giong: {}, model: {} };
  const m = caiDat.mieng();
  for (const nha of ['openai', 'gemini']) {
    const p = providers[nha] || {};
    if (p.voice && giong.coGiong(nha, p.voice)) daChuyen.giong[nha] = p.voice;
    if (p.model && caiDat.MAC_DINH.mieng.some((x) => x.model === p.model && x.nha === nha)) daChuyen.model[nha] = p.model;
  }
  caiDat.datMieng({ ...m, giong: { ...m.giong, ...daChuyen.giong } });

  let dich = path.join(thuMuc, 'db.json.ban-hang-cu');
  for (let i = 2; fs.existsSync(dich); i++) dich = path.join(thuMuc, `db.json.ban-hang-cu-${i}`);
  fs.renameSync(cu, dich);

  const kq = { luc: gio(), file: path.basename(dich), ...daChuyen };
  caiDat.ghi('chuyen_ban_cu', kq);
  return kq;
}

module.exports = { chuyenBanCu };
