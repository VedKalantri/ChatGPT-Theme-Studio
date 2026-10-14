/**
 * ChatGPT Theme Studio - Content Script
 * Injected into chatgpt.com to manage the background layer strictly within <main>
 * and ensure themes persist seamlessly across SPA navigation, conversation switches,
 * and "New chat" clicks without touching the native sidebar.
 */

(function () {
  'use strict';

  // Prevent duplicate execution in the same frame
  if (window.__CGTS_INITIALIZED__) return;
  window.__CGTS_INITIALIZED__ = true;

  // Local settings cache
  let currentSettings = null;
  let observer = null;
  let lastUrl = location.href;

  const BG_LAYER_ID = 'cgts-background-layer';
  const DYNAMIC_STYLE_ID = 'cgts-dynamic-styles';

  /**
   * Find ChatGPT's main chat container landmark.
   * Isolating the background to <main> guarantees that the left sidebar
   * remains 100% untouched and native.
   * @returns {HTMLElement|null}
   */
  function getMainContainer() {
    return document.querySelector('main');
  }

  /**
   * Inject or update a dedicated <style> element in the document head.
   * Because CSS stylesheets cannot be removed by React's virtual DOM reconciliation,
   * styling main::before guarantees the background image NEVER disappears
   * during SPA page transitions or conversation switches.
   * @param {object} settings
   */
  function injectOrUpdateDynamicStyles(settings) {
    const isDefaultNoImage = !settings || !settings.enabled || (settings.themeId === 'default' && !settings.bgImage);
    let styleEl = document.getElementById(DYNAMIC_STYLE_ID);

    if (isDefaultNoImage) {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = DYNAMIC_STYLE_ID;
      const targetParent = document.head || document.documentElement;
      if (targetParent) {
        targetParent.appendChild(styleEl);
      }
    }

    let cssPos = 'center center';
    if (settings.bgPosition === 'top') cssPos = 'center top';
    else if (settings.bgPosition === 'bottom') cssPos = 'center bottom';

    const bgImgRule = settings.bgImage ? `url("${settings.bgImage}")` : 'none';
    const opacityVal = (settings.bgOpacity || 85) / 100;
    const blurVal = settings.bgBlur || 0;
    const bgColorVal = settings.bgColor || '#16171d';
    const bgSizeVal = settings.bgSize || 'cover';

    const cssRules = `
      main {
        position: relative !important;
        background-color: transparent !important;
      }
      main::before {
        content: "" !important;
        position: absolute !important;
        inset: -12px !important;
        background-color: ${bgColorVal} !important;
        background-image: ${bgImgRule} !important;
        background-position: ${cssPos} !important;
        background-size: ${bgSizeVal} !important;
        background-repeat: no-repeat !important;
        opacity: ${opacityVal} !important;
        filter: blur(${blurVal}px) !important;
        pointer-events: none !important;
        z-index: 0 !important;
      }
    `;

    if (styleEl.textContent !== cssRules) {
      styleEl.textContent = cssRules;
    }
  }

  /**
   * Ensure the dedicated extension background layer exists and is attached
   * strictly inside <main>. Never attaches outside main.
   * Direct inlining of styles ensures 0ms latency rendering.
   * @param {object} [settings]
   * @returns {HTMLElement|null}
   */
  function ensureBackgroundLayer(settings) {
    const main = getMainContainer();
    if (!main) return null;

    let layer = document.getElementById(BG_LAYER_ID);

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

    const s = settings || currentSettings;
    if (s && s.enabled && !(s.themeId === 'default' && !s.bgImage)) {
      const imgEl = layer.querySelector('.cgts-backdrop-image');
      if (imgEl) {
        let cssPos = 'center center';
        if (s.bgPosition === 'top') cssPos = 'center top';
        else if (s.bgPosition === 'bottom') cssPos = 'center bottom';

        imgEl.style.setProperty('background-image', s.bgImage ? `url("${s.bgImage}")` : 'none', 'important');
        imgEl.style.setProperty('opacity', String((s.bgOpacity || 85) / 100), 'important');
        imgEl.style.setProperty('filter', `blur(${s.bgBlur || 0}px)`, 'important');
        imgEl.style.setProperty('background-position', cssPos, 'important');
        imgEl.style.setProperty('background-size', s.bgSize || 'cover', 'important');
      }

      const colorEl = layer.querySelector('.cgts-backdrop-color');
      if (colorEl) {
        colorEl.style.setProperty('background-color', s.bgColor || '#16171d', 'important');
      }
    }

    main.style.setProperty('position', 'relative', 'important');
    if (!main.classList.contains('cgts-main-active')) {
      main.classList.add('cgts-main-active');
    }

    if (layer.parentNode !== main) {
      main.prepend(layer);
    }

    return layer;
  }

  /**
   * Remove background layer and dynamic styles when customization is disabled or reset
   */
  function removeCustomizations() {
    const layer = document.getElementById(BG_LAYER_ID);
    if (layer && layer.parentNode) {
      layer.parentNode.removeChild(layer);
    }
    const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    const main = getMainContainer();
    if (main) {
      main.classList.remove('cgts-main-active');
    }
  }

  /**
   * Apply settings as CSS custom properties and dynamic background styles
   * @param {object} settings 
   */
  function applyStyles(settings) {
    if (!settings) return;
    const docEl = document.documentElement;
    const isDefaultNoImage = settings.themeId === 'default' && !settings.bgImage;

    if (!settings.enabled || isDefaultNoImage) {
      docEl.classList.remove('cgts-active');
      docEl.removeAttribute('data-cgts-mode');
      removeCustomizations();
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

    // Mark as active on html
    if (!docEl.classList.contains('cgts-active')) {
      docEl.classList.add('cgts-active');
    }
    
    // Determine theme mode (dark vs light)
    let mode = 'dark';
    if (typeof CGTS_UTILS !== 'undefined' && CGTS_UTILS.getThemeById) {
      const currentTheme = CGTS_UTILS.getThemeById(settings.themeId);
      if (currentTheme && currentTheme.mode) mode = currentTheme.mode;
    }
    docEl.setAttribute('data-cgts-mode', mode);

    // Dynamic un-deletable stylesheet
    injectOrUpdateDynamicStyles(settings);

    // Backdrop layer inside main
    ensureBackgroundLayer(settings);

    // Map position keyword
    let cssPos = 'center center';
    if (settings.bgPosition === 'top') cssPos = 'center top';
    else if (settings.bgPosition === 'bottom') cssPos = 'center bottom';

    const bgImageValue = settings.bgImage ? `url("${settings.bgImage}")` : 'none';

    // Scrim gradient
    const scrimValue = settings.bgImage
      ? 'radial-gradient(circle at center, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.45) 100%)'
      : 'none';

    // Set CSS custom properties on documentElement
    docEl.style.setProperty('--cgts-bg-color', settings.bgColor || '#16171d');
    docEl.style.setProperty('--cgts-accent-color', settings.accentColor || '#4d88ff');
    docEl.style.setProperty('--cgts-bg-image', bgImageValue);
    docEl.style.setProperty('--cgts-bg-opacity', String((settings.bgOpacity || 85) / 100));
    docEl.style.setProperty('--cgts-bg-blur', `${settings.bgBlur || 0}px`);
    docEl.style.setProperty('--cgts-bg-position', cssPos);
    docEl.style.setProperty('--cgts-bg-size', settings.bgSize || 'cover');
    docEl.style.setProperty('--cgts-scrim-gradient', scrimValue);

    // Guarantee observer is active
    if (!observer) {
      setupDOMObserver();
    }
  }

  /**
   * Observe DOM to ensure background layer and dynamic styles stay attached
   * across SPA navigation, conversation switches, and dynamic re-renders.
   */
  function setupDOMObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (!document.body) return;

    observer = new MutationObserver(() => {
      const isDefaultNoImage = currentSettings && currentSettings.themeId === 'default' && !currentSettings.bgImage;
      if (!currentSettings || !currentSettings.enabled || isDefaultNoImage) {
        return;
      }

      const docEl = document.documentElement;
      const main = getMainContainer();
      if (!main) return;

      const layer = document.getElementById(BG_LAYER_ID);
      const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
      const isHtmlActive = docEl.classList.contains('cgts-active');
      const isMainActive = main.classList.contains('cgts-main-active');

      const needsAttachment = !layer || layer.parentNode !== main || !styleEl || !isHtmlActive || !isMainActive;

      if (needsAttachment) {
        applyStyles(currentSettings);
      }
    });

    // Observe body for subtree child additions (React mounting new chats)
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also observe html element for class wipes during Next.js theme updates
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-cgts-mode']
    });
  }

  /**
   * Handle route changes with staggered sync passes to ensure the wallpaper
   * remains rock-solid while React asynchronously mounts the conversation.
   */
  function handleRouteChange() {
    if (!currentSettings || !currentSettings.enabled) return;
    const isDefaultNoImage = currentSettings.themeId === 'default' && !currentSettings.bgImage;
    if (isDefaultNoImage) return;

    lastUrl = location.href;
    applyStyles(currentSettings);
    setTimeout(() => applyStyles(currentSettings), 60);
    setTimeout(() => applyStyles(currentSettings), 200);
    setTimeout(() => applyStyles(currentSettings), 500);
    setTimeout(() => applyStyles(currentSettings), 1000);
  }

  /**
   * Intercept SPA History and navigation events so switching chats or clicking
   * "New chat" maintains the theme seamlessly without delay.
   */
  function setupNavigationWatchers() {
    // 1. Monkey-patch History API (pushState & replaceState) used by Next.js
    const origPushState = history.pushState;
    if (origPushState) {
      history.pushState = function () {
        const ret = origPushState.apply(this, arguments);
        handleRouteChange();
        return ret;
      };
    }

    const origReplaceState = history.replaceState;
    if (origReplaceState) {
      history.replaceState = function () {
        const ret = origReplaceState.apply(this, arguments);
        handleRouteChange();
        return ret;
      };
    }

    // 2. Browser navigation popstate (back/forward)
    window.addEventListener('popstate', handleRouteChange);

    // 3. Click listener on sidebar navigation links & new chat buttons
    document.addEventListener('click', (e) => {
      if (!currentSettings || !currentSettings.enabled) return;
      const target = e.target;
      if (!target) return;

      const clickable = target.closest('a, button, nav, aside');
      if (clickable) {
        handleRouteChange();
      }
    }, true);

    // 4. Polling watchdog to guarantee styles remain active across all edge cases
    setInterval(() => {
      if (!currentSettings || !currentSettings.enabled) return;
      const isDefaultNoImage = currentSettings.themeId === 'default' && !currentSettings.bgImage;
      if (isDefaultNoImage) return;

      if (location.href !== lastUrl) {
        handleRouteChange();
        return;
      }

      const main = getMainContainer();
      const layer = document.getElementById(BG_LAYER_ID);
      const styleEl = document.getElementById(DYNAMIC_STYLE_ID);
      const isHtmlActive = document.documentElement.classList.contains('cgts-active');

      if (main && (!layer || layer.parentNode !== main || !styleEl || !isHtmlActive)) {
        applyStyles(currentSettings);
      }
    }, 250);
  }

  /**
   * Listen for direct real-time messages from popup (0ms latency)
   */
  function setupMessageListener() {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === 'CGTS_APPLY_SETTINGS') {
        const sanitized = (typeof CGTS_UTILS !== 'undefined' && CGTS_UTILS.sanitizeSettings)
          ? CGTS_UTILS.sanitizeSettings(message.settings)
          : message.settings;

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
        currentSettings = (typeof CGTS_DEFAULT_SETTINGS !== 'undefined')
          ? { ...CGTS_DEFAULT_SETTINGS }
          : {};
      }

      for (const [key, change] of Object.entries(changes)) {
        currentSettings[key] = change.newValue;
      }

      const sanitized = (typeof CGTS_UTILS !== 'undefined' && CGTS_UTILS.sanitizeSettings)
        ? CGTS_UTILS.sanitizeSettings(currentSettings)
        : currentSettings;

      currentSettings = sanitized;
      applyStyles(sanitized);
    });
  }

  /**
   * Initialize content script on page load
   */
  function init() {
    setupMessageListener();
    setupStorageListener();
    setupNavigationWatchers();

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const sanitized = (typeof CGTS_UTILS !== 'undefined' && CGTS_UTILS.sanitizeSettings)
          ? CGTS_UTILS.sanitizeSettings(items)
          : items;

        currentSettings = sanitized;

        const onReady = () => {
          applyStyles(currentSettings);
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
