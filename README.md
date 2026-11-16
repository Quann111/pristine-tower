# Pristine Tower — tour 360, mặt bằng, căn hộ

- **Trang web:** https://pristine-tower.quann111.workers.dev
- **Admin:** `/admin/` (tài khoản `admin`, mật khẩu nằm trong file `.dev.vars` — file này không đưa lên git)

## Dữ liệu
- Toàn bộ nội dung (cảnh 360, hotspot, trang chủ, mặt bằng, vùng căn hộ…) là **một tài liệu JSON** (`tour.json`).
  Trên Cloudflare nó nằm trong Durable Object `TourDB`; bản khởi tạo là `public/seed/tour.json`.
- Ảnh admin tải lên được thu nhỏ ngay trên trình duyệt rồi lưu vào Workers KV (binding `DB`).
  Ảnh có sẵn nằm trong `public/uploads`, `public/home`.

## Lệnh
- `npm test` — chạy test API.
- `npm start` — chạy thử trên máy (Node, dữ liệu trong `data/`), http://localhost:3360
- `npm run dev` — chạy bằng `wrangler dev` (giống bản Cloudflare).
- `npm run deploy` — triển khai lên Cloudflare.
- Đổi mật khẩu admin: `npx wrangler secret put ADMIN_PASS`

## Xoay 360 (kéo để xoay từng khung)
- Trang `/xoay360.html`: 120 khung WebP cắt từ video, kéo ngang / cuộn chuột / phím ← → để xoay, có quán tính và tự xoay khi rảnh.
- Tạo lại khung từ video mới: `node scripts/build-frames.mjs "<video.mp4>"` (cần ffmpeg). Video 360 khung/25fps là đủ một vòng.
  Script cắt viền 12px, lấy mỗi khung thứ 3 và xuất 3 cỡ: `public/frames/1280`, `1920`, `2560`.
  Sau khi dựng lại, tăng `VER` trong `public/xoay360.html` (và trong đoạn script đầu trang) để trình duyệt tải bản mới.

## Mặt bằng (video tách tầng)
- Trang `/matbang`: đứng ở khung đầu, bấm/chạm để chạy 50 khung WebP tới khung cuối rồi dừng. Khung đầu tải ưu tiên, các khung còn lại tải dần lúc rảnh; cỡ khung (960/1280/1920) chọn theo màn hình và mạng.
- Khung hình từng thiết bị (điện thoại dọc/ngang, tablet, máy tính) chỉnh trong admin → Mặt bằng (có khung xem trước).
- Dựng lại khung từ video mới: `node scripts/build-split-frames.mjs "<video>"` (cần ffmpeg) → `public/split/{960,1280,1920,2560}`, rồi tăng `?v=` của khung `f_` trong `matbang.html`. Bản hiện tại dựng từ `PhanTangTI_V3_2.mov` (`?v=4`).
- Khi tới khung cuối: hiệu ứng quét sáng, chấm điểm chỉ, đường spine tự vẽ và thẻ tiện ích/nhãn tầng mở ra. Bấm thẻ → bảng xem ảnh; bấm nhãn tầng → trang tầng. Sửa vị trí thẻ/spine trong admin → Mặt bằng → "Sửa vị trí hotspot".
- Chuyển cảnh Phân tầng → Mặt bằng: bấm vùng tầng tiện ích ở `/phantang` → `/matbang?from=pt` chạy 48 khung video chuyển cảnh rồi nối luôn 50 khung tách tầng. Dựng lại: `node scripts/build-transition-frames.mjs "<video>"` → `public/split/trans/{960,1280,1920}`; video mới thì đo lại `T_END` (vị trí `f_00` trong khung cuối) trong `matbang.html` và tăng `?v=`.
- Dựng lại ảnh tiện ích: `node scripts/build-amenities.mjs "<thư mục ảnh>"` → `public/split/amenity/`.
- Trang `/tienich` (bấm nhãn "Tầng tiện ích" ở Mặt bằng): sơ đồ tầng tiện ích, bấm nút tiện ích để tô vùng và xem ảnh. Vùng chỉnh trong admin → Mặt bằng → "Sơ đồ tầng tiện ích". Dựng lại ảnh sơ đồ: thêm đường dẫn ảnh làm tham số thứ 2 của `build-amenities.mjs`.
