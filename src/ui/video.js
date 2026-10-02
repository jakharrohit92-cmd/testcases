import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Video is texture: it plays only while on screen. autoplay stays off. */
export function bindVideo(video, vars = {}) {
  const play = () => video.play().catch(() => {});
  const pause = () => video.pause();
  return ScrollTrigger.create({
    trigger: video,
    start: "top bottom",
    end: "bottom top",
    ...vars,
    onEnter: play,
    onEnterBack: play,
    onLeave: pause,
    onLeaveBack: pause,
  });
}

/** Videos outside the horizontal track. Track videos are bound by the
 *  location section, which knows about its containerAnimation. */
export function initVideos() {
  document.querySelectorAll("video[data-scroll-video]").forEach((v) => {
    if (!v.closest("[data-h-track]")) bindVideo(v);
  });
}
