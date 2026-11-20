// Lõi API dùng chung cho Cloudflare Worker và máy chủ Node (chỉ dùng Web API chuẩn: Request/Response/crypto.subtle).
// Dữ liệu là MỘT tài liệu JSON (tour.json) lưu qua `store`; ảnh lưu dạng asset (nhị phân) qua `store`.

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_ASSET = 12 * 1024 * 1024;
const enc = new TextEncoder();

// ---------- dữ liệu mặc định & di trú ----------
// trang Mặt bằng cũ (thẻ/vùng trên ảnh toà nhà) đã bỏ: xoá các trường đó khỏi dữ liệu đã lưu
const migrateFloor = ({ card, dot, zone, side, y, ...it }) => it;
// trang Mặt bằng = video tách tầng chạy theo khung; khung hình theo từng thiết bị: điểm ảnh (cx, cy 0..1) đặt giữa màn, zoom so với vừa khít (contain), nhãn cách đáy (tỉ lệ chiều cao)
const SPLIT_DEVICES = ['phone', 'phoneLand', 'tablet', 'desktop'];
const DEFAULT_SPLIT_VIEW = { phone: { cx: 0.5, cy: 0.5, zoom: 1.7, label: 0.15 }, phoneLand: { cx: 0.5, cy: 0.5, zoom: 1, label: 0.2 }, tablet: { cx: 0.5, cy: 0.5, zoom: 1.45, label: 0.12 }, desktop: { cx: 0.5, cy: 0.5, zoom: 1, label: 0.118 } };
// hotspot hiện sau khung cuối: thẻ tiện ích (bấm xem ảnh) + nhãn tầng (mở trang tầng); x,y = tâm thẻ, pts = điểm gấp … điểm chỉ (0..1 theo khung video)
const DEFAULT_SPLIT_HOTSPOTS = [{"id":"kidzone","kind":"card","title":"Kidzone","x":0.1374,"y":0.3286,"pts":[[0.28,0.3259],[0.351,0.4234]],"img":"/split/amenity/kidzone-card.webp","photo":"/split/amenity/kidzone-2048.webp"},{"id":"gym","kind":"card","title":"Gym","x":0.7941,"y":0.353,"pts":[[0.6821,0.3502],[0.4503,0.399]],"img":"/split/amenity/gym-card.webp","photo":"/split/amenity/gym-2048.webp"},{"id":"healthhub","kind":"card","title":"Health Hub","x":0.1318,"y":0.5696,"pts":[[0.2548,0.5696],[0.3195,0.4979]],"img":"/split/amenity/healthhub2-card.webp","photo":"/split/amenity/healthhub2-2048.webp"},{"id":"pool","kind":"card","title":"Bể bơi","x":0.8209,"y":0.5534,"pts":[[0.6979,0.5561],[0.6269,0.5249]],"img":"/split/amenity/pool-card.webp","photo":"/split/amenity/pool-2048.webp"},{"id":"golf","kind":"card","title":"Golf","x":0.3439,"y":0.6875,"pts":[[0.3825,0.5222]],"img":"/split/amenity/golf-card.webp","photo":"/split/amenity/golf-2048.webp"},{"id":"shcd","kind":"card","title":"SHCĐ","x":0.7034,"y":0.8337,"pts":[[0.6033,0.8337],[0.5481,0.8134]],"img":"/split/amenity/shcd2-card.webp","photo":"/split/amenity/shcd2-2048.webp"},{"id":"flapt","kind":"floor","title":"Tầng căn hộ","icon":"apt","floorId":"f21","x":0.51,"y":0.2514,"pts":[]},{"id":"flamen","kind":"floor","title":"Tầng tiện ích","icon":"amen","floorId":"f13","x":0.51,"y":0.70,"pts":[]}];
const LOBBY_HOTSPOT = {"id": "sanh", "kind": "card", "title": "Sảnh", "x": 0.25, "y": 0.86, "pts": [[0.3, 0.86], [0.349, 0.845]], "img": "/split/amenity/hs-sanh.webp", "card": "/split/amenity/hs-sanh.webp", "gallery": [{"title": "Sảnh chính", "photos": ["/split/amenity/lobby/main2-06-2048.webp", "/split/amenity/lobby/main2-05-2048.webp", "/split/amenity/lobby/main2-01-2048.webp", "/split/amenity/lobby/main2-02-2048.webp", "/split/amenity/lobby/main2-03-2048.webp", "/split/amenity/lobby/main2-04-2048.webp"]}, {"title": "Sảnh thang", "photos": ["/split/amenity/lobby/lift-01-2048.webp", "/split/amenity/lobby/lift-02-2048.webp", "/split/amenity/lobby/lift-03-2048.webp", "/split/amenity/lobby/lift-04-2048.webp", "/split/amenity/lobby/lift-05-2048.webp", "/split/amenity/lobby/lift-06-2048.webp", "/split/amenity/lobby/lift-07-2048.webp", "/split/amenity/lobby/lift-08-2048.webp", "/split/amenity/lobby/lift-09-2048.webp", "/split/amenity/lobby/lift-10-2048.webp", "/split/amenity/lobby/lift-11-2048.webp", "/split/amenity/lobby/lift-12-2048.webp", "/split/amenity/lobby/lift-13-2048.webp", "/split/amenity/lobby/lift-14-2048.webp", "/split/amenity/lobby/lift-15-2048.webp"]}]};
const HS_CARD = ['sanh', 'kidzone', 'gym', 'healthhub', 'pool', 'golf', 'shcd', 'flapt', 'flamen'];
const SPLIT_IMG = /^\/(uploads\/[\w.-]+(\?v=\d+)?|split\/amenity\/(lobby\/)?[\w-]+\.webp)$/;
const cleanHotspots = (arr) => {
  if (!Array.isArray(arr) || arr.length > 30) throw new Error('Tối đa 30 hotspot');
  const xy = (q) => [+clampNum(q[0], 0, 1).toFixed(4), +clampNum(q[1], 0, 1).toFixed(4)];
  return arr.map((h, i) => {
    const o = { id: /^\w{1,20}$/.test(h.id || '') ? h.id : 'h' + Date.now().toString(36) + i, kind: h.kind === 'floor' ? 'floor' : 'card', title: String(h.title || '').slice(0, 40) };
    [o.x, o.y] = xy([h.x, h.y]);
    o.pts = (Array.isArray(h.pts) ? h.pts : []).slice(0, 8).map((q) => xy(Array.isArray(q) ? q : []));
    if (o.kind === 'floor') { o.icon = h.icon === 'amen' ? 'amen' : 'apt'; if (/^\w{1,20}$/.test(h.floorId || '')) o.floorId = h.floorId; }
    for (const k of ['img', 'photo', 'card']) if (typeof h[k] === 'string' && SPLIT_IMG.test(h[k])) o[k] = h[k];
    // bộ ảnh nhiều tab (vd. Sảnh chính / Sảnh thang)
    if (Array.isArray(h.gallery)) {
      const g = h.gallery.slice(0, 4).map((t) => ({ title: String((t && t.title) || '').slice(0, 30), photos: (Array.isArray(t && t.photos) ? t.photos : []).filter((u) => typeof u === 'string' && SPLIT_IMG.test(u)).slice(0, 40) })).filter((t) => t.photos.length);
      if (g.length) o.gallery = g;
    }
    return o;
  });
};
// trang Tầng tiện ích: sơ đồ + vùng từng tiện ích (x,y,w,h chuẩn hoá 0..1 trên ảnh sơ đồ), bấm mở ảnh
const DEFAULT_AMENITY_PLAN = {"plan":"/split/amenity/plan4-3200.webp","items":[{"id":"golf","title":"Golf","photo":"/split/amenity/golf-2048.webp","x":0.075,"y":0.469,"w":0.245,"h":0.239},{"id":"gym","title":"Gym","photo":"/split/amenity/gym-2048.webp","x":0.649,"y":0.016,"w":0.302,"h":0.429},{"id":"kidzone","title":"Kidzone","photo":"/split/amenity/kidzone-2048.webp","x":0.368,"y":0.016,"w":0.281,"h":0.243},{"id":"healthhub","title":"Health Hub","photo":"/split/amenity/healthhub2-2048.webp","x":0.071,"y":0.204,"w":0.172,"h":0.261},{"id":"pool","title":"Bể bơi","photo":"/split/amenity/pool-2048.webp","x":0.071,"y":0.711,"w":0.881,"h":0.282}]};
const cleanAmenityPlan = (b, cur) => {
  if (!Array.isArray(b.items) || b.items.length > 30) throw new Error('Tối đa 30 tiện ích');
  const n = (v) => +clampNum(v, 0, 1).toFixed(4);
  return {
    plan: typeof b.plan === 'string' && SPLIT_IMG.test(b.plan) ? b.plan : cur.plan,
    items: b.items.map((it, i) => {
      const o = { id: /^\w{1,20}$/.test(it.id || '') ? it.id : 'a' + Date.now().toString(36) + i, title: String(it.title || '').slice(0, 40), x: n(it.x), y: n(it.y), w: Math.max(0.005, n(it.w)), h: Math.max(0.005, n(it.h)) };
      o.w = +Math.min(o.w, 1 - o.x).toFixed(4); o.h = +Math.min(o.h, 1 - o.y).toFixed(4);
      if (typeof it.photo === 'string' && SPLIT_IMG.test(it.photo)) o.photo = it.photo;
      return o;
    })
  };
};
// trang Phân tầng (ảnh mặt đứng): nhãn tầng (ảnh có sẵn đường kẻ + chấm; x = mép trái, y = tâm, w = rộng) + khối tầng poly; toạ độ 0..1 theo ảnh
const ELEV_IMG = /^\/(uploads\/[\w.-]+(\?v=\d+)?|split\/matdung\/[\w-]+\.webp)$/;
const DEFAULT_ELEV = (() => {
  const E = (x, y) => [+(x / 2000).toFixed(4), +(y / 1125).toFixed(4)];
  // mép tầng: cong lên ở giữa theo phối cảnh (trái thấp hơn phải)
  const edge = (y, x0 = 903, x1 = 1140) => [0, .25, .5, .75, 1].map((t) => E(x0 + (x1 - x0) * t, y + 8 * (1 - t) - 22 * 4 * t * (1 - t)));
  const band = (y0, y1, a, b) => [...edge(y0, ...(a || [])), ...edge(y1, ...(b || [])).reverse()];
  const L = 630, R = 1155, W = 0.129;
  const it = (floorId, side, y, poly, target = 'floor') => ({ id: floorId, floorId, target, side, img: `/split/matdung/hs-${floorId}.webp`, x: +((side === 'l' ? L : R) / 2000).toFixed(4), y: +(y / 1125).toFixed(4), w: W, poly });
  return { bg: '/split/matdung/matdung-3200.webp', items: [
    it('f40', 'l', 211, band(212, 262)), it('f36', 'r', 270, band(262, 300)), it('f35', 'l', 331, band(300, 328)),
    it('f21', 'r', 434, band(328, 555)), it('f20', 'l', 589, band(555, 582)), it('f4', 'r', 741, band(582, 862)),
    // khối đế theo hình mẫu: mép trên gãy lên ở bên trái rồi gần phẳng, mép dưới phẳng, góc trái dưới vát nhẹ
    it('f13', 'l', 917, [[0.438, 0.7758], [0.4757, 0.7644], [0.5076, 0.762], [0.571, 0.7697], [0.571, 0.858], [0.4738, 0.858], [0.438, 0.8549]], 'amenity')
  ] };
})();
const cleanElev = (b, cur) => {
  if (!Array.isArray(b.items) || b.items.length > 20) throw new Error('Tối đa 20 tầng');
  const n = (v) => +clampNum(v, 0, 1).toFixed(4);
  return {
    bg: typeof b.bg === 'string' && ELEV_IMG.test(b.bg) ? b.bg : cur.bg,
    items: b.items.map((h, i) => {
      const o = { id: /^\w{1,20}$/.test(h.id || '') ? h.id : 'e' + Date.now().toString(36) + i, target: h.target === 'amenity' ? 'amenity' : 'floor', side: h.side === 'r' ? 'r' : 'l', x: n(h.x), y: n(h.y), w: Math.max(0.02, n(h.w)) };
      if (/^\w{1,20}$/.test(h.floorId || '')) o.floorId = h.floorId;
      if (typeof h.img === 'string' && ELEV_IMG.test(h.img)) o.img = h.img;
      o.poly = (Array.isArray(h.poly) ? h.poly : []).slice(0, 40).map((q) => [n((q || [])[0]), n((q || [])[1])]);
      return o;
    })
  };
};
// khung cũ (0..1) → khung V2: điểm trên mô hình theo mốc đo được; thẻ giữ chỗ trên màn (tỉ lệ 1.792/2.305)
const r4 = (v) => +Math.min(1, Math.max(0, v)).toFixed(4);
const onModel = (x) => r4(0.099 + 0.793 * x), onScreen = (x) => r4(0.111 + 0.777 * x);
function migrateSplitV2(sp) {
  for (const h of sp.hotspots || []) {
    h.x = h.kind === 'floor' ? onModel(h.x) : onScreen(h.x);
    h.pts = (h.pts || []).map(([x, y]) => [onModel(x), y]);
  }
  const v = sp.view || {}, K = 2305 / 1792;
  // máy tính / điện thoại ngang: chiều cao ảnh như cũ; màn dọc: toà nhà rộng như cũ
  for (const k of ['desktop', 'phoneLand']) if (v[k]) { v[k].zoom = +(v[k].zoom * K).toFixed(3); v[k].cx = onModel(v[k].cx); }
  for (const k of ['phone', 'tablet']) if (v[k]) { v[k].zoom = +(v[k].zoom / 0.793).toFixed(3); v[k].cx = onModel(v[k].cx); }
  sp.frameVer = 2;
}
const cleanView = (v, d) => ({ cx: clampNum(v.cx ?? d.cx, 0, 1), cy: clampNum(v.cy ?? d.cy, 0, 1), zoom: clampNum(v.zoom ?? d.zoom, 0.3, 3), label: clampNum(v.label ?? d.label, 0, 0.6) });
const R = (x0, y0, x1, y1) => ({ x: +(x0 / 2000).toFixed(4), y: +(y0 / 1598).toFixed(4), w: +((x1 - x0) / 2000).toFixed(4), h: +((y1 - y0) / 1598).toFixed(4) });
const DEMO_UNITS = [
  ['pn15', '06', R(258, 490, 478, 660)], ['pn15', '12', R(1240, 225, 1410, 445)], ['pn15', '17', R(1333, 830, 1550, 1005)], ['pn15', '21', R(1060, 1100, 1275, 1280)],
  ['studio', '09', R(703, 515, 840, 725)], ['studio', '12A', R(1415, 262, 1520, 445)], ['studio', '16', R(1335, 712, 1550, 830)], ['studio', '22', R(1060, 985, 1280, 1095)],
  ['pn22', '07', R(258, 225, 480, 490)], ['pn22', '08', R(480, 225, 700, 510)], ['pn22', '10', R(885, 515, 1050, 725)], ['pn22', '12B', R(1520, 225, 1790, 445)], ['pn22', '18', R(1335, 1010, 1550, 1280)],
  ['pn21', '15', R(1560, 505, 1790, 710)],
  ['pn3', '11', R(1060, 225, 1275, 615)], ['pn3', '03', R(258, 1065, 540, 1445)], ['pn3', '20', R(1015, 1275, 1280, 1550)], ['pn3', '19', R(1280, 1275, 1680, 1500)]
].map(([type, label, r], i) => ({ id: 'u' + i, type, label, ...r }));
const DEFAULT_TYPES = [
  { id: 'studio', name: 'Căn hộ Studio', color: '#AFD3E0' }, { id: 'pn2', name: 'Căn hộ 2 PN', color: '#D69F70' },
  { id: 'pn3', name: 'Căn hộ 3 PN', color: '#F5806A' }, { id: 'dualkey', name: 'Căn hộ Dual key', color: '#B9A3D6' },
  { id: 'duplex', name: 'Căn hộ Duplex', color: '#9FC39B' }, { id: 'penthouse', name: 'Penthouse', color: '#E3C16F' },
  { id: 'pn15', name: 'Căn hộ 1.5 PN', color: '#DDBBB0' }, { id: 'pn22', name: 'Căn hộ 2 PN, 2 VS', color: '#E9E5DB' }, { id: 'pn21', name: 'Căn hộ 2 PN, 1 VS', color: '#D69F70' }];
const DEFAULT_SPOTS = [[928, 858], [936, 507], [626, 436], [767, 226]];

// ảnh cũ (.jpg) đã được thay bằng WebP nhẹ hơn: đổi đường dẫn trong dữ liệu đã lưu
const LEGACY = { '/home/bg.jpg': '/home/bg.webp', '/home/rooftop.jpg': '/home/rooftop.webp', '/home/plan2d.jpg': '/home/plan2d.webp', '/uploads/a5fb89ce1mvks2wis.jpg': '/uploads/a5fb89ce1mvks2wis.webp' };
const fixPath = (u) => (typeof u !== 'string' ? u : LEGACY[u] || LEGACY[u.split('?')[0]] || u.replace(/^(\/uploads\/s0[1-4])(\.thumb)?\.jpg$/, '$1$2.webp'));

function normalize(db) {
  for (const sc of db.scenes || []) { sc.image = fixPath(sc.image); sc.thumb = fixPath(sc.thumb); }
  if (db.home) db.home.bg = fixPath(db.home.bg);
  if (db.floors) { delete db.floors.bg; db.floors.defaultPano = fixPath(db.floors.defaultPano); db.floors.defaultPlan = fixPath(db.floors.defaultPlan); }
  db.scenes = db.scenes || [];
  if (db.firstSceneId === undefined) db.firstSceneId = db.scenes[0] ? db.scenes[0].id : null;
  if (db.home && db.home.focusMobile && !db.home.focus) { db.home.focus = { phone: db.home.focusMobile }; delete db.home.focusMobile; }
  if (!db.floors) {
    db.floors = { title: 'Phân tầng chức năng', items: [
      { id: 'f40', title: 'Tầng 40', sub: 'Penthouse' },
      { id: 'f35', title: 'Tầng 35', sub: 'Dualkey' },
      { id: 'f20', title: 'Tầng 20', sub: 'Lánh nạn' },
      { id: 'f13', title: 'Tầng 1 đến 3', sub: 'Tiện ích' },
      { id: 'f36', title: 'Tầng 36 đến 39', sub: 'Duplex' },
      { id: 'f21', title: 'Tầng 21 đến 34', sub: 'Căn hộ' },
      { id: 'f4', title: 'Tầng 4 đến 19', sub: 'Căn hộ' }] };
  }
  db.floors.items = db.floors.items.map(migrateFloor);
  db.floors.unitTypes = db.floors.unitTypes || DEFAULT_TYPES.map((t) => ({ ...t }));
  for (const t of DEFAULT_TYPES) if (!db.floors.unitTypes.some((x) => x.id === t.id)) db.floors.unitTypes.push({ ...t });
  for (const it of db.floors.items) if (!it.units) it.units = it.plan ? [] : JSON.parse(JSON.stringify(DEMO_UNITS));
  db.floors.defaultPano = db.floors.defaultPano || '/home/rooftop.webp';
  db.floors.defaultPlan = (!db.floors.defaultPlan || db.floors.defaultPlan === '/home/plan2d.jpg') ? '/home/plan2d.webp' : db.floors.defaultPlan;
  db.split = db.split || {};
  db.split.view = Object.fromEntries(SPLIT_DEVICES.map((k) => [k, { ...DEFAULT_SPLIT_VIEW[k], ...((db.split.view || {})[k]) }]));
  if (!Array.isArray(db.split.hotspots)) db.split.hotspots = JSON.parse(JSON.stringify(DEFAULT_SPLIT_HOTSPOTS));
  // video tách tầng V2 (3540x1536) rộng hơn V1 (2752x1536): đổi toạ độ đã lưu theo khung cũ một lần
  if (db.split.frameVer !== 2) migrateSplitV2(db.split);
  // thêm hotspot Sảnh một lần (cờ để admin xoá rồi thì không tự thêm lại)
  if (!db.split.lobbyAdded) { if (!db.split.hotspots.some((h) => h.id === 'sanh')) db.split.hotspots.push(JSON.parse(JSON.stringify(LOBBY_HOTSPOT))); db.split.lobbyAdded = true; }
  // nhãn tầng trỏ tới tầng không còn tồn tại (mặc định cũ f21) → tầng căn hộ 21–34 hoặc tầng đầu
  for (const h of db.split.hotspots) if (h.kind === 'floor' && h.icon !== 'amen' && !db.floors.items.some((x) => x.id === h.floorId)) h.floorId = (db.floors.items.find((x) => /21/.test(x.title)) || db.floors.items[0] || {}).id;
  // ảnh thẻ hotspot thiết kế sẵn (tiêu đề, nút, viền in trong ảnh) cho các mục mặc định
  for (const h of db.split.hotspots) if (!h.card && HS_CARD.includes(h.id)) h.card = `/split/amenity/hs-${h.id}.webp`;
  if (!db.split.amenityPlan) db.split.amenityPlan = JSON.parse(JSON.stringify(DEFAULT_AMENITY_PLAN));
  if (!db.elev) db.elev = JSON.parse(JSON.stringify(DEFAULT_ELEV));
  db.hotspotSize = Object.assign({ desktop: 44, tablet: 44, phone: 44 }, db.hotspotSize);
  if (!db.home) {
    db.home = { bg: '/home/bg.webp', hotspots: DEFAULT_SPOTS.slice(0, db.scenes.length).map(([x, y], i) => ({ id: `home${i}`, x, y, text: db.scenes[i].name, target: db.scenes[i].id })) };
  }
  return db;
}

// ---------- tiện ích ----------
const clampNum = (v, min, max) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error('Giá trị không hợp lệ'); return Math.min(max, Math.max(min, n)); };
const rand = (n = 4) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const uid = (p) => p + rand(4);
const cleanUnits = (arr, types) => (Array.isArray(arr) ? arr : []).slice(0, 200).map((u, i) => {
  if (!types.some((t) => t.id === u.type)) throw new Error('Loại căn hộ không hợp lệ');
  const x = clampNum(u.x, 0, 1), y = clampNum(u.y, 0, 1), w = clampNum(u.w, 0.004, 1), h = clampNum(u.h, 0.004, 1);
  return { id: /^\w{1,20}$/.test(u.id || '') ? u.id : 'u' + Date.now().toString(36) + i, type: u.type, label: String(u.label || '').slice(0, 8), x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
});
// chỉ nhận ảnh đã tải lên: /uploads/<tên>[?v=số]
const UPLOAD_URL = /^\/uploads\/[\w.-]+(\?v=\d+)?$/;
const checkUrl = (u) => { if (typeof u !== 'string' || !UPLOAD_URL.test(u)) throw new Error('Địa chỉ ảnh không hợp lệ'); return u; };
const bust = (u) => (u.includes('?') ? u : `${u}?v=${Date.now()}`);

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

function sniffType(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/**
 * store: { getJson(), putJson(obj), getSeed(), getAsset(name) → {data,type}|null, putAsset(name, bytes, type), deleteAsset(name) }
 * env:   { ADMIN_USER, ADMIN_PASS, SESSION_SECRET }
 */
export function createApp({ store, env = {}, now = () => Date.now() }) {
  const user = env.ADMIN_USER || 'admin', pass = env.ADMIN_PASS || 'admin123';
  const secret = env.SESSION_SECRET || `pt:${pass}`;
  const TTL = 12 * 3600 * 1000;

  const send = (code, body) => new Response(JSON.stringify(body), { status: code, headers: JSON_HEADERS });
  const readJson = async (req) => { const t = await req.text(); if (t.length > 1e6) throw new Error('Dữ liệu quá lớn'); return t ? JSON.parse(t) : {}; };
  const load = async () => normalize((await store.getJson()) || (await store.getSeed()) || { firstSceneId: null, scenes: [] });
  const save = (db) => store.putJson(db);

  const makeToken = async () => { const exp = (now() + TTL).toString(36); return `${exp}.${await hmac(secret, exp)}`; };
  const verifyToken = async (t) => {
    const [exp, sig] = String(t || '').split('.');
    if (!exp || !sig || parseInt(exp, 36) < now()) return false;
    return safeEq(sig, await hmac(secret, exp));
  };

  async function admin(req, p, m) {
    const db = await load();
    let mm;

    // tải ảnh đã xử lý ở trình duyệt lên kho
    if (p === '/api/admin/assets' && m === 'POST') {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_ASSET) return send(400, { error: 'Ảnh rỗng hoặc quá lớn (tối đa 12MB)' });
      const type = sniffType(bytes);
      if (!type || !ALLOWED_TYPES[type]) return send(400, { error: 'Chỉ nhận ảnh JPG, PNG hoặc WebP' });
      const name = `${uid('a')}${now().toString(36)}.${ALLOWED_TYPES[type]}`;
      await store.putAsset(name, bytes, type);
      return send(201, { url: `/uploads/${name}` });
    }
    if (p === '/api/admin/scenes' && m === 'POST') {
      const b = await readJson(req);
      try {
        const id = uid('s');
        const scene = { id, name: String(b.name || 'Góc nhìn mới').trim().slice(0, 80) || 'Góc nhìn mới', image: checkUrl(b.image), thumb: checkUrl(b.thumb), hotspots: [] };
        db.scenes.push(scene);
        if (!db.firstSceneId) db.firstSceneId = id;
        await save(db); return send(201, scene);
      } catch (e) { return send(400, { error: e.message }); }
    }
    if (p === '/api/admin/home/bg' && m === 'POST') {
      try { db.home.bg = bust(checkUrl((await readJson(req)).url)); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.home);
    }
    if (p === '/api/admin/split/amenity-plan' && m === 'PUT') {
      const b = await readJson(req);
      try { db.split.amenityPlan = cleanAmenityPlan(b, db.split.amenityPlan); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.split.amenityPlan);
    }
    if (p === '/api/admin/elev' && m === 'PUT') {
      const b = await readJson(req);
      try { db.elev = cleanElev(b, db.elev); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.elev);
    }
    if (p === '/api/admin/split/hotspots' && m === 'PUT') {
      const b = await readJson(req);
      try { db.split.hotspots = cleanHotspots(b.hotspots); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.split.hotspots);
    }
    if (p === '/api/admin/split' && (m === 'PATCH' || m === 'PUT')) {
      const b = await readJson(req);
      try {
        for (const k of SPLIT_DEVICES) if (b.view && b.view[k] && typeof b.view[k] === 'object') db.split.view[k] = cleanView(b.view[k], db.split.view[k]);
      } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.split);
    }
    if (p === '/api/admin/floors' && (m === 'PATCH' || m === 'PUT')) {
      const b = await readJson(req);
      try {
        if (typeof b.title === 'string') db.floors.title = b.title.slice(0, 80);
        if (Array.isArray(b.items)) {
          if (b.items.length > 40) throw new Error('Tối đa 40 mục');
          db.floors.items = b.items.map((it) => ({
            id: /^\w{1,20}$/.test(it.id || '') ? it.id : uid('f'),
            title: String(it.title || '').slice(0, 40), sub: String(it.sub || '').slice(0, 40),
            ...(['pano', 'plan'].reduce((o, k) => { const v = it[k]; if (typeof v === 'string' && UPLOAD_URL.test(v)) o[k] = v; return o; }, {})),
            ...(['view', 'viewMobile'].reduce((o, k) => { const v = it[k]; if (v && typeof v === 'object') o[k] = { yaw: clampNum(v.yaw, -180, 180), pitch: clampNum(v.pitch, -90, 90), hfov: clampNum(v.hfov, 30, 120) }; return o; }, {})),
            units: cleanUnits(it.units !== undefined ? it.units : (db.floors.items.find((x) => x.id === it.id) || {}).units, db.floors.unitTypes)
          }));
        }
      } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.floors);
    }
    if ((mm = p.match(/^\/api\/admin\/floors\/(\w+)\/(pano|plan)$/)) && m === 'POST') {
      const item = db.floors.items.find((x) => x.id === mm[1]);
      if (!item) return send(404, { error: 'Không tìm thấy mục' });
      try { item[mm[2]] = bust(checkUrl((await readJson(req)).url)); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, item);
    }
    if ((mm = p.match(/^\/api\/admin\/floors\/(\w+)\/units$/)) && m === 'PUT') {
      const item = db.floors.items.find((x) => x.id === mm[1]);
      if (!item) return send(404, { error: 'Không tìm thấy mục' });
      const b = await readJson(req);
      try { item.units = cleanUnits(b.units, db.floors.unitTypes); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, item.units);
    }
    if (p === '/api/admin/unit-types' && m === 'PUT') {
      const b = await readJson(req);
      for (const t of Array.isArray(b.types) ? b.types : []) {
        const cur = db.floors.unitTypes.find((x) => x.id === t.id);
        if (!cur) continue;
        if (typeof t.name === 'string' && t.name.trim()) cur.name = t.name.trim().slice(0, 40);
        if (typeof t.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.color)) cur.color = t.color;
      }
      await save(db); return send(200, db.floors.unitTypes);
    }
    if (p === '/api/admin/settings' && m === 'POST') {
      const b = await readJson(req);
      try {
        const next = { ...db.hotspotSize };
        for (const k of ['desktop', 'tablet', 'phone']) if (b.hotspotSize && b.hotspotSize[k] !== undefined) next[k] = Math.round(clampNum(b.hotspotSize[k], 16, 120));
        db.hotspotSize = next;
      } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.hotspotSize);
    }
    if (p === '/api/admin/home/focus' && m === 'POST') {
      const b = await readJson(req);
      try { if (!['phone', 'tablet'].includes(b.device)) throw new Error('Thiết bị không hợp lệ'); db.home.focus = Object.assign({}, db.home.focus, { [b.device]: { x: clampNum(b.x, 0, 1920), y: 540 } }); } catch (e) { return send(400, { error: e.message }); }
      await save(db); return send(200, db.home);
    }
    if (p === '/api/admin/home/hotspots' && m === 'POST') {
      const b = await readJson(req);
      try {
        if (!db.scenes.some((x) => x.id === b.target)) throw new Error('Cảnh đích không hợp lệ');
        const h = { id: uid('home'), x: clampNum(b.x, 0, 1920), y: clampNum(b.y, 0, 1080), text: String(b.text || '').slice(0, 80), target: b.target };
        db.home.hotspots.push(h); await save(db); return send(201, h);
      } catch (e) { return send(400, { error: e.message }); }
    }
    if ((mm = p.match(/^\/api\/admin\/home\/hotspots\/(\w+)$/))) {
      const h = db.home.hotspots.find((x) => x.id === mm[1]);
      if (!h) return send(404, { error: 'Không tìm thấy hotspot' });
      if (m === 'PATCH') {
        const b = await readJson(req);
        try {
          if (b.x !== undefined) h.x = clampNum(b.x, 0, 1920);
          if (b.y !== undefined) h.y = clampNum(b.y, 0, 1080);
          if (b.text !== undefined) h.text = String(b.text).slice(0, 80);
          if (b.target !== undefined) { if (!db.scenes.some((x) => x.id === b.target)) throw new Error('Cảnh đích không hợp lệ'); h.target = b.target; }
        } catch (e) { return send(400, { error: e.message }); }
        await save(db); return send(200, h);
      }
      if (m === 'DELETE') { db.home.hotspots = db.home.hotspots.filter((x) => x !== h); await save(db); return send(200, { ok: true }); }
    }
    if (p === '/api/admin/reorder' && m === 'POST') {
      const { ids } = await readJson(req);
      const map = new Map(db.scenes.map((s) => [s.id, s]));
      if (!Array.isArray(ids) || ids.length !== db.scenes.length || ids.some((i) => !map.has(i))) return send(400, { error: 'Danh sách không hợp lệ' });
      db.scenes = ids.map((i) => map.get(i)); await save(db); return send(200, db);
    }
    if ((mm = p.match(/^\/api\/admin\/scenes\/([\w]+)$/))) {
      const scene = db.scenes.find((s) => s.id === mm[1]);
      if (!scene) return send(404, { error: 'Không tìm thấy cảnh' });
      if (m === 'PATCH') {
        const b = await readJson(req);
        if (typeof b.name === 'string' && b.name.trim()) scene.name = b.name.trim().slice(0, 80);
        if (b.isFirst) db.firstSceneId = scene.id;
        const vk = b.device === 'mobile' ? 'viewMobile' : 'view';
        if (b.view === null) delete scene[vk];
        else if (b.view) {
          try { scene[vk] = { yaw: clampNum(b.view.yaw, -180, 180), pitch: clampNum(b.view.pitch, -90, 90), hfov: clampNum(b.view.hfov, 30, 120) }; }
          catch (e) { return send(400, { error: e.message }); }
        }
        await save(db); return send(200, scene);
      }
      if (m === 'DELETE') {
        db.scenes = db.scenes.filter((s) => s !== scene);
        for (const s of db.scenes) s.hotspots = s.hotspots.filter((h) => h.target !== scene.id);
        db.home.hotspots = db.home.hotspots.filter((h) => h.target !== scene.id);
        if (db.firstSceneId === scene.id) db.firstSceneId = db.scenes[0]?.id ?? null;
        await save(db);
        for (const f of [scene.image, scene.thumb]) { try { await store.deleteAsset(String(f).split('/').pop().split('?')[0]); } catch (e) { /* ảnh gốc đi kèm bản triển khai: bỏ qua */ } }
        return send(200, { ok: true });
      }
    }
    if ((mm = p.match(/^\/api\/admin\/scenes\/(\w+)\/hotspots$/)) && m === 'POST') {
      const scene = db.scenes.find((s) => s.id === mm[1]);
      if (!scene) return send(404, { error: 'Không tìm thấy cảnh' });
      const b = await readJson(req);
      try {
        if (!db.scenes.some((s) => s.id === b.target) || b.target === scene.id) throw new Error('Cảnh đích không hợp lệ');
        const h = { id: uid('h'), pitch: clampNum(b.pitch, -90, 90), yaw: clampNum(b.yaw, -180, 180), text: String(b.text || '').slice(0, 80), target: b.target };
        scene.hotspots.push(h); await save(db); return send(201, h);
      } catch (e) { return send(400, { error: e.message }); }
    }
    if ((mm = p.match(/^\/api\/admin\/hotspots\/(\w+)$/))) {
      const scene = db.scenes.find((s) => s.hotspots.some((h) => h.id === mm[1]));
      if (!scene) return send(404, { error: 'Không tìm thấy hotspot' });
      const h = scene.hotspots.find((x) => x.id === mm[1]);
      if (m === 'PATCH') {
        const b = await readJson(req);
        try {
          if (b.pitch !== undefined) h.pitch = clampNum(b.pitch, -90, 90);
          if (b.yaw !== undefined) h.yaw = clampNum(b.yaw, -180, 180);
          if (b.text !== undefined) h.text = String(b.text).slice(0, 80);
          if (b.target !== undefined) {
            if (!db.scenes.some((s) => s.id === b.target) || b.target === scene.id) throw new Error('Cảnh đích không hợp lệ');
            h.target = b.target;
          }
        } catch (e) { return send(400, { error: e.message }); }
        await save(db); return send(200, h);
      }
      if (m === 'DELETE') { scene.hotspots = scene.hotspots.filter((x) => x !== h); await save(db); return send(200, { ok: true }); }
    }
    return send(404, { error: 'Not found' });
  }

  // Trả về Response, hoặc null nếu đây không phải đường dẫn của API (để lớp ngoài phục vụ file tĩnh).
  async function handle(req) {
    const url = new URL(req.url);
    let p; try { p = decodeURIComponent(url.pathname); } catch { return send(400, { error: 'Đường dẫn không hợp lệ' }); }
    const m = req.method;
    try {
      // trang công khai: trình duyệt dùng ngay bản đã lưu, đồng thời hỏi bản mới ở nền (admin luôn tải bản mới)
      if (p === '/api/tour' && m === 'GET') return new Response(JSON.stringify(await load()), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=0, stale-while-revalidate=86400' } });
      if (p === '/api/login' && m === 'POST') {
        const b = await readJson(req);
        if (typeof b.user === 'string' && typeof b.pass === 'string' && safeEq(b.user, user) && safeEq(b.pass, pass)) return send(200, { token: await makeToken() });
        return send(401, { error: 'Sai tài khoản hoặc mật khẩu' });
      }
      if (p.startsWith('/api/admin/')) {
        const tok = (req.headers.get('authorization') || '').replace('Bearer ', '');
        if (!(await verifyToken(tok))) return send(401, { error: 'Chưa đăng nhập' });
        return await admin(req, p, m);
      }
      if (p.startsWith('/uploads/') && m === 'GET') {
        const a = await store.getAsset(p.slice('/uploads/'.length));
        if (!a) return null;
        return new Response(a.data, { headers: { 'Content-Type': a.type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
      }
      if (p.startsWith('/api/')) return send(404, { error: 'Not found' });
      return null;
    } catch (e) {
      return send(500, { error: e.message });
    }
  }

  return { handle };
}
