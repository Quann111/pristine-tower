// Đẩy dữ liệu mặt bằng (danh sách tầng, căn hộ, loại căn) từ data/floors-push.json lên site.
// Dùng: ADMIN_PASS=... node scripts/push-floors.mjs [https://pristine-tower.panamotion.io.vn]
import fs from 'node:fs';

const base = (process.argv[2] || 'https://pristine-tower.panamotion.io.vn').replace(/\/$/, '');
const pass = process.env.ADMIN_PASS;
if (!pass) { console.error('Thiếu biến môi trường ADMIN_PASS'); process.exit(1); }
const { items, unitTypes } = JSON.parse(fs.readFileSync(new URL('../data/floors-push.json', import.meta.url), 'utf8'));

const login = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user: process.env.ADMIN_USER || 'admin', pass }) });
if (!login.ok) { console.error('Đăng nhập thất bại:', login.status); process.exit(1); }
const H = { authorization: `Bearer ${(await login.json()).token}` };

const t = await fetch(`${base}/api/admin/unit-types`, { method: 'PUT', headers: H, body: JSON.stringify({ types: unitTypes }) });
console.log('unit-types', t.status);
const r = await fetch(`${base}/api/admin/floors`, { method: 'PATCH', headers: H, body: JSON.stringify({ items }) });
const out = await r.json();
if (!r.ok) { console.error('floors', r.status, out); process.exit(1); }
console.log('floors', r.status, out.items.map((i) => `${i.title} (${i.units.length} căn)`).join(' | '));
