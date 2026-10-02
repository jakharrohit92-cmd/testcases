import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { armGroup, chain, collectGroups, groupFor } from "../reveal.js";
import { bindVideo } from "../ui/video.js";
import { DESKTOP, durL, durS, MOBILE, MOTION } from "../timing.js";

const ARCH_SHUT = "inset(100% 0% 0% 0% round 100vw 100vw 0 0)";
const ARCH_OPEN = "inset(0% 0% 0% 0% round 100vw 100vw 0 0)";
const ARCH_GONE = "inset(0% 0% 100% 0% round 100vw 100vw 0 0)";

/** Location images rise into an arch; on rewind the arch sinks the other way. */
function archReveal(el, vars) {
  const img = el.firstElementChild;
  gsap.set(el, { clipPath: ARCH_SHUT });
  gsap.set(img, { scale: 1.15, z: 10 });
  return chain(
    vars,
    () => {
      gsap.fromTo(el, { clipPath: ARCH_SHUT }, { clipPath: ARCH_OPEN, duration: durL, ease: "Out", overwrite: true });
      gsap.fromTo(img, { scale: 1.15 }, { scale: 1, duration: durL, ease: "Out", overwrite: true });
    },
    () => gsap.to(el, { clipPath: ARCH_GONE, duration: durS, ease: "In", overwrite: true }),
  );
}

/**
 * 5.3 Horizontal scroll (desktop only). The wrapper's height is set from the
 * track's width so vertical and horizontal distance are 1:1 by construction.
 * Everything inside the track hangs off the track tween via containerAnimation.
 */
export function initLocation(mm) {
  const area = document.querySelector(".location");
  const track = area.querySelector("[data-h-track]");
  const lines = gsap.utils.toArray(".location__line", area);
  const arches = gsap.utils.toArray("[data-arch-reveal]", area);
  const videos = gsap.utils.toArray("video[data-scroll-video]", area);
  const groups = () => collectGroups(track).map((g) => groupFor(g.el) || g);

  mm.add(`${DESKTOP} and ${MOTION}`, () => {
    const setHeight = () => {
      area.style.height = `${track.scrollWidth}px`;
    };
    setHeight();
    ScrollTrigger.addEventListener("refreshInit", setHeight);
    ScrollTrigger.refresh();

    const tween = gsap.to(track, {
      x: () => -(track.scrollWidth - area.offsetWidth),
      ease: "horScroll",
      scrollTrigger: { trigger: area, start: "2.5% top", end: "97.5% bottom", scrub: 0.25, invalidateOnRefresh: true },
    });
    area._horizontalTween = tween;

    // Title lines counter-drift on X, alternating direction.
    const dir = gsap.utils.wrap([1, -1]);
    lines.forEach((line, i) => {
      gsap.fromTo(
        line,
        { xPercent: dir(i) * 12, z: 10 },
        {
          xPercent: -dir(i) * 12,
          ease: "none",
          scrollTrigger: { trigger: area, start: "top bottom", end: () => `+=${window.innerHeight * 2}`, scrub: true, invalidateOnRefresh: true },
        },
      );
    });

    const inTrack = { containerAnimation: tween, start: "left bottom" };
    const kills = [
      ...groups().map((g) => armGroup(g, { trigger: g.el, ...inTrack })),
      ...arches.map((el) => archReveal(el, { trigger: el, ...inTrack })),
    ];
    videos.forEach((v) => bindVideo(v, { containerAnimation: tween, start: "left right", end: "right left" }));

    return () => {
      kills.forEach((k) => k());
      ScrollTrigger.removeEventListener("refreshInit", setHeight);
      area.style.height = "";
      area._horizontalTween = null;
    };
  });

  mm.add(`${MOBILE} and ${MOTION}`, () => {
    const kills = [...groups().map((g) => armGroup(g)), ...arches.map((el) => archReveal(el, { trigger: el, start: "top 85%" }))];
    videos.forEach((v) => bindVideo(v));
    return () => kills.forEach((k) => k());
  });
}
