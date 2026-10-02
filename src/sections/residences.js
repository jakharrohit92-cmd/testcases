import { gsap } from "gsap";
import { chain, groupFor, playGroup } from "../reveal.js";
import { delayReveal, durL, durM, durS } from "../timing.js";

const FRAME_SHUT = "inset(14% 14% 14% 14%)";
const FRAME_OPEN = "inset(0% 0% 0% 0%)";
const FRAME_GONE = "inset(0% 0% 100% 0%)";

/** Residence photographs open from the centre while settling from 1.15. */
function frame(panel, state, delay = 0) {
  const el = panel.querySelector("[data-res-reveal]");
  if (!el) return gsap.timeline();
  const img = el.querySelector("img");
  const tl = gsap.timeline({ delay });
  if (state === "initial") tl.set(el, { clipPath: FRAME_SHUT }).set(img, { scale: 1.15, z: 10 });
  else if (state === "final") tl.set(el, { clipPath: FRAME_OPEN }).set(img, { scale: 1, z: 10 });
  else if (state === "reveal")
    tl.fromTo(el, { clipPath: FRAME_SHUT }, { clipPath: FRAME_OPEN, duration: durL, ease: "Out" }, 0).fromTo(
      img,
      { scale: 1.15 },
      { scale: 1, duration: durL, ease: "Out" },
      0,
    );
  else tl.to(el, { clipPath: FRAME_GONE, duration: durS, ease: "In" }, 0);
  return tl;
}

function playPanel(panel, state, delay = 0) {
  const tl = gsap.timeline({ delay });
  tl.add(frame(panel, state), 0).add(playGroup(groupFor(panel) || panel, state), 0);
  return tl;
}

/**
 * Tabs (ARIA tabs pattern: arrow keys, Home/End, roving tabindex) whose panels
 * swap with the reveal primitives — the old panel exits, the new one enters.
 */
export function initResidences({ motion }) {
  const tabs = document.querySelector("[data-tabs]");
  const buttons = [...tabs.querySelectorAll('[role="tab"]')];
  const panels = buttons.map((b) => document.getElementById(b.getAttribute("aria-controls")));
  let active = 0;
  let inView = !motion;
  let swap = null;

  if (motion) {
    panels.forEach((p) => frame(p, "initial"));
    chain(
      { trigger: tabs, start: "top 85%" },
      () => {
        inView = true;
        playPanel(panels[active], "reveal");
      },
      () => {
        inView = false;
        playPanel(panels[active], "hide");
      },
    );
  }

  const select = (next, focus = true) => {
    if (next === active) return focus && buttons[next].focus();
    const prev = active;
    active = next;
    buttons.forEach((b, i) => {
      b.setAttribute("aria-selected", String(i === next));
      b.tabIndex = i === next ? 0 : -1;
    });
    if (focus) buttons[next].focus();

    if (!motion || !inView) {
      panels[prev].hidden = true;
      panels[next].hidden = false;
      return;
    }
    swap?.progress(1);
    swap = gsap
      .timeline()
      .add(playPanel(panels[prev], "hide"))
      .add(() => {
        panels[prev].hidden = true;
        panels[next].hidden = false;
        playPanel(panels[next], "initial");
      })
      .add(playPanel(panels[next], "reveal"), `+=${delayReveal}`);
  };

  buttons.forEach((b, i) => {
    b.addEventListener("click", () => select(i, false));
    b.addEventListener("keydown", (e) => {
      const last = buttons.length - 1;
      const map = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last };
      if (!(e.key in map)) return;
      e.preventDefault();
      select(map[e.key]);
    });
  });

  initAccordion(motion);
}

/** Accordion: buttons with aria-expanded, arrow keys move between headers. */
function initAccordion(motion) {
  const root = document.querySelector("[data-accordion]");
  const buttons = [...root.querySelectorAll(".accordion__btn")];

  buttons.forEach((btn, i) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      if (!motion) {
        panel.hidden = !open;
        return;
      }
      if (open) {
        panel.hidden = false;
        gsap.fromTo(panel, { height: 0 }, { height: "auto", duration: durM, ease: "InOut", overwrite: true });
      } else {
        gsap.to(panel, { height: 0, duration: durS, ease: "In", overwrite: true, onComplete: () => (panel.hidden = true) });
      }
    });
    btn.addEventListener("keydown", (e) => {
      const last = buttons.length - 1;
      const map = { ArrowDown: i === last ? 0 : i + 1, ArrowUp: i === 0 ? last : i - 1, Home: 0, End: last };
      if (!(e.key in map)) return;
      e.preventDefault();
      buttons[map[e.key]].focus();
    });
  });
}
