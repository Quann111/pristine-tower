// Đẩy danh sách ảnh popup "Sảnh" (Sảnh chính / Sảnh thang) từ src/app.js lên site thật.
// Dùng: node scripts/push-lobby-gallery.mjs [https://pristine-tower.quann111.workers.dev]  (mật khẩu: $env:ADMIN_PASS hoặc .dev.vars)
import fs from 'node:fs';
const base = (process.argv[2] || 'https://pristine-tower.quann111.workers.dev').replace(/\/$/, '');
let pass = process.env.ADMIN_PASS;
if (!pass || /^<.*>$/.test(pass)) {
  try { pass = (fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_PASS\s*=\s*"?([^"\r\n]*)"?/m) || [])[1]; } catch {}
}
if (!pass) { console.error('Thiếu biến môi trường ADMIN_PASS'); process.exit(1); }
const src = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const gallery = JSON.parse(src.match(/const LOBBY_HOTSPOT = (\{.*\});/)[1]).gallery;
const login = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user: process.env.ADMIN_USER || 'admin', pass }) });
if (!login.ok) { console.error('Đăng nhập thất bại:', login.status); process.exit(1); }
const H = { authorization: `Bearer ${(await login.json()).token}` };
const live = (await (await fetch(`${base}/api/tour`, { cache: 'no-store' })).json()).split.hotspots;
if (!live.some((h) => h.id === 'sanh')) { console.error('Site không có hotspot "sanh" — không đổi gì'); process.exit(1); }
const hotspots = live.map((h) => (h.id === 'sanh' ? { ...h, gallery } : h));
const r = await fetch(`${base}/api/admin/split/hotspots`, { method: 'PUT', headers: H, body: JSON.stringify({ hotspots }) });
console.log('split/hotspots', r.status, r.ok ? gallery.map((g) => `${g.title}: ${g.photos.length} ảnh`).join(' | ') : await r.text());
