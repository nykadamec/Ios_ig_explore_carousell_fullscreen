// /app/main.js
// IG Explore → Fullscreen Swipe (iOS-only) — Module Orchestrator
// Načte moduly z /app/* (BASE z window.__IGFS_BASE_RAW__), poté spustí App.init()

(function () {
  'use strict';

  if (window.__IGFS_ACTIVE__) return;
  window.__IGFS_ACTIVE__ = true;

  // ---------- BASE ----------
  // Preferuj BASE z loaderu; fallback na main/app/
  const DEFAULT_BASE =
    'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/app/';
  const BASE = (typeof window.__IGFS_BASE_RAW__ === 'string' && window.__IGFS_BASE_RAW__.endsWith('/'))
    ? window.__IGFS_BASE_RAW__
    : DEFAULT_BASE;

  // ---------- GM fetch wrapper ----------
  function gmFetchText(url) {
    // 1) Preferuj wrapper z loaderu (funguje spolehlivě i v eval kontextu)
    if (typeof window.__IGFS_GM_FETCH__ === 'function') {
      return window.__IGFS_GM_FETCH__(url, 20000);
    }
    // 2) Fallback: přímo GM_xmlhttpRequest (když je dostupný)
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('GM_xmlhttpRequest not available'));
        return;
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 20000,
        onload: (r) =>
          r.status >= 200 && r.status < 300
            ? resolve(r.responseText)
            : reject(new Error('HTTP ' + r.status)),
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }

  async function loadModule(filename) {
    const url = BASE + filename;
    const code = await gmFetchText(url);
    // Každý modul exportuje přes window.IGFS.*
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

      if (!window.IGFS || !window.IGFS.App || !window.IGFS.App.init) {
        throw new Error('App not loaded');
      }
      window.IGFS.App.init();
    } catch (e) {
      console.error('[IGFS] Boot failed:', e);
      alert('IGFS failed to load modules. See console for details.');
    }
  })();
})();
