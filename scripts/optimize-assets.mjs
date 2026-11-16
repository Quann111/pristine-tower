// Tạo lại ảnh tối ưu (WebP chất lượng cao) từ ảnh gốc và nén phông WOFF2. Chạy: node scripts/optimize-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
const PUB = path.resolve('public');
const SRC = path.resolve('..'); // thư mục chứa 360_Cam_*.png
const pano = async (src, out, w = 4096) => {
  const img = sharp(src, { limitInputPixels: false });
  await img.clone().resize(w, w / 2, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(out);
  await img.clone().resize(480, 240, { fit: 'fill' }).webp({ quality: 72, effort: 6 }).toFile(out.replace(/\.webp$/, '.thumb.webp'));
};
const files = fs.readdirSync(SRC).filter((f) => /^360_Cam_.*\.png$/i.test(f)).sort();
for (const [i, f] of files.entries()) { await pano(path.join(SRC, f), path.join(PUB, 'uploads', `s0${i + 1}.webp`)); console.log('pano', f); }
const roof = 'E:/6/JPG/JPG/360_Rooftop.png';
if (fs.existsSync(roof)) { await sharp(roof, { limitInputPixels: false }).resize(4096, 2048, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 82, effort: 6 }).toFile(path.join(PUB, "home", "rooftop.webp")); console.log('rooftop'); }
for (const n of ['bg', 'matbang']) { await sharp(path.join(PUB, 'home', `${n}.jpg`)).webp({ quality: 90, effort: 6 }).toFile(path.join(PUB, 'home', `${n}.webp`)); console.log(n); }
