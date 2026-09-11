/**
 * Fume menu — site configuration.
 * Deploying? The ONLY thing you normally change here is API_URL.
 */
window.FUME_CONFIG = {
  // Google Apps Script web app URL (Code.gs deployment), ending in /exec.
  // Example: "https://script.google.com/macros/s/AKfycb.../exec"
  // Leave "" to serve the bundled data file (public/data/menu.json) instead.
  API_URL: "https://script.google.com/macros/s/AKfycbxxTpcDHUtDku7PX3o18ul_LJxoj-gcEm8QtPFmvU-ujUa-2xfsDuX72NQ-r5dvN-KtIQ/exec",

  // Which menu (column "menu" in the Menu sheet) to fetch from Apps Script.
  MENU_NAME: "Fume Menu",

  // Local fallback used when API_URL is empty or unreachable.
  FALLBACK_URL: "data/menu.json",

  // Cache fetched menu in localStorage for this many minutes (0 = no cache).
  CACHE_MINUTES: 5,

  // Each request times out so a failed connection does not leave a permanent spinner.
  REQUEST_TIMEOUT_MS: 12000
};
