import { DurableObject } from 'cloudflare:workers';
import { createApp } from './app.js';

// Tài liệu JSON (tour.json) nằm trong Durable Object: nhất quán tức thì ngay sau mỗi lần admin lưu (KV có thể trả dữ liệu cũ tới ~60s).
export class TourDB extends DurableObject {
  async getJson() { return (await this.ctx.storage.get('tour')) ?? null; }
  async putJson(obj) { await this.ctx.storage.put('tour', obj); }
}

// JSON → Durable Object; ảnh tải lên (tên ngẫu nhiên, không đổi nội dung) → KV ("a:<tên>").
function kvStore(env, request) {
  const kv = env.DB;
  return {
    async getJson() { return env.TOUR.getByName('main').getJson(); },
    async putJson(obj) { await env.TOUR.getByName('main').putJson(obj); },
    async getSeed() {
      const r = await env.ASSETS.fetch(new Request(new URL('/seed/tour.json', request.url)));
      return r.ok ? r.json() : null;
    },
    async getAsset(name) {
      const { value, metadata } = await kv.getWithMetadata(`a:${name}`, 'arrayBuffer');
      return value ? { data: value, type: (metadata && metadata.type) || 'application/octet-stream' } : null;
    },
    async putAsset(name, bytes, type) { await kv.put(`a:${name}`, bytes, { metadata: { type } }); },
    async deleteAsset(name) { await kv.delete(`a:${name}`); }
  };
}

export default {
  async fetch(request, env) {
    const url0 = new URL(request.url);
    // Chưa cấu hình mật khẩu admin (secret ADMIN_PASS) thì khoá đăng nhập thay vì dùng mật khẩu mặc định.
    if (!env.ADMIN_PASS && (url0.pathname === '/api/login' || url0.pathname.startsWith('/api/admin/'))) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình mật khẩu admin' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    const app = createApp({ store: kvStore(env, request), env });
    const res = await app.handle(request);
    if (res) return res;
    const url = new URL(request.url);
    if (url.pathname === '/admin') return Response.redirect(`${url.origin}/admin/`, 301);
    return env.ASSETS.fetch(request);
  }
};
