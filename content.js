/**
 * ChatGPT Theme Studio - Content Script
 * Injected into chatgpt.com to manage the background layer, ensure native sidebar integrity,
 * and apply custom styling in real-time.
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
  let hasAttemptedInitialSidebarRestore = false;

  const BG_LAYER_ID = 'cgts-background-layer';
  const FLOATING_TOGGLE_ID = 'cgts-floating-sidebar-toggle';

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
   * Determine whether ChatGPT's left navigation sidebar is currently open/expanded.
   * @returns {boolean}
   */
  function isSidebarOpen() {
    const nav = document.querySelector('nav[aria-label="Chat history"], nav, aside, #stage-slideover-sidebar');
    if (!nav) return false;

    try {
      const style = window.getComputedStyle(nav);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      return nav.offsetWidth > 60;
    } catch {
      return false;
    }
  }

  /**
   * Dispatch ChatGPT's native keyboard shortcut (Ctrl+Shift+S or Cmd+Shift+S)
   * to toggle the sidebar.
   */
  function triggerSidebarShortcut() {
    const isMac = typeof navigator !== 'undefined' && navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const eventParams = {
      key: 's',
      code: 'KeyS',
      keyCode: 83,
      which: 83,
      ctrlKey: !isMac,
      metaKey: isMac,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    };

    const evt = new KeyboardEvent('keydown', eventParams);
    document.dispatchEvent(evt);
    window.dispatchEvent(evt);
  }

  /**
   * Open ChatGPT's sidebar using native buttons or keyboard shortcut fallback.
   */
  function openNativeSidebar() {
    const candidateSelectors = [
      'button[data-testid="open-sidebar-button"]',
      'button[aria-label*="Open sidebar" i]',
      'button[aria-label*="open sidebar" i]',
      'button[title*="Open sidebar" i]',
      'button[aria-controls="stage-popover-sidebar"]',
      'button[aria-controls="stage-slideover-sidebar"]',
      'button[aria-label*="sidebar" i]',
      '[data-testid*="sidebar" i]'
    ];

    for (const sel of candidateSelectors) {
      const btn = document.querySelector(sel);
      if (btn && typeof btn.click === 'function') {
        btn.click();
        return true;
      }
    }

    // Keyboard shortcut trigger
    triggerSidebarShortcut();
    return true;
  }

  /**
   * Ensure a floating sidebar toggle button exists when the sidebar is collapsed,
   * giving the user an unmissable, reliable 1-click restore mechanism.
   */
  function updateFloatingSidebarToggle() {
    const existing = document.getElementById(FLOATING_TOGGLE_ID);
    const sidebarVisible = isSidebarOpen();

    if (sidebarVisible) {
      if (existing) {
        existing.style.display = 'none';
      }
      return;
    }

    // Sidebar is collapsed: show the floating toggle
    if (existing) {
      existing.style.display = 'flex';
      return;
    }

    if (!document.body) return;

    const btn = document.createElement('button');
    btn.id = FLOATING_TOGGLE_ID;
    btn.type = 'button';
    btn.title = 'Open ChatGPT Sidebar (Ctrl+Shift+S)';
    btn.setAttribute('aria-label', 'Open ChatGPT Sidebar');
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
      <span>Open Sidebar</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openNativeSidebar();
      setTimeout(updateFloatingSidebarToggle, 250);
    });

    document.body.appendChild(btn);
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
    const isDefaultNoImage = settings && settings.themeId === 'default' && !settings.bgImage;

    if (!settings || !settings.enabled || isDefaultNoImage) {
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
      updateFloatingSidebarToggle();
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

    updateFloatingSidebarToggle();
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
      const isDefaultNoImage = currentSettings && currentSettings.themeId === 'default' && !currentSettings.bgImage;
      if (!currentSettings || !currentSettings.enabled || isDefaultNoImage || isReattaching) {
        updateFloatingSidebarToggle();
        return;
      }

      const layer = document.getElementById(BG_LAYER_ID);
      const main = getMainContainer();

      // Check if layer is missing or if main appeared and layer needs to move into main
      const needsAttachment = !layer || (main && layer.parentNode !== main);

      if (needsAttachment) {
        isReattaching = true;
        requestAnimationFrame(() => {
          if (currentSettings && currentSettings.enabled && !isDefaultNoImage) {
            ensureBackgroundLayer();
          }
          isReattaching = false;
        });
      }

      updateFloatingSidebarToggle();
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

      const isDefaultNoImage = sanitized.themeId === 'default' && !sanitized.bgImage;
      if (sanitized.enabled && !isDefaultNoImage && !observer) {
        setupDOMObserver();
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
          setupDOMObserver();
          updateFloatingSidebarToggle();

          // Auto-recover sidebar if collapsed on initial mount
          if (!hasAttemptedInitialSidebarRestore) {
            hasAttemptedInitialSidebarRestore = true;
            setTimeout(() => {
              if (!isSidebarOpen()) {
                openNativeSidebar();
              }
              updateFloatingSidebarToggle();
            }, 600);
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
