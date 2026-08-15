# Vanaxi

Astro rebuild of the Vanaxi (ونکسی) marketing site. Static output, ready for Vercel.

## Local

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

Requires Node 20 or newer.

## Deploy

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com/new), import the repository.
3. Leave the defaults (Framework: Astro, Build: `npm run build`, Output: `dist`).
4. Add the production domain when you are ready.

No environment variables are required.

## Edit

| What | Where |
|---|---|
| Home layout and copy | `src/partials/*.html`, `src/pages/index.astro` |
| Custom motion / UI | `public/js/script.js`, `public/js/gsap.js`, `public/styles/custom.css` |
| Webflow visual CSS | `public/styles/webflow.css` |
