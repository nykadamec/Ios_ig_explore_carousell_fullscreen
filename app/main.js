// /app/main.js
// IG Explore → Fullscreen Swipe (iOS-only) — Module Orchestrator v0.19.8 (2025-09-08)
// Načte moduly z /app/* (BASE z window.__IGFS_BASE_RAW__), poté spustí App.init()

(function () {
  'use strict';

  if (window.__IGFS_ACTIVE__) return;
  window.__IGFS_ACTIVE__ = true;

  // ---------- Initialize IGFS namespace and basic Console ----------
  const IGFS = (window.IGFS = window.IGFS || {});
  
  // Create minimal Console object to prevent errors during module loading
  IGFS.Console = {
    log: function(...args) { 
      console.log('[IGFS]', ...args); 
    },
    error: function(...args) { 
      console.error('[IGFS]', ...args); 
    },
    warn: function(...args) { 
      console.warn('[IGFS]', ...args); 
    },
    info: function(...args) { 
      console.info('[IGFS]', ...args); 
    },
    debug: function(...args) { 
      console.debug('[IGFS]', ...args); 
    }
  };

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
    let code;
    try {
      code = await gmFetchText(url);
      // Každý modul exportuje přes window.IGFS.*
      new Function(code + `\n//# sourceURL=${url}`)();
      
      // Kontrola, zda modul správně exportoval do IGFS
      if (filename === 'console.js' && (!window.IGFS || !window.IGFS.Console || !window.IGFS.Console.log)) {
        throw new Error('Console module loaded but IGFS.Console not properly exported');
      }
      if (filename === 'ui.js' && (!window.IGFS || !window.IGFS.UI)) {
        throw new Error('UI module loaded but IGFS.UI not exported');
      }
      if (filename === 'icons.js' && (!window.IGFS || !window.IGFS.ti)) {
        throw new Error('Icons module loaded but IGFS.ti not exported');
      }
      if (filename === 'app.js' && (!window.IGFS || !window.IGFS.App)) {
        throw new Error('App module loaded but IGFS.App not exported');
      }
      
      IGFS.Console.log(`[IGFS] Module ${filename} loaded and exported correctly`);
    } catch (moduleError) {
      IGFS.Console.error(`[IGFS] Detailed error loading ${filename}:`, {
        message: moduleError.message,
        stack: moduleError.stack,
        url: url,
        codeLength: code ? code.length : 'unknown'
      });
      throw new Error(`Module load failed: ${filename} - ${moduleError.message}`);
    }
  }

  // ---------- Pořadí modulů ----------
  const modules = ['console.js', 'utils.js', 'icons.js', 'ui.js', 'collect.js', 'bridge.js', 'infinite.js', 'app.js'];

  (async function boot() {
    try {
      IGFS.Console.log('[IGFS] Starting module loading...');

      if (window.IGFS && window.IGFS.Debug && window.IGFS.Debug.debugLog) {
        window.IGFS.Debug.debugLog('🚀 Starting IGFS module loading');
      }

      for (const m of MODULES) {
        IGFS.Console.log(`[IGFS] Loading module: ${m}`);
        try {
          await loadModule(m);
          IGFS.Console.log(`[IGFS] Successfully loaded module: ${m}`);
        } catch (moduleError) {
          IGFS.Console.error(`[IGFS] Failed to load module ${m}:`, moduleError);
          throw new Error(`Module load failed: ${m}`);
        }
      }

      IGFS.Console.log('[IGFS] All modules loaded, checking IGFS object...');
      if (!window.IGFS) {
        throw new Error('IGFS object not created');
      }

      IGFS.Console.log('[IGFS] IGFS object exists, checking App module...');
      if (!window.IGFS.App) {
        throw new Error('App module not loaded');
      }

      IGFS.Console.log('[IGFS] App module exists, checking init function...');
      if (!window.IGFS.App.init) {
        throw new Error('App.init function not found');
      }

      IGFS.Console.log('[IGFS] Initializing App...');
      window.IGFS.App.init();
      IGFS.Console.log('[IGFS] App initialized successfully');

      if (window.IGFS && window.IGFS.Debug && window.IGFS.Debug.debugLog) {
        window.IGFS.Debug.debugLog('✅ IGFS fully initialized and ready', 'success');
      }
    } catch (e) {
      IGFS.Console.error('[IGFS] Boot failed:', e);
      alert('IGFS failed to load modules. See console for details.');
    }
  })();
})();
