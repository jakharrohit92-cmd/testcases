# Solenne — marketing site

A scroll-driven marketing site for **Solenne**, a fictional development of forty-two residences on the (equally fictional) Lake Ilse.

Stack: vanilla HTML/CSS/JS modules, Vite, GSAP 3.15 (ScrollTrigger, SplitText, CustomEase), Lenis 1.3. No WebGL or canvas.

```sh
npm install
npm run dev       # http://localhost:5173
npm run build && npm run preview
npm run assets    # re-render imagery + video (needs python3, numpy, scipy, pillow, ffmpeg)
```

## Map

| File | Role |
| --- | --- |
| `src/timing.js` | The only durations (`durS/M/L`) and the six named eases |
| `src/scroll.js` | Lenis wiring, scrollbar-compensated scroll lock |
| `src/reveal.js` | Six reveal primitives × three states, wrapper groups, once/rewind trigger chain |
| `src/parallax.js` | Five `data-parallax` variants, rebuilt across 992px |
| `src/preloader.js` | Plum curtain with a four-layer CSS-mask arch; short loader on repeat visits |
| `src/sections/*` | Hero dive, word-spacing spread, horizontal location, zoom-through amenities, curtain architecture, closing page clip |
| `src/ui/*` | Theme swapping, spinning corner mark, progress rail, modal, video, anchors, magnetic hover |

Every pinned moment is a tall wrapper with a `position: sticky` screen. `pin: true` is never used.

## Assets

All imagery and both video loops are generated procedurally by `scripts/render_assets.py`, so they are original. Each image ships as AVIF and WebP at 640, 1024, 1600, 2400 and 3840px. Hero-class images are about 45 KB at 1600px. They are placeholders for commissioned photography: replace the files and keep the names, or update `public/img/manifest.json`.
`<x-pic>` tags in `index.html` are expanded at build time into full `<picture>` elements by the small plugin in `vite.config.js`.

Fonts: Bodoni Moda, Archivo and Pinyon Script, self-hosted under the SIL Open Font License (see `public/fonts/`).
