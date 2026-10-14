/**
 * ChatGPT Theme Studio - Popup Controller
 * Manages user interactions, theme presets, image uploads, interactive photo cropping/repositioning,
 * and 0ms real-time tab synchronization.
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
  const btnCrop = document.getElementById('btn-crop');
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

  // Crop Modal DOM
  const cropModal = document.getElementById('crop-modal');
  const btnCloseCrop = document.getElementById('btn-close-crop');
  const btnCancelCrop = document.getElementById('btn-cancel-crop');
  const btnApplyCrop = document.getElementById('btn-apply-crop');
  const cropCanvas = document.getElementById('crop-canvas');
  const cropViewport = document.getElementById('crop-viewport');
  const cropZoomSlider = document.getElementById('crop-zoom-slider');
  const cropZoomVal = document.getElementById('crop-zoom-val');
  const btnRotate = document.getElementById('btn-rotate');
  const aspectButtons = document.querySelectorAll('.cgts-aspect-group .cgts-pill-btn');

  // Debounce timers
  const debounceTimers = {};

  // Crop / Reposition State
  const cropState = {
    imageObj: null,
    scale: 1.0,
    panX: 0,
    panY: 0,
    rotation: 0,
    aspectRatio: 16 / 9,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    initialPanX: 0,
    initialPanY: 0
  };

  /**
   * Broadcast settings immediately to all active ChatGPT tabs for 0ms real-time preview
   * @param {object} settings 
   */
  function broadcastToChatGPTTabs(settings) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({}, (tabs) => {
      if (!tabs || !tabs.length) return;
      tabs.forEach(tab => {
        if (tab.url && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CGTS_APPLY_SETTINGS',
            settings: settings
          }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              // Ignore silent port disconnects
            }
          });
        }
      });
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
   * Persist a specific setting key and broadcast to tabs
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
          showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
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

    const updatePayload = {
      themeId: theme.id,
      bgColor: theme.bgColor,
      accentColor: theme.accentColor
    };

    if (theme.id === 'default') {
      currentSettings.bgImage = null;
      currentSettings.bgOriginalImage = null;
      updateImageThumbnailUI();
      updatePayload.bgImage = null;
      updatePayload.bgOriginalImage = null;
    }

    updatePresetSelectionUI();
    updateBgColorUI(theme.bgColor);
    updateAccentColorUI(theme.accentColor);

    saveSettingsBatch(updatePayload, () => {
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
   * Update image thumbnail preview and action buttons
   */
  function updateImageThumbnailUI() {
    if (currentSettings.bgImage) {
      bgThumbImg.src = currentSettings.bgImage;
      bgThumbImg.classList.remove('hidden');
      bgThumbPlaceholder.classList.add('hidden');
      btnRemoveImage.classList.remove('hidden');
      btnCrop.classList.remove('hidden');
    } else {
      bgThumbImg.src = '';
      bgThumbImg.classList.add('hidden');
      bgThumbPlaceholder.classList.remove('hidden');
      btnRemoveImage.classList.add('hidden');
      btnCrop.classList.add('hidden');
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
   * Optimize and compress uploaded image using an offscreen canvas
   * Produces crisp, high-performance ~250KB JPEG for zero latency tab broadcasts
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
          const MAX_DIM = 1920; // 1080p-optimized max dimension for crisp, lightweight wallpaper
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

          // Use JPEG with 0.86 quality for ultra-sharp rendering and small payload
          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --------------------------------------------------------------------------
  // Crop & Reposition Modal Engine
  // --------------------------------------------------------------------------

  /**
   * Open the crop and reposition modal with current image
   */
  function openCropModal() {
    const srcDataUrl = currentSettings.bgOriginalImage || currentSettings.bgImage;
    if (!srcDataUrl) {
      showStatus('No image to edit', 'error');
      return;
    }

    const img = new Image();
    img.onload = () => {
      cropState.imageObj = img;
      cropState.scale = 1.0;
      cropState.panX = 0;
      cropState.panY = 0;
      cropState.rotation = 0;
      cropZoomSlider.value = '1.0';
      cropZoomVal.textContent = '1.0x';

      cropModal.classList.remove('hidden');
      renderCropPreview();
    };
    img.onerror = () => {
      showStatus('Failed to load image for editing', 'error');
    };
    img.src = srcDataUrl;
  }

  /**
   * Close the crop modal
   */
  function closeCropModal() {
    cropModal.classList.add('hidden');
    cropState.isDragging = false;
  }

  /**
   * Render the interactive crop preview canvas
   */
  function renderCropPreview() {
    if (!cropState.imageObj) return;

    const canvasW = 340;
    let canvasH = 191; // default 16:9

    if (cropState.aspectRatio === 'original') {
      const origAspect = cropState.imageObj.width / cropState.imageObj.height;
      canvasH = Math.max(140, Math.min(230, Math.round(canvasW / origAspect)));
    } else {
      canvasH = Math.round(canvasW / cropState.aspectRatio);
    }

    cropViewport.style.height = `${canvasH}px`;
    cropCanvas.width = canvasW;
    cropCanvas.height = canvasH;

    const ctx = cropCanvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Determine dimensions considering rotation
    const isSideways = cropState.rotation === 90 || cropState.rotation === 270;
    const effW = isSideways ? cropState.imageObj.height : cropState.imageObj.width;
    const effH = isSideways ? cropState.imageObj.width : cropState.imageObj.height;

    // Minimum scale to cover canvas
    const baseCoverScale = Math.max(canvasW / effW, canvasH / effH);
    const drawScale = baseCoverScale * cropState.scale;

    ctx.save();
    ctx.translate((canvasW / 2) + cropState.panX, (canvasH / 2) + cropState.panY);
    ctx.rotate((cropState.rotation * Math.PI) / 180);
    ctx.scale(drawScale, drawScale);
    ctx.drawImage(cropState.imageObj, -cropState.imageObj.width / 2, -cropState.imageObj.height / 2);
    ctx.restore();
  }

  /**
   * Export the high-resolution cropped image and apply it to ChatGPT
   */
  function applyCroppedImage() {
    if (!cropState.imageObj) return;

    showStatus('Applying crop...', 'info');

    const exportW = 1920;
    let exportH = 1080;

    if (cropState.aspectRatio === 'original') {
      const origAspect = cropState.imageObj.width / cropState.imageObj.height;
      exportH = Math.round(exportW / origAspect);
    } else {
      exportH = Math.round(exportW / cropState.aspectRatio);
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exportCtx = exportCanvas.getContext('2d');

    const isSideways = cropState.rotation === 90 || cropState.rotation === 270;
    const effW = isSideways ? cropState.imageObj.height : cropState.imageObj.width;
    const effH = isSideways ? cropState.imageObj.width : cropState.imageObj.height;

    const baseCoverScale = Math.max(exportW / effW, exportH / effH);
    const drawScale = baseCoverScale * cropState.scale;

    // Scale preview pan coordinates up to high-resolution export canvas
    const coordRatio = exportW / cropCanvas.width;
    const exportPanX = cropState.panX * coordRatio;
    const exportPanY = cropState.panY * coordRatio;

    exportCtx.save();
    exportCtx.translate((exportW / 2) + exportPanX, (exportH / 2) + exportPanY);
    exportCtx.rotate((cropState.rotation * Math.PI) / 180);
    exportCtx.scale(drawScale, drawScale);
    exportCtx.drawImage(cropState.imageObj, -cropState.imageObj.width / 2, -cropState.imageObj.height / 2);
    exportCtx.restore();

    const croppedDataUrl = exportCanvas.toDataURL('image/jpeg', 0.88);

    currentSettings.bgImage = croppedDataUrl;
    updateImageThumbnailUI();

    // Broadcast immediately to ChatGPT tab and save to storage
    saveSetting('bgImage', croppedDataUrl, () => {
      closeCropModal();
      showStatus('Wallpaper cropped and updated!', 'success');
    });
  }

  // --------------------------------------------------------------------------
  // Crop Modal Event Listeners
  // --------------------------------------------------------------------------

  btnCrop.addEventListener('click', openCropModal);
  btnCloseCrop.addEventListener('click', closeCropModal);
  btnCancelCrop.addEventListener('click', closeCropModal);
  btnApplyCrop.addEventListener('click', applyCroppedImage);

  // Mouse drag panning
  cropViewport.addEventListener('mousedown', (e) => {
    cropState.isDragging = true;
    cropState.dragStartX = e.clientX;
    cropState.dragStartY = e.clientY;
    cropState.initialPanX = cropState.panX;
    cropState.initialPanY = cropState.panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!cropState.isDragging) return;
    const dx = e.clientX - cropState.dragStartX;
    const dy = e.clientY - cropState.dragStartY;
    cropState.panX = cropState.initialPanX + dx;
    cropState.panY = cropState.initialPanY + dy;
    renderCropPreview();
  });

  window.addEventListener('mouseup', () => {
    cropState.isDragging = false;
  });

  // Touch drag panning for touchscreens
  cropViewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      cropState.isDragging = true;
      cropState.dragStartX = e.touches[0].clientX;
      cropState.dragStartY = e.touches[0].clientY;
      cropState.initialPanX = cropState.panX;
      cropState.initialPanY = cropState.panY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!cropState.isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - cropState.dragStartX;
    const dy = e.touches[0].clientY - cropState.dragStartY;
    cropState.panX = cropState.initialPanX + dx;
    cropState.panY = cropState.initialPanY + dy;
    renderCropPreview();
  }, { passive: true });

  window.addEventListener('touchend', () => {
    cropState.isDragging = false;
  });

  // Mouse wheel zoom
  cropViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.1 : -0.1;
    let newScale = Math.max(1.0, Math.min(3.5, cropState.scale + zoomStep));
    cropState.scale = Math.round(newScale * 100) / 100;
    cropZoomSlider.value = cropState.scale.toString();
    cropZoomVal.textContent = `${cropState.scale.toFixed(1)}x`;
    renderCropPreview();
  }, { passive: false });

  // Zoom slider input
  cropZoomSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    cropState.scale = val;
    cropZoomVal.textContent = `${val.toFixed(1)}x`;
    renderCropPreview();
  });

  // Rotation button
  btnRotate.addEventListener('click', () => {
    cropState.rotation = (cropState.rotation + 90) % 360;
    renderCropPreview();
  });

  // Aspect ratio presets
  aspectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      aspectButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const aspectVal = btn.dataset.aspect;
      if (aspectVal === '16/9') cropState.aspectRatio = 16 / 9;
      else if (aspectVal === '16/10') cropState.aspectRatio = 16 / 10;
      else if (aspectVal === '4/3') cropState.aspectRatio = 4 / 3;
      else if (aspectVal === 'original') cropState.aspectRatio = 'original';

      renderCropPreview();
    });
  });

  // --------------------------------------------------------------------------
  // Main Settings Event Listeners
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

  // Background Image File Selection - 0ms Real-Time Instant Application
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showStatus('Invalid file. Use JPG, PNG, or WebP.', 'error');
      return;
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      showStatus('File exceeds 10MB limit. Please choose a smaller image.', 'error');
      return;
    }

    showStatus('Applying wallpaper...', 'info');

    try {
      const dataUrl = await processUploadedImage(file);
      currentSettings.bgImage = dataUrl;
      currentSettings.bgOriginalImage = dataUrl;
      updateImageThumbnailUI();

      saveSettingsBatch({
        bgImage: dataUrl,
        bgOriginalImage: dataUrl
      }, () => {
        showStatus('Wallpaper applied instantly!', 'success');
      });
    } catch (err) {
      showStatus('Error processing image: ' + err.message, 'error');
    }
  });

  // Remove Background Image
  btnRemoveImage.addEventListener('click', () => {
    currentSettings.bgImage = null;
    currentSettings.bgOriginalImage = null;
    updateImageThumbnailUI();
    saveSettingsBatch({
      bgImage: null,
      bgOriginalImage: null
    }, () => {
      showStatus('Background image removed', 'success');
    });
  });

  // Background Color Picker
  bgColorPicker.addEventListener('input', (e) => {
    const hex = e.target.value.toLowerCase();
    bgColorText.textContent = hex.toUpperCase();
    bgThumbFill.style.backgroundColor = hex;
    currentSettings.bgColor = hex;

    const matchingPreset = CGTS_THEMES.find(t => t.bgColor.toLowerCase() === hex);
    currentSettings.themeId = matchingPreset ? matchingPreset.id : 'custom';
    updatePresetSelectionUI();

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

  // Accent Color Picker
  accentColorPicker.addEventListener('input', (e) => {
    const hex = e.target.value.toLowerCase();
    accentColorText.textContent = hex.toUpperCase();
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--border-focus', hex);
    currentSettings.accentColor = hex;

    broadcastToChatGPTTabs(currentSettings);

    debounce('accentColor', () => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ accentColor: hex });
      }
    }, 60);
  });

  // Opacity Slider
  sliderOpacity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    labelOpacityVal.textContent = `${val}%`;
    currentSettings.bgOpacity = val;

    broadcastToChatGPTTabs(currentSettings);

    debounce('bgOpacity', () => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ bgOpacity: val });
      }
    }, 60);
  });

  // Blur Slider
  sliderBlur.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    labelBlurVal.textContent = `${val} px`;
    currentSettings.bgBlur = val;

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
