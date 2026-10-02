import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/** The live Lenis instance, or null under reduced motion. */
export let lenis = null;

const root = document.documentElement;
let tick = null;
let locks = 0;

/* Wired exactly like this: ScrollTrigger reads Lenis, one rAF loop for the
   whole site, and no lag smoothing so scrubs never desync after a dropped
   frame. Native touch momentum is left alone (no syncTouch). */
export function initSmoothScroll() {
  lenis = new Lenis({
    wrapper: window,
    duration: 1.2,
    smoothWheel: true,
    touchMultiplier: 2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  lenis.on("scroll", ScrollTrigger.update);
  tick = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  if (locks > 0) lenis.stop();

  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    lenis = null;
  };
}

/* Scroll lock measures the scrollbar into --sbw and pads the body by it, so
   the layout does not jump when the bar disappears. Reference-counted so the
   preloader and a modal can overlap safely. */
export function lockScroll() {
  if (locks++ > 0) return;
  const sbw = window.innerWidth - root.clientWidth;
  root.style.setProperty("--sbw", `${sbw}px`);
  root.classList.add("is-locked");
  lenis?.stop();
}

export function unlockScroll() {
  if (locks === 0 || --locks > 0) return;
  root.classList.remove("is-locked");
  root.style.setProperty("--sbw", "0px");
  lenis?.start();
}

export function scrollToTarget(target, opts = {}) {
  if (lenis) {
    lenis.scrollTo(target, opts);
    return;
  }
  const y =
    typeof target === "number" ? target : target instanceof Element ? target.getBoundingClientRect().top + window.scrollY + (opts.offset || 0) : 0;
  window.scrollTo({ top: y, behavior: "auto" });
}
