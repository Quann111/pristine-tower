import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = path.resolve(process.argv[2] || '..');
const files = fs.readdirSync(src).filter((f) => /^360_.*\.png$/i.test(f)).sort();
fs.mkdirSync('uploads', { recursive: true });
fs.mkdirSync('data', { recursive: true });
const scenes = [];
for (const [i, f] of files.entries()) {
  const id = `s${String(i + 1).padStart(2, '0')}`;
  const buf = path.join(src, f);
  await sharp(buf, { limitInputPixels: false }).resize(4096, 2048, { fit: 'fill' }).jpeg({ quality: 82 }).toFile(`uploads/${id}.jpg`);
  await sharp(buf, { limitInputPixels: false }).resize(480, 240, { fit: 'fill' }).jpeg({ quality: 70 }).toFile(`uploads/${id}.thumb.jpg`);
  scenes.push({ id, name: `GÓC NHÌN ${String(i + 1).padStart(2, '0')}`, image: `/uploads/${id}.jpg`, thumb: `/uploads/${id}.thumb.jpg`, hotspots: [] });
  console.log('processed', f);
}
scenes.forEach((s, i) => {
  scenes.filter((t) => t !== s).forEach((t, k) => s.hotspots.push({ id: `h${i}${k}`, pitch: -10 + k * 4, yaw: -60 + k * 60, text: t.name, target: t.id }));
});
fs.writeFileSync('data/tour.json', JSON.stringify({ firstSceneId: scenes[0]?.id ?? null, scenes }, null, 2));
