// ==UserScript==
// @name         IG Explore → Fullscreen Swipe (Loader)
// @namespace    ig-explore-fullscreen
// @version      0.18.0
// @description  Loader, který stáhne a spustí /app/main.js z GitHubu (BASE dle main). Autoupdate userscriptu + přepnutí BASE + GM fetch wrapper pro moduly. v0.18.0: Aktualizace verze a data poslední aktualizace - 2025-09-08. Oprava kritických chyb (nedefinované proměnné, syntax chyby), implementace bridge.js pro centralizované propojení modulů, standardizace kódovacího stylu, odstranění debug console.log statements. Vylepšená stabilita a výkon.
// @author       nykadamec
// @match        https://www.instagram.com/*explore*
// @match        https://www.instagram.com/explore/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// @connect      raw.githubusercontent.com
// @connect      github.com
// @updateURL    https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/userscript.js
// @downloadURL  https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/userscript.js
// ==/UserScript==

(function () {
  'use strict';

  if (window.__IGFS_LOADER__) return;
  window.__IGFS_LOADER__ = true;

  // ====== LOADER CONFIG ======
  const DEFAULT_BASE =
    'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/app/'; // musí končit /app/
  const BASE_OVERRIDE_KEY = 'IGFS_APP_BASE';
  const CACHE_KEY = 'IGFS_APP_CACHE_v1';

  // ====== USERSCRIPT AUTUPDATE ======
  const USERJS_RAW_URL =
    'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/userscript.js';
  const USERJS_INSTALL_URL = USERJS_RAW_URL;
  const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
  const LAST_CHECK_KEY = 'IGFS_USERJS_LAST_UPDATE_CHECK';

  // ====== HELPERS ======
  const getBase = () => {
    try {
      const gm = typeof GM_getValue === 'function' ? GM_getValue(BASE_OVERRIDE_KEY) : null;
      if (gm) return String(gm).replace(/\/+$/, '/');
    } catch {}
    try {
      const ls = localStorage.getItem(BASE_OVERRIDE_KEY);
      if (ls) return String(ls).replace(/\/+$/, '/');
    } catch {}
    return DEFAULT_BASE;
  };

  const setBase = (url) => {
    const clean = String(url || '').trim();
    try { GM_setValue && GM_setValue(BASE_OVERRIDE_KEY, clean); } catch {}
    try { localStorage.setItem(BASE_OVERRIDE_KEY, clean); } catch {}
  };
  const clearBase = () => setBase('');

  const saveCache = (code) => {
    try {
      const payload = { code, ts: Date.now(), base: getBase() };
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
        timeout: 20000
      });
    });

  // ====== AUTUPDATE USERSCRIPT ======
  const getCurrentVersion = () => {
    try {
      return (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version)
        ? GM_info.script.version
        : '0.0.0';
    } catch { return '0.0.0'; }
  };

  const cmpSemver = (a, b) => {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] || 0;
      const db = pb[i] || 0;
      if (da < db) return -1;
      if (da > db) return 1;
    }
    return 0;
  };

  const parseVersionFromUserJS = (code) => {
    const m = code.match(/@version\s+([^\s]+)/);
    return m ? m[1].trim() : null;
  };

  const shouldCheckUpdate = () => {
    try {
      const last = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
      return (!last || (Date.now() - last) > CHECK_INTERVAL_MS);
    } catch { return true; }
  };

  const markCheckedNow = () => {
    try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch {}
  };

  const checkForUserscriptUpdate = async (silent = true) => {
    const cur = getCurrentVersion();
    try {
      const remote = await fetchText(USERJS_RAW_URL);
      const remoteVer = parseVersionFromUserJS(remote) || '0.0.0';
      const cmp = cmpSemver(cur, remoteVer);
      if (cmp < 0) {
        if (!silent) {
          if (!confirm(`Nová verze userscriptu je k dispozici (${cur} → ${remoteVer}). Nainstalovat nyní?`)) {
            return { updated: false, current: cur, remote: remoteVer };
          }
        }
        try {
          GM_openInTab(USERJS_INSTALL_URL, { active: true, insert: true });
        } catch {
          window.location.href = USERJS_INSTALL_URL;
        }
        return { updated: true, current: cur, remote: remoteVer };
      } else {
        if (!silent) alert(`Žádná nová verze. Běží ${cur}.`);
        return { updated: false, current: cur, remote: remoteVer };
      }
    } catch (e) {
      if (!silent) alert(`Kontrola aktualizace selhala: ${e && e.message ? e.message : e}`);
      return { error: true, message: e && e.message ? e.message : String(e) };
    } finally {
      markCheckedNow();
    }
  };

  // ====== MENU ======
  try {
    GM_registerMenuCommand('Show current BASE', () => {
      alert(`Current BASE:\n${getBase() || '(default)'}\n\n(main branch /app/)`);
    });
    GM_registerMenuCommand('Set custom BASE…', () => {
      const current = getBase() || '';
      const next = prompt(
        'Enter BASE URL (must end with /app/), e.g.\nhttps://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/<branch-or-commit>/app/',
        current
      );
      if (next && next.trim()) {
        setBase(next.trim());
        alert('BASE updated. Reload page to apply.');
      }
    });
    GM_registerMenuCommand('Use default BASE (main)', () => {
      clearBase();
      alert('Reverted to default BASE (main). Reload page to apply.');
    });
    GM_registerMenuCommand('Check userscript updates', async () => {
      await checkForUserscriptUpdate(false);
    });
    GM_registerMenuCommand('Reinstall userscript…', () => {
      try { GM_openInTab(USERJS_INSTALL_URL, { active: true, insert: true }); }
      catch { window.location.href = USERJS_INSTALL_URL; }
    });
  } catch {}

  // ====== AUTO-KONTROLA USERSCRIPTU 1×/24h ======
  (async function autoUpdateUserJS() {
    if (shouldCheckUpdate()) checkForUserscriptUpdate(true);
  })();

  // ====== BOOT APP ======
  (async function bootApp() {
    // 1) Nastav BASE globálně, aby si ho /app/main.js převzal
    const base = getBase();
    window.__IGFS_BASE_RAW__ = base;

    // 2) GM wrapper zpřístupnit i eval-nutým modulům
    window.__IGFS_GM_FETCH__ = function (url, timeout = 20000) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          headers: { 'Cache-Control': 'no-cache' },
          timeout,
          onload: (r) => (r.status >= 200 && r.status < 300)
            ? resolve(r.responseText)
            : reject(new Error('HTTP ' + r.status)),
          onerror: () => reject(new Error('Network error')),
          ontimeout: () => reject(new Error('Timeout')),
        });
      });
    };

    // 3) Stáhni a spusť /app/main.js
    const src = base + 'main.js';
    try {
      const code = await fetchText(src);
      saveCache(code);
      evalWithSourceURL(code, src);
      console.info('[IGFS Loader] Loaded app from BASE:', base);
    } catch (e) {
      console.warn('[IGFS Loader] Fetch failed:', e?.message || e);
      const cached = loadCache();
      if (cached?.code) {
        console.info('[IGFS Loader] Using cached app bundle from', new Date(cached.ts).toISOString(), 'BASE:', cached.base);
        if (cached.base) window.__IGFS_BASE_RAW__ = cached.base;
        evalWithSourceURL(cached.code, 'cache:/app/main.js');
      } else {
        console.error('[IGFS Loader] No cache available. App not started.');
        alert('IGFS failed to load modules. See console for details.');
      }
    }
  })();
})();
