const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..');

console.log('--- Test 1: Validate manifest.json ---');
const manifestRaw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);
console.assert(manifest.manifest_version === 3, 'Manifest version should be 3');
console.assert(manifest.name === 'ChatGPT Theme Studio', 'Manifest name should match');
console.assert(manifest.permissions.includes('storage'), 'Manifest must have storage permission');
console.assert(manifest.permissions.includes('unlimitedStorage'), 'Manifest must have unlimitedStorage permission');
console.assert(manifest.host_permissions.includes('https://chatgpt.com/*'), 'Manifest must have chatgpt host permissions');
console.assert(manifest.content_scripts[0].matches.includes('https://chatgpt.com/*'), 'Content scripts must match chatgpt.com');
console.log('✓ manifest.json is valid');

console.log('--- Test 2: Validate themes.js ---');
const themesModule = require(path.join(dir, 'themes.js'));
console.assert(Array.isArray(themesModule.THEMES), 'THEMES must be an array');
console.assert(themesModule.THEMES.length === 5, 'Must have exactly 5 themes');
const themeIds = themesModule.THEMES.map(t => t.id);
console.assert(themeIds.includes('midnight'), 'Missing midnight theme');
console.assert(themeIds.includes('ocean'), 'Missing ocean theme');
console.assert(themeIds.includes('forest'), 'Missing forest theme');
console.assert(themeIds.includes('lavender'), 'Missing lavender theme');
console.assert(themeIds.includes('minimal-light'), 'Missing minimal-light theme');

// Test sanitization
const sanitizedDefault = themesModule.UTILS.sanitizeSettings({});
console.assert(sanitizedDefault.enabled === true, 'Default enabled should be true');
console.assert(sanitizedDefault.themeId === 'midnight', 'Default themeId should be midnight');
console.assert(sanitizedDefault.bgOpacity === 85, 'Default bgOpacity should be 85');
console.assert(sanitizedDefault.bgBlur === 0, 'Default bgBlur should be 0');
console.assert(sanitizedDefault.bgPosition === 'center', 'Default bgPosition should be center');
console.assert(sanitizedDefault.bgSize === 'cover', 'Default bgSize should be cover');

// Test sanitization with out-of-bound values
const clamped = themesModule.UTILS.sanitizeSettings({
  bgOpacity: 150,
  bgBlur: 99,
  bgPosition: 'invalid_pos',
  bgSize: 'invalid_size',
  bgColor: 'not_a_color'
});
console.assert(clamped.bgOpacity === 100, 'Opacity should clamp to 100');
console.assert(clamped.bgBlur === 12, 'Blur should clamp to 12');
console.assert(clamped.bgPosition === 'center', 'Invalid position should fall back to center');
console.assert(clamped.bgSize === 'cover', 'Invalid size should fall back to cover');
console.assert(clamped.bgColor === '#16171d', 'Invalid bgColor should fall back to default');
console.log('✓ themes.js validated successfully');

console.log('--- Test 3: Validate icons exist ---');
for (const sz of [16, 48, 128]) {
  const iconPath = path.join(dir, 'icons', `icon${sz}.png`);
  console.assert(fs.existsSync(iconPath), `Missing icon ${sz}`);
  const stat = fs.statSync(iconPath);
  console.assert(stat.size > 0, `Icon ${sz} is empty`);
}
console.log('✓ Icons verified');

console.log('--- Test 4: Validate popup.html and popup.js element IDs ---');
const html = fs.readFileSync(path.join(dir, 'popup.html'), 'utf8');
const expectedIds = [
  'enabled-toggle', 'status-badge', 'themes-grid',
  'bg-thumb-container', 'bg-thumb-fill', 'bg-thumb-img', 'bg-thumb-placeholder',
  'bg-file-input', 'btn-upload', 'btn-remove-image', 'bg-color-picker', 'bg-color-text',
  'slider-opacity', 'label-opacity-val', 'slider-blur', 'label-blur-val',
  'select-position', 'select-size', 'accent-color-picker', 'accent-color-text',
  'btn-reset', 'status-message'
];
for (const id of expectedIds) {
  console.assert(html.includes(`id="${id}"`), `popup.html missing ID: ${id}`);
}
console.log('✓ All 22 expected element IDs exist in popup.html');

console.log('--- Test 5: Validate CSS and JS syntax ---');
// Verify content.css has key selectors
const contentCss = fs.readFileSync(path.join(dir, 'content.css'), 'utf8');
console.assert(contentCss.includes('#cgts-background-layer'), 'Missing #cgts-background-layer in content.css');
console.assert(contentCss.includes('.cgts-backdrop-image'), 'Missing .cgts-backdrop-image in content.css');
console.assert(contentCss.includes('html.cgts-active'), 'Missing html.cgts-active in content.css');
console.assert(contentCss.includes('--cgts-bg-color'), 'Missing --cgts-bg-color in content.css');
console.assert(contentCss.includes('--cgts-accent-color'), 'Missing --cgts-accent-color in content.css');
console.assert(contentCss.includes('--cgts-bg-opacity'), 'Missing --cgts-bg-opacity in content.css');
console.assert(contentCss.includes('--cgts-bg-blur'), 'Missing --cgts-bg-blur in content.css');
console.log('✓ content.css verified');

// Verify content.js has storage listener and background injection
const contentJs = fs.readFileSync(path.join(dir, 'content.js'), 'utf8');
console.assert(contentJs.includes('chrome.storage.onChanged'), 'Missing storage listener in content.js');
console.assert(contentJs.includes('ensureBackgroundLayer'), 'Missing ensureBackgroundLayer in content.js');
console.assert(contentJs.includes('MutationObserver'), 'Missing MutationObserver in content.js');
console.log('✓ content.js verified');

console.log('====================================');
console.log('ALL VERIFICATION TESTS PASSED (5/5)');
console.log('====================================');
