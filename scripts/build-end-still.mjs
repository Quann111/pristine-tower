// Khung cuối trang Mặt bằng = ảnh tĩnh nét (PhanTangTI_Anh_V1.png, 7080×3072, cùng tỉ lệ 3540:1536 với video → hotspot giữ nguyên).
// Dùng: node scripts/build-end-still.mjs "<ảnh .png>"  → public/split/{960,1280,1920,2560}/end.webp (cỡ cao hơn khung chạy 1 bậc)
import sharp from 'sharp';
import fs from 'node:fs';
const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Thiếu ảnh'); process.exit(1); }
// cỡ ≈ 1,5 × cỡ khung chạy (nét cả khi phóng nhẹ / màn mật độ cao), nén nhẹ q92 — chỉ tải sau khi video chạy xong nên không làm chậm lúc mở trang
for (const [tier, w, q] of [[960, 1440, 92], [1280, 1920, 92], [1920, 2880, 92], [2560, 4096, 92]]) {
  const o = `public/split/${tier}/end.webp`;
  await sharp(src).resize(w, Math.round(w * 1536 / 3540), { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: q, effort: 6, smartSubsample: true }).toFile(o);
  console.log(o, (fs.statSync(o).size / 1024).toFixed(0), 'KB');
}
