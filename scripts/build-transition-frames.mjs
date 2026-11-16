// Cắt video chuyển cảnh Phân tầng → Mặt bằng thành từng khung WebP ở 3 cỡ (960/1280/1920) cho trang /matbang?from=pt.
// Dùng: node scripts/build-transition-frames.mjs "<đường dẫn video>"
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const video = process.argv[2];
if (!video || !fs.existsSync(video)) { console.error('Thiếu hoặc sai đường dẫn video'); process.exit(1); }
const QUALITY = { 960: 74, 1280: 76, 1920: 76 };
for (const w of [960, 1280, 1920]) {
  const dir = path.resolve('public', 'split', 'trans', String(w));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-an',
    '-vf', `scale=${w}:-2:flags=lanczos,format=yuv420p`,
    '-c:v', 'libwebp', '-quality', String(QUALITY[w]), '-compression_level', '6', '-start_number', '0', path.join(dir, 't_%02d.webp')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  const files = fs.readdirSync(dir), bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  console.log(`${w}px: ${files.length} khung, ${(bytes / 1048576).toFixed(1)} MB (TB ${(bytes / files.length / 1024).toFixed(0)} KB/khung)`);
}
