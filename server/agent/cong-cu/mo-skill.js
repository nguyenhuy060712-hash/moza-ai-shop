'use strict';

const skill = require('../../nghiep-vu/skill');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

module.exports = {
  ten: 'mo_skill',
  moTa: 'Mở nội dung một Skill (cách làm, ví dụ đúng, ví dụ sai) theo id trong mục lục Skill của bạn. Mở khi việc đang làm khớp dòng "dùng khi" của Skill đó.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: {
    type: 'object',
    properties: { id: { type: 'string', description: 'id của Skill, lấy từ mục lục Skill' } },
    required: ['id'],
    additionalProperties: false,
  },
  chay({ id }, ctx = {}) {
    let s;
    try {
      s = skill.moSkill(id, ctx.agentId);
    } catch (e) {
      if (e.ma === 'SKILL_KHONG_DUOC_CAP') throw e;
      throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có Skill "${id}". Chỉ mở Skill có trong mục lục của bạn.`);
    }
    ctx.ghiNguon?.('skill', s.id, s.phien_ban);
    return s;
  },
};
