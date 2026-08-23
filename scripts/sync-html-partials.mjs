import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('e:/Coding/vanaxi-astro');
const mainPath = path.join(root, 'src/partials/Main.astro');
const outDir = path.join(root, 'src/partials');

let html = fs.readFileSync(mainPath, 'utf8');
html = html.replace(/^---[\s\S]*?---\s*/, '');
html = html.replace(/<OptimizedImg\s+([\s\S]*?)\s*\/>/g, (_, attrs) => `<img ${attrs.trim()} />`);

const inner = html.replace(/^[\s\S]*?<main[^>]*>\s*/, '').replace(/\s*<\/main>\s*$/, '');

const markers = [
  { file: 'hero.html', start: '<section id="hero"' },
  { file: 'video.html', start: '<section id="video"' },
  { file: 'why.html', start: '<!-- Daylight GSAP' },
  { file: 'logos.html', start: '<section id="clients"' },
  { file: 'services.html', start: '<section id="services"' },
  { file: 'pharma.html', start: '<section id="pharma"' },
  { file: 'process.html', start: '<section id="process"' },
  { file: 'story.html', start: '<section id="stories"' },
  { file: 'faq.html', start: '<section id="faq"' },
  { file: 'seo.html', start: '<section id="organizational-transport"' },
];

const starts = markers.map((m) => {
  const index = inner.indexOf(m.start);
  if (index < 0) throw new Error(`Missing marker: ${m.start}`);
  return { ...m, index };
});

for (let i = 0; i < starts.length; i++) {
  const end = i + 1 < starts.length ? starts[i + 1].index : inner.length;
  const chunk = inner.slice(starts[i].index, end).replace(/\s+$/, '') + '\n';
  fs.writeFileSync(path.join(outDir, starts[i].file), chunk, 'utf8');
  console.log(`${starts[i].file} ${chunk.length} chars`);
}
