// Saved desktop HFOV uses a 16:9 reference. Never stretch that angle onto
// a portrait canvas: keep vertical framing and cap both projection axes.
const rad = Math.PI / 180;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const verticalFov = (h, aspect) => 2 * Math.atan(Math.tan(h * rad / 2) / aspect) / rad;
export const horizontalFov = (v, aspect) => 2 * Math.atan(Math.tan(v * rad / 2) * aspect) / rad;
export function fovBounds(aspect) {
  return [Math.min(25, horizontalFov(30, aspect)), Math.min(110, horizontalFov(95, aspect))];
}
export function panoramaView(source = {}, width = 16, height = 9) {
  const aspect = width / height;
  const mobile = aspect < 1 && source.viewMobile;
  const saved = mobile || source.view || source;
  const reference = mobile ? 9 / 16 : 16 / 9;
  // Without a portrait preset, gently widen the vertical composition (up to
  // 90 degrees), rather than cropping a tall building to its middle floors.
  const baseV = verticalFov(Number(saved.hfov) || 100, reference);
  const v = !mobile && aspect < 1 ? Math.max(baseV, 90) : baseV;
  const [minHfov, maxHfov] = fovBounds(aspect);
  return { ...saved, hfov: clamp(horizontalFov(v, aspect), minHfov, maxHfov), minHfov, maxHfov };
}

// Preserve the user's direction and relative zoom on resize, including
// fullscreen, device rotation and a previously hidden interior dialog.
export function bindPanoramaView(viewer, element, sources) {
  let aspect = 0, baseline = 0, scene = null;
  const update = () => {
    const { width, height } = element.getBoundingClientRect();
    if (!width || !height) return;
    const id = viewer.getScene(), nextAspect = width / height;
    const view = panoramaView(sources[id] || {}, width, height);
    const nextBase = Math.tan(view.hfov * rad / 2) / nextAspect;
    const same = id === scene;
    const zoom = same && aspect && baseline
      ? Math.tan(viewer.getHfov() * rad / 2) / aspect / baseline : 1;
    viewer.setHfovBounds([view.minHfov, view.maxHfov]);
    if (!same || Math.abs(nextAspect - aspect) > 0.0001) {
      viewer.setHfov(clamp(2 * Math.atan(nextBase * zoom * nextAspect) / rad, view.minHfov, view.maxHfov), false);
    }
    scene = id; aspect = nextAspect; baseline = nextBase;
  };
  viewer.on('scenechange', update);
  viewer.on('load', update);
  const observer = new ResizeObserver(update);
  observer.observe(element);
  update();
  return () => { observer.disconnect(); viewer.off('scenechange', update); viewer.off('load', update); };
}
