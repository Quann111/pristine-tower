// Ảnh popup "Sảnh" (trang Mặt bằng): mỗi ảnh gốc → WebP 1280/2048/2880, giữ tỉ lệ (không cắt).
// Dùng: node scripts/build-lobby.mjs "<thư mục chứa '1. Sảnh chính' và '2. Sảnh Thang'>" ["<ảnh thẻ SẢNH>"]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const src = process.argv[2], out = path.resolve('public/split/amenity/lobby');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const num = (f) => { const m = f.match(/\((\d+)\)/); return m ? +m[1] : 999; };
const res = {};
for (const [key, re] of [['main', /chính/i], ['lift', /thang/i]]) {
  const dir = fs.readdirSync(src).find((d) => re.test(d.normalize('NFC')));
  const files = fs.readdirSync(path.join(src, dir)).filter((f) => /\.jpe?g$/i.test(f)).sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  res[key] = [];
  for (const [i, f] of files.entries()) {
    const base = `${key}-${String(i + 1).padStart(2, '0')}`;
    for (const w of [1280, 2048, 2880]) await sharp(path.join(src, dir, f)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(path.join(out, `${base}-${w}.webp`));
    res[key].push(`/split/amenity/lobby/${base}-2048.webp`);
    console.log(base, '←', f);
  }
}
if (process.argv[3]) await sharp(process.argv[3]).webp({ quality: 90 }).toFile(path.resolve('public/split/amenity/hs-sanh.webp'));
console.log(JSON.stringify(res));
const b = fs.readdirSync(out).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log(fs.readdirSync(out).length, 'tệp', (b / 1048576).toFixed(1), 'MB');
