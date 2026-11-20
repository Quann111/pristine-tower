import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

// kho dữ liệu trong bộ nhớ (cùng giao diện với KV / fs)
function memStore() {
  let json = null; const assets = new Map();
  return {
    async getJson() { return json ? JSON.parse(json) : null; },
    async putJson(o) { json = JSON.stringify(o); },
    async getSeed() { return null; },
    async getAsset(n) { return assets.get(n) || null; },
    async putAsset(n, b, t) { assets.set(n, { data: b, type: t }); },
    async deleteAsset(n) { assets.delete(n); },
    _assets: assets
  };
}
const store = memStore();
let clock = 1_000_000;
const app = createApp({ store, env: { ADMIN_USER: 'u', ADMIN_PASS: 'p', SESSION_SECRET: 's3cret' }, now: () => clock });
let tok;
const call = async (p, method = 'GET', body, headers = {}) => {
  const isBytes = body instanceof Uint8Array;
  const res = await app.handle(new Request('http://x' + p, { method, headers: { ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(body && !isBytes ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: isBytes ? body : body ? JSON.stringify(body) : undefined }));
  if (!res) return { status: null };
  return { status: res.status, json: await res.json().catch(() => null), res };
};
const jpg = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#468' } }).jpeg().toBuffer().then((b) => new Uint8Array(b));
const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#468' } }).png().toBuffer().then((b) => new Uint8Array(b));
const upload = async (bytes) => (await call('/api/admin/assets', 'POST', bytes)).json.url;

test('admin API requires login (token ký HMAC, hết hạn)', async () => {
  assert.equal((await call('/api/admin/scenes', 'POST', { name: 'x' })).status, 401);
  assert.equal((await call('/api/login', 'POST', { user: 'u', pass: 'bad' })).status, 401);
  tok = (await call('/api/login', 'POST', { user: 'u', pass: 'p' })).json.token;
  assert.ok(tok);
  assert.equal((await call('/api/admin/reorder', 'POST', { ids: [] })).status, 200);
  const keep = tok; tok = tok.slice(0, -2) + 'zz';
  assert.equal((await call('/api/admin/reorder', 'POST', { ids: [] })).status, 401); // sai chữ ký
  tok = keep; clock += 13 * 3600 * 1000;
  assert.equal((await call('/api/admin/reorder', 'POST', { ids: [] })).status, 401); // hết hạn
  clock = 1_000_000; tok = (await call('/api/login', 'POST', { user: 'u', pass: 'p' })).json.token;
});

test('upload ảnh: chỉ nhận JPG/PNG/WebP thật, lưu và phục vụ lại', async () => {
  assert.equal((await call('/api/admin/assets', 'POST', new TextEncoder().encode('khong phai anh'))).status, 400);
  assert.equal((await call('/api/admin/assets', 'POST', new Uint8Array(0))).status, 400);
  const url = await upload(await jpg(40, 20));
  assert.match(url, /^\/uploads\/[\w.]+\.jpg$/);
  const got = await call(url);
  assert.equal(got.res.headers.get('content-type'), 'image/jpeg');
  assert.equal((await call('/uploads/khong-co.jpg')).status, null); // để lớp ngoài phục vụ file tĩnh
});

let a, b;
test('tạo cảnh từ ảnh đã tải; địa chỉ ảnh phải hợp lệ', async () => {
  assert.equal((await call('/api/admin/scenes', 'POST', { name: 'x', image: 'http://evil/x.jpg', thumb: '/uploads/a.jpg' })).status, 400);
  assert.equal((await call('/api/admin/scenes', 'POST', { name: 'x', image: '/uploads/../x.jpg', thumb: '/uploads/a.jpg' })).status, 400);
  const mk = async (name) => (await call('/api/admin/scenes', 'POST', { name, image: await upload(await jpg(80, 40)), thumb: await upload(await jpg(16, 8)) })).json;
  a = await mk('Cảnh A'); b = await mk('Cảnh B');
  const tour = (await call('/api/tour')).json;
  assert.equal(tour.scenes.length, 2);
  assert.equal(tour.firstSceneId, a.id);
});

let h;
test('hotspot create / validate / update / delete', async () => {
  assert.equal((await call(`/api/admin/scenes/${a.id}/hotspots`, 'POST', { pitch: 0, yaw: 0, target: a.id })).status, 400);
  assert.equal((await call(`/api/admin/scenes/${a.id}/hotspots`, 'POST', { pitch: 'x', yaw: 0, target: b.id })).status, 400);
  h = (await call(`/api/admin/scenes/${a.id}/hotspots`, 'POST', { pitch: 5, yaw: 200, text: 'Đi', target: b.id })).json;
  assert.equal(h.yaw, 180);
  const u = await call(`/api/admin/hotspots/${h.id}`, 'PATCH', { text: 'Mới', pitch: -3 });
  assert.equal(u.json.text, 'Mới'); assert.equal(u.json.pitch, -3);
  assert.equal((await call(`/api/admin/hotspots/${h.id}`, 'DELETE')).status, 200);
  assert.equal((await call('/api/tour')).json.scenes[0].hotspots.length, 0);
});

test('đổi tên, sắp xếp, cảnh mở đầu; xoá cảnh kéo theo hotspot và ảnh', async () => {
  await call(`/api/admin/scenes/${a.id}/hotspots`, 'POST', { pitch: 0, yaw: 0, target: b.id });
  const bImg = b.image.split('/').pop();
  assert.ok(store._assets.has(bImg));
  await call(`/api/admin/scenes/${b.id}`, 'PATCH', { name: 'B2', isFirst: true });
  assert.equal((await call('/api/tour')).json.firstSceneId, b.id);
  await call('/api/admin/reorder', 'POST', { ids: [b.id, a.id] });
  assert.equal((await call('/api/tour')).json.scenes[0].name, 'B2');
  assert.equal((await call('/api/admin/reorder', 'POST', { ids: [a.id] })).status, 400);
  await call(`/api/admin/scenes/${b.id}`, 'DELETE');
  const t = (await call('/api/tour')).json;
  assert.equal(t.scenes.length, 1); assert.equal(t.firstSceneId, a.id); assert.equal(t.scenes[0].hotspots.length, 0);
  assert.ok(!store._assets.has(bImg));
});

test('góc camera mặc định cho cảnh, tách laptop / điện thoại', async () => {
  const r = await call(`/api/admin/scenes/${a.id}`, 'PATCH', { view: { yaw: 400, pitch: 10, hfov: 90 } });
  assert.deepEqual(r.json.view, { yaw: 180, pitch: 10, hfov: 90 });
  assert.equal((await call(`/api/admin/scenes/${a.id}`, 'PATCH', { view: { yaw: 'x', pitch: 0, hfov: 90 } })).status, 400);
  const m = await call(`/api/admin/scenes/${a.id}`, 'PATCH', { device: 'mobile', view: { yaw: -50, pitch: 5, hfov: 70 } });
  assert.deepEqual(m.json.view, { yaw: 180, pitch: 10, hfov: 90 }); assert.deepEqual(m.json.viewMobile, { yaw: -50, pitch: 5, hfov: 70 });
  assert.equal((await call(`/api/admin/scenes/${a.id}`, 'PATCH', { device: 'mobile', view: null })).json.viewMobile, undefined);
  assert.equal((await call(`/api/admin/scenes/${a.id}`, 'PATCH', { view: null })).json.view, undefined);
});

test('trang chủ: hotspot, ảnh nền, vị trí trên điện thoại/tablet', async () => {
  const bId = (await call('/api/admin/scenes', 'POST', { name: 'C', image: await upload(await jpg(80, 40)), thumb: await upload(await jpg(16, 8)) })).json.id;
  assert.equal((await call('/api/admin/home/hotspots', 'POST', { x: 1, y: 1, target: 'nope' })).status, 400);
  const hs = (await call('/api/admin/home/hotspots', 'POST', { x: 5000, y: 100, text: 'T', target: bId })).json;
  assert.equal(hs.x, 1920);
  assert.equal((await call(`/api/admin/home/hotspots/${hs.id}`, 'PATCH', { x: 10, text: 'U' })).json.text, 'U');
  const url = await upload(await jpg(64, 36));
  assert.match((await call('/api/admin/home/bg', 'POST', { url })).json.bg, /^\/uploads\/.+\?v=\d+$/);
  assert.equal((await call('/api/admin/home/bg', 'POST', { url: 'https://x/y.jpg' })).status, 400);
  assert.equal((await call('/api/admin/home/focus', 'POST', { device: 'tv', x: 1 })).status, 400);
  await call('/api/admin/home/focus', 'POST', { device: 'phone', x: 5000 });
  const f = await call('/api/admin/home/focus', 'POST', { device: 'tablet', x: 700 });
  assert.deepEqual(f.json.focus, { phone: { x: 1920, y: 540 }, tablet: { x: 700, y: 540 } });
  await call(`/api/admin/scenes/${bId}`, 'DELETE');
  assert.ok(!(await call('/api/tour')).json.home.hotspots.some((x) => x.id === hs.id));
});

test('kích thước hotspot theo nền tảng', async () => {
  assert.equal((await call('/api/tour')).json.hotspotSize.phone, 44);
  const r = await call('/api/admin/settings', 'POST', { hotspotSize: { phone: 999, tablet: 60 } });
  assert.deepEqual(r.json, { desktop: 44, tablet: 60, phone: 120 });
  assert.equal((await call('/api/admin/settings', 'POST', { hotspotSize: { phone: 'x' } })).status, 400);
});

test('mặt bằng: di trú dữ liệu cũ, thay thế danh sách, kiểm tra hợp lệ', async () => {
  const f = (await call('/api/tour')).json.floors;
  assert.equal(f.items.length, 7);
  assert.ok(!f.bg && !f.items[0].card && !f.items[0].zone);
  assert.equal(f.defaultPano, '/home/rooftop.webp');
  const items = [{ id: 'f40', title: 'Tầng 41', sub: 'Sky', card: { x: 5000, y: 10 }, dot: { x: 800, y: 60 }, zone: [[1, 1], [100, 1], [100, 100]] }, { title: 'Mới', sub: '', card: { x: 1, y: 2 }, dot: { x: 3, y: 4 }, zone: [] }];
  const r = await call('/api/admin/floors', 'PUT', { items });
  assert.equal(r.json.items.length, 2); assert.equal(r.json.items[0].title, 'Tầng 41'); assert.ok(!r.json.items[0].card && !r.json.items[0].zone); assert.ok(r.json.items[1].id);
  assert.equal((await call('/api/admin/floors', 'PUT', { items: [{ title: 'x', units: [{ type: 'nope', x: 0, y: 0, w: 0.1, h: 0.1 }] }] })).status, 400);
  assert.equal((await call('/api/tour')).json.floors.items.length, 2);
  assert.equal((await call('/api/admin/floors/bg', 'POST', { url: await upload(await jpg(64, 36)) })).status, 404);
});

test('mặt bằng: khung hình video tách tầng theo thiết bị', async () => {
  const v = (await call('/api/tour')).json.split.view;
  assert.deepEqual(Object.keys(v), ['phone', 'phoneLand', 'tablet', 'desktop']);
  const r = await call('/api/admin/split', 'PATCH', { view: { phone: { cx: 0.4, cy: 2, zoom: 1.6, label: 0.2 }, bogus: { cx: 1 } } });
  assert.equal(r.status, 200); assert.deepEqual(r.json.view.phone, { cx: 0.4, cy: 1, zoom: 1.6, label: 0.2 }); assert.ok(!r.json.view.bogus);
  assert.equal((await call('/api/admin/split', 'PATCH', { view: { tablet: { zoom: 'x' } } })).status, 400);
  assert.equal((await call('/api/tour')).json.split.view.phone.zoom, 1.6);
});

test('mặt bằng: hotspot tiện ích & nhãn tầng sau khung cuối', async () => {
  const hs = (await call('/api/tour')).json.split.hotspots;
  assert.equal(hs.length, 9); assert.equal(hs.find((h) => h.id === 'sanh').gallery.length, 2); assert.ok(hs.find((h) => h.id === 'gym').pts.length >= 1);
  const r = await call('/api/admin/split/hotspots', 'PUT', { hotspots: [
    { id: 'gym', kind: 'card', title: 'Gym', x: 1.5, y: 0.2, pts: [[0.4, 0.5]], img: '/split/amenity/gym-card.webp', photo: 'javascript:alert(1)' },
    { kind: 'floor', title: 'Tầng', icon: 'x', floorId: 'f21', x: 0.5, y: 0.5 }] });
  assert.equal(r.status, 200); assert.equal(r.json[0].x, 1); assert.equal(r.json[0].img, '/split/amenity/gym-card.webp'); assert.ok(!r.json[0].photo);
  assert.equal(r.json[1].icon, 'apt'); assert.ok(r.json[1].id); assert.deepEqual(r.json[1].pts, []);
  assert.equal((await call('/api/admin/split/hotspots', 'PUT', { hotspots: [{ x: 'a', y: 0 }] })).status, 400);
  assert.equal((await call('/api/tour')).json.split.hotspots.length, 2);
});

test('mặt bằng: toạ độ theo khung cũ được đổi sang video V2 (khổ rộng)', async () => {
  const s = memStore();
  await s.putJson({ scenes: [], split: { hotspots: [{ id: 'gym', kind: 'card', title: 'Gym', x: 0.5, y: 0.3, pts: [[0, 0.4]] }], view: { desktop: { cx: 0.5, cy: 0.5, zoom: 1, label: 0.1 } } } });
  const d = await (await createApp({ store: s, env: {} }).handle(new Request('http://x/api/tour'))).json();
  assert.equal(d.split.frameVer, 2);
  assert.equal(d.split.hotspots[0].x, 0.4995); assert.deepEqual(d.split.hotspots[0].pts, [[0.099, 0.4]]);
  assert.equal(d.split.view.desktop.zoom, 1.286); assert.equal(d.split.view.phone.zoom, 2.144);
});

test('tầng tiện ích: sơ đồ và vùng tiện ích', async () => {
  const ap = (await call('/api/tour')).json.split.amenityPlan;
  assert.equal(ap.plan, '/split/amenity/plan4-3200.webp'); assert.equal(ap.items.length, 5);
  const r = await call('/api/admin/split/amenity-plan', 'PUT', { plan: 'https://evil/x.png', items: [{ id: 'gym', title: 'Gym', x: 0.9, y: -1, w: 0.5, h: 0.2, photo: '/split/amenity/gym-2048.webp' }] });
  assert.equal(r.status, 200); assert.equal(r.json.plan, '/split/amenity/plan4-3200.webp');
  assert.deepEqual(r.json.items[0], { id: 'gym', title: 'Gym', x: 0.9, y: 0, w: 0.1, h: 0.2, photo: '/split/amenity/gym-2048.webp' });
  assert.equal((await call('/api/admin/split/amenity-plan', 'PUT', { items: [{ x: 'a' }] })).status, 400);
});

test('ảnh 360 / 2D riêng của tầng và góc camera từng thiết bị', async () => {
  const items = (await call('/api/tour')).json.floors.items, id = items[0].id;
  assert.equal((await call(`/api/admin/floors/${id}/pano`, 'POST', { url: 'javascript:1' })).status, 400);
  const r = await call(`/api/admin/floors/${id}/pano`, 'POST', { url: await upload(await jpg(80, 40)) });
  assert.match(r.json.pano, /^\/uploads\//);
  assert.equal((await call(`/api/admin/floors/${id}/plan`, 'POST', { url: await upload(await png(50, 40)) })).status, 200);
  assert.equal((await call('/api/admin/floors/nope/plan', 'POST', { url: '/uploads/a.jpg' })).status, 404);
  const cur = (await call('/api/tour')).json.floors.items;
  cur[0].view = { yaw: 400, pitch: 5, hfov: 90 }; cur[0].viewMobile = { yaw: -20, pitch: 0, hfov: 70 };
  const out = (await call('/api/admin/floors', 'PUT', { items: cur })).json.items[0];
  assert.ok(out.pano && out.plan);
  assert.deepEqual(out.view, { yaw: 180, pitch: 5, hfov: 90 }); assert.deepEqual(out.viewMobile, { yaw: -20, pitch: 0, hfov: 70 });
});

test('vùng căn hộ trên mặt bằng và loại căn hộ', async () => {
  const f = (await call('/api/tour')).json.floors;
  for (const t of ['studio', 'pn2', 'pn3', 'dualkey', 'duplex', 'penthouse']) assert.ok(f.unitTypes.some((x) => x.id === t), t);
  const id = f.items[1].id;
  const r = await call(`/api/admin/floors/${id}/units`, 'PUT', { units: [{ type: 'pn3', label: '99', x: 0.5, y: 0.5, w: 0.9, h: 0.9 }] });
  assert.equal(r.status, 200); assert.equal(r.json[0].w, 0.5); assert.ok(r.json[0].id);
  assert.equal((await call(`/api/admin/floors/${id}/units`, 'PUT', { units: [{ type: 'nope', x: 0, y: 0, w: 0.1, h: 0.1 }] })).status, 400);
  assert.equal((await call(`/api/admin/floors/${id}/units`, 'PUT', { units: [{ type: 'pn3', x: 'a', y: 0, w: 0.1, h: 0.1 }] })).status, 400);
  assert.equal((await call('/api/admin/floors/zz/units', 'PUT', { units: [] })).status, 404);
  const kept = (await call('/api/admin/floors', 'PUT', { items: (await call('/api/tour')).json.floors.items })).json.items[1];
  assert.equal(kept.units.length, 1);
  const ty = await call('/api/admin/unit-types', 'PUT', { types: [{ id: 'pn3', name: 'Căn 3PN', color: '#112233' }, { id: 'studio', color: 'red' }] });
  assert.equal(ty.json.find((x) => x.id === 'pn3').name, 'Căn 3PN');
  assert.equal(ty.json.find((x) => x.id === 'studio').color, '#AFD3E0');
});

test('đường dẫn ảnh .jpg cũ trong dữ liệu đã lưu được đổi sang WebP', async () => {
  const s = memStore();
  await s.putJson({ firstSceneId: 's01', scenes: [{ id: 's01', name: 'A', image: '/uploads/s01.jpg', thumb: '/uploads/s01.thumb.jpg', hotspots: [] }], home: { bg: '/home/bg.jpg', hotspots: [] }, floors: { bg: '/home/matbang.jpg', defaultPano: '/home/rooftop.jpg', defaultPlan: '/home/plan2d.jpg', items: [] } });
  const r = await createApp({ store: s, env: {} }).handle(new Request('http://x/api/tour'));
  const d = await r.json();
  assert.equal(d.scenes[0].image, '/uploads/s01.webp'); assert.equal(d.scenes[0].thumb, '/uploads/s01.thumb.webp');
  assert.equal(d.home.bg, '/home/bg.webp'); assert.ok(!('bg' in d.floors));
  assert.equal(d.floors.defaultPano, '/home/rooftop.webp'); assert.equal(d.floors.defaultPlan, '/home/plan2d.webp');
});
