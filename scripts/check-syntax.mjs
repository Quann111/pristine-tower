import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) {
    try { new Function(m[1].replace(/\bimport\s[^;]+;/g, '').replace(/\bawait\b/g, '(0,0)&&') ); } catch (e) { console.log(f, 'SYNTAX', e.message); process.exitCode = 1; }
  }
}
console.log('checked');
