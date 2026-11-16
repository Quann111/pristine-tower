import sharp from 'sharp'; import fs from 'node:fs';
const src='C:/Users/ADMIN/Downloads/1/New folder (3)/';
const map=[['cam07','360_Cam07a_WM.png','a41440c63mvkog9vm','a9e5d2fe1mvkogcdc'],['cam01','360_Cam01.png','a086304e0mvkohcp5','ad8def226mvkohe9z'],['cam03','360_Cam03.png','aea12b56amvkoi73w','a713ab8fcmvkoi9w6'],['cam06','360_Cam06_WM.png','abf3d2538mvkojcaf','a547b7fd4mvkoje14']];
const o={limitInputPixels:false};
for(const [k,f,up,th] of map){
  const m=await sharp(src+f,o).metadata(); console.log(k,f,m.width,m.height);
  const buf=await sharp(src+f,o).resize(8192,4096,{kernel:'lanczos3'}).png({compressionLevel:1}).toBuffer();
  await sharp(buf,o).webp({quality:82,effort:6,smartSubsample:true}).toFile(`public/home/scenes/${k}-8k.webp`);
  await sharp(buf,o).resize(4096,2048).webp({quality:80,effort:6,smartSubsample:true}).toFile(`public/home/scenes/${k}-4k.webp`);
  await sharp(buf,o).resize(4096,2048).jpeg({quality:85,mozjpeg:true}).toFile(`public/uploads/${up}.jpg`);
  await sharp(buf,o).resize(480,240).jpeg({quality:80}).toFile(`public/uploads/${th}.jpg`);
}
