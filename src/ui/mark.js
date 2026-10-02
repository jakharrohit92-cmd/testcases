import { gsap } from "gsap";
import { durL, MARK_GAIN, MARK_IDLE, MARK_QUIET, MARK_RESPONSE } from "../timing.js";

/**
 * The corner mark never stops spinning. Idle at 30°/s; scrolling pushes it to
 * dir × (30 + 10·|velocity|), and after 100ms of quiet it eases back to idle.
 * Programmatic scrolls (preloader reset, anchor jumps) are ignored until the
 * reader has actually used a wheel or touch.
 */
export function initMark(getLenis) {
  const ring = document.querySelector("[data-mark-ring]");
  if (!ring) return () => {};
  const state = { speed: MARK_IDLE };
  let angle = 0;
  let engaged = false;
  let settle = null;

  const engage = () => (engaged = true);
  window.addEventListener("wheel", engage, { passive: true, once: true });
  window.addEventListener("touchmove", engage, { passive: true, once: true });

  const spin = (_time, deltaTime) => {
    // Clamp the delta so a background tab doesn't come back with a lurch.
    const dt = Math.min(deltaTime, 100) / 1000;
    angle = (angle + state.speed * dt) % 360;
    ring.style.transform = `rotate(${angle.toFixed(2)}deg)`;
  };
  gsap.ticker.add(spin);

  const onScroll = ({ velocity, direction }) => {
    if (!engaged) return;
    const dir = direction < 0 ? -1 : 1;
    gsap.to(state, { speed: dir * (MARK_IDLE + MARK_GAIN * Math.abs(velocity)), duration: MARK_RESPONSE, ease: "Out", overwrite: true });
    settle?.kill();
    settle = gsap.delayedCall(MARK_QUIET, () => gsap.to(state, { speed: MARK_IDLE, duration: durL, ease: "InOut", overwrite: true }));
  };

  let bound = null;
  const bind = () => {
    const lenis = getLenis();
    if (lenis === bound) return;
    bound?.off?.("scroll", onScroll);
    bound = lenis;
    lenis?.on("scroll", onScroll);
  };
  bind();

  return Object.assign(
    () => {
      gsap.ticker.remove(spin);
      bound?.off?.("scroll", onScroll);
      settle?.kill();
    },
    { rebind: bind },
  );
}
