// Ảnh bóc mái động: video (có kênh alpha) → WebP động lặp vô hạn, giữ nền trong suốt, 3 cỡ.
// Dùng: node scripts/build-roof-anim.mjs "<video .mov>"  → public/split/amenity/bocmai-anim-{720,1080,1600}.webp
// WebP động chạy được trong <img> ở mọi trình duyệt hiện đại (kể cả Safari/iOS), trình duyệt tự giải mã từng khung
// nên tốn ít RAM, và phóng to / kéo bằng CSS transform y như ảnh tĩnh.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const video = process.argv[2];
if (!video || !fs.existsSync(video)) { console.error('Thiếu hoặc sai đường dẫn video'); process.exit(1); }
for (const [w, q] of [[720, 70], [1080, 72], [1600, 74]]) {
  const o = path.resolve('public/split/amenity', `bocmai-anim-${w}.webp`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-an', '-vf', `scale=${w}:-2:flags=lanczos,format=yuva420p`,
    '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', String(q), '-compression_level', '6', '-loop', '0', o], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
  console.log(o, (fs.statSync(o).size / 1048576).toFixed(2), 'MB');
}
