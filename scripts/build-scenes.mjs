// Tạo ảnh 360 chất lượng cao cho /xoay360 từ ảnh gốc 9000x4500: 8K (máy tính) và 4K (điện thoại / mạng yếu).
// Dùng: node scripts/build-scenes.mjs <thư mục ảnh>  — tên tệp chứa Cam01/Cam03/Cam06/Cam07
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2], out = path.resolve('public/home/scenes');
for (const f of fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f))) {
  const k = 'cam' + f.match(/cam(\d\d)/i)[1];
  for (const [w, q] of [[8192, 82], [4096, 80]]) {
    const o = path.join(out, `${k}-${w === 8192 ? '8k' : '4k'}.webp`);
    await sharp(path.join(dir, f), { limitInputPixels: false }).resize(w, w / 2, { kernel: 'lanczos3' }).webp({ quality: q, effort: 6, smartSubsample: true }).toFile(o);
    console.log(o, (fs.statSync(o).size / 1048576).toFixed(2), 'MB');
  }
}
