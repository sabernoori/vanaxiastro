import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { transformWithEsbuild } from 'vite';

function minifyPublicAssets() {
  return {
    name: 'minify-public-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const folders = [
          { rel: 'js', ext: '.js' },
          { rel: 'styles', ext: '.css' }
        ];

        for (const { rel, ext } of folders) {
          const folder = path.join(root, rel);
          let names;
          try {
            names = await readdir(folder);
          } catch {
            continue;
          }

          for (const name of names) {
            if (!name.endsWith(ext)) continue;
            const filePath = path.join(folder, name);
            const before = (await stat(filePath)).size;
            const source = await readFile(filePath, 'utf8');
            const result = await transformWithEsbuild(source, filePath, {
              minify: true,
              legalComments: 'none'
            });
            await writeFile(filePath, result.code);
            const after = (await stat(filePath)).size;
            logger.info(
              `Minified /${rel}/${name} (${kb(before)} → ${kb(after)})`
            );
          }
        }
      }
    }
  };
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const loopbackHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
for (const key of ['NO_PROXY', 'no_proxy']) {
  const current = process.env[key] ?? '';
  const parts = new Set(
    current
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  for (const host of loopbackHosts) parts.add(host);
  process.env[key] = [...parts].join(',');
}

export default defineConfig({
  site: 'https://vanaxi.com',
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    inlineStylesheets: 'always'
  },
  integrations: [minifyPublicAssets()],
  server: {
    host: '127.0.0.1'
  },
  vite: {
    server: {
      host: '127.0.0.1',
      hmr: {
        host: '127.0.0.1',
        protocol: 'ws'
      }
    }
  }
});
