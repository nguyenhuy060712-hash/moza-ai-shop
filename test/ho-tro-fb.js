'use strict';

/**
 * `fetchMetaGia(meta)` (docs/07 mục 2, cách B): một `fetch` giả chuyển mỗi yêu cầu HTTP của `that.js` + `graph.js` thành lời gọi
 * Meta giả — để CHÍNH mã Facebook thật chạy trên cùng bộ luật với bản giả. Trả JSON và header mức dùng như Graph API,
 * luồng bình luận live là server-sent events. Mã truy cập dạng `ma_<pageId>`: `/me` là Page đó.
 */

const { LoiMeta } = require('../server/facebook/meta-gia');

function traJson(meta, status, j) {
  return new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json', ...meta.headerMucDung() } });
}

async function docThan(init) {
  if (!init?.body) return {};
  if (typeof init.body === 'string') return JSON.parse(init.body);
  if (init.body instanceof FormData) {
    const o = {};
    for (const [k, v] of init.body.entries()) {
      if (typeof v === 'string') o[k] = /^[[{]/.test(v) ? JSON.parse(v) : v;
      else o[k] = { ten: v.name, co: v.size };
    }
    return o;
  }
  return init.body;
}

/** Luồng SSE `live_comments` cho một live: mỗi bình luận mới một khối `data: {…}`. */
function luongSse(meta, liveId, signal) {
  let nghe;
  const ma = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      nghe = ({ liveId: id, raw }) => { if (id === liveId) c.enqueue(ma.encode(`data: ${JSON.stringify(raw)}\n\n`)); };
      meta.on('binh_luan_live', nghe);
      signal?.addEventListener('abort', () => { meta.off('binh_luan_live', nghe); try { c.close(); } catch { /* đã đóng */ } });
      c.enqueue(ma.encode(': ping\n\n'));
    },
    cancel() { meta.off('binh_luan_live', nghe); },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/**
 * @param {import('../server/facebook/meta-gia').MetaGia} meta
 * @returns {typeof fetch & {goi: {phuong:string, duong:string, than:object}[]}}
 */
function fetchMetaGia(meta) {
  const goi = [];
  const f = async (url, init = {}) => {
    const u = new URL(String(url));
    const phuong = (init.method || 'GET').toUpperCase();
    const token = u.searchParams.get('access_token') || '';
    const pageCuaToken = token.startsWith('ma_') ? token.slice(3) : null;
    const duong = u.pathname.replace(/^\/v\d+\.\d+/, '');
    const phan = duong.split('/').filter(Boolean).map((x) => (x === 'me' ? pageCuaToken : x));
    const than = await docThan(init);
    goi.push({ phuong, duong, than });
    try {
      if (u.hostname.startsWith('streaming-graph')) return luongSse(meta, phan[0], init.signal);
      const [a, b] = phan;
      if (phuong === 'GET' && b === 'live_videos') return traJson(meta, 200, { data: meta.timLive(a) });
      if (phuong === 'GET' && b === 'comments') {
        const since = u.searchParams.get('since');
        return traJson(meta, 200, { data: meta.docBinhLuan(a, since ? Number(since) : null) });
      }
      if (b === 'messages' && phuong === 'POST') {
        if (than.filedata) {
          const r = meta.guiTep(a, than.recipient?.id, { ten: than.filedata.ten, co: than.filedata.co });
          return traJson(meta, 200, r);
        }
        return traJson(meta, 200, meta.gui(a, than));
      }
      if (b === 'message_attachments' && phuong === 'POST') {
        return traJson(meta, 200, meta.taiLen(a, than.filedata ? { tep: than.filedata.ten } : { url: than.message?.attachment?.payload?.url }));
      }
      if (b === 'message_templates') {
        if (phuong === 'POST') return traJson(meta, 200, meta.taoMau(a, than));
        return traJson(meta, 200, { data: meta.docMau(a, u.searchParams.get('name')) });
      }
      if (b === 'messenger_profile' && phuong === 'POST') return traJson(meta, 200, meta.datHoSo(a, than));
      if (b === 'page_status') return traJson(meta, 200, meta.trangThaiPage(a));
      if (b === 'comments' && phuong === 'POST') return traJson(meta, 200, meta.traLoiBinhLuan(a, than.message));
      if (!b && phuong === 'POST' && than.is_hidden) return traJson(meta, 200, meta.an(a));
      if (!b && phuong === 'GET') {
        const truong = u.searchParams.get('fields') || '';
        if (truong.includes('can_reply_privately')) return traJson(meta, 200, meta.xemBinhLuan(a));
        if (meta.pages.has(a)) return traJson(meta, 200, { id: a, name: meta.pages.get(a).ten });
        return traJson(meta, 200, meta.layNguoi(a));
      }
      return traJson(meta, 400, { error: { code: 100, message: `fetchMetaGia: chưa giả đường ${phuong} ${duong}` } });
    } catch (e) {
      if (e instanceof LoiMeta) return traJson(meta, 400, { error: e.error });
      throw e;
    }
  };
  f.goi = goi;
  return f;
}

/**
 * Bản Facebook thật (FacebookThat + graph + nhịp gọi thật) nối vào Meta giả của một FacebookGia.
 * @param {import('../server/facebook/gia').FacebookGia} gia
 */
function thatTrenMetaGia(gia, { nhip = null } = {}) {
  const { NhipGoi } = require('../server/facebook/nhip-goi');
  const { taoGraph } = require('../server/facebook/graph');
  const { FacebookThat, FacebookPage } = require('../server/facebook/that');
  const f = fetchMetaGia(gia.meta);
  const n = nhip || new NhipGoi({ ngu: async () => {} });
  const graph = taoGraph({ layMa: () => '', nhip: n, fetch: f });
  const pages = gia.pages.map((p) => new FacebookPage({ graph, pageId: p.id, layMa: () => `ma_${p.id}`, ten: p.ten, fetch: f }));
  const that = new FacebookThat({ layPages: () => pages });
  return { that, fetch: f, nhip: n };
}

module.exports = { fetchMetaGia, thatTrenMetaGia };
