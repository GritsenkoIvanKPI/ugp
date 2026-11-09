// Makes the responsive WebP images the page uses: assets/img/<name>-<width>.webp
//
//   node tools/optimize-images.mjs
//
// Sources are the full-quality originals in assets/img/raw/ (kept local, not in git).
// Needs cwebp (brew install webp). macOS sips does the resizing for the client logo.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const img = path.join(root, 'assets/img');
const raw = path.join(img, 'raw');

// Widths to offer; each image also gets its own full width as the largest step.
const LADDER = [360, 480, 640, 800, 960, 1200, 1440, 1600];
const QUALITY = 74;

const size = (file) => {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  return { w: +out.match(/pixelWidth: (\d+)/)[1], h: +out.match(/pixelHeight: (\d+)/)[1] };
};

const webp = (src, dest, width, extra = []) =>
  execFileSync('cwebp', ['-quiet', '-q', String(QUALITY), '-m', '6', '-sharp_yuv', '-metadata', 'none',
    ...extra, '-resize', String(width), '0', src, '-o', dest]);

const report = [];
for (const file of fs.readdirSync(raw).filter((f) => f.endsWith('.jpg')).sort()) {
  const name = file.replace(/\.jpg$/, '');
  const src = path.join(raw, file);
  const { w } = size(src);
  const widths = [...LADDER.filter((x) => x < w), w];
  for (const width of widths) webp(src, path.join(img, `${name}-${width}.webp`), width);
  report.push(`${name}: ${widths.join(', ')}`);
}

// Client logo: shown about 100px wide, so one 2x file is enough. Alpha is kept.
const logo = path.join(img, 'clients/gromada-zakhysnykiv.webp');
const logoSrc = fs.existsSync(path.join(raw, 'gromada-zakhysnykiv.png')) ? path.join(raw, 'gromada-zakhysnykiv.png') : null;
if (logoSrc) {
  webp(logoSrc, path.join(img, 'clients/gromada-zakhysnykiv-200.webp'), 200, ['-alpha_q', '100']);
  report.push('clients/gromada-zakhysnykiv: 200');
} else if (fs.existsSync(logo)) {
  report.push('clients/gromada-zakhysnykiv: skipped (no PNG source in raw/)');
}

console.log(report.join('\n'));
