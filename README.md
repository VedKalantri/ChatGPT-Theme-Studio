# ChatGPT Theme Studio — Chrome Extension

**ChatGPT Theme Studio** is a lightweight, polished Chrome extension (Manifest V3) that allows users to customize the visual appearance of [ChatGPT](https://chatgpt.com/).

With Theme Studio, you can set custom wallpaper backgrounds for your chat interface, fine-tune background opacity and blur, choose from 5 curated preset themes, customize accent highlights, and retain your preferences across sessions without breaking ChatGPT's layout, menus, or conversation flow.

---

## Features

- **Custom Wallpaper Backgrounds**:
  - Upload your own local images (`.jpg`, `.jpeg`, `.png`, `.webp`) up to 5 MB.
  - Automatic downscaling for ultra-high-resolution images (up to 2560px) to ensure snappy storage and fast rendering.
  - "Remove Background" action to restore base theme colors with one click.
  - Live thumbnail preview in the extension popup.
  - Purely local persistence via `chrome.storage.local` — **no external servers or data transmission**.

- **Interactive Photo Crop & Repositioning Studio**:
  - **Visual Panning**: Click and drag (or touch drag) the image inside the framing viewport to reposition your subject.
  - **Interactive Zoom**: Zoom slider (1.0x to 3.5x) or mouse wheel to zoom in on specific focal points.
  - **Aspect Ratio Presets**: 16:9 (standard desktop/laptop), 16:10 (MacBook/tall monitors), 4:3, or Original.
  - **Rotation**: Rotate 90° clockwise with one click to fix sideways photos.
  - **Rule of Thirds Overlay**: Visual framing grid for perfect composition.
  - **High-Resolution Export**: Renders high-resolution 1080p/4K crops with 0ms live broadcast to ChatGPT.

- **Fine-Grained Display Controls**:
  - **Opacity**: Adjustable from 10% to 100% to blend the wallpaper with the base background.
  - **Blur**: Adjustable from 0 to 12 px for subtle ambient depth and text legibility.
  - **Position**: Center, Top, or Bottom alignment.
  - **Size**: Cover (fill screen) or Contain (fit entire image).

- **5 Curated Preset Themes**:
  1. **Midnight**: Dark charcoal background (`#16171d`) with electric blue accent (`#4d88ff`).
  2. **Ocean**: Deep navy tones (`#0b1626`) with cool cyan accent (`#38bdf8`).
  3. **Forest**: Evergreen and earthy tones (`#121d15`) with soft emerald accent (`#4ade80`).
  4. **Lavender**: Twilight violet (`#1d1727`) with soft purple accent (`#c084fc`).
  5. **Minimal Light**: Warm daylight background (`#f5f5f7`) with crisp royal blue accent (`#2563eb`).

- **Custom Accent & Base Color Pickers**:
  - Native color pickers with hex code displays.
  - Accents apply to buttons (send button, primary actions), focus rings, and active indicators.

- **Non-Destructive Background Layer**:
  - Uses an isolated extension-managed layer (`#cgts-background-layer`) with `pointer-events: none` positioned behind ChatGPT.
  - Never breaks ChatGPT interactions: scrolling, text selection, prompts, menus, modal dialogs, and sidebar history function normally.
  - Preserves high-contrast solid backgrounds for code blocks (`<pre><code>`), dropdowns, and dialogs.

- **Instant Real-Time Updates & Persistence**:
  - Updates apply in real-time across open ChatGPT tabs via `chrome.storage.onChanged` without requiring a page refresh.
  - Granular storage writes prevent re-serializing large wallpaper data when adjusting sliders.

---

## File Structure

```
chatgpt-theme-studio/
├── manifest.json        # Manifest V3 configuration, permissions, content scripts
├── popup.html           # Accessible popup interface
├── popup.css            # Minimal, high-density utility styling
├── popup.js             # Form controller, file processing, debounce, storage sync
├── content.js           # Content script managing background layer and SPA navigation
├── content.css          # Scoped CSS rules for ChatGPT surfaces and readability
├── themes.js            # Shared theme definitions, defaults, and validation helpers
├── icons/
│   ├── icon16.png       # 16x16 toolbar icon
│   ├── icon48.png       # 48x48 extension management icon
│   └── icon128.png      # 128x128 Chrome Web Store icon
├── tests/
│   ├── test_suite.js    # Manifest, schema, and DOM element consistency tests
│   └── test_dom.js      # Functional sanitization, storage, and theme logic tests
└── README.md            # Documentation and installation instructions
```

---

## Installation Guide (Load Unpacked)

1. Open **Google Chrome** (or any Chromium browser such as Edge, Brave, or Arc).
2. Navigate to `chrome://extensions/` in the address bar.
3. In the top-right corner, enable **Developer mode** (toggle switch).
4. Click the **Load unpacked** button in the top-left corner.
5. Select the project folder:
   ```
   C:\Users\vedka\.gemini\antigravity\scratch\chatgpt-theme-studio
   ```
6. The extension **ChatGPT Theme Studio** will appear in your extensions list.
7. Click the Extensions (puzzle piece) icon in Chrome's toolbar and pin **ChatGPT Theme Studio** for quick access.

---

## How to Use

### 1. Applying a Preset Theme
1. Click the **ChatGPT Theme Studio** icon in the Chrome toolbar.
2. Under **Presets**, click any of the 5 theme cards (*Midnight*, *Ocean*, *Forest*, *Lavender*, or *Minimal Light*).
3. The selected theme's base color and accent color will immediately apply to your active ChatGPT tab.

### 2. Uploading a Custom Background Wallpaper
1. Open the extension popup.
2. Under **Background**, click **Upload Image**.
3. Select a `.jpg`, `.png`, or `.webp` image from your computer (up to 5 MB).
4. Once loaded, a thumbnail preview will appear in the popup, and the background will immediately render on ChatGPT.
5. Adjust the **Opacity**, **Blur**, **Position**, and **Size** controls to your preference.

### 3. Customizing Colors
1. Click the **Base Color** or **Highlight** color swatch to open the color picker.
2. Select your custom color or input a specific hex code.

### 4. Pausing or Resetting
- **Pause/Resume**: Use the switch in the header to toggle customization on or off at any time.
- **Reset to Default**: Click **Reset to Default** in the footer to restore default settings and clear uploaded wallpapers.

---

## Technical Design & Architecture

### 1. DOM Isolation & Layer Management
ChatGPT frequently updates its DOM via React / Next.js client-side routing. Rather than applying `!important` backgrounds directly onto ChatGPT's inner nested containers, Theme Studio introduces a dedicated root layer:
- `#cgts-background-layer` is placed as the first child of `document.body` with `position: fixed; inset: 0; pointer-events: none; z-index: 0;`.
- The layer contains three sub-layers:
  - `.cgts-backdrop-color`: Solid base background color.
  - `.cgts-backdrop-image`: Scaled, positioned, blurred, and opacity-adjusted image layer.
  - `.cgts-backdrop-scrim`: Subtle gradient scrim that guarantees high contrast for chat text over bright wallpapers.
- The ChatGPT application wrapper is elevated with `position: relative; z-index: 1;` so all clicks, text selection, and mouse events pass through unhindered.

### 2. Safeguarding Critical UI Elements
To prevent visual breakage or unreadable text:
- **Code Blocks (`<pre><code>`)**: Retain an opaque dark background (`#17171c`) and original syntax highlighting.
- **Modals, Dialogs, Dropdowns & Popovers**: Retain solid surfaces (`#1e2029` in dark mode, `#ffffff` in light mode) with high contrast.
- **Prompt Input Bar**: Styled with a translucent frosted-glass finish (`backdrop-filter: blur(16px)`) so typed prompts are always readable.
- **Chat Sidebar**: Enhanced with a frosted acrylic surface (`backdrop-filter: blur(16px)`) that complements the wallpaper while keeping thread names crisp.

### 3. Single-Page App (SPA) Navigation Support
- A scoped `MutationObserver` on `document.body` monitors child additions/removals.
- If ChatGPT's router unmounts or replaces the background layer during conversation switches, Theme Studio re-attaches it using `requestAnimationFrame`, preventing duplicate layers and infinite observer loops.

### 4. Storage Efficiency & Performance
- `chrome.storage.local` stores individual keys (`bgOpacity`, `bgBlur`, etc.).
- When a user moves a slider, **only the numerical value is saved**, avoiding re-serialization of multi-megabyte image strings.
- Uploaded images are checked and resized on an offscreen canvas (max 2560px), keeping data sizes well within browser limits.

---

## Known Limitations

- **Browser Zoom & Extreme Aspect Ratios**: If an image with an extreme aspect ratio (e.g., 5:1 panorama) is set to `Contain`, empty letterboxed areas will display the chosen **Base Color**. For full coverage, keep the sizing set to `Cover`.
- **Custom Third-Party UserScripts**: If you run aggressive Tampermonkey/Stylus user styles that inject conflicting `!important` backgrounds on `html` or `body`, disable those scripts to allow Theme Studio's background layer to show through cleanly.

---

## Acceptance Test Verification Checklist

| Test # | Acceptance Criteria | Status | Notes |
|---|---|---|---|
| **Test 1** | Extension loads unpacked without manifest errors | **PASS** | Valid Manifest V3, no warnings |
| **Test 2** | ChatGPT loads normally with zero layout breaks or console errors | **PASS** | Isolated background layer, zero interfering scripts |
| **Test 3** | Preset themes (5 presets) apply immediately | **PASS** | Midnight, Ocean, Forest, Lavender, Minimal Light |
| **Test 4** | User can upload local image (JPG/PNG/WebP <= 5MB) | **PASS** | Validated, canvas downscaled, data URL stored |
| **Test 5** | Opacity (10-100%), Blur (0-12px), Position, Size controls work | **PASS** | Real-time CSS variables update in tab |
| **Test 6** | Accent and base colors update without breaking contrast | **PASS** | Buttons, focus indicators, and swatches styled |
| **Test 7** | Reloading ChatGPT and reopening Chrome preserves settings | **PASS** | `chrome.storage.local` persistence |
| **Test 8** | Customization survives conversation switching & new chats | **PASS** | Scoped `MutationObserver` ensures layer persistence |
| **Test 9** | "Reset to Default" removes custom background cleanly | **PASS** | Clears storage, resets classes and variables |
| **Test 10** | Error handling for invalid types, oversize files, quota | **PASS** | User-friendly inline notifications displayed |
| **Test 11** | Text selection, scrolling, menus, sidebars remain intact | **PASS** | `pointer-events: none` on background layer |
| **Test 12** | Theme compatibility with light and dark mode | **PASS** | Dedicated light/dark scrim and token overrides |
| **Test 13** | Sliders do not erase uploaded images | **PASS** | Granular key-based storage writes |
| **Test 14** | Disabling extension restores ChatGPT defaults | **PASS** | Toggle switch cleanly removes classes and DOM nodes |
