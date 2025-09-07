// /app/main.js
// IG Explore → Fullscreen Swipe (iOS-only) — Module Orchestrator
// Načte moduly z /app/* přes GM_xmlhttpRequest (CSP-safe), potom spustí App.init()

(function () {
  'use strict';

  if (window.__IGFS_ACTIVE__) return;
  window.__IGFS_ACTIVE__ = true;

  // ---------- Konfigurace cesty ----------
  // Pokud spouštíš z main branch:
  const BASE_RAW = 'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/app/';
  // Pro test jiného commitu/branch můžeš přepsat BASE_RAW přes localStorage/GM_value:
  try {
    const override = (typeof GM_getValue === 'function' && GM_getValue('IGFS_APP_BASE')) || localStorage.getItem('IGFS_APP_BASE');
    if (override) window.__IGFS_BASE_RAW__ = String(override).replace(/\/+$/, '/') ;
  } catch {}
  const BASE = window.__IGFS_BASE_RAW__ || BASE_RAW;

  // ---------- Mini loader modulu ----------
  function gmFetchText(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('GM_xmlhttpRequest not available')); return;
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 20000,
        onload: (r) => (r.status >= 200 && r.status < 300) ? resolve(r.responseText) : reject(new Error('HTTP '+r.status)),
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout'))
      });
    });
  }

  async function loadModule(filename) {
    const url = BASE + filename;
    const code = await gmFetchText(url);
    // ESM neumíme přímo, takže každý modul exportuje skrze window.IGFS.<name>
    // eval s sourceURL kvůli hezčím stackům
    new Function(code + `\n//# sourceURL=${url}`)();
  }

  // ---------- Pořadí modulů ----------
  const MODULES = [
    'utils.js',
    'icons.js',
    'ui.js',
    'collect.js',
    'preload.js',
    'infinite.js',
    'app.js',
  ];

  (async function boot() {
    try {
      for (const m of MODULES) await loadModule(m);
      // Spusť aplikaci
      if (!window.IGFS || !window.IGFS.App || !window.IGFS.App.init) throw new Error('App not loaded');
      window.IGFS.App.init();
    } catch (e) {
      console.error('[IGFS] Boot failed:', e);
      alert('IGFS failed to load modules. See console for details.');
    }
  })();
})();
