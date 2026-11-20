import test from 'node:test';
import assert from 'node:assert/strict';
import { panoramaView, verticalFov, bindPanoramaView } from '../public/panorama-view.js';

test('portrait projection and zoom limits never expose extreme vertical angles', () => {
  for (const [w, h] of [[320,828],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080],[2560,1080]]) {
    for (const source of [{view:{hfov:100}}, {view:{hfov:120},viewMobile:{hfov:120}}, {hfov:110}]) {
      const v = panoramaView(source,w,h);
      assert(v.hfov <= 110);
      assert(verticalFov(v.hfov,w/h) <= 95.00001);
      assert(verticalFov(v.maxHfov,w/h) <= 95.00001);
      assert(v.minHfov < v.maxHfov);
    }
  }
});

test('rotation matches a fresh load, preserves zoom and does not reset on HQ reload', () => {
  let resize;
  const previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(fn) { resize=fn; } observe() {} disconnect() {} };
  try {
    let w=390,h=844,id='a',fov=50,bounds=[1,120];
    const handlers={};
    const viewer={getScene:()=>id,getHfov:()=>fov,setHfovBounds:b=>bounds=b,
      setHfov:n=>{fov=Math.max(bounds[0],Math.min(bounds[1],n));},on:(e,f)=>handlers[e]=f,off:()=>{}};
    const source={view:{hfov:100},viewMobile:{hfov:50}};
    const stop=bindPanoramaView(viewer,{getBoundingClientRect:()=>({width:w,height:h})},{a:source,b:{view:{hfov:90}}});
    w=844;h=390;resize();
    assert(Math.abs(fov-panoramaView(source,w,h).hfov)<1e-8);
    w=390;h=844;resize();
    assert(Math.abs(fov-panoramaView(source,w,h).hfov)<1e-8);
    fov=30;handlers.load();assert.equal(fov,30);
    w=0;h=0;resize();assert.equal(fov,30);
    w=390;h=844;resize();assert.equal(fov,30);
    id='b';handlers.scenechange();assert(Math.abs(fov-panoramaView({view:{hfov:90}},w,h).hfov)<1e-8);
    stop();
  } finally { globalThis.ResizeObserver=previous; }
});
