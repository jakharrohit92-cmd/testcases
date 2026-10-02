import { gsap } from "gsap";
import { ctn, h, line, playGroup } from "./reveal.js";
import { lockScroll, unlockScroll } from "./scroll.js";
import { durL, durM, durS, stagger } from "./timing.js";

const VISITED = "hasVisited";

function visitedBefore() {
  try {
    return sessionStorage.getItem(VISITED) === "1";
  } catch {
    return false;
  }
}
function markVisited() {
  try {
    sessionStorage.setItem(VISITED, "1");
  } catch {
    /* storage unavailable: every visit plays the full loader */
  }
}

/** Page content is inert while the curtain is down, so focus can't wander behind it. */
function setInert(on) {
  document.querySelectorAll("[data-loading-inert]").forEach((el) => (el.inert = on));
}

export function holdPreloader() {
  lockScroll();
  setInert(true);
}

export function dismissPreloaderNow() {
  const root = document.querySelector(".preloader-root");
  root?.classList.add("is-done");
  setInert(false);
  unlockScroll();
}

/**
 * Logo assembles → watermark → irregular loading bar → (wait until the page is
 * measured) → arch opens and widens → arch dives off the top while the hero
 * resolves from 0.75 on the very same frames → unlock.
 * Repeat visits in the session play only the arch.
 */
export function playPreloader({ ready, heroImg, heroGroup }) {
  const root = document.querySelector(".preloader-root");
  const loader = root.querySelector("[data-preloader]");
  const lockup = loader.querySelector(".preloader__lockup");
  const mark = loader.querySelector(".preloader__mark");
  const name = loader.querySelector(".preloader__name");
  const rule = loader.querySelector(".preloader__rule");
  const sub = loader.querySelector(".preloader__sub");
  const watermark = loader.querySelector(".preloader__watermark");
  const bar = loader.querySelector(".preloader__bar");
  const fill = loader.querySelector(".preloader__bar-fill");
  const arches = root.querySelectorAll(".preloader__arch");
  const short = visitedBefore();
  markVisited();

  gsap.set(root, { "--arch-w": "24vw", "--arch-y": "104vh" });
  gsap.set(heroImg, { scale: 0.75, transformOrigin: "center top", z: 10 });

  return new Promise((resolve) => {
    const intro = gsap.timeline();
    if (short) {
      gsap.set([lockup, bar, watermark], { autoAlpha: 0 });
    } else {
      ctn(mark, "initial");
      h(name, "initial");
      line(rule, "initial");
      ctn(sub, "initial");
      intro
        .add(ctn(mark, "reveal")[0], 0)
        .add(h(name, "reveal")[0], stagger)
        .add(line(rule, "reveal")[0], stagger * 2)
        .add(ctn(sub, "reveal")[0], stagger * 3)
        .to(watermark, { opacity: 1, duration: durL, ease: "Ease" }, stagger * 4)
        .to(fill, { scaleX: 1, duration: durL, ease: "loadBar" }, durS);
    }

    // The arch never opens before the page is measured, however fast the intro.
    const introDone = short ? Promise.resolve() : new Promise((r) => intro.eventCallback("onComplete", r));
    Promise.all([ready, introDone]).then(() => {
      const out = gsap.timeline({
        onComplete: () => {
          root.classList.add("is-done");
          setInert(false);
          unlockScroll();
          resolve();
        },
      });
      if (!short) {
        out
          .add(h(name, "hide")[0], 0)
          .add(ctn([sub, mark], "hide")[0], 0)
          .add(line(rule, "hide")[0], 0)
          .to([bar, watermark], { opacity: 0, duration: durS, ease: "In" }, 0);
      }
      out
        .fromTo(root, { "--arch-w": "24vw", "--arch-y": "104vh" }, { "--arch-w": "36vw", "--arch-y": "15vh", duration: durL, ease: "InOut" }, short ? 0 : durS)
        .to(root, { "--arch-w": "125vw", "--arch-y": "-100vh", duration: durL, ease: "diveIn" }, ">")
        // Same frames as the dive — one camera move, not two effects.
        .to(heroImg, { scale: 1, duration: durL, ease: "diveIn" }, "<")
        .to(arches, { opacity: 0, duration: durM, ease: "In" }, "<")
        .add(() => playGroup(heroGroup, "reveal"), `<${durS}`);
    });
  });
}
