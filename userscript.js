// ==UserScript==
// @name         IG Explore → Fullscreen Swipe (Loader)
// @namespace    ig-explore-fullscreen
// @version      3.0.0
// @description  Loader, který stáhne a spustí /app/main.js z GitHubu.
// @author       nykadamec
// @match        https://www.instagram.com/*explore*
// @match        https://www.instagram.com/explore/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  'use strict';

  // -------- Singleton guard pro loader --------
  if (window.__IGFS_LOADER__) return;
  window.__IGFS_LOADER__ = true;

  // ====== KONFIGURACE ======
  // Výchozí zdroj APP skriptu z GitHubu (main branch):
  const DEFAULT_SRC =
    'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/app/main.js';

  // Možnost přepnout zdroj dynamicky (pro rychlý test bez přepisu kódu)
  // 1) v konzoli: localStorage.setItem('IGFS_APP_SRC', 'https://.../main.js')
  // 2) nebo přes userscript menu (viz níže)
  const OVERRIDE_KEY = 'IGFS_APP_SRC';

  // Lokální cache (pro případ výpadku sítě)
  const CACHE_KEY = 'IGFS_APP_CACHE_v1';

  // ====== HELPERY ======
  const getOverride = () => {
    try {
      // preferuj GM storage, když existuje
      const gm = GM_getValue(OVERRIDE_KEY);
      if (gm) return gm;
    } catch {}
    try {
      const ls = localStorage.getItem(OVERRIDE_KEY);
      if (ls) return ls;
    } catch {}
    return null;
  };

  const setOverride = (url) => {
    try { GM_setValue(OVERRIDE_KEY, url); } catch {}
    try { localStorage.setItem(OVERRIDE_KEY, url); } catch {}
  };

  const clearOverride = () => setOverride('');

  const saveCache = (code) => {
    try {
      const payload = { code, ts: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };

  const evalWithSourceURL = (code, label) => {
    // Zajistí pěknější stacktrace v konzoli
    // eslint-disable-next-line no-new-func
    new Function(`${code}\n//# sourceURL=${label}`)();
  };

  const fetchText = (url) =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'Cache-Control': 'no-cache' },
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            resolve(res.responseText);
          } else {
            reject(new Error(`HTTP ${res.status}`));
          }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
        timeout: 12000
      });
    });

  // ====== MENU (rychlé přepínání zdroje) ======
  try {
    GM_registerMenuCommand('Set custom APP src…', () => {
      const current = getOverride() || '';
      const next = prompt('Enter URL to /app/main.js (raw):', current);
      if (next && next.trim()) {
        setOverride(next.trim());
        alert('APP src updated. Reload page to apply.');
      }
    });
    GM_registerMenuCommand('Use default APP src', () => {
      clearOverride();
      alert('Reverted to default src. Reload page to apply.');
    });
  } catch {}

  // ====== BOOT ======
  (async function boot() {
    const src = getOverride() || DEFAULT_SRC;
    try {
      const code = await fetchText(src);
      saveCache(code);
      evalWithSourceURL(code, src);
    } catch (e) {
      console.warn('[IGFS Loader] Fetch failed:', e?.message || e);
      const cached = loadCache();
      if (cached?.code) {
        console.info('[IGFS Loader] Using cached app bundle from', new Date(cached.ts).toISOString());
        evalWithSourceURL(cached.code, 'cache:/app/main.js');
      } else {
        console.error('[IGFS Loader] No cache available. App not started.');
      }
    }
  })();
})();
