# Triển khai Moza AI Shop lên VPS

*Soạn 28/10/2026. Phần mềm vốn thiết kế cho **một laptop, không có đăng nhập**. Đưa lên VPS thì **bắt buộc** có một lớp đăng nhập
đứng trước (Caddy ở dưới), không bao giờ mở thẳng cổng 5173 ra internet — ai biết địa chỉ là xem được khách, đơn, khóa AI.*

## 1. Cần có

| Thứ | Ghi chú |
| --- | --- |
| VPS Linux 64-bit (Ubuntu 24.04 trở lên) | 2 vCPU, 2 GB RAM, 20 GB ổ là đủ cho một shop |
| **Node.js 26** | Đúng bản đang dùng khi phát triển (`package.json` → `engines`). Cài theo nodejs.org (NodeSource) |
| Một tên miền trỏ về VPS | Ví dụ `shop.ten-mien-cua-ban.vn` — để có HTTPS (micro trên trình duyệt chỉ chạy với HTTPS) |
| Caddy | Tự lấy HTTPS, bắt đăng nhập (`deploy/Caddyfile`) |
| `cloudflared` | Chỉ khi nối Facebook: MOZA tự mở đường hầm cho webhook (như trên laptop). `which cloudflared` phải thấy |

## 2. Cài

```bash
sudo useradd -r -m -d /opt/moza-ai-shop moza
sudo -u moza git clone <địa chỉ kho GitHub riêng tư> /opt/moza-ai-shop
cd /opt/moza-ai-shop
sudo -u moza npm ci
sudo -u moza npm test            # phải đạt hết
sudo -u moza npm run demo        # nạp dữ liệu demo vào data/ (bỏ qua nếu muốn bắt đầu trống)
```

- **Khóa AI:** không chép `.env` từ laptop qua chat hay git. Sau khi chạy, vào giao diện → Cài đặt → Khóa AI dán khóa (MOZA tự ghi
  vào `.env` trên VPS, quyền chỉ user `moza` đọc được).
- `data/` (cơ sở dữ liệu, ảnh, video) **không nằm trong git** — sao lưu thư mục này định kỳ.

## 3. Chạy như dịch vụ

```bash
sudo cp deploy/moza.service /etc/systemd/system/moza.service
sudo nano /etc/systemd/system/moza.service     # sửa MOZA_DIA_CHI_NGOAI = https://<tên miền của bạn>
sudo systemctl daemon-reload && sudo systemctl enable --now moza
journalctl -u moza -f                           # xem nhật ký
```

`MOZA_DIA_CHI_NGOAI` cho MOZA nhận thêm **đúng** địa chỉ https đó (mặc định MOZA chỉ nhận `127.0.0.1`); trang lạ khác vẫn bị chặn.

## 4. Caddy (HTTPS + đăng nhập)

```bash
caddy hash-password                              # nhập mật khẩu → ra chuỗi băm
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile                   # thay tên miền, dán chuỗi băm
sudo systemctl reload caddy
```

Tường lửa chỉ mở 22 (SSH), 80, 443. **Không mở 5173, 5174.** Mở trình duyệt vào `https://<tên miền>` → nhập tài khoản Caddy → dùng như trên laptop.

## 5. Khác với chạy trên laptop

| Việc | Trên VPS |
| --- | --- |
| Nối Facebook | Như laptop: Cài đặt → Facebook, MOZA tự mở đường hầm `cloudflared` cho webhook |
| Micro, loa của Màn hình người dẫn | Chạy trong trình duyệt của máy đang live (cần HTTPS — Caddy lo) |
| **OBS** (đổi cảnh, MOZA nhìn) | OBS chạy trên máy live; VPS không gọi tới được OBS trong mạng nhà → để tắt mục OBS, đổi cảnh bằng tay |
| "Tự chạy khi mở máy" (Cài đặt) | Chỉ có trên Windows; VPS dùng systemd ở mục 3 |
| `CHAY PHAN MEM.bat`, `scripts/tu-chay.ps1` | Chỉ cho Windows |

## 6. Cập nhật bản mới

```bash
cd /opt/moza-ai-shop && sudo -u moza git pull && sudo -u moza npm ci && sudo -u moza npm test && sudo systemctl restart moza
```

## 7. Lưu ý an toàn

- Dữ liệu khách (tên, số điện thoại, địa chỉ) nằm trên VPS → chọn nhà cung cấp VPS đặt máy tại Việt Nam nếu được, đặt mật khẩu Caddy
  mạnh, sao lưu `data/` có mật khẩu. Nhờ người rành bảo mật xem trước khi dùng với khách thật (#127).
- Chưa chạy thử trên Linux thật (phát triển và test trên Windows 11) — chạy `npm test` ở bước 2 để chắc chắn.
