// Đẩy sơ đồ tầng tiện ích (ảnh + vùng tô từng tiện ích) từ data/tour.json lên site thật.
// Dùng: node scripts/push-amenity-plan.mjs [https://pristine-tower.quann111.workers.dev]  (mật khẩu: $env:ADMIN_PASS hoặc .dev.vars)
import fs from 'node:fs';
const base = (process.argv[2] || 'https://pristine-tower.quann111.workers.dev').replace(/\/$/, '');
let pass = process.env.ADMIN_PASS;
if (!pass || /^<.*>$/.test(pass)) {
  try { pass = (fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/^ADMIN_PASS\s*=\s*"?([^"\r\n]*)"?/m) || [])[1]; } catch {}
}
if (!pass) { console.error('Thiếu biến môi trường ADMIN_PASS'); process.exit(1); }
const ap = JSON.parse(fs.readFileSync(new URL('../data/tour.json', import.meta.url), 'utf8')).split.amenityPlan;
const login = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user: process.env.ADMIN_USER || 'admin', pass }) });
if (!login.ok) { console.error('Đăng nhập thất bại:', login.status); process.exit(1); }
const H = { authorization: `Bearer ${(await login.json()).token}` };
const r = await fetch(`${base}/api/admin/split/amenity-plan`, { method: 'PUT', headers: H, body: JSON.stringify(ap) });
console.log('amenity-plan', r.status, r.ok ? `${ap.plan} · ${ap.items.length} tiện ích` : await r.text());
