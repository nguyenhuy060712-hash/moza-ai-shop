# Phiếu giao việc — BH12 "Kịch bản buổi sau"

*Soạn 28/10/2026. Chủ dự án vắng qua đêm, giao tự quyết (ghi "Quyết định khi chủ dự án vắng — BH12" ở `SPEC.md` mục 12), **không dừng chờ
duyệt**. Thiết kế: `docs/11` mục 7. Đây là mốc cuối của đợt.*

## Model gợi ý
**Sonnet 5.5 · Medium** (luật "con số phải có trong đầu vào" đã có mẫu ở agent `tong_ket`).

## Trước khi làm
- BH10, GD1, BH11 đã xong. Tạo tag `truoc-bh12`.
- Đọc: `docs/11` mục **0, 7**; tra `SPEC.md` grep F-117, F-102, F-103.
- Mã liên quan: `server/nghiep-vu/tong-ket-phien.js` (phễu, mốc từng món F-103), `server/agent/agents/tong-ket.js` (luật bỏ gợi ý có số lạ —
  mẫu để chép), `server/agent/agents/soan-kich-ban.js`, bảng `so_lieu_phut` (BH11), màn Tổng kết buổi (tìm "tong-ket" trong `public/js/man-hinh/`).

## Làm theo thứ tự
1. `tong-ket-phien.js` hàm `bangDoan(phienId)`: mỗi đoạn món, giây bắt đầu – kết thúc, người xem đầu / cuối (từ `so_lieu_phut`), người chốt,
   câu hỏi; đánh dấu **ra đơn** (chốt ≥ trung bình buổi) và **người xem bỏ đi** (tụt ≥ 20% trong đoạn). Chỉ khi buổi có ≥ 10 phút số liệu.
2. API `POST /live/phien/:id/de-xuat-kich-ban {mon_se_ban?}` → `soan_kich_ban` nhận số liệu gộp (không tên, không số điện thoại, không bình
   luận) → nháp thứ tự món, thời lượng, chỗ đổi lời mở; mã bỏ gợi ý có số lạ (chép luật `tong_ket`); `gpt-6-luna`; AI giả trả nháp mẫu.
3. Tổng kết buổi: bảng đoạn + nút "✨ Mai đề xuất kịch bản buổi sau" → nháp sửa được → "Lưu thành kịch bản" (API kịch bản có sẵn) → chọn ở ô
   kịch bản buổi sau.
4. Test: số liệu đoạn khớp đếm; AI giả nêu số lạ → bỏ; dữ liệu gửi AI không có tên / số.
5. **Kết mốc và kết đợt:** `npm test` đủ; xem thử `moza-ai-gia`: buổi tập → Tổng kết → nháp → lưu → chọn ở buổi tập kế (ảnh); `preview_stop`;
   ghi "Kết quả BH12" + quyết định khi vắng; **cập nhật đầu `SPEC.md` (trạng thái: đợt BH10 → BH12 đã code), `BAN-GIAO.md` mục 5–6, `README.md`
   (hướng dẫn người dùng các màn mới), `CLAUDE.md` (dòng trạng thái)**; gom **"Việc chủ dự án cần làm — sau đợt BH10 → BH12"** cuối mục 12
   (dán khóa ElevenLabs, nghe thử máy đọc, chọn cỡ chữ Màn hình người dẫn, nghe giọng riêng rồi bật, F-112 nếu chưa bật, Facebook thật / Bước 0,
   luật sư #127); commit + tag `bh12-kich-ban-buoi-sau`. Kết thúc lượt, câu cuối ghi tag, số test, việc dở.

## Không làm
Zalo. Không đo đạc / tinh chỉnh model.

## Lưu ý máy
Như `docs/phieu-gd1.md`.
