/**
 * ChatGPT Theme Studio - Popup Controller
 * Manages user interactions, theme presets, image uploads, and real-time live synchronization.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // State cache
  let currentSettings = { ...CGTS_DEFAULT_SETTINGS };
  let statusTimeout = null;

  // DOM Elements
  const enabledToggle = document.getElementById('enabled-toggle');
  const statusBadge = document.getElementById('status-badge');
  const themesGrid = document.getElementById('themes-grid');
  
  // Background DOM
  const bgThumbContainer = document.getElementById('bg-thumb-container');
  const bgThumbFill = document.getElementById('bg-thumb-fill');
  const bgThumbImg = document.getElementById('bg-thumb-img');
  const bgThumbPlaceholder = document.getElementById('bg-thumb-placeholder');
  const fileInput = document.getElementById('bg-file-input');
  const btnUpload = document.getElementById('btn-upload');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  const bgColorPicker = document.getElementById('bg-color-picker');
  const bgColorText = document.getElementById('bg-color-text');
  
  // Image adjustments
  const sliderOpacity = document.getElementById('slider-opacity');
  const labelOpacityVal = document.getElementById('label-opacity-val');
  const sliderBlur = document.getElementById('slider-blur');
  const labelBlurVal = document.getElementById('label-blur-val');
  const selectPosition = document.getElementById('select-position');
  const selectSize = document.getElementById('select-size');
  
  // Accent DOM
  const accentColorPicker = document.getElementById('accent-color-picker');
  const accentColorText = document.getElementById('accent-color-text');
  
  // Footer DOM
  const btnReset = document.getElementById('btn-reset');
  const statusMessage = document.getElementById('status-message');

  // Debounce timers
  const debounceTimers = {};

  /**
   * Broadcast settings immediately to all active ChatGPT tabs for 0ms real-time preview
   * @param {object} settings 
   */
  function broadcastToChatGPTTabs(settings) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    // Send to all open ChatGPT tabs
    chrome.tabs.query({ url: '*://chatgpt.com/*' }, (tabs) => {
      if (tabs && tabs.length) {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CGTS_APPLY_SETTINGS',
            settings: settings
          }).catch(() => {
            // Content script might be dormant or page loading
          });
        });
      }
    });

    // Also check active tab in current window
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('chatgpt.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CGTS_APPLY_SETTINGS',
          settings: settings
        }).catch(() => {});
      }
    });
  }

  /**
   * Display status feedback to the user
   * @param {string} msg 
   * @param {'info'|'success'|'error'} type 
   */
  function showStatus(msg, type = 'info') {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }
    statusMessage.textContent = msg;
    statusMessage.className = 'cgts-status-msg';
    if (type === 'success') statusMessage.classList.add('success');
    if (type === 'error') statusMessage.classList.add('error');

    statusTimeout = setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'cgts-status-msg';
    }, 2800);
  }

  /**
   * Persist a specific setting key without reserializing large data
   * Also broadcasts immediately to active tabs.
   * @param {string} key 
   * @param {*} value 
   * @param {Function} [callback] 
   */
  function saveSetting(key, value, callback) {
    currentSettings[key] = value;
    broadcastToChatGPTTabs(currentSettings);

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting: ' + chrome.runtime.lastError.message, 'error');
        } else if (callback) {
          callback();
        }
      });
    }
  }

  /**
   * Persist multiple settings at once and broadcast to tabs
   * @param {object} obj 
   * @param {Function} [callback] 
   */
  function saveSettingsBatch(obj, callback) {
    Object.assign(currentSettings, obj);
    broadcastToChatGPTTabs(currentSettings);

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          showStatus('Storage error: ' + chrome.runtime.lastError.message, 'error');
        } else if (callback) {
          callback();
        }
      });
    }
  }

  /**
   * Debounce helper
   */
  function debounce(key, fn, delay = 80) {
    if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(fn, delay);
  }

  /**
   * Render theme cards in the presets grid
   */
  function renderThemesGrid() {
    themesGrid.innerHTML = '';
    CGTS_THEMES.forEach(theme => {
      const card = document.createElement('div');
      card.className = 'cgts-theme-card';
      card.setAttribute('role', 'radio');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', theme.name + ' theme');
      card.dataset.themeId = theme.id;

      if (currentSettings.themeId === theme.id) {
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
      } else {
        card.setAttribute('aria-checked', 'false');
      }

      card.innerHTML = `
        <div class="cgts-theme-swatch" style="background-color: ${theme.bgColor};">
          <div class="cgts-theme-accent-dot" style="background-color: ${theme.accentColor};"></div>
        </div>
        <span class="cgts-theme-name">${theme.name}</span>
      `;

      const selectHandler = () => applyPresetTheme(theme);
      card.addEventListener('click', selectHandler);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectHandler();
        }
      });

      themesGrid.appendChild(card);
    });
  }

  /**
   * Apply a preset theme
   * @param {object} theme 
   */
  function applyPresetTheme(theme) {
    currentSettings.themeId = theme.id;
    currentSettings.bgColor = theme.bgColor;
    currentSettings.accentColor = theme.accentColor;

    // Update UI elements
    updatePresetSelectionUI();
    updateBgColorUI(theme.bgColor);
    updateAccentColorUI(theme.accentColor);

    // Save batch to storage and broadcast in real-time
    saveSettingsBatch({
      themeId: theme.id,
      bgColor: theme.bgColor,
      accentColor: theme.accentColor
    }, () => {
      showStatus(`${theme.name} theme applied`, 'success');
    });
  }

  /**
   * Update active theme card selection highlight
   */
  function updatePresetSelectionUI() {
    const cards = themesGrid.querySelectorAll('.cgts-theme-card');
    cards.forEach(card => {
      const isSelected = card.dataset.themeId === currentSettings.themeId;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }

  /**
   * Update background color UI elements
   * @param {string} color 
   */
  function updateBgColorUI(color) {
    bgColorPicker.value = color;
    bgColorText.textContent = color.toUpperCase();
    bgThumbFill.style.backgroundColor = color;
  }

  /**
   * Update accent color UI elements
   * @param {string} color 
   */
  function updateAccentColorUI(color) {
    accentColorPicker.value = color;
    accentColorText.textContent = color.toUpperCase();
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--border-focus', color);
  }

  /**
   * Update image thumbnail preview
   */
  function updateImageThumbnailUI() {
    if (currentSettings.bgImage) {
      bgThumbImg.src = currentSettings.bgImage;
      bgThumbImg.classList.remove('hidden');
      bgThumbPlaceholder.classList.add('hidden');
      btnRemoveImage.classList.remove('hidden');
    } else {
      bgThumbImg.src = '';
      bgThumbImg.classList.add('hidden');
      bgThumbPlaceholder.classList.remove('hidden');
      btnRemoveImage.classList.add('hidden');
    }
  }

  /**
   * Update all popup controls from state
   */
  function populateUI(settings) {
    currentSettings = { ...settings };

    // Enabled toggle
    enabledToggle.checked = currentSettings.enabled;
    updateEnabledBadge(currentSettings.enabled);

    // Themes Grid
    renderThemesGrid();

    // Background color
    updateBgColorUI(currentSettings.bgColor);

    // Accent color
    updateAccentColorUI(currentSettings.accentColor);

    // Image thumbnail
    updateImageThumbnailUI();

    // Sliders
    sliderOpacity.value = currentSettings.bgOpacity;
    labelOpacityVal.textContent = `${currentSettings.bgOpacity}%`;

    sliderBlur.value = currentSettings.bgBlur;
    labelBlurVal.textContent = `${currentSettings.bgBlur} px`;

    // Dropdowns
    selectPosition.value = currentSettings.bgPosition;
    selectSize.value = currentSettings.bgSize;
  }

  /**
   * Update active status badge
   * @param {boolean} isEnabled 
   */
  function updateEnabledBadge(isEnabled) {
    if (isEnabled) {
      statusBadge.textContent = 'Active';
      statusBadge.className = 'cgts-badge active';
    } else {
      statusBadge.textContent = 'Paused';
      statusBadge.className = 'cgts-badge';
    }
  }

  /**
   * Load stored settings from chrome.storage.local
   */
  function loadSettings() {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (data) => {
        const sanitized = CGTS_UTILS.sanitizeSettings(data);
        populateUI(sanitized);
      });
    } else {
      populateUI(CGTS_DEFAULT_SETTINGS);
    }
  }

  /**
   * Resize and compress uploaded image using an offscreen canvas
   * @param {File} file 
   * @returns {Promise<string>} data URL
   */
  function processUploadedImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to decode image data'));
        img.onload = () => {
          const MAX_DIM = 2560; // Max dimension for crisp 4K rendering
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Output format based on original type
          const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = 0.90;
          const dataUrl = canvas.toDataURL(format, quality);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --------------------------------------------------------------------------
  // Event Listeners (with INSTANT live broadcast on input)
  // --------------------------------------------------------------------------

  // Enabled Toggle
  enabledToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    updateEnabledBadge(isEnabled);
    saveSetting('enabled', isEnabled, () => {
      showStatus(isEnabled ? 'Customization enabled' : 'Customization paused', 'success');
    });
  });

  // Background Image Upload Trigger
  btnUpload.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  // Background Image File Selection
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showStatus('Invalid file. Use JPG, PNG, or WebP.', 'error');
      return;
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      showStatus('File exceeds 5MB limit. Please choose a smaller image.', 'error');
      return;
    }

    showStatus('Processing wallpaper...', 'info');

    try {
      const dataUrl = await processUploadedImage(file);
      currentSettings.bgImage = dataUrl;
      updateImageThumbnailUI();

      saveSetting('bgImage', dataUrl, () => {
        showStatus('Background image uploaded!', 'success');
      });
    } catch (err) {
      showStatus('Error processing image: ' + err.message, 'error');
    }
  });

  // Remove Background Image
  btnRemoveImage.addEventListener('click', () => {
    currentSettings.bgImage = null;
    updateImageThumbnailUI();
    saveSetting('bgImage', null, () => {
      showStatus('Background image removed', 'success');
    });
  });

  // Background Color Picker: live broadcast on input, debounced storage write
  bgColorPicker.addEventListener('input', (e) => {
    const hex = e.target.value.toLowerCase();
    bgColorText.textContent = hex.toUpperCase();
    bgThumbFill.style.backgroundColor = hex;
    currentSettings.bgColor = hex;

    const matchingPreset = CGTS_THEMES.find(t => t.bgColor.toLowerCase() === hex);
    currentSettings.themeId = matchingPreset ? matchingPreset.id : 'custom';
    updatePresetSelectionUI();

    // LIVE INSTANT UPDATE TO CHATGPT TAB
    broadcastToChatGPTTabs(currentSettings);

    debounce('bgColor', () => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          bgColor: hex,
          themeId: currentSettings.themeId
        });
      }
    }, 60);
  });

  // Accent Color Picker: live broadcast on input, debounced storage write
  accentColorPicker.addEventListener('input', (e) => {
    const hex = e.target.value.toLowerCase();
    accentColorText.textContent = hex.toUpperCase();
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--border-focus', hex);
    currentSettings.accentColor = hex;

    // LIVE INSTANT UPDATE TO CHATGPT TAB
    broadcastToChatGPTTabs(currentSettings);

    debounce('accentColor', () => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ accentColor: hex });
      }
    }, 60);
  });

  // Opacity Slider: LIVE INSTANT BROADCAST ON INPUT
  sliderOpacity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    labelOpacityVal.textContent = `${val}%`;
    currentSettings.bgOpacity = val;

    // LIVE INSTANT UPDATE TO CHATGPT TAB
    broadcastToChatGPTTabs(currentSettings);

    debounce('bgOpacity', () => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ bgOpacity: val });
      }
    }, 60);
  });

  // Blur Slider: LIVE INSTANT BROADCAST ON INPUT
  sliderBlur.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    labelBlurVal.textContent = `${val} px`;
    currentSettings.bgBlur = val;

    // LIVE INSTANT UPDATE TO CHATGPT TAB
    broadcastToChatGPTTabs(currentSettings);

    debounce('bgBlur', () => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ bgBlur: val });
      }
    }, 60);
  });

  // Position Select
  selectPosition.addEventListener('change', (e) => {
    const val = e.target.value;
    saveSetting('bgPosition', val, () => {
      showStatus('Position updated', 'success');
    });
  });

  // Size Select
  selectSize.addEventListener('change', (e) => {
    const val = e.target.value;
    saveSetting('bgSize', val, () => {
      showStatus('Size updated', 'success');
    });
  });

  // Reset to Default
  btnReset.addEventListener('click', () => {
    const defaults = { ...CGTS_DEFAULT_SETTINGS };
    populateUI(defaults);
    broadcastToChatGPTTabs(defaults);

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.clear(() => {
        chrome.storage.local.set(defaults, () => {
          showStatus('Reset to default settings', 'success');
        });
      });
    } else {
      showStatus('Reset to default settings', 'success');
    }
  });

  // Initialize
  loadSettings();
});
