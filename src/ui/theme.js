import { ScrollTrigger } from "gsap/ScrollTrigger";

const THEMES = ["theme_on-light", "theme_on-dark", "theme_on-color"];
let targets = [];
let current = "dark";
let override = null;

function apply() {
  const cls = `theme_on-${override || current}`;
  targets.forEach((el) => {
    if (el.classList.contains(cls)) return;
    el.classList.remove(...THEMES);
    el.classList.add(cls);
  });
}

/** A section whose ground changes mid-choreography (hero dissolving into sky,
 *  amenities fading to plum) can override the swap while it runs. */
export function setThemeOverride(bg) {
  if (bg === override) return;
  override = bg;
  apply();
}

/**
 * One ScrollTrigger per [data-bg] section swaps every [data-theme] fixed
 * element between theme_on-light / -dark / -color, measured at the line the
 * corner mark sits on so it stays legible over every ground.
 */
export function initTheme() {
  targets = [...document.querySelectorAll("[data-theme]")];
  const mark = document.querySelector(".mark");
  const line = () => {
    const r = mark.getBoundingClientRect();
    return Math.round(r.top + r.height / 2);
  };

  document.querySelectorAll("[data-bg]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: () => `top ${line()}px`,
      end: () => `bottom ${line()}px`,
      onToggle: (self) => {
        if (!self.isActive) return;
        current = section.dataset.bg;
        apply();
      },
    });
  });
  apply();
}
