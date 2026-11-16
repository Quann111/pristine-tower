// Cắt video vòng lặp Mặt bằng (chạy lặp sau khi tách tầng xong, lúc hotspot đang hiện) thành khung WebP.
// Dùng: node scripts/build-loop-frames.mjs "<video>"  → public/split/loop/{960,1280,1920}/l_XX.webp
// Tối đa 1920: 50 khung giải mã nằm sẵn trong bộ nhớ để lặp, 2560 quá nặng cho RAM/GPU.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const video = process.argv[2];
if (!video || !fs.existsSync(video)) { console.error('Thiếu hoặc sai đường dẫn video'); process.exit(1); }
const Q = { 960: 74, 1280: 74, 1920: 72 };
for (const w of [960, 1280, 1920]) {
  const dir = path.resolve('public', 'split', 'loop', String(w));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-an', '-vf', `scale=${w}:-2:flags=lanczos,format=yuv420p`,
    '-c:v', 'libwebp', '-quality', String(Q[w]), '-compression_level', '6', '-preset', 'picture', '-start_number', '0', path.join(dir, 'l_%02d.webp')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
  const files = fs.readdirSync(dir), bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  console.log(`loop ${w}px: ${files.length} khung, ${(bytes / 1048576).toFixed(1)} MB`);
}
