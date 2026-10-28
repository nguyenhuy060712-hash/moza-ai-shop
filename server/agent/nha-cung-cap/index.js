'use strict';

/**
 * Các bộ nối nhà cung cấp AI. Mỗi bộ có cùng một hàm `goi({ model, mucSuyNghi, heThong, lichSu, congCu, luocDo, tinHieu })`.
 * Bản xem thử chạy với cờ `--ai-gia` (MOZA_AI_GIA=1, #93): mọi Agent dùng AI giả "đáp án mẫu" — 0 đồng, không gọi mạng.
 */

if (process.env.MOZA_AI_GIA === '1') {
  const gia = require('./gia-mau');
  module.exports = { gemini: gia, openai: gia, anthropic: gia };
} else {
  module.exports = {
    gemini: require('./gemini'),
    openai: require('./openai'),
    anthropic: require('./anthropic'),
  };
}
