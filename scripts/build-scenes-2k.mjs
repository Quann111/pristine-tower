// Ảnh 360 cỡ 2K (2048×1024) cho mạng chậm / tiết kiệm dữ liệu: hiện nhanh trước, máy đủ điều kiện mới nâng lên 4K/8K.
// Dùng: node scripts/build-scenes-2k.mjs  (lấy từ public/home/scenes/*-4k.webp)
import sharp from 'sharp';
import fs from 'node:fs';
const d = 'public/home/scenes';
for (const f of fs.readdirSync(d).filter((f) => f.endsWith('-4k.webp'))) {
  const o = `${d}/${f.replace('-4k', '-2k')}`;
  await sharp(`${d}/${f}`).resize(2048, 1024, { kernel: 'lanczos3' }).webp({ quality: 78, effort: 6, smartSubsample: true }).toFile(o);
  console.log(o, (fs.statSync(o).size / 1024).toFixed(0), 'KB');
}
