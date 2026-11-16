// Ảnh tiện ích cho hotspot trang Mặt bằng: thẻ nhỏ (360x190) + ảnh xem lớn (1280/2048) dạng WebP.
// Dùng: node scripts/build-amenities.mjs "<thư mục ảnh gốc>" ["<ảnh sơ đồ tầng tiện ích>"]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Thiếu hoặc sai thư mục ảnh'); process.exit(1); }
// tên tệp gốc → id hotspot
const MAP = { kidzone: /kidzone/i, gym: /gym/i, healthhub: /hea.?th/i, pool: /be.?boi/i, golf: /golf/i, shcd: /shcd/i };
const out = path.resolve('public', 'split', 'amenity');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src)) {
  const id = Object.keys(MAP).find((k) => MAP[k].test(f));
  if (!id) { console.log('bỏ qua', f); continue; }
  const img = () => sharp(path.join(src, f)).rotate();
  await img().resize(360, 190, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(out, `${id}-card.webp`));
  for (const w of [1280, 2048]) await img().resize(w, Math.round(w * 755 / 1357), { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(out, `${id}-${w}.webp`));
  console.log(id, '←', f);
}
// sơ đồ tầng tiện ích (tuỳ chọn, tham số thứ 2): giữ nền trong suốt
const plan = process.argv[3];
if (plan) for (const w of [2048, 3200]) await sharp(plan).resize(w).webp({ quality: 85, alphaQuality: 90 }).toFile(path.join(out, `plan-${w}.webp`));
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB');
