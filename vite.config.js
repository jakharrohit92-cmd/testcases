import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

/**
 * Expands <x-pic name="hero" alt="…" sizes="…" class="…" eager> into a full
 * <picture> with AVIF + WebP srcsets, explicit width/height, and the right
 * loading hints. Every attribute it does not own is forwarded to the <img>.
 */
function picturePlugin() {
  const manifest = () => JSON.parse(readFileSync(new URL("./public/img/manifest.json", import.meta.url), "utf8"));
  const OWN = new Set(["name", "sizes", "eager", "picture-class"]);

  return {
    name: "solenne-picture",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const m = manifest();
        const preloads = [];
        const out = html.replace(/<x-pic\s([^>]*?)\s*\/?>(?:<\/x-pic>)?/g, (_, raw) => {
          const attrs = {};
          for (const [, k, v] of raw.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[k] = v ?? "";
          const entry = m[attrs.name];
          if (!entry) throw new Error(`x-pic: unknown image "${attrs.name}"`);
          const set = (ext) => entry.sizes.map((w) => `/img/${attrs.name}-${w}.${ext} ${w}w`).join(", ");
          const sizes = attrs.sizes || "100vw";
          const eager = "eager" in attrs;
          const pass = Object.entries(attrs)
            .filter(([k]) => !OWN.has(k))
            .map(([k, v]) => (v === "" && k !== "alt" ? k : `${k}="${v}"`))
            .join(" ");
          const hints = eager ? 'fetchpriority="high" loading="eager" decoding="sync"' : 'loading="lazy" decoding="async"';
          if (eager) {
            preloads.push(
              `<link rel="preload" as="image" type="image/avif" imagesrcset="${set("avif")}" imagesizes="${sizes}" fetchpriority="high">`,
            );
          }
          const pc = attrs["picture-class"] ? ` class="${attrs["picture-class"]}"` : "";
          return (
            `<picture${pc}>` +
            `<source type="image/avif" srcset="${set("avif")}" sizes="${sizes}">` +
            `<source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">` +
            `<img src="/img/${attrs.name}-1600.webp" width="${entry.w}" height="${entry.h}" ${hints} ${pass}>` +
            `</picture>`
          );
        });
        return out.replace("<!-- preload:images -->", preloads.join("\n    "));
      },
    },
  };
}

export default defineConfig({
  plugins: [picturePlugin()],
  build: { target: "es2020", assetsInlineLimit: 0 },
});
