/**
 * ChatGPT Theme Studio - Content Script
 * Injected into chatgpt.com to manage the background layer and apply custom styling in real-time.
 */

(function () {
  'use strict';

  // Prevent duplicate execution in the same frame
  if (window.__CGTS_INITIALIZED__) return;
  window.__CGTS_INITIALIZED__ = true;

  // Local settings cache
  let currentSettings = null;
  let observer = null;
  let isReattaching = false;

  const BG_LAYER_ID = 'cgts-background-layer';

  /**
   * Find ChatGPT's main chat container landmark.
   * Isolating the background to <main> prevents wallpaper bleed into the sidebar
   * and guarantees perfect alignment with conversation messages.
   * @returns {HTMLElement|null}
   */
  function getMainContainer() {
    return document.querySelector('main');
  }

  /**
   * Ensure the dedicated extension background layer exists and is attached
   * directly inside <main> (or fallback to body if <main> is loading).
   */
  function ensureBackgroundLayer() {
    let layer = document.getElementById(BG_LAYER_ID);
    const main = getMainContainer();
    const targetParent = main || document.body || document.documentElement;

    if (!targetParent) return null;

    if (!layer) {
      layer = document.createElement('div');
      layer.id = BG_LAYER_ID;
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = `
        <div class="cgts-backdrop-color"></div>
        <div class="cgts-backdrop-image"></div>
        <div class="cgts-backdrop-scrim"></div>
      `;
    }

    if (main) {
      main.style.setProperty('position', 'relative', 'important');
      if (layer.parentNode !== main) {
        main.prepend(layer);
      }
    } else if (layer.parentNode !== targetParent) {
      targetParent.prepend(layer);
    }

    return layer;
  }

  /**
   * Remove background layer when customization is disabled or reset
   */
  function removeBackgroundLayer() {
    const layer = document.getElementById(BG_LAYER_ID);
    if (layer && layer.parentNode) {
      layer.parentNode.removeChild(layer);
    }
  }

  /**
   * Apply settings as CSS custom properties on document.documentElement
   * @param {object} settings 
   */
  function applyStyles(settings) {
    const docEl = document.documentElement;

    if (!settings || !settings.enabled) {
      docEl.classList.remove('cgts-active');
      removeBackgroundLayer();
      docEl.style.removeProperty('--cgts-bg-color');
      docEl.style.removeProperty('--cgts-accent-color');
      docEl.style.removeProperty('--cgts-bg-image');
      docEl.style.removeProperty('--cgts-bg-opacity');
      docEl.style.removeProperty('--cgts-bg-blur');
      docEl.style.removeProperty('--cgts-bg-position');
      docEl.style.removeProperty('--cgts-bg-size');
      docEl.style.removeProperty('--cgts-scrim-gradient');
      return;
    }

    // Mark as active and ensure layer is mounted inside <main>
    docEl.classList.add('cgts-active');
    
    // Determine theme mode (dark vs light)
    const currentTheme = CGTS_UTILS.getThemeById(settings.themeId);
    const mode = (currentTheme && currentTheme.mode) ? currentTheme.mode : 'dark';
    docEl.setAttribute('data-cgts-mode', mode);

    ensureBackgroundLayer();

    // Map position keyword
    let cssPos = 'center center';
    if (settings.bgPosition === 'top') cssPos = 'center top';
    else if (settings.bgPosition === 'bottom') cssPos = 'center bottom';

    // Format background image URL
    const bgImageValue = settings.bgImage ? `url("${settings.bgImage}")` : 'none';

    // Soft readability gradient scrim when image is active
    const scrimValue = settings.bgImage
      ? 'radial-gradient(circle at center, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.45) 100%)'
      : 'none';

    // Set CSS custom properties
    docEl.style.setProperty('--cgts-bg-color', settings.bgColor || '#16171d');
    docEl.style.setProperty('--cgts-accent-color', settings.accentColor || '#4d88ff');
    docEl.style.setProperty('--cgts-bg-image', bgImageValue);
    docEl.style.setProperty('--cgts-bg-opacity', String((settings.bgOpacity || 85) / 100));
    docEl.style.setProperty('--cgts-bg-blur', `${settings.bgBlur || 0}px`);
    docEl.style.setProperty('--cgts-bg-position', cssPos);
    docEl.style.setProperty('--cgts-bg-size', settings.bgSize || 'cover');
    docEl.style.setProperty('--cgts-scrim-gradient', scrimValue);
  }

  /**
   * Observe DOM to ensure background layer survives SPA navigation,
   * conversation switches, and dynamic re-renders.
   */
  function setupDOMObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (!document.body) return;

    observer = new MutationObserver(() => {
      if (!currentSettings || !currentSettings.enabled || isReattaching) return;

      const layer = document.getElementById(BG_LAYER_ID);
      const main = getMainContainer();

      // Check if layer is missing or if main appeared and layer needs to move into main
      const needsAttachment = !layer || (main && layer.parentNode !== main);

      if (needsAttachment) {
        isReattaching = true;
        requestAnimationFrame(() => {
          if (currentSettings && currentSettings.enabled) {
            ensureBackgroundLayer();
          }
          isReattaching = false;
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Listen for direct real-time messages from popup (0ms latency)
   */
  function setupMessageListener() {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === 'CGTS_APPLY_SETTINGS') {
        const sanitized = CGTS_UTILS.sanitizeSettings(message.settings);
        currentSettings = sanitized;
        applyStyles(sanitized);
        sendResponse({ success: true });
      }
    });
  }

  /**
   * Listen for storage changes across tabs and restarts
   */
  function setupStorageListener() {
    if (!chrome || !chrome.storage || !chrome.storage.onChanged) return;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (!currentSettings) {
        currentSettings = { ...CGTS_DEFAULT_SETTINGS };
      }

      for (const [key, change] of Object.entries(changes)) {
        currentSettings[key] = change.newValue;
      }

      const sanitized = CGTS_UTILS.sanitizeSettings(currentSettings);
      currentSettings = sanitized;
      applyStyles(sanitized);

      if (sanitized.enabled && !observer) {
        setupDOMObserver();
      } else if (!sanitized.enabled && observer) {
        observer.disconnect();
        observer = null;
      }
    });
  }

  /**
   * Initialize content script on page load
   */
  function init() {
    setupMessageListener();
    setupStorageListener();

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const sanitized = CGTS_UTILS.sanitizeSettings(items);
        currentSettings = sanitized;

        const onReady = () => {
          applyStyles(currentSettings);
          if (currentSettings.enabled) {
            setupDOMObserver();
          }
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', onReady, { once: true });
        } else {
          onReady();
        }
      });
    }
  }

  init();
})();
