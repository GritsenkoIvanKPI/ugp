// Builds the English page (en/index.html) from the Ukrainian master (index.html)
// and the translations in i18n/en.json.
//
//   node build-en.mjs
//
// Run it after every change to index.html or i18n/en.json. The build stops with a list
// of the Ukrainian text it could not translate, so nothing untranslated ships by accident.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const { text: T, script: JS } = JSON.parse(fs.readFileSync(path.join(root, 'i18n/en.json'), 'utf8'));

const CYR = /[Ѐ-ӿ]/;
const KEEP = new Set(['Українська']);           // language name shown in its own language
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const used = new Set();
const missing = [];

const tr = (raw, where) => {
  const key = norm(raw);
  if (!key || !CYR.test(key)) return raw;
  if (KEEP.has(key)) return raw;
  if (!(key in T)) { missing.push(`${where}: ${key}`); return raw; }
  used.add(key);
  const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
  return lead + T[key] + trail;
};

const ATTRS = ['alt', 'aria-label', 'title', 'placeholder', 'content', 'value', 'data-topic', 'label'];
const translateTag = (tag) => tag.replace(
  new RegExp(`\\b(${ATTRS.join('|')})="([^"]*)"`, 'g'),
  (m, a, v) => `${a}="${tr(v, 'attribute ' + a)}"`
);

const translateScript = (code) => {
  if (!CYR.test(code)) return code;
  for (const [uk, en] of Object.entries(JS)) {
    if (!code.includes(uk)) { missing.push(`script string not found in index.html: ${uk}`); continue; }
    code = code.split(uk).join(en);
  }
  return code;
};

// Walk the document: comments, scripts and styles are copied as they are (scripts get
// their string table applied), tags have their text attributes translated, text is translated.
let out = '';
const re = /<!--[\s\S]*?-->|<![^>]*>|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<\/?[a-zA-Z][^>]*>|[^<]+|</g;
let pos = 0;
for (const m of src.matchAll(re)) {
  const piece = m[0];
  if (m.index !== pos) throw new Error(`scanner skipped text at offset ${pos}: ${JSON.stringify(src.slice(pos, m.index))}`);
  pos = m.index + piece.length;
  if (piece.startsWith('<!')) out += piece;      // comments and the doctype are copied as they are
  else if (piece === '<') out += piece;
  else if (piece.startsWith('<script')) out += piece.replace(/^(<script\b[^>]*>)([\s\S]*?)(<\/script>)$/, (m, o, c, e) => o + translateScript(c) + e);
  else if (piece.startsWith('<style')) out += piece;
  else if (piece.startsWith('<')) out += translateTag(piece);
  else out += tr(piece, 'text');
}

if (pos !== src.length) throw new Error('scanner stopped before the end of index.html');

// Page-level differences between the two languages
const swaps = [
  [/<html lang="uk">/, '<html lang="en">'],
  [/<meta property="og:locale" content="uk_UA">\n(\s*)<meta property="og:locale:alternate" content="en_GB">/,
   '<meta property="og:locale" content="en_GB">\n$1<meta property="og:locale:alternate" content="uk_UA">'],
  // assets live one level up
  [/(\s(?:src|content)=")assets\//g, '$1../assets/'],
  // the current-language badge in the header button
  [/(<button[^>]*class="lang-btn"[\s\S]*?)#flag-ua([\s\S]*?)<span class="lang-code">UA<\/span>/, '$1#flag-gb$2<span class="lang-code">EN</span>'],
];
for (const [from, to] of swaps) {
  if (!from.test(out)) missing.push(`page swap did not apply: ${from}`);
  from.lastIndex = 0;
  out = out.replace(from, to);
}
// language links: point each one at the right page and mark English as current
out = out.replace(/<a ([^>]*?)data-lang="(uk|en)"([^>]*)>/g, (m, a, lang, b) => {
  const attrs = (a + 'data-lang="' + lang + '"' + b).replace(/\s*aria-current="true"/, '').replace(/href="[^"]*"/, `href="${lang === 'uk' ? '../' : './'}"`);
  return `<a ${attrs}${lang === 'en' ? ' aria-current="true"' : ''}>`;
});

// Anything Ukrainian left in visible text or attributes is a missing translation
const visible = out.replace(/<!--[\s\S]*?-->/g, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (s) => s.replace(/var SHORT = .*$/m, ''));
for (const [piece] of visible.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>|<[^>]+>|[^<]+/g)) {
  if (piece.startsWith('<script')) {
    for (const [q] of piece.matchAll(/'[^'\n]*[Ѐ-ӿ][^'\n]*'/g)) missing.push(`untranslated script text: ${q}`);
    continue;
  }
  const t = piece.startsWith('<') ? [...piece.matchAll(new RegExp(`\\b(?:${ATTRS.join('|')})="([^"]*)"`, 'g'))].map((m) => m[1]).join(' ') : piece;
  const left = norm(t);
  if (left && CYR.test(left) && !KEEP.has(left)) missing.push(`still Ukrainian: ${left}`);
}

const unique = [...new Set(missing)];
if (unique.length) {
  console.error(`en/index.html NOT written — ${unique.length} problem(s):\n  ` + unique.join('\n  '));
  process.exit(1);
}

const banner = '<!-- GENERATED from index.html + i18n/en.json by build-en.mjs. Do not edit by hand. -->\n';
fs.mkdirSync(path.join(root, 'en'), { recursive: true });
fs.writeFileSync(path.join(root, 'en/index.html'), out.replace(/^(<!DOCTYPE html>\n)/i, `$1${banner}`));

const unused = Object.keys(T).filter((k) => !used.has(k));
console.log(`en/index.html written: ${used.size} text entries used${unused.length ? `, ${unused.length} unused in i18n/en.json:\n  ` + unused.join('\n  ') : ''}`);
