(() => {
  "use strict";

  const SELECTORS = {
    trigger: [
      '[data-test-id="bard-mode-menu-button"]',
      'button[aria-label*="mode picker" i]',
      'button[aria-label*="model picker" i]'
    ].join(", "),
    label: '[data-test-id="logo-pill-label-container"]',
    directProOption: '[data-test-id="bard-mode-option-pro"]',
    menuRoot: [
      ".cdk-overlay-container",
      ".mat-mdc-menu-panel",
      ".gds-mode-switch-menu",
      "mat-bottom-sheet-container",
      "gem-popover",
      '[role="menu"]',
      '[role="listbox"]'
    ].join(", "),
    menuOption: [
      '[data-test-id^="bard-mode-option"]',
      ".bard-mode-list-button",
      ".mat-mdc-menu-item",
      "gem-menu-item",
      '[role="menuitemradio"]',
      '[role="menuitem"]',
      '[role="option"]'
    ].join(", ")
  };

  const MAX_WAIT_MS = 30000;
  const POLL_MS = 250;
  const CLICK_COOLDOWN_MS = 600;
  const POST_CLICK_WAIT_MS = 700;
  const POST_MODEL_CLICK_GRACE_MS = 4000;
  const MODE_MENU_TEXT_RE = /\b(gemini|flash|pro|thinking level|extended|auto|fast)\b/;

  let hasRun = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeText = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (style.opacity === "0") return false;
    return el.getClientRects().length > 0;
  };

  const isEnabled = (el) => {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    return true;
  };

  const getText = (el) => {
    if (!el) return "";
    return normalizeText([el.getAttribute("aria-label"), el.textContent].filter(Boolean).join(" "));
  };

  const getCurrentPickerText = () => {
    const labelText = Array.from(document.querySelectorAll(SELECTORS.label))
      .filter(isVisible)
      .map((label) => label.textContent)
      .filter(Boolean)
      .join(" ");
    const trigger = getTriggerButton();
    const text = normalizeText(
      [
        labelText,
        trigger && trigger.getAttribute("aria-label")
      ]
        .filter(Boolean)
        .join(" ")
    );
    return text || null;
  };

  const isCurrentModelPro = () => {
    const text = getCurrentPickerText();
    return !!text && /\bpro\b/.test(text);
  };

  const isThinkingExtended = () => {
    const text = getCurrentPickerText();
    return !!text && /\bextended\b/.test(text);
  };

  const getTriggerButton = () => {
    const trigger = Array.from(document.querySelectorAll(SELECTORS.trigger)).find(
      (el) => isVisible(el) && isEnabled(el)
    );
    if (!trigger) return null;
    if (trigger.matches("button")) return trigger;
    return trigger.querySelector("button");
  };

  const getMenuRoots = () =>
    Array.from(document.querySelectorAll(SELECTORS.menuRoot)).filter(
      (el) => isVisible(el) && el.querySelector(SELECTORS.menuOption)
    );

  const getModeMenuRoots = () =>
    getMenuRoots().filter((el) => el.matches(".gds-mode-switch-menu") || MODE_MENU_TEXT_RE.test(getText(el)));

  const isModePickerOpen = () => {
    const trigger = getTriggerButton();
    return (
      (trigger && trigger.getAttribute("aria-expanded") === "true") ||
      getModeMenuRoots().length > 0
    );
  };

  const getActionElement = (el) =>
    el.closest("button, gem-menu-item, [role='menuitemradio'], [role='menuitem'], [role='option']") ||
    el;

  const getMenuOptions = () => {
    const roots = getModeMenuRoots();
    const scopes = roots.length ? roots : [document];
    const options = scopes.flatMap((scope) => Array.from(scope.querySelectorAll(SELECTORS.menuOption)));
    return options
      .map(getActionElement)
      .filter((el, index, list) => list.indexOf(el) === index)
      .filter((el) => isVisible(el) && isEnabled(el));
  };

  const scoreProOption = (el) => {
    const text = getText(el);
    if (!text) return 0;
    if (/\b(upgrade|subscribe|subscription|sign in|learn more)\b/.test(text)) {
      return 0;
    }
    if (/\bgemini\s+3\s+pro\b/.test(text)) return 100;
    if (/\b3\s+pro\b/.test(text)) return 95;
    if (/\bgemini\s+2\.5\s+pro\b/.test(text)) return 90;
    if (/\b2\.5\s+pro\b/.test(text)) return 85;
    if (/\bgemini\s+\d(?:\.\d+)?\s+pro\b/.test(text)) return 75;
    if (/\b(nano banana|create image)\b/.test(text)) return 0;
    if (/^pro\b/.test(text)) return 60;
    if (/\b1\.0\s+pro\b/.test(text)) return 40;
    if (/\bpro\b/.test(text)) return 30;
    return 0;
  };

  const findProOption = () => {
    const direct = document.querySelector(SELECTORS.directProOption);
    if (direct && isVisible(direct) && isEnabled(direct)) return getActionElement(direct);

    return getMenuOptions()
      .map((el) => ({ el, score: scoreProOption(el) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.el || null;
  };

  const scoreThinkingOption = (el) => {
    const text = getText(el);
    if (!text) return 0;
    if (/\b(upgrade|subscribe|subscription|sign in|learn more)\b/.test(text)) return 0;
    if (/^extended\b/.test(text)) return 100;
    if (/\bthinking level\b.*\bextended\b/.test(text)) return 95;
    if (/\bextended\b/.test(text)) return 80;
    return 0;
  };

  const findExtendedThinkingOption = () =>
    getMenuOptions()
      .map((el) => ({ el, score: scoreThinkingOption(el) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.el || null;

  const findThinkingLevelTrigger = () =>
    getMenuOptions().find((el) => {
      const text = getText(el);
      return /\bthinking level\b/.test(text) || text === "thinking";
    }) || null;

  const clickElement = (el) => {
    if (!el) return false;
    el.click();
    return true;
  };

  const openModePicker = (lastClickAt) => {
    if (isModePickerOpen()) return lastClickAt;
    if (Date.now() - lastClickAt < CLICK_COOLDOWN_MS) return lastClickAt;

    const triggerButton = getTriggerButton();
    if (!triggerButton) return lastClickAt;

    clickElement(triggerButton);
    return Date.now();
  };

  const ensureDefaultsOnce = async () => {
    if (hasRun) return;
    hasRun = true;

    const start = Date.now();
    let lastTriggerClickAt = 0;
    let clickedProAt = 0;
    let clickedExtended = false;

    while (Date.now() - start < MAX_WAIT_MS) {
      const modelReady =
        isCurrentModelPro() ||
        (clickedProAt > 0 && Date.now() - clickedProAt < POST_MODEL_CLICK_GRACE_MS);
      const thinkingReady = isThinkingExtended() || clickedExtended;
      if (modelReady && thinkingReady) return;

      if (!modelReady) {
        const proOption = findProOption();
        if (proOption && clickElement(proOption)) {
          clickedProAt = Date.now();
          await sleep(POST_CLICK_WAIT_MS);
          continue;
        }

        lastTriggerClickAt = openModePicker(lastTriggerClickAt);
        await sleep(POLL_MS);
        continue;
      }

      const extendedOption = findExtendedThinkingOption();
      if (extendedOption && clickElement(extendedOption)) {
        clickedExtended = true;
        return;
      }

      const thinkingTrigger = findThinkingLevelTrigger();
      if (thinkingTrigger && clickElement(thinkingTrigger)) {
        await sleep(POST_CLICK_WAIT_MS);
        continue;
      }

      lastTriggerClickAt = openModePicker(lastTriggerClickAt);
      await sleep(POLL_MS);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void ensureDefaultsOnce();
    }, { once: true });
  } else {
    void ensureDefaultsOnce();
  }
})();
