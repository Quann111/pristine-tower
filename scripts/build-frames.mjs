// Dựng 120 khung WebP (3 cỡ 960/1280/1920) cho trang Xoay 360, mỗi khung cách nhau 3°.
// Dùng: node scripts/build-frames.mjs "<video.mp4 | thư mục ảnh JPG/PNG>"
// - Video 25fps: 360 khung là đủ một vòng (khung 360 trùng khung 0), cắt viền 12px.
// - Thư mục ảnh (vd Xoay_360_00000.jpg … 00360.jpg): sắp theo tên, bỏ ảnh cuối nếu trùng ảnh đầu, lấy đều 120 ảnh, không cắt viền.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Thiếu hoặc sai đường dẫn video / thư mục ảnh'); process.exit(1); }
const N = 120, SIZES = [960, 1280, 1920], QUALITY = { 960: 74, 1280: 76, 1920: 77 };
const outDir = (w) => path.resolve('public', 'frames', String(w));
const report = () => {
  for (const w of SIZES) {
    const dir = outDir(w), files = fs.readdirSync(dir), bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    console.log(`${w}px: ${files.length} khung, ${(bytes / 1048576).toFixed(1)} MB (TB ${(bytes / files.length / 1024).toFixed(0)} KB/khung)`);
  }
};
for (const w of SIZES) { fs.rmSync(outDir(w), { recursive: true, force: true }); fs.mkdirSync(outDir(w), { recursive: true }); }

if (fs.statSync(src).isDirectory()) {
  const all = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const loop = all.length % N === 1 ? all.slice(0, -1) : all; // 361 ảnh = 360 + ảnh khép vòng
  const pick = Array.from({ length: N }, (_, i) => loop[Math.round((i * loop.length) / N)]);
  let done = 0;
  const work = async (f, i) => {
    const name = `f_${String(i).padStart(3, '0')}.webp`;
    for (const w of SIZES) {
      await sharp(path.join(src, f)).resize(w, null, { kernel: 'lanczos3', withoutEnlargement: true })
        .webp({ quality: QUALITY[w], effort: 6, smartSubsample: true }).toFile(path.join(outDir(w), name));
    }
    if (++done % 20 === 0) console.log(`${done}/${N}`);
  };
  for (let i = 0; i < N; i += 8) await Promise.all(pick.slice(i, i + 8).map((f, k) => work(f, i + k)));
} else {
  const STEP = 3, TOTAL = 360;
  for (const w of SIZES) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src,
      '-vf', `select='lt(n\,${TOTAL})*not(mod(n\,${STEP}))',crop=iw-24:ih-24:12:12,scale=${w}:-2:flags=lanczos`, '-fps_mode', 'vfr',
      '-c:v', 'libwebp', '-quality', String(QUALITY[w]), '-compression_level', '6', '-start_number', '0', path.join(outDir(w), 'f_%03d.webp')], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status || 1);
  }
}
report();
