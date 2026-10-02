import { gsap } from "gsap";
import { DESKTOP, MOBILE, MOTION } from "../timing.js";

/**
 * 5.2 Word-spacing spread. The short line physically pulls itself apart as
 * the section passes. word-spacing triggers layout, so: two words per line,
 * and nothing else in this section animates.
 */
export function initStatement(mm) {
  const section = document.querySelector(".statement");
  const line = section.querySelector("[data-spread]");

  mm.add({ desk: `${DESKTOP} and ${MOTION}`, mob: `${MOBILE} and ${MOTION}` }, (ctx) => {
    gsap.fromTo(
      line,
      { wordSpacing: "0rem" },
      {
        wordSpacing: ctx.conditions.desk ? "10rem" : "3rem",
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true },
      },
    );
  });
}
