import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";

/* The timing language. Every animation on the site uses one of these three
   durations and one of the six named eases — no raw numbers elsewhere. */
export const BREAKPOINT = 992;
export const durS = 0.4,
  durM = 0.8,
  durL = 1.2;
export const stagger = 0.1,
  delayReveal = 0.3;
/** Characters stagger at a quarter of the base step so long words stay brisk. */
export const staggerChars = stagger / 4;

export const DESKTOP = `(min-width: ${BREAKPOINT}px)`;
export const MOBILE = `(max-width: ${BREAKPOINT - 1}px)`;
export const MOTION = "(prefers-reduced-motion: no-preference)";
export const REDUCED = "(prefers-reduced-motion: reduce)";

/* Corner mark: degrees per second, and how hard scroll velocity pushes it. */
export const MARK_IDLE = 30;
export const MARK_GAIN = 10;
export const MARK_RESPONSE = 0.3;
export const MARK_QUIET = 0.1;

/* Dragging the progress thumb is a slow camera move, not a jump. */
export const RAIL_SCROLL_DURATION = 3.2;

export function registerEases() {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("InOut", "0.75,0,0.25,1");
  CustomEase.create("Out", "0.25,1,0.5,1");
  CustomEase.create("In", "0.5,0,0.75,0");
  CustomEase.create("Ease", "0.25,0.1,0.25,1");
  CustomEase.create("diveIn", "0.6,0,0,1"); // preloader arch dive
  CustomEase.create("horScroll", "0.25,0,0.75,1"); // horizontal section
  // Hand-drawn loader curve: surges, stalls, surges again, settles.
  CustomEase.create(
    "loadBar",
    "M0,0 C0.06,0.2 0.12,0.29 0.2,0.31 0.27,0.33 0.31,0.34 0.36,0.5 0.41,0.67 0.47,0.71 0.55,0.72 0.63,0.73 0.67,0.74 0.72,0.88 0.77,0.97 0.88,1 1,1",
  );
}
