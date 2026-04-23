import { requireElementById } from "./dom.js";

const progressBarWrapperElt = requireElementById(
  "progress-bar-wrap",
  HTMLElement,
);
const progressBarElt = requireElementById("progress-bar", HTMLElement);
const statusLineElt = requireElementById("status-line", HTMLElement);
const cancelButtonElt = requireElementById(
  "progress-cancel-button",
  HTMLButtonElement,
);

const TOAST_STATE_CLASSES = [
  "is-active",
  "is-success",
  "is-warning",
  "is-error",
];

/**
 * Behavior for the progress bar on the top of the page.
 * Will be constructed as a Pascal-Cased singleton from this file, explaining
 * the weird naming.
 */
class ProgressBarClass {
  /** @type {ReturnType<typeof requestAnimationFrame> | null} */
  #restartRaf = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #fadeTimeout = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #resetTimeout = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #cancelButtonTimeout = null;
  /** @type {(() => void) | null} */
  #cancelAction = null;
  /** @type {ReturnType<typeof requestAnimationFrame> | null} */
  #easingRaf = null;
  /** @type {number} */
  #percent = 0;

  constructor() {
    cancelButtonElt.addEventListener("click", () => {
      if (!this.#cancelAction) {
        return;
      }
      cancelButtonElt.disabled = true;
      this.#cancelAction();
      this.cancel("Operation canceled.");
    });
  }

  /**
   * @param {(() => void) | null} cancelAction
   */
  setCancelAction(cancelAction) {
    this.#cancelAction = cancelAction;
  }

  /**
   * @param {string} msg
   */
  start(msg) {
    this.#clearPendingAnimation();
    this.#hideCancelButton();
    this.#setToastState("is-active");
    if (this.#cancelAction !== null) {
      this.#cancelButtonTimeout = setTimeout(() => {
        if (!this.#cancelAction) {
          return;
        }
        cancelButtonElt.disabled = false;
        cancelButtonElt.removeAttribute("aria-hidden");
        cancelButtonElt.removeAttribute("tabindex");
        cancelButtonElt.classList.add("is-visible");
      }, 300);
    }
    statusLineElt.textContent = msg;
    statusLineElt.style.visibility = "visible";
    progressBarWrapperElt.style.backgroundColor =
      "var(--color-border-tertiary)";
    this.#percent = 0;
    this.#setProgressSemantics(true, null);
    progressBarElt.style.backgroundColor = "var(--color-accent-blue)";
    progressBarElt.style.width = "0%";
    this.#restartRaf = requestAnimationFrame(() => {
      this.#restartRaf = null;
      this.#percent = 5;
      progressBarElt.style.transition = "width 0.3s ease";
      progressBarElt.style.width = "5%";
    });
  }

  startEasing() {
    const tick = () => {
      this.#percent += (90 - this.#percent) * 0.02;
      progressBarElt.style.width = `${this.#percent}%`;
      this.#easingRaf = requestAnimationFrame(tick);
    };
    this.#easingRaf = requestAnimationFrame(tick);
  }

  /**
   * @param {number | undefined} ratio
   * @param {string | undefined} msg
   */
  setProgress(ratio, msg) {
    if (ratio !== undefined) {
      this.#stopEasing();
      this.#percent = Math.min(ratio, 0.99) * 100;
      progressBarElt.style.width = `${this.#percent}%`;
      this.#setProgressSemantics(true, this.#percent);
    }
    if (msg !== undefined) {
      statusLineElt.textContent = msg;
      statusLineElt.style.visibility = msg ? "visible" : "hidden";
    }
  }

  /**
   * @param {string} msg
   */
  updateStatus(msg) {
    statusLineElt.textContent = msg;
    statusLineElt.style.visibility = msg ? "visible" : "hidden";
  }

  /**
   * @param {string} msg
   */
  end(msg) {
    this.#finish(msg, "var(--color-accent-green)");
  }

  /**
   * @param {string} msg
   */
  fail(msg) {
    this.#settle(msg, "var(--color-accent-orange)");
  }

  /**
   * @param {string} msg
   */
  cancel(msg) {
    this.#settle(msg, "var(--color-accent-yellow)");
  }

  /**
   * @param {string} msg
   * @param {string} color
   */
  #settle(msg, color) {
    this.#clearPendingAnimation();
    this.#hideCancelButton();
    this.#cancelAction = null;
    this.#setToastState(
      color === "var(--color-accent-orange)" ? "is-error" : "is-warning",
    );
    progressBarWrapperElt.style.backgroundColor =
      "var(--color-border-tertiary)";
    progressBarElt.style.backgroundColor = color;
    statusLineElt.textContent = msg;
    statusLineElt.style.visibility = "visible";
  }

  /**
   * @param {string} msg
   * @param {string} color
   */
  #finish(msg, color) {
    this.#clearPendingAnimation();
    this.#hideCancelButton();
    this.#cancelAction = null;
    this.#setToastState("is-success");
    this.#percent = 100;
    this.#setProgressSemantics(true, this.#percent);
    progressBarElt.style.width = "100%";
    progressBarElt.style.backgroundColor = color;
    statusLineElt.textContent = msg;
    statusLineElt.style.visibility = "visible";

    this.#fadeTimeout = setTimeout(() => {
      statusLineElt.style.transition = "opacity 0.9s ease";
      statusLineElt.style.opacity = "0";
      progressBarWrapperElt.style.transition = "opacity 0.9s ease";
      progressBarWrapperElt.style.opacity = "0";
      progressBarElt.style.transition = "opacity 0.9s ease";
      progressBarElt.style.opacity = "0";

      this.#resetTimeout = setTimeout(() => {
        progressBarWrapperElt.style.backgroundColor = "transparent";
        this.#setProgressSemantics(false, null);
        progressBarWrapperElt.style.opacity = "1";
        progressBarElt.style.backgroundColor = "transparent";
        progressBarElt.style.opacity = "1";
        statusLineElt.style.visibility = "hidden";
        statusLineElt.style.opacity = "1";
        this.#setToastState(null);
      }, 1200);
    }, 2000);
  }

  #stopEasing() {
    if (this.#easingRaf !== null) {
      cancelAnimationFrame(this.#easingRaf);
      this.#easingRaf = null;
    }
  }

  #clearPendingAnimation() {
    this.#stopEasing();
    if (this.#restartRaf !== null) {
      cancelAnimationFrame(this.#restartRaf);
      this.#restartRaf = null;
    }
    if (this.#fadeTimeout !== null) {
      clearTimeout(this.#fadeTimeout);
      this.#fadeTimeout = null;
    }
    if (this.#resetTimeout !== null) {
      clearTimeout(this.#resetTimeout);
      this.#resetTimeout = null;
    }
    if (this.#cancelButtonTimeout !== null) {
      clearTimeout(this.#cancelButtonTimeout);
      this.#cancelButtonTimeout = null;
    }
    progressBarWrapperElt.style.transition = "none";
    progressBarWrapperElt.style.opacity = "1";
    progressBarElt.style.transition = "none";
    progressBarElt.style.opacity = "1";
    statusLineElt.style.transition = "none";
    statusLineElt.style.opacity = "1";
  }

  #hideCancelButton() {
    if (this.#cancelButtonTimeout !== null) {
      clearTimeout(this.#cancelButtonTimeout);
      this.#cancelButtonTimeout = null;
    }
    cancelButtonElt.classList.remove("is-visible");
    cancelButtonElt.disabled = false;
    cancelButtonElt.setAttribute("aria-hidden", "true");
    cancelButtonElt.setAttribute("tabindex", "-1");
  }

  /**
   * @param {boolean} isVisible
   * @param {number | null} percent
   */
  #setProgressSemantics(isVisible, percent) {
    progressBarWrapperElt.setAttribute(
      "aria-hidden",
      isVisible ? "false" : "true",
    );
    if (percent === null) {
      progressBarWrapperElt.removeAttribute("aria-valuenow");
      return;
    }
    progressBarWrapperElt.setAttribute(
      "aria-valuenow",
      String(Math.round(percent)),
    );
  }

  /**
   * @param {string | null} stateClass
   */
  #setToastState(stateClass) {
    statusLineElt.classList.remove(...TOAST_STATE_CLASSES);
    if (stateClass) {
      statusLineElt.classList.add(stateClass);
    }
  }
}

const ProgressBar = new ProgressBarClass();
export default ProgressBar;
