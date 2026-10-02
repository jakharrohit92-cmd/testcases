import { gsap } from "gsap";
import { setThemeOverride } from "../ui/theme.js";
import { DESKTOP, durL, MOTION } from "../timing.js";

/**
 * 5.4 Zoom-through hand-off (285vh). After a hold, the grid scales 1 → 2 while
 * the layer carrying it fades 1 → 0 on the same frames, so the plum ground of
 * the architecture section is revealed through the current one.
 */
export function initAmenities(mm) {
  const area = document.querySelector(".amen");
  const layer = area.querySelector(".amen__layer");
  const grid = area.querySelector(".amen__grid");

  mm.add(`${DESKTOP} and ${MOTION}`, () => {
    gsap.set(grid, { z: 10 });
    gsap
      .timeline({
        scrollTrigger: {
          trigger: area,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => setThemeOverride(self.progress > 0.8 ? "dark" : null),
          onLeaveBack: () => setThemeOverride(null),
        },
      })
      .to({}, { duration: durL }) // hold: the grid is read before it moves
      .fromTo(grid, { scale: 1 }, { scale: 2, duration: durL, ease: "In" }, "zoom")
      .fromTo(layer, { opacity: 1 }, { opacity: 0, duration: durL, ease: "In" }, "zoom");

    return () => setThemeOverride(null);
  });
}
