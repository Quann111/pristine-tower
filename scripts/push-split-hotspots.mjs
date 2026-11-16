// Đẩy vị trí hotspot trang Mặt bằng (split.hotspots trong data/tour.json) lên site thật.
// Dùng (PowerShell): $env:ADMIN_PASS="..."; node scripts/push-split-hotspots.mjs [https://pristine-tower.quann111.workers.dev]
import fs from 'node:fs';
const base = (process.argv[2] || 'https://pristine-tower.quann111.workers.dev').replace(/\/$/, '');
// không đặt ADMIN_PASS (hoặc còn để chữ mẫu trong dấu <>) → lấy từ .dev.vars
let pass = process.env.ADMIN_PASS;
if (!pass || /^<.*>$/.test(pass)) {
  try { pass = (fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_PASS\s*=\s*"?([^"\r\n]*)"?/m) || [])[1]; } catch {}
}
if (!pass) { console.error('Thiếu biến môi trường ADMIN_PASS'); process.exit(1); }
const local = JSON.parse(fs.readFileSync(new URL('../data/tour.json', import.meta.url), 'utf8')).split.hotspots;
const login = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user: process.env.ADMIN_USER || 'admin', pass }) });
if (!login.ok) { console.error('Đăng nhập thất bại:', login.status); process.exit(1); }
const H = { authorization: `Bearer ${(await login.json()).token}` };
// chỉ đổi toạ độ x/y của hai nhãn tầng, giữ nguyên mọi thứ khác đang có trên site
const live = (await (await fetch(`${base}/api/tour`, { cache: 'no-store' })).json()).split.hotspots;
const want = Object.fromEntries(local.filter((h) => h.kind === 'floor').map((h) => [h.id, h]));
const hotspots = live.map((h) => (want[h.id] ? { ...h, x: want[h.id].x, y: want[h.id].y } : h));
const r = await fetch(`${base}/api/admin/split/hotspots`, { method: 'PUT', headers: H, body: JSON.stringify({ hotspots }) });
console.log('split/hotspots', r.status, r.ok ? hotspots.filter((h) => want[h.id]).map((h) => `${h.id} ${h.x},${h.y}`).join(' | ') : await r.text());
