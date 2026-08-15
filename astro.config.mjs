import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vanaxi.com',
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    inlineStylesheets: 'always'
  }
});
