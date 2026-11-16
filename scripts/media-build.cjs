// Tạo ảnh Media: 4 cỡ WebP (960/1600/2560 + thumb 360) cho srcset, và media.json
const sharp = require('sharp'), fs = require('fs'), path = require('path');
sharp.cache(false); sharp.concurrency(2);
const SRC = process.argv[2], OUT = 'public/split/media';
const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
const slug = (f) => path.parse(f).name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
(async () => {
  const list = [];
  for (const f of files) {
    const s = slug(f), img = () => sharp(path.join(SRC, f), { limitInputPixels: false }).rotate();
    const m = await img().metadata();
    for (const w of [960, 1600, 2560]) {
      const o = `${OUT}/${s}-${w}.webp`;
      if (!fs.existsSync(o)) await img().resize({ width: Math.min(w, m.width) }).webp({ quality: w >= 2560 ? 80 : 82, effort: 5, smartSubsample: true }).toFile(o);
    }
    const t = `${OUT}/${s}-thumb.webp`;
    if (!fs.existsSync(t)) await img().resize(360, 250, { fit: 'cover' }).webp({ quality: 72 }).toFile(t);
    // màu chủ đạo làm nền chờ khi ảnh chưa tải
    const { dominant } = await img().resize(64).stats();
    list.push({ id: s, title: path.parse(f).name.replace(/_/g, ' '), w: m.width, h: m.height, bg: `rgb(${dominant.r},${dominant.g},${dominant.b})` });
    console.log('ok', f);
  }
  fs.writeFileSync(`${OUT}/media.json`, JSON.stringify(list));
  console.log('done', list.length);
})();
