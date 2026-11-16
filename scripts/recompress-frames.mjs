// Nén lại khung Xoay 360 cỡ 1920 (khi không còn video gốc): đọc từ bản sao lưu, nén WebP q64 + sharpYuv, chỉ ghi đè khi nhỏ hơn.
// Dùng: node scripts/recompress-frames.mjs <thư mục bản sao lưu>
import sharp from 'sharp';
import fs from 'node:fs';
const src = process.argv[2], out = 'public/frames/1920';
let a = 0, b = 0;
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.webp'))) {
  const buf = await sharp(`${src}/${f}`).webp({ quality: 64, effort: 6, smartSubsample: true }).toBuffer();
  const old = fs.statSync(`${src}/${f}`).size; a += old;
  if (buf.length < old) { fs.writeFileSync(`${out}/${f}`, buf); b += buf.length; } else b += old;
}
console.log(`1920: ${(a / 1048576).toFixed(1)} MB → ${(b / 1048576).toFixed(1)} MB`);
