import { gsap } from "gsap";
import { setThemeOverride } from "../ui/theme.js";
import { DESKTOP, durL, durS, MOTION } from "../timing.js";

/**
 * 5.1 The dive (340vh wrapper, sticky screen). Content lifts faster than the
 * background, then the background scales 1 → 2 from 50% 75% — the glowing
 * doorway — so it reads as a camera flying in, and dissolves into the sky of
 * the next section.
 */
export function initHero(mm) {
  const area = document.querySelector(".hero");
  const bg = area.querySelector(".hero__bg");
  const content = area.querySelector(".hero__content");
  const scrim = area.querySelector(".hero__scrim");
  const veil = area.querySelector(".hero__veil");
  const img = area.querySelector(".hero__img");

  mm.add(`${DESKTOP} and ${MOTION}`, (ctx) => {
    const timeline = () => {
      gsap.set(bg, { z: 10, transformOrigin: "50% 75%" });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: area,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => setThemeOverride(self.progress > 0.9 ? "color" : null),
        },
      });
      tl.to(content, { yPercent: -110, duration: durL, ease: "In" }, 0)
        .to(scrim, { opacity: 0, duration: durL }, 0)
        .to(bg, { yPercent: -6, duration: durL }, 0)
        .fromTo(bg, { scale: 1 }, { scale: 2, duration: durL * 2, ease: "In" }, "-=0.2")
        .to(veil, { opacity: 1, duration: durS, ease: "In" }, `>-${durS}`);
    };
    // Record into the matchMedia context even when built later, so it reverts.
    const build = () => ctx.add(timeline);

    // Wait for the hero to decode, or every offset is measured against a zero-height box.
    if (img.complete && img.naturalWidth) build();
    else img.addEventListener("load", build, { once: true });

    return () => setThemeOverride(null);
  });
}
