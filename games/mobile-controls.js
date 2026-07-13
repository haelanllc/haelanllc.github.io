(function () {
  "use strict";

  const isTouchDevice = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice || window.__gameLabMobileControls) return;
  window.__gameLabMobileControls = true;

  const KEY_PROFILES = {
    up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    fire: { key: " ", code: "Space", keyCode: 32 },
    dash: { key: "Shift", code: "ShiftLeft", keyCode: 16 },
    start: { key: "Enter", code: "Enter", keyCode: 13 },
  };

  const activeKeys = new Set();

  function targetElement() {
    return document.activeElement || document.querySelector("canvas") || document.body || window;
  }

  function dispatchKey(action, type) {
    const profile = KEY_PROFILES[action];
    if (!profile) return;

    const event = new KeyboardEvent(type, {
      key: profile.key,
      code: profile.code,
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(event, "keyCode", { get: () => profile.keyCode });
    Object.defineProperty(event, "which", { get: () => profile.keyCode });

    const target = targetElement();
    target.dispatchEvent(event);
    document.dispatchEvent(event);
    window.dispatchEvent(event);
  }

  function press(action) {
    if (activeKeys.has(action)) return;
    activeKeys.add(action);
    dispatchKey(action, "keydown");
  }

  function release(action) {
    if (!activeKeys.has(action)) return;
    activeKeys.delete(action);
    dispatchKey(action, "keyup");
  }

  function releaseAll() {
    for (const action of [...activeKeys]) release(action);
  }

  function makeButton(label, action, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `glab-control ${extraClass}`.trim();
    button.dataset.action = action;
    button.textContent = label;
    button.setAttribute("aria-label", label);

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      press(action);
      const canvas = document.querySelector("canvas");
      if (canvas && typeof canvas.focus === "function") canvas.focus({ preventScroll: true });
    });

    const end = (event) => {
      event.preventDefault();
      release(action);
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("lostpointercapture", () => release(action));
    return button;
  }

  function buildControls() {
    const root = document.createElement("div");
    root.className = "glab-mobile-controls";
    root.innerHTML = `
      <div class="glab-pad" aria-label="Movement controls"></div>
      <div class="glab-actions" aria-label="Action controls"></div>
    `;

    const pad = root.querySelector(".glab-pad");
    pad.append(
      makeButton("Up", "up", "glab-up"),
      makeButton("Left", "left", "glab-left"),
      makeButton("Right", "right", "glab-right"),
      makeButton("Down", "down", "glab-down"),
    );

    const actions = root.querySelector(".glab-actions");
    actions.append(
      makeButton("Start", "start", "glab-start"),
      makeButton("A", "fire", "glab-a"),
      makeButton("B", "dash", "glab-b"),
    );

    document.body.append(root);
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @media (pointer: coarse) {
        html,
        body {
          min-width: 0 !important;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
        }

        body {
          padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px)) !important;
        }

        canvas {
          max-width: 100vw;
          touch-action: none;
        }

        .glab-mobile-controls {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2147483647;
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          padding: 10px max(12px, env(safe-area-inset-left, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-right, 0px));
          pointer-events: none;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .glab-pad,
        .glab-actions {
          pointer-events: auto;
          display: grid;
          gap: 7px;
        }

        .glab-pad {
          grid-template-columns: repeat(3, 46px);
          grid-template-rows: repeat(3, 42px);
        }

        .glab-actions {
          grid-template-columns: repeat(2, 52px);
          grid-template-rows: 34px 52px;
          align-items: end;
        }

        .glab-control {
          border: 1px solid rgba(255, 255, 255, 0.34);
          border-radius: 8px;
          color: #fffaf0;
          background: rgba(6, 16, 21, 0.72);
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.26);
          backdrop-filter: blur(10px);
          font: 800 12px/1 ui-sans-serif, system-ui, sans-serif;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }

        .glab-control:active {
          background: rgba(255, 208, 138, 0.48);
          border-color: rgba(255, 208, 138, 0.9);
        }

        .glab-up { grid-column: 2; grid-row: 1; }
        .glab-left { grid-column: 1; grid-row: 2; }
        .glab-right { grid-column: 3; grid-row: 2; }
        .glab-down { grid-column: 2; grid-row: 3; }
        .glab-start { grid-column: 1 / 3; grid-row: 1; min-height: 34px; }
        .glab-a,
        .glab-b {
          min-height: 52px;
          border-radius: 50%;
          font-size: 16px;
        }

        .glab-a { grid-column: 2; grid-row: 2; }
        .glab-b { grid-column: 1; grid-row: 2; opacity: 0.9; }
      }

      @media (pointer: fine) {
        .glab-mobile-controls { display: none !important; }
      }
    `;
    document.head.append(style);
  }

  window.addEventListener("blur", releaseAll);
  window.addEventListener("pagehide", releaseAll);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectStyles();
      buildControls();
    }, { once: true });
  } else {
    injectStyles();
    buildControls();
  }
})();
