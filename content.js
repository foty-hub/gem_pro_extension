(() => {
  "use strict";

  const SELECTORS = {
    trigger: '[data-test-id="bard-mode-menu-button"], [aria-label="Open mode picker"]',
    label: '[data-test-id="logo-pill-label-container"]',
    proOption: '[data-test-id="bard-mode-option-pro"]'
  };

  const MAX_WAIT_MS = 10000;
  const POLL_MS = 250;
  const CLICK_COOLDOWN_MS = 750;

  let hasRun = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeText = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();

  const getCurrentMode = () => {
    const label = document.querySelector(SELECTORS.label);
    if (!label) return null;
    const text = normalizeText(label.textContent || "");
    return text || null;
  };

  const getTriggerButton = () => {
    const trigger = document.querySelector(SELECTORS.trigger);
    if (!trigger) return null;
    if (trigger.matches("button")) return trigger;
    return trigger.querySelector("button");
  };

  const findProOption = () => {
    const direct = document.querySelector(SELECTORS.proOption);
    if (direct) return direct;

    const candidates = Array.from(
      document.querySelectorAll('button[role="menuitemradio"], [role="menuitemradio"]')
    );

    return (
      candidates.find((el) => {
        const text = normalizeText(el.textContent || "");
        return text === "pro" || text.startsWith("pro ");
      }) || null
    );
  };

  const ensureProOnce = async () => {
    if (hasRun) return;
    hasRun = true;

    const start = Date.now();
    let lastClickAt = 0;

    while (Date.now() - start < MAX_WAIT_MS) {
      const currentMode = getCurrentMode();
      if (currentMode && currentMode.includes("pro")) return;

      const proOption = findProOption();
      if (proOption) {
        proOption.click();
        return;
      }

      const triggerButton = getTriggerButton();
      if (triggerButton && Date.now() - lastClickAt > CLICK_COOLDOWN_MS) {
        triggerButton.click();
        lastClickAt = Date.now();
      }

      await sleep(POLL_MS);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void ensureProOnce();
    }, { once: true });
  } else {
    void ensureProOnce();
  }
})();
