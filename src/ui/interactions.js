import { gsap } from "gsap";
import { scrollToTarget } from "../scroll.js";
import { DESKTOP, durL, durM, durS, MOTION } from "../timing.js";

/** In-page links glide with Lenis and move focus to the target for keyboard
 *  and screen reader users. */
export function initAnchors() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const id = link.getAttribute("href").slice(1);
    const target = id === "top" ? document.getElementById("top") : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(id === "top" ? 0 : target, { duration: durL * 2 });
    target.focus({ preventScroll: true });
    history.replaceState(null, "", `#${id}`);
  });
}

/** Magnetic hover — desktop, fine pointer and motion allowed only. */
export function initMagnetic(mm) {
  const els = [...document.querySelectorAll("[data-magnetic]")];
  mm.add(`${DESKTOP} and ${MOTION} and (hover: hover) and (pointer: fine)`, () => {
    const offs = els.map((el) => {
      const x = gsap.quickTo(el, "x", { duration: durS, ease: "Out" });
      const y = gsap.quickTo(el, "y", { duration: durS, ease: "Out" });
      const move = (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.3);
        y((e.clientY - (r.top + r.height / 2)) * 0.3);
      };
      const leave = () => gsap.to(el, { x: 0, y: 0, duration: durM, ease: "Out", overwrite: true });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
        gsap.set(el, { clearProps: "transform" });
      };
    });
    return () => offs.forEach((off) => off());
  });
}
