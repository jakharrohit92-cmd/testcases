import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { durL, durS, stagger, staggerChars } from "./timing.js";

/* ==========================================================================
   Six primitives, three states, one attribute.
   Each primitive is (elements, state, delay) with state "reveal" | "hide" |
   "initial". Reveals run long and "Out"; hides are the mirrored exit, short
   and "In" — exits are faster than entrances.
   ========================================================================== */

const toArray = (els) => gsap.utils.toArray(els);

/* --- splitting ----------------------------------------------------------- */

/** The visible text becomes an aria-hidden span that SplitText owns; an sr-only
 *  copy keeps the accessible name intact on any element type. */
function splitHost(el) {
  if (el._splitHost) return el._splitHost;
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = el.textContent.replace(/\s+/g, " ").trim();
  const host = document.createElement("span");
  host.className = "split";
  host.setAttribute("aria-hidden", "true");
  host.append(...el.childNodes);
  el.append(sr, host);
  el._splitHost = host;
  return host;
}

const SPLIT_VARS = {
  a: { type: "chars" },
  h: { type: "words,chars" },
  p: { type: "lines,words", mask: "lines" },
};

function ensureSplit(el, kind) {
  if (el._split || !SPLIT_VARS[kind]) return el._split;
  el._split = SplitText.create(splitHost(el), {
    ...SPLIT_VARS[kind],
    aria: "auto", // aria-hidden on every generated span
    autoSplit: true,
    onSplit() {
      // Re-splits (resize, font load) produce fresh spans: put them straight
      // back into whatever state the element was last left in.
      if (!el._split) return;
      el._tween?.kill();
      PRIMITIVES[kind](el, el._state === "reveal" ? "final" : el._state || "initial");
    },
  });
  return el._split;
}

const chars = (el) => ensureSplit(el, el.dataset.reveal)?.chars ?? [];
const lines = (el) => ensureSplit(el, "p")?.lines ?? [];

/* --- the six primitives -------------------------------------------------- */

function run(el, state, delay, targets, from, to, hideTo, each) {
  el._state = state === "final" ? "reveal" : state;
  el._tween?.kill();
  if (state === "initial") return (el._tween = gsap.set(targets, from));
  if (state === "final") return (el._tween = gsap.set(targets, to));
  if (state === "reveal") {
    return (el._tween = gsap.fromTo(targets, from, { ...to, duration: durL, ease: "Out", stagger: each, delay }));
  }
  return (el._tween = gsap.to(targets, { ...hideTo, duration: durS, ease: "In", stagger: each / 2, delay }));
}

/** a — chars swing up on X and slide in from the right; exit swings on, to the left. */
export function a(elements, state, delay = 0) {
  return toArray(elements).map((el) =>
    run(
      el,
      state,
      delay,
      chars(el),
      { opacity: 0, rotateX: 90, x: "10rem", transformOrigin: "50% 100%" },
      { opacity: 1, rotateX: 0, x: 0, transformOrigin: "50% 100%" },
      { opacity: 0, rotateX: -90, x: "-10rem", transformOrigin: "50% 0%" },
      staggerChars,
    ),
  );
}

/** h — chars rise half a line and turn in on Y; exit keeps travelling up. */
export function h(elements, state, delay = 0) {
  return toArray(elements).map((el) =>
    run(
      el,
      state,
      delay,
      chars(el),
      { opacity: 0, yPercent: 50, rotateY: 90 },
      { opacity: 1, yPercent: 0, rotateY: 0 },
      { opacity: 0, yPercent: -50, rotateY: -90 },
      staggerChars,
    ),
  );
}

/** p — lines rise from behind their own mask; exit lifts them out the top. */
export function p(elements, state, delay = 0) {
  return toArray(elements).map((el) =>
    run(el, state, delay, lines(el), { yPercent: 110 }, { yPercent: 0 }, { yPercent: -110 }, stagger),
  );
}

/** ctn — a container fades up 3.33rem; exit simply fades. */
export function ctn(elements, state, delay = 0) {
  return toArray(elements).map((el) =>
    run(el, state, delay, el, { opacity: 0, y: "3.33rem" }, { opacity: 1, y: 0 }, { opacity: 0 }, stagger),
  );
}

/** line — wipes down from the top edge; exit wipes away downward. */
export function line(elements, state, delay = 0) {
  return toArray(elements).map((el) =>
    run(
      el,
      state,
      delay,
      el,
      { clipPath: "inset(0% 0% 100% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)" },
      { clipPath: "inset(100% 0% 0% 0%)" },
      stagger,
    ),
  );
}

/** slide — a 4-point polygon wipes left to right while the child settles from
 *  scale 1.5 and 25% right; exit wipes off to the right, child drifting left. */
export function slide(elements, state, delay = 0) {
  return toArray(elements).map((el) => {
    const child = el.firstElementChild;
    el._state = state === "final" ? "reveal" : state;
    el._tween?.kill();
    const shut = "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)";
    const open = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
    const gone = "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)";
    const tl = gsap.timeline({ delay });
    if (state === "initial") {
      tl.set(el, { clipPath: shut }).set(child, { scale: 1.5, xPercent: 25, z: 10 });
    } else if (state === "final") {
      tl.set(el, { clipPath: open }).set(child, { scale: 1, xPercent: 0, z: 10 });
    } else if (state === "reveal") {
      tl.fromTo(el, { clipPath: shut }, { clipPath: open, duration: durL, ease: "Out" }, 0).fromTo(
        child,
        { scale: 1.5, xPercent: 25, z: 10 },
        { scale: 1, xPercent: 0, duration: durL, ease: "Out" },
        0,
      );
    } else {
      tl.to(el, { clipPath: gone, duration: durS, ease: "In" }, 0).to(child, { xPercent: -25, duration: durS, ease: "In" }, 0);
    }
    return (el._tween = tl);
  });
}

export const PRIMITIVES = { a, h, p, ctn, line, slide };

/* ==========================================================================
   Groups and triggers
   ========================================================================== */

const PRIMITIVE_SELECTOR = Object.keys(PRIMITIVES)
  .map((k) => `[data-reveal="${k}"]`)
  .join(",");

/** Repeating blocks marked data-reveal-first: only the first sibling in each
 *  parent animates, so a long list never runs a long stagger. */
function capLists(root) {
  const byParent = new Map();
  root.querySelectorAll("[data-reveal-first]").forEach((el) => {
    const list = byParent.get(el.parentElement) || [];
    list.push(el);
    byParent.set(el.parentElement, list);
  });
  byParent.forEach((list) =>
    list.slice(1).forEach((el) => {
      el.removeAttribute("data-reveal");
      el.querySelectorAll("[data-reveal]").forEach((c) => c.removeAttribute("data-reveal"));
    }),
  );
}

/** Every [data-reveal] element is collected into its nearest [data-reveal="w"]
 *  wrapper, so a heading and its paragraph stagger together under one trigger.
 *  Elements outside a wrapper form a group of one. */
export function collectGroups(root = document) {
  capLists(root);
  const groups = new Map();
  root.querySelectorAll(PRIMITIVE_SELECTOR).forEach((el) => {
    if (el.closest("[data-preloader]")) return;
    const key = el.closest('[data-reveal="w"]') || el;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  });
  return [...groups].map(([el, members]) => ({ el, members }));
}

const groupByEl = new Map();

export function playGroup(groupOrEl, state, delay = 0) {
  const group = groupOrEl.members ? groupOrEl : groupByEl.get(groupOrEl);
  if (!group) return gsap.timeline();
  const tl = gsap.timeline({ delay });
  const members = state === "hide" ? [...group.members].reverse() : group.members;
  members.forEach((el, i) => {
    const step = state === "hide" ? (i * stagger) / 2 : i * stagger;
    const made = PRIMITIVES[el.dataset.reveal](el, state, 0);
    if (state === "initial" || state === "final") return;
    made.forEach((t) => tl.add(t, step));
  });
  group.state = state;
  return tl;
}

/**
 * The trigger chain. A reveal trigger fires once (`once: true`) and kills
 * itself; in its place it arms a rewind trigger that waits for the reader to
 * scroll back past the same line, plays the mirrored exit, kills itself and
 * re-arms the reveal. Only one live trigger per group at any time.
 */
export function chain(vars, onReveal, onHide) {
  let live = null;
  let dead = false;

  const armReveal = () => {
    if (dead) return;
    live = ScrollTrigger.create({
      ...vars,
      end: vars.start,
      once: true,
      onEnter: () => {
        onReveal();
        // Arm the rewind on the next tick: never create a trigger from inside
        // a trigger callback that is about to kill itself.
        gsap.delayedCall(0, armRewind);
      },
    });
  };

  const armRewind = () => {
    if (dead) return;
    live = ScrollTrigger.create({
      ...vars,
      onLeaveBack: (self) => {
        self.kill();
        onHide();
        gsap.delayedCall(0, armReveal);
      },
    });
  };

  armReveal();
  return () => {
    dead = true;
    live?.kill();
  };
}

const DEFAULT_START = "top 85%";

/** Arm a group with a reveal/rewind chain. Groups inside sticky screens use
 *  their non-sticky wrapper ([data-reveal-trigger]) so positions are stable. */
export function armGroup(group, vars = {}) {
  const trigger = group.el.closest("[data-reveal-trigger]") || group.el;
  return chain(
    { trigger, start: DEFAULT_START, ...vars },
    () => playGroup(group, "reveal"),
    () => playGroup(group, "hide"),
  );
}

let allGroups = [];

/**
 * Motion on: split, hide everything to its initial state (only now that JS is
 * confirmed running), and arm triggers for every auto group. Groups inside the
 * horizontal track or marked data-reveal-manual are left for their owners.
 */
export function initReveals() {
  allGroups = collectGroups();
  allGroups.forEach((g) => {
    groupByEl.set(g.el, g);
    playGroup(g, "initial");
  });
  allGroups
    .filter((g) => !g.el.closest("[data-h-track]") && !g.el.closest("[data-reveal-manual]") && !g.el.hasAttribute("data-reveal-manual"))
    .forEach((g) => armGroup(g));
  return allGroups;
}

/** Reduced motion (or a failed boot): everything straight to its final state. */
export function revealAllFinal() {
  (allGroups.length ? allGroups : collectGroups()).forEach((g) => {
    g.members.forEach((el) => {
      el._tween?.kill();
      if (el._split) PRIMITIVES[el.dataset.reveal](el, "final");
      else gsap.set(el, { clearProps: "opacity,transform,clipPath" });
      if (el.dataset.reveal === "slide" && el.firstElementChild) gsap.set(el.firstElementChild, { clearProps: "transform" });
    });
  });
}

export function groupFor(el) {
  return groupByEl.get(el);
}
