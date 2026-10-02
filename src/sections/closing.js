import { gsap } from "gsap";
import { playGroup } from "../reveal.js";
import { scrollToTarget } from "../scroll.js";
import { BREAKPOINT, DESKTOP, MOBILE, MOTION } from "../timing.js";

/**
 * 5.6 The page closes on itself. The final frame of the site is clipped inward
 * into a card while the footer scales up behind it. Background, scale and clip
 * scrub; the footer type fires discretely from onEnter / onLeaveBack.
 */
export function initClosing(mm) {
  const area = document.querySelector(".closing");
  const footer = area.querySelector("[data-footer]");
  const inner = area.querySelector(".footer-inner");

  mm.add({ desk: `${DESKTOP} and ${MOTION}`, mob: `${MOBILE} and ${MOTION}` }, () => {
    const target = innerWidth >= BREAKPOINT ? "inset(8% 22% 8% 22%)" : "inset(4% 32% 4% 32%)";
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: area,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onEnter: () => playGroup(inner, "reveal"),
        onLeaveBack: () => playGroup(inner, "hide"),
      },
    });
    tl.fromTo("[data-page-clip]", { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: target, ease: "none" }, 0).fromTo(
      ".footer-inner",
      { opacity: 0, scale: 0.75 },
      { opacity: 1, scale: 1, ease: "none" },
      0,
    );

    // Keyboard users tabbing into the footer are carried to where it is visible.
    const onFocus = () => {
      const st = tl.scrollTrigger;
      if (st && st.progress < 1) scrollToTarget(st.end);
    };
    footer.addEventListener("focusin", onFocus);
    return () => footer.removeEventListener("focusin", onFocus);
  });
}
