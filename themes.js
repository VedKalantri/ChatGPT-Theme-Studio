/**
 * ChatGPT Theme Studio - Preset Themes & Settings Configuration
 * Centralized theme definitions and validation helpers.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    root.CGTS = exports;
    root.CGTS_THEMES = exports.THEMES;
    root.CGTS_DEFAULT_SETTINGS = exports.DEFAULT_SETTINGS;
    root.CGTS_UTILS = exports.UTILS;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Five Curated Preset Themes
   */
  const THEMES = [
    {
      id: 'midnight',
      name: 'Midnight',
      mode: 'dark',
      bgColor: '#16171d',
      accentColor: '#4d88ff',
      textColor: '#e5e7eb',
      surfaceColor: 'rgba(255, 255, 255, 0.05)',
      description: 'Dark charcoal background with muted electric blue accent. Comfortable for nighttime work.'
    },
    {
      id: 'ocean',
      name: 'Ocean',
      mode: 'dark',
      bgColor: '#0b1626',
      accentColor: '#38bdf8',
      textColor: '#e0f2fe',
      surfaceColor: 'rgba(56, 189, 248, 0.06)',
      description: 'Deep oceanic navy with cool cyan accent. Crisp, calm, and serene.'
    },
    {
      id: 'forest',
      name: 'Forest',
      mode: 'dark',
      bgColor: '#121d15',
      accentColor: '#4ade80',
      textColor: '#dcfce7',
      surfaceColor: 'rgba(74, 222, 128, 0.06)',
      description: 'Dark evergreen and muted earthy tones with soft green accent. Natural and focused.'
    },
    {
      id: 'lavender',
      name: 'Lavender',
      mode: 'dark',
      bgColor: '#1d1727',
      accentColor: '#c084fc',
      textColor: '#f3e8ff',
      surfaceColor: 'rgba(192, 132, 252, 0.06)',
      description: 'Muted twilight violet with soft purple accent. Elegant, modern aesthetic.'
    },
    {
      id: 'minimal-light',
      name: 'Minimal Light',
      mode: 'light',
      bgColor: '#f5f5f7',
      accentColor: '#2563eb',
      textColor: '#1e293b',
      surfaceColor: 'rgba(0, 0, 0, 0.03)',
      description: 'Clean off-white daylight background with readable dark text and royal blue accent.'
    }
  ];

  /**
   * Default Extension Settings
   */
  const DEFAULT_SETTINGS = {
    enabled: true,
    themeId: 'midnight',
    bgColor: '#16171d',
    accentColor: '#4d88ff',
    bgImage: null,
    bgOpacity: 85,
    bgBlur: 0,
    bgPosition: 'center',
    bgSize: 'cover'
  };

  /**
   * Validation & Sanitization Utilities
   */
  const UTILS = {
    /**
     * Look up theme configuration by ID
     * @param {string} themeId
     * @returns {object|null}
     */
    getThemeById(themeId) {
      if (!themeId) return null;
      return THEMES.find(t => t.id === themeId) || null;
    },

    /**
     * Validate a hex color string
     * @param {string} val
     * @returns {boolean}
     */
    isValidHexColor(val) {
      return typeof val === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val);
    },

    /**
     * Sanitize settings loaded from storage or user input
     * @param {object} raw
     * @returns {object}
     */
    sanitizeSettings(raw) {
      const src = (raw && typeof raw === 'object') ? raw : {};
      const result = { ...DEFAULT_SETTINGS };

      // Enabled state
      if (typeof src.enabled === 'boolean') {
        result.enabled = src.enabled;
      }

      // Theme ID
      if (typeof src.themeId === 'string' && (UTILS.getThemeById(src.themeId) || src.themeId === 'custom')) {
        result.themeId = src.themeId;
      }

      // Background Color
      if (UTILS.isValidHexColor(src.bgColor)) {
        result.bgColor = src.bgColor.toLowerCase();
      }

      // Accent Color
      if (UTILS.isValidHexColor(src.accentColor)) {
        result.accentColor = src.accentColor.toLowerCase();
      }

      // Background Image (data URL or null)
      if (typeof src.bgImage === 'string' && src.bgImage.startsWith('data:image/')) {
        result.bgImage = src.bgImage;
      } else {
        result.bgImage = null;
      }

      // Opacity: 10 - 100
      const opacityNum = Number(src.bgOpacity);
      if (!Number.isNaN(opacityNum)) {
        result.bgOpacity = Math.max(10, Math.min(100, Math.round(opacityNum)));
      }

      // Blur: 0 - 12
      const blurNum = Number(src.bgBlur);
      if (!Number.isNaN(blurNum)) {
        result.bgBlur = Math.max(0, Math.min(12, Math.round(blurNum)));
      }

      // Position: 'center', 'top', 'bottom'
      const validPositions = ['center', 'top', 'bottom'];
      if (typeof src.bgPosition === 'string' && validPositions.includes(src.bgPosition)) {
        result.bgPosition = src.bgPosition;
      }

      // Size: 'cover', 'contain'
      const validSizes = ['cover', 'contain'];
      if (typeof src.bgSize === 'string' && validSizes.includes(src.bgSize)) {
        result.bgSize = src.bgSize;
      }

      return result;
    },

    /**
     * Map position keyword to standard CSS background-position value
     * @param {string} pos
     * @returns {string}
     */
    toCssPosition(pos) {
      switch (pos) {
        case 'top': return 'center top';
        case 'bottom': return 'center bottom';
        case 'center':
        default:
          return 'center center';
      }
    }
  };

  return {
    THEMES,
    DEFAULT_SETTINGS,
    UTILS
  };
});
