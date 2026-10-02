import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToTarget } from "../scroll.js";
import { RAIL_SCROLL_DURATION } from "../timing.js";

/**
 * One document-wide ScrollTrigger writes --progress (a percentage) and the
 * two-digit counter. CSS positions the thumb and clips the fill from it.
 * The rail is supplementary: Space, PageDown, Home and End all still work.
 */
export function initProgress() {
  const host = document.querySelector(".progress");
  const counter = host.querySelector("[data-counter]");
  const rail = host.querySelector("[data-rail]");
  const thumb = host.querySelector("[data-rail-thumb]");
  let last = "";

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const pct = self.progress * 100;
      host.style.setProperty("--progress", `${pct.toFixed(2)}%`);
      const text = String(Math.min(99, Math.floor(pct))).padStart(2, "0");
      if (text !== last) counter.textContent = last = text;
    },
  });

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const toRatio = (clientY) => {
    const r = rail.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientY - r.top) / r.height));
  };
  const goTo = (ratio) => scrollToTarget(ratio * maxScroll(), { duration: RAIL_SCROLL_DURATION });

  // Dragging is a slow camera move: every pointer move re-aims a long glide.
  let dragging = false;
  rail.addEventListener("pointerdown", (e) => {
    dragging = true;
    rail.classList.add("is-dragging");
    rail.setPointerCapture(e.pointerId);
    goTo(toRatio(e.clientY));
    e.preventDefault();
  });
  rail.addEventListener("pointermove", (e) => dragging && goTo(toRatio(e.clientY)));
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    rail.classList.remove("is-dragging");
    if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId);
  };
  rail.addEventListener("pointerup", end);
  rail.addEventListener("pointercancel", end);

  thumb.addEventListener("keydown", (e) => {
    const page = window.innerHeight;
    const y = window.scrollY;
    const moves = {
      ArrowDown: y + page,
      ArrowRight: y + page,
      PageDown: y + page,
      ArrowUp: y - page,
      ArrowLeft: y - page,
      PageUp: y - page,
      Home: 0,
      End: maxScroll(),
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    scrollToTarget(Math.max(0, Math.min(maxScroll(), moves[e.key])));
  });
}
