'use strict';

/**
 * API "Trước live" (SPEC.md F-96): lịch live cố định, dời / hủy buổi, AI soạn bộ bài báo trước, lời mời + link cho nhóm Zalo.
 * Chỉ gọi khối Nghiệp vụ / Agent.
 */

const express = require('express');
const lichLive = require('../nghiep-vu/lich-live');
const cm = require('../nghiep-vu/cau-mau-khach');

const r = express.Router();

function trangThai() {
  const ke = lichLive.buoiKe();
  return { lich: lichLive.lich(), buoi_ke: ke, dong: lichLive.dongLich(), dong_y: ke ? require('../nghiep-vu/dong-y').demBuoi(ke.luc) : null, // F-97
    sap_toi: lichLive.cacBuoi(new Date().toISOString(), new Date(Date.now() + 21 * 86400e3).toISOString()).map((b) => ({ ...b, chu: lichLive.chuBuoi(b) })) };
}

r.get('/lich-live', (req, res) => res.json(trangThai()));

r.put('/lich-live', (req, res) => {
  lichLive.datLich({ buoi: req.body?.buoi || [] });
  res.json(trangThai());
});

/** Dời / hủy một buổi; trả kèm bài báo dời (máy điền, không gọi AI) để chép. */
r.post('/lich-live/doi-buoi', (req, res) => {
  const b = req.body || {};
  const cu = lichLive.cacBuoi(new Date(`${b.ngay}T00:00:00+07:00`).toISOString(), new Date(`${b.ngay}T23:59:59+07:00`).toISOString())[0] || null;
  lichLive.doiBuoi({ ngay: b.ngay, huy: !!b.huy, gio_moi: b.gio_moi || null, bo: !!b.bo });
  const ke = lichLive.buoiKe();
  const lichCu = cu ? lichLive.chuBuoi(cu) : b.ngay;
  const bai = b.bo ? null : b.huy ? cm.cau('bai_huy_buoi', { lich_cu: lichCu, lich_moi: ke ? ke.chu : 'shop báo sau' })
    : cm.cau('bai_doi_buoi', { lich_cu: lichCu, lich_moi: lichLive.chuBuoi({ ngay: b.ngay, gio: b.gio_moi, thu: new Date(`${b.ngay}T12:00:00+07:00`).getUTCDay() }) });
  res.json({ ...trangThai(), bai });
});

r.post('/lich-live/soan-bai', async (req, res) => {
  const { soanBai } = require('../agent/agents/soan-bai');
  const kq = await soanBai({ kichBanId: req.body?.kich_ban_id || null });
  res.json({ ...kq, nhac_quang_cao: cm.cau('nhac_quang_cao') });
});

/** Lời mời + link cho nhóm Zalo: đang live → link buổi live (Facebook trả); chưa live → link Page + giờ buổi kế. */
r.get('/lich-live/loi-moi', (req, res) => {
  const live = require('../nghiep-vu/live');
  const p = live.phienDangMo();
  const soMon = p ? new Set(p.kich_ban.doan.map((d) => d.san_pham_id).filter(Boolean)).size : require('../nghiep-vu/san-pham').danhSach().filter((x) => x.trang_thai === 'dang_ban').length;
  if (p?.trang_thai === 'dang_live' && p.fb_link) return res.json({ chu: cm.cau('loi_moi_zalo_dang_live', { so_mon: soMon, link: p.fb_link }), link: p.fb_link, dang_live: true });
  const fbPage = require('../nghiep-vu/fb-page');
  const pageId = p?.page_id || fbPage.danhSach()[0]?.id || (p?.dien_tap ? 'page_gia' : null);
  const link = pageId ? (fbPage.lay(pageId)?.link || `https://www.facebook.com/${pageId}`) : '';
  const ke = lichLive.buoiKe();
  const sp = require('../nghiep-vu/san-pham');
  const dsMon = p ? [...new Set(p.kich_ban.doan.map((d) => d.san_pham_id).filter(Boolean))].map((id) => { try { return sp.laySanPham(id); } catch { return null; } }).filter(Boolean)
    : sp.danhSach().filter((x) => x.trang_thai === 'dang_ban').map((x) => sp.laySanPham(x.id));
  res.json({ chu: cm.cau('loi_moi_zalo', { lich: ke ? ke.chu : 'buổi live tới', so_mon: soMon, link, cach_chot: sp.cachChotChung(dsMon) }), link, dang_live: false });
});

module.exports = r;
