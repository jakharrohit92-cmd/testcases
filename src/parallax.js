import { gsap } from "gsap";
import { DESKTOP, MOBILE, MOTION } from "./timing.js";

/* Five attribute-driven variants. All ease "none", all on their own
   compositor layer (translateZ 10). Built inside gsap.matchMedia so they are
   torn down and rebuilt whenever the 992px breakpoint is crossed. */
const VARIANTS = {
  img: { from: { yPercent: -15 }, to: { yPercent: 15 }, start: "top bottom", end: "bottom top", scrub: 0.5 },
  "img-out": { from: { yPercent: 0 }, to: { yPercent: 20 }, start: "bottom bottom", end: "bottom top", scrub: 0.5 },
  "img-in": { from: { yPercent: -20 }, to: { yPercent: 0 }, start: "top bottom", end: "bottom bottom", scrub: true },
  "ctn-down": { from: { yPercent: -10 }, to: { yPercent: 10 }, start: "top 125%", end: "bottom -25%", scrub: 0.5 },
  "ctn-up": { from: { yPercent: 10 }, to: { yPercent: -10 }, start: "top 125%", end: "bottom -25%", scrub: 0.5 },
};

export function initParallax(mm) {
  const els = [...document.querySelectorAll("[data-parallax]")].filter((el) => el.dataset.parallax in VARIANTS);

  mm.add({ desk: `${DESKTOP} and ${MOTION}`, mob: `${MOBILE} and ${MOTION}` }, (ctx) => {
    const { desk } = ctx.conditions;
    els.forEach((el) => {
      if (desk && el.dataset.desk === "off") return;
      if (!desk && el.dataset.mob === "off") return;
      const v = VARIANTS[el.dataset.parallax];
      const trigger = el.closest('[data-parallax="w"]') || el;
      gsap.fromTo(
        el,
        { ...v.from, z: 10 },
        { ...v.to, z: 10, ease: "none", scrollTrigger: { trigger, start: v.start, end: v.end, scrub: v.scrub } },
      );
    });
  });
}
