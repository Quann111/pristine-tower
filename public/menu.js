// Menu dùng chung, định vị theo viewport (công tắc FLYCAM/XOAY 360, thanh TỔNG THỂ/MẶT BẰNG, thanh công cụ). initMenu(root, 'fly' | 'xoay')
// đường dẫn hiện tại không kèm .html (Cloudflare tự bỏ .html)
const here = () => location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
export function initMenu(root, active, opts = {}) { // opts.tab: 'tongthe' | 'matbang'; opts.noToggle: ẩn công tắc
  if (!document.querySelector('link[href="/menu.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/menu.css">');
  root.classList.add('mn');
  root.insertAdjacentHTML('beforeend', `
  <div id="toggle" class="box ${active}"${opts.noToggle ? ' hidden' : ''}><div class="thumb"></div>${opts.toggleLabels ? `<a class="fly" href="#">${opts.toggleLabels[0]}</a><a class="xo" href="#">${opts.toggleLabels[1]}</a>` : '<a class="fly" href="/">Flycam</a><a class="xo" href="/xoay360.html">Xoay 360</a>'}</div>
  <div id="tool" class="box">
    <button class="fs" type="button" aria-label="Toàn màn hình"><svg viewBox="0 0 40 40" fill="none" stroke="#EFEEEA" stroke-width="2.5"><path d="M8 15V8h7M25 8h7v7M32 25v7h-7M15 32H8v-7"/></svg></button>
    <button class="sd" type="button" aria-label="Âm thanh"><svg viewBox="0 0 40 40" fill="none" stroke="#EFEEEA" stroke-width="2"><path d="M6 15h6l8-7v24l-8-7H6z" fill="#EFEEEA"/><path class="w" d="M25 14c3 3 3 9 0 12M29 10c5 5 5 15 0 20"/></svg></button>
  </div>
  <div id="tabs" class="box${opts.tab === 'matbang' ? ' t2on' : opts.tab === 'media' ? ' t3on' : ''}"><button class="t1" type="button">Tổng thể</button><button class="t2" type="button">Mặt bằng</button><button class="t3" type="button">Media</button><i class="ul"></i></div>`);
  if (opts.toggleLabels) {
    const tg = root.querySelector('#toggle');
    tg.querySelectorAll('a').forEach((el, i) => el.addEventListener('click', (e) => { e.preventDefault(); tg.classList.toggle('fly', i === 0); tg.classList.toggle('xoay', i === 1); if (opts.onToggle) opts.onToggle(i); }));
  }
  const tabs = root.querySelector('#tabs');
  root.querySelector('.t3').onclick = () => { tabs.classList.remove('t2on'); tabs.classList.add('t3on'); if (here() !== '/media') setTimeout(() => (location.href = '/media'), 120); };
  root.querySelector('.t1').onclick = () => { tabs.classList.remove('t2on', 't3on'); if (here() !== '/' && here() !== '/xoay360') setTimeout(() => (location.href = '/'), 120); };
  root.querySelector('.t2').onclick = () => { tabs.classList.remove('t3on'); tabs.classList.add('t2on'); if (here() !== '/phantang') setTimeout(() => (location.href = '/phantang'), 120); };
  prefetchPages();
  root.querySelector('.fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  let muted = false;
  root.querySelector('.sd').onclick = () => { muted = !muted; root.querySelector('.w').style.opacity = muted ? 0 : 1; };
}

// lúc rảnh: tải trước HTML các trang khác + khung đầu trang Mặt bằng để chuyển menu gần như tức thì
function prefetchPages() {
  const c = navigator.connection || {};
  if (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || '')) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  const run = () => idle(() => {
    const cur = here();
    const urls = ['/', '/phantang', '/media', '/matbang', '/xoay360', '/tienich'].filter((u) => u !== cur);
    if (cur === '/phantang') urls.push(`/split/${innerWidth * Math.min(devicePixelRatio || 1, 2) <= 1000 ? 960 : 1280}/f_00.webp?v=4`); // khung đầu video tách tầng
    for (const u of urls) {
      if (document.querySelector(`link[rel=prefetch][href="${u}"]`)) continue;
      const l = document.createElement('link'); l.rel = 'prefetch'; l.href = u; document.head.appendChild(l);
    }
  });
  if (document.readyState === 'complete') run(); else addEventListener('load', run, { once: true });
}

export const deviceOf = () => (innerWidth < 768 ? 'phone' : innerWidth < 1200 ? 'tablet' : 'desktop');
// Kích thước hotspot theo nền tảng (admin chỉnh) → biến CSS --hs
export function applyHotspotSize(sizes) {
  const set = () => document.documentElement.style.setProperty('--hs', ((sizes || {})[deviceOf()] || 44) + 'px');
  addEventListener('resize', set); set();
}
