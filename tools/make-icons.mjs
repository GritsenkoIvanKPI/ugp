// Renders the favicon set and the social-share images (Open Graph) with headless Chrome.
//
//   node tools/make-icons.mjs        (dev server must run: PORT=3100 node serve.mjs)
//
// Writes favicon.ico, assets/icons/*, assets/img/og-uk.jpg and assets/img/og-en.jpg.
// Re-run it when the logo, the headline or the hero photo changes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://localhost:3100';
const NAVY = '#16202e';
const PAGE = '#fafafa';

// The logo mark (Logo 9.svg) and its centre, as used in the header
const MARK = 'M20 18.7695V69.5886C20 76.3584 25.488 81.8465 32.2579 81.8465H76.5649V41.6253M42.8558 60.7783V38.9439C42.8558 32.1741 48.3438 26.6861 55.1137 26.6861H84.2261';
const markSvg = ({ scale, radius }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${radius}" fill="${NAVY}"/>` +
  `<g transform="translate(50 50) scale(${scale}) translate(-49.04 -53.39)"><path d="${MARK}" fill="none" stroke="${PAGE}" stroke-width="12.3077"/></g></svg>`;

const icons = path.join(root, 'assets/icons');
fs.mkdirSync(icons, { recursive: true });

// Browser-tab icon (rounded) and home-screen icons (full bleed, mark inside the maskable safe zone)
const tabSvg = markSvg({ scale: 0.72, radius: 18 });
const appSvg = markSvg({ scale: 0.6, radius: 0 });
fs.writeFileSync(path.join(icons, 'icon.svg'), tabSvg + '\n');

const browser = await puppeteer.launch();
const page = await browser.newPage();

const renderSvg = async (svg, px) => {
  await page.setViewport({ width: px, height: px, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${svg}`);
  return page.screenshot({ type: 'png', omitBackground: true });
};

fs.writeFileSync(path.join(icons, 'apple-touch-icon.png'), await renderSvg(appSvg, 180));
fs.writeFileSync(path.join(icons, 'icon-192.png'), await renderSvg(appSvg, 192));
fs.writeFileSync(path.join(icons, 'icon-512.png'), await renderSvg(appSvg, 512));

// favicon.ico: PNG frames at 16, 32 and 48 px inside an ICO container
const frames = [];
for (const px of [16, 32, 48]) frames.push({ px, data: await renderSvg(tabSvg, px) });
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ px, data }, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(px, e); header.writeUInt8(px, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += data.length;
});
fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([header, ...frames.map((f) => f.data)]));

// Open Graph images, 1200 x 630, one per language. The logo lockup is taken from the header.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lockup = html.match(/<svg class="logo-svg hidden[^>]*>[\s\S]*?<\/svg>/)[0]
  .replace(/class="[^"]*"/, '').replace(/ aria-hidden="true" focusable="false"/, '');

const COPY = {
  uk: {
    title: 'Реалізація інвестиційних проєктів в&nbsp;Україні',
    sub: 'Від аналізу активу до&nbsp;працюючого об’єкта: Due&nbsp;Diligence, дозволи, громади, девелопмент.',
    foot: 'Первинна консультація безкоштовна',
  },
  en: {
    title: 'Delivering investment projects in&nbsp;Ukraine',
    sub: 'From asset analysis to&nbsp;a&nbsp;working asset: due diligence, permits, communities, development.',
    foot: 'The first consultation is free',
  },
};

for (const [lang, c] of Object.entries(COPY)) {
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });   // same origin, so fonts and photos load
  await page.setContent(`<!doctype html><html lang="${lang}"><head><base href="${BASE}/">
<link rel="stylesheet" href="assets/css/site.css">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  .card { position: relative; isolation: isolate; display: grid; grid-template-columns: 1fr 440px; width: 1200px; height: 630px; background: ${NAVY}; color: ${PAGE}; }
  .card::before { content: ''; position: absolute; inset: 0; z-index: -1; background:
    radial-gradient(52rem 28rem at 8% -12%, rgba(137,161,194,.2), transparent 62%),
    radial-gradient(40rem 26rem at 70% 120%, rgba(20,68,134,.32), transparent 64%); }
  .text { display: flex; flex-direction: column; padding: 64px 56px 56px 72px; }
  .text svg { width: 300px; height: auto; color: ${PAGE}; }
  h1 { margin: auto 0 0; font: 500 60px/1.1 Onest, Arial, sans-serif; letter-spacing: -.035em; text-wrap: balance; }
  p { margin: 22px 0 0; font: 400 24px/1.45 Geist, Arial, sans-serif; color: #d3d9df; max-width: 30em; text-wrap: pretty; }
  .foot { display: flex; align-items: center; gap: 14px; margin-top: 36px; font: 500 20px/1 Geist, Arial, sans-serif; color: ${PAGE}; }
  .foot::before { content: ''; width: 36px; height: 2px; background: #89a1c2; }
  .photo { position: relative; overflow: hidden; }
  .photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .photo::before { content: ''; position: absolute; inset: 0; z-index: 1; background: rgba(20,68,134,.18); mix-blend-mode: multiply; }
  .photo::after { content: ''; position: absolute; inset: 0; z-index: 2; background: linear-gradient(90deg, ${NAVY} 0%, rgba(22,32,46,.35) 22%, transparent 55%); }
</style></head><body>
<div class="card">
  <div class="text">${lockup}<h1>${c.title}</h1><p>${c.sub}</p><div class="foot">${c.foot}</div></div>
  <div class="photo"><img src="assets/img/hero-3-960.webp" alt=""></div>
</div></body></html>`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  fs.writeFileSync(path.join(root, `assets/img/og-${lang}.jpg`), await page.screenshot({ type: 'jpeg', quality: 86 }));
}

await browser.close();
console.log('favicon.ico, assets/icons/{icon.svg,apple-touch-icon.png,icon-192.png,icon-512.png}, assets/img/og-{uk,en}.jpg');
