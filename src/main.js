import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

import { initParallax } from "./parallax.js";
import { dismissPreloaderNow, holdPreloader, playPreloader } from "./preloader.js";
import { groupFor, initReveals, revealAllFinal } from "./reveal.js";
import { initSmoothScroll, lenis } from "./scroll.js";
import { initAmenities } from "./sections/amenities.js";
import { initArchitecture } from "./sections/architecture.js";
import { initClosing } from "./sections/closing.js";
import { initHero } from "./sections/hero.js";
import { initLocation } from "./sections/location.js";
import { initResidences } from "./sections/residences.js";
import { initStatement } from "./sections/statement.js";
import { MOTION, REDUCED, registerEases } from "./timing.js";
import { initAnchors, initMagnetic } from "./ui/interactions.js";
import { initMark } from "./ui/mark.js";
import { initModals } from "./ui/modal.js";
import { initProgress } from "./ui/progress.js";
import { initTheme } from "./ui/theme.js";
import { initVideos } from "./ui/video.js";

window.__solenneBooted = true;
document.documentElement.classList.add("js");

gsap.registerPlugin(ScrollTrigger, SplitText);
registerEases();
gsap.ticker.lagSmoothing(0);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduced = window.matchMedia(REDUCED).matches;
const heroImg = document.querySelector(".hero__img");

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function decoded(img) {
  if (img.complete && img.naturalWidth) return img.decode().catch(() => {});
  return new Promise((r) => {
    img.addEventListener("load", () => img.decode().catch(() => {}).then(r), { once: true });
    img.addEventListener("error", r, { once: true });
  });
}

async function boot() {
  if (reduced) return bootReduced();

  window.scrollTo(0, 0);
  holdPreloader();

  // Nothing is split or measured until the type that shapes it has arrived.
  await document.fonts.ready;

  const mm = gsap.matchMedia();
  let mark = null;
  mm.add(MOTION, () => {
    const destroy = initSmoothScroll();
    mark?.rebind();
    return () => {
      destroy();
      mark?.rebind();
      revealAllFinal();
    };
  });

  initReveals();
  initTheme();
  initHero(mm);
  initStatement(mm);
  initLocation(mm);
  initAmenities(mm);
  initArchitecture(mm);
  initResidences({ motion: true });
  initClosing(mm);
  initParallax(mm);
  initVideos();
  initProgress();
  initModals({ motion: true });
  initAnchors();
  initMagnetic(mm);
  mark = initMark(() => lenis);

  // The page is "measured" once the hero has decoded and every trigger has
  // been refreshed against final layout.
  const ready = decoded(heroImg).then(
    () =>
      new Promise((r) => {
        ScrollTrigger.refresh();
        requestAnimationFrame(r);
      }),
  );

  await playPreloader({ ready, heroImg, heroGroup: groupFor(document.querySelector(".hero__content")) });
}

/** Reduced motion: no smooth scroll, no scrub, every reveal already final. */
function bootReduced() {
  dismissPreloaderNow();
  initTheme();
  initResidences({ motion: false });
  initProgress();
  initModals({ motion: false });
  initAnchors();
}

boot().catch((err) => {
  // Never leave the curtain down or content parked invisible.
  console.error(err);
  dismissPreloaderNow();
  revealAllFinal();
});
