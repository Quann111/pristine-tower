// Ảnh 360 căn hộ mẫu (popup căn trên trang tầng): 8K cho máy tính, 4K cho điện thoại / lần mở đầu.
// Dùng: node scripts/build-unit-pano.mjs "<ảnh 2BR>" "<ảnh 3BR>"
import sharp from 'sharp';
import fs from 'node:fs';
const [p2, p3] = process.argv.slice(2);
for (const [k, f] of [['pn2', p2], ['pn3', p3]]) for (const [w, q, r] of [[8192, 82, '8k'], [4096, 80, '4k']]) {
  const o = `public/home/units/pano-${k}-${r}.webp`;
  await sharp(f, { limitInputPixels: false }).resize(w, w / 2, { kernel: 'lanczos3' }).webp({ quality: q, effort: 6, smartSubsample: true }).toFile(o);
  console.log(o, (fs.statSync(o).size / 1048576).toFixed(2), 'MB');
}
