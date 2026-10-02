import { gsap } from "gsap";
import { chain } from "../reveal.js";
import { DESKTOP, durL, durM, durS, MOBILE, MOTION } from "../timing.js";

/* Six-point apertures, all in percentages so they are resolution independent.
   Each half carries one; together they form a chamfered camera iris. */
const pts = (list) => `polygon(${list.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
const mirror = (list) => list.map(([x, y]) => [+(100 - x).toFixed(2), y]);

const L_SHUT = [[50.2, 50], [50.2, 50], [50.2, 50], [50.2, 50], [50.2, 50], [50.2, 50]];
const L_IRIS = [[50.2, 16], [43, 16], [35, 30], [35, 86], [50.2, 86], [50.2, 86]];
const L_OPEN = [[50.2, 0], [0, 0], [0, 0], [0, 100], [50.2, 100], [50.2, 100]];
const SHAPES = {
  l: { shut: pts(L_SHUT), iris: pts(L_IRIS), open: pts(L_OPEN) },
  r: { shut: pts(mirror(L_SHUT)), iris: pts(mirror(L_IRIS)), open: pts(mirror(L_OPEN)) },
};

/**
 * 5.5 Clip-path curtains as a camera (190vh). The two halves open their
 * apertures, then the whole frame scales 1 → 1.84 while the arch motifs push
 * outward, and the residences section scales 0.75 → 1 from centre top to meet
 * it. This is the most paint-expensive section: nothing else animates here.
 */
export function initArchitecture(mm) {
  const area = document.querySelector(".archi");
  const frame = area.querySelector(".archi__frame");
  const halfL = area.querySelector(".archi__half--l");
  const halfR = area.querySelector(".archi__half--r");
  const motifL = area.querySelector(".archi__motif--l");
  const motifR = area.querySelector(".archi__motif--r");
  const res = document.querySelector(".res");
  const resInner = res.querySelector(".res__inner");

  mm.add(`${DESKTOP} and ${MOTION}`, () => {
    gsap.set(frame, { z: 10 });
    gsap.set(halfL, { clipPath: SHAPES.l.shut });
    gsap.set(halfR, { clipPath: SHAPES.r.shut });

    gsap
      .timeline({ scrollTrigger: { trigger: area, start: "top top", end: "bottom bottom", scrub: true } })
      .to(halfL, { clipPath: SHAPES.l.iris, duration: durM, ease: "InOut" }, 0)
      .to(halfR, { clipPath: SHAPES.r.iris, duration: durM, ease: "InOut" }, 0)
      .to(halfL, { clipPath: SHAPES.l.open, duration: durL, ease: "InOut" })
      .to(halfR, { clipPath: SHAPES.r.open, duration: durL, ease: "InOut" }, "<")
      .addLabel("push")
      .to(frame, { scale: 1.84, duration: durL, ease: "In" }, "push")
      .to(motifL, { xPercent: -50, z: 10, duration: durL, ease: "In" }, "push")
      .to(motifR, { xPercent: 50, z: 10, duration: durL, ease: "In" }, "push");

    gsap.fromTo(
      resInner,
      { scale: 0.75, transformOrigin: "center top", z: 10 },
      { scale: 1, ease: "Out", scrollTrigger: { trigger: res, start: "top bottom", end: "top top", scrub: true } },
    );
  });

  // Below 992px the same geometry plays discretely when the frame arrives.
  mm.add(`${MOBILE} and ${MOTION}`, () => {
    gsap.set(halfL, { clipPath: SHAPES.l.shut });
    gsap.set(halfR, { clipPath: SHAPES.r.shut });
    return chain(
      { trigger: frame, start: "top 75%" },
      () =>
        gsap
          .timeline()
          .to([halfL, halfR], { clipPath: (i) => (i ? SHAPES.r.iris : SHAPES.l.iris), duration: durS, ease: "Out" })
          .to([halfL, halfR], { clipPath: (i) => (i ? SHAPES.r.open : SHAPES.l.open), duration: durL, ease: "Out" }),
      () => gsap.to([halfL, halfR], { clipPath: (i) => (i ? SHAPES.r.shut : SHAPES.l.shut), duration: durS, ease: "In", overwrite: true }),
    );
  });
}
