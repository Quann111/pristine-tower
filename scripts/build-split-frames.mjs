// Cắt video tách tầng (Mặt bằng) thành từng khung WebP ở 4 cỡ (960/1280/1920/2560) cho trang /matbang.
// Dùng: node scripts/build-split-frames.mjs "<đường dẫn video>"
// Chất lượng chia 2 mức: khung đứng yên lâu (f_00 lúc chờ, 2 khung cuối lúc hiện hotspot) nén nhẹ cho nét;
// khung đang chạy (mỗi khung chỉ hiện 40ms, mắt không kịp thấy khác biệt) nén mạnh hơn để tải nhanh.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const video = process.argv[2];
if (!video || !fs.existsSync(video)) { console.error('Thiếu hoặc sai đường dẫn video'); process.exit(1); }
const Q_MOVE = { 960: 72, 1280: 72, 1920: 72, 2560: 70 }, Q_STILL = { 960: 88, 1280: 90, 1920: 90, 2560: 88 };
const STILL = (i, n) => i === 0 || i >= n - 2;
const ff = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status || 1); };
const webp = (q) => ['-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', '-preset', 'picture'];

for (const w of [960, 1280, 1920, 2560]) {
  const dir = path.resolve('public', 'split', String(w)), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'split-'));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // thu nhỏ một lần ra PNG (không mất chất lượng) rồi nén từng khung theo mức của nó
  ff(['-i', video, '-an', '-vf', `scale=${w}:-2:flags=lanczos`, '-pix_fmt', 'rgb24', '-start_number', '0', path.join(tmp, 'f_%02d.png')]);
  const pngs = fs.readdirSync(tmp).sort();
  pngs.forEach((f, i) => ff(['-i', path.join(tmp, f), ...webp(STILL(i, pngs.length) ? Q_STILL[w] : Q_MOVE[w]), '-pix_fmt', 'yuv420p', path.join(dir, f.replace('.png', '.webp'))]));
  // khung cuối chất lượng cao nhất (end.webp): cỡ lớn hơn 1 bậc (tối đa bằng video gốc), nén rất nhẹ.
  // Trang chỉ tải nó sau khi video đã chạy xong rồi thay vào khung cuối → không làm chậm lúc tải khung chạy.
  const hw = { 960: 1280, 1280: 1920, 1920: 2560, 2560: 3540 }[w];
  ff(['-sseof', '-0.04', '-i', video, '-an', '-frames:v', '1', '-vf', `scale=${hw}:-2:flags=lanczos`, ...webp(95), '-pix_fmt', 'yuv420p', path.join(dir, 'end.webp')]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const files = fs.readdirSync(dir), bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  console.log(`${w}px: ${files.length} khung, ${(bytes / 1048576).toFixed(1)} MB (TB ${(bytes / files.length / 1024).toFixed(0)} KB/khung)`);
}
