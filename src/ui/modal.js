import { gsap } from "gsap";
import { lockScroll, unlockScroll } from "../scroll.js";
import { durM, durS } from "../timing.js";

/**
 * Native <dialog> modals: focus is trapped by the browser, Esc closes (we
 * intercept `cancel` only to play the exit), and scroll lock pads the body by
 * the measured scrollbar so nothing shifts underneath.
 */
export function initModals({ motion }) {
  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    const openers = [...document.querySelectorAll(`[data-modal-open="${dialog.id}"]`)];
    let opener = null;
    let closing = false;

    const setExpanded = (v) => openers.forEach((b) => b.setAttribute("aria-expanded", String(v)));

    const open = (from) => {
      if (dialog.open) return;
      opener = from;
      lockScroll();
      dialog.showModal();
      setExpanded(true);
      if (motion) {
        gsap.fromTo(
          dialog,
          { clipPath: "inset(50% 0% 50% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: durM, ease: "InOut", clearProps: "clipPath" },
        );
        gsap.fromTo(dialog.querySelector(".modal__inner"), { opacity: 0, y: "3.33rem" }, { opacity: 1, y: 0, duration: durM, ease: "Out", delay: durS / 2 });
      }
    };

    const finish = () => {
      closing = false;
      dialog.close();
      setExpanded(false);
      unlockScroll();
      opener?.focus();
    };

    const close = () => {
      if (!dialog.open || closing) return;
      closing = true;
      if (!motion) return finish();
      gsap.to(dialog, { clipPath: "inset(50% 0% 50% 0%)", duration: durS, ease: "In", onComplete: finish });
    };

    openers.forEach((b) => b.addEventListener("click", () => open(b)));
    dialog.querySelectorAll("[data-modal-close]").forEach((b) => b.addEventListener("click", close));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault(); // Esc: play the exit, then close
      close();
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close(); // backdrop
    });

    initForm(dialog);
  });
}

function initForm(dialog) {
  const form = dialog.querySelector("[data-enquire-form]");
  if (!form) return;
  const error = form.querySelector("[data-form-error]");
  const thanks = dialog.querySelector("[data-form-thanks]");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const invalid = [...form.querySelectorAll("input[required]")].filter((input) => !input.checkValidity());
    form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
    if (invalid.length) {
      invalid.forEach((input) => input.setAttribute("aria-invalid", "true"));
      error.textContent = "Please add your name and a valid email address.";
      invalid[0].focus();
      return;
    }
    error.textContent = "";
    form.hidden = true;
    thanks.hidden = false;
    thanks.setAttribute("tabindex", "-1");
    thanks.focus();
  });
}
