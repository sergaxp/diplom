/**
 * Генерация брендовых PNG-иконок (сова Warmingtea) из SVG через sharp.
 * Запуск:  node scripts/gen-brand-icons.mjs   (из apps/web)
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

const PINE = '#1F4A40';
const owl = `
    <path d="M14.5 3 L18.5 11 L11.5 11 Z" fill="#D2E0DB"/>
    <path d="M33.5 3 L36.5 11 L29.5 11 Z" fill="#D2E0DB"/>
    <path d="M24 7 C32.5 7 38 13.5 38 23 C38 34 31.5 42 24 42 C16.5 42 10 34 10 23 C10 13.5 15.5 7 24 7 Z" fill="#D2E0DB"/>
    <circle cx="16.6" cy="22" r="7" fill="#102B25"/>
    <circle cx="31.4" cy="22" r="7" fill="#102B25"/>
    <circle cx="17.6" cy="22.6" r="3.1" fill="#D99A45"/>
    <circle cx="30.4" cy="22.6" r="3.1" fill="#D99A45"/>
    <path d="M24 25.5 L21.7 27.6 Q24 29 26.3 27.6 Z" fill="#D99A45"/>`;

/** rx — скругление (0 = квадрат), scale/tx/ty — посадка совы внутри 48×48 */
function svg({ rx, scale, tx, ty }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="${rx}" fill="${PINE}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">${owl}
  </g>
</svg>`;
}

const rounded  = svg({ rx: 11, scale: 0.78, tx: 5.3,  ty: 6.45 }); // 192/512/favicon
const square   = svg({ rx: 0,  scale: 0.72, tx: 6.72, ty: 7.8  }); // apple-touch
const maskable = svg({ rx: 0,  scale: 0.62, tx: 9.12, ty: 10.05 }); // android adaptive (safe-zone)

const jobs = [
  ['icon-192.png',           rounded,  192],
  ['icon-512.png',           rounded,  512],
  ['icon-maskable-512.png',  maskable, 512],
  ['apple-touch-icon.png',   square,   180],
];

for (const [name, src, size] of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(join(PUBLIC, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
console.log('Готово.');
