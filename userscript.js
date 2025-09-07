// ==UserScript==
// @name         IG Explore → Fullscreen Swipe (Loader)
// @namespace    ig-explore-fullscreen
// @version      0.11
// @description  Loader, který stáhne a spustí /app/main.js z GitHubu. Umí i autoupdate samotného userscriptu.
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

  // -------- Singleton guard pro loader --------
  if (window.__IGFS_LOADER__) return;
  window.__IGFS_LOADER__ = true;

  // ====== KONFIGURACE APP LOADERU ======
  const DEFAULT_SRC =
    'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/app/main.js';
  const OVERRIDE_KEY = 'IGFS_APP_SRC';
  const CACHE_KEY = 'IGFS_APP_CACHE_v1';

  // ====== KONFIGURACE AUTOUPDATE USERSCRIPTU ======
  // Kde je MASTER verze userscriptu (raw):
  const USERJS_RAW_URL =
    'https://raw.githubusercontent.com/nykadamec/Ios_ig_explore_carousell_fullscreen/main/userscript.js';
  // URL pro instalaci (většinou stejné):
  const USERJS_INSTALL_URL = USERJS_RAW_URL;

  // Jak často provádět kontrolu (ms)
  const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
  const LAST_CHECK_KEY = 'IGFS_USERJS_LAST_UPDATE_CHECK';

  // ====== HELPERY (APP) ======
  const getOverride = () => {
    try {
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
        timeout: 15000
      });
    });

  // ====== HELPERY (AUTUPDATE) ======
  const getCurrentVersion = () => {
    try {
      // Tampermonkey: GM_info.script.version
      // Violentmonkey/Greasemonkey může mít variace, ale většinou funguje.
      return (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '0.0.0';
    } catch {
      return '0.0.0';
    }
  };

  // Jednoduché semver porovnání (vrací -1/0/1)
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
    // Hledáme @version XYZ v metadatech
    const m = code.match(/@version\s+([^\s]+)/);
    return m ? m[1].trim() : null;
  };

  const shouldCheckUpdate = () => {
    try {
      const last = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
      return (!last || (Date.now() - last) > CHECK_INTERVAL_MS);
    } catch {
      return true;
    }
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
        // je novější verze
        if (!silent) {
          if (!confirm(`Nová verze userscriptu je k dispozici (${cur} → ${remoteVer}). Nainstalovat nyní?`)) {
            return { updated: false, current: cur, remote: remoteVer };
          }
        }
        try {
          GM_openInTab(USERJS_INSTALL_URL, { active: true, insert: true });
        } catch {
          // fallback – přesměrování v aktuálním tabu (může otevřít instalační dialog přímo)
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
    GM_registerMenuCommand('Check for userscript updates now', async () => {
      await checkForUserscriptUpdate(false);
    });
    GM_registerMenuCommand('Reinstall userscript…', () => {
      try { GM_openInTab(USERJS_INSTALL_URL, { active: true, insert: true }); }
      catch { window.location.href = USERJS_INSTALL_URL; }
    });
  } catch {}

  // ====== AUTO-KONTROLA USERSCRIPTU (1× za 24h) ======
  (async function autoUpdateUserJS() {
    if (shouldCheckUpdate()) {
      checkForUserscriptUpdate(true);
    }
  })();

  // ====== BOOT APP ======
  (async function bootApp() {
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