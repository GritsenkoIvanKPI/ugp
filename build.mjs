// Production build. Run after every change to index.html, src/ or i18n/en.json:
//
//   node build.mjs
//
// 1. Compiles Tailwind (tailwind.config.js + src/site.css) into a minified assets/css/site.css.
// 2. Stamps the stylesheet link in index.html with a content hash, so browsers can cache it for a year.
// 3. Builds the English page (build-en.mjs).
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

run('npx -y tailwindcss@3.4.17 -c tailwind.config.js -i src/site.css -o assets/css/site.css --minify');

const css = fs.readFileSync(path.join(root, 'assets/css/site.css'));
const hash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 10);
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const stamped = html.replace(/assets\/css\/site\.css(\?v=[\w]+)?/g, `assets/css/site.css?v=${hash}`);
if (stamped === html && !html.includes(`site.css?v=${hash}`)) throw new Error('stylesheet link not found in index.html');
fs.writeFileSync(htmlPath, stamped);
console.log(`assets/css/site.css: ${(css.length / 1024).toFixed(1)} KB, v=${hash}`);

run('node build-en.mjs');
