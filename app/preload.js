// /app/preload.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { deThumbURL, pickLargestFromSrcset } = IGFS;

  let preferHQ = true;

  function setPreferHQ(v){ preferHQ = !!v; }
  function getPreferHQ(){ return !!preferHQ; }

  // Mapa pro cacheování HQ URL
  const hqCache = new Map();
  
  // Časování cache v milisekundách (5 minut)
  const CACHE_TTL = 5 * 60 * 1000;
  
  async function resolveHQ(it){
    // Kontrola cache
    if (hqCache.has(it.href)) {
      const cached = hqCache.get(it.href);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.url;
      } else {
        // Vypršela platnost cache, odstranění
        hqCache.delete(it.href);
      }
    }
    
    // Pokud je HQ URL již k dispozici, vraťte ji
    if (it.hq) {
      hqCache.set(it.href, { url: it.hq, timestamp: Date.now() });
      return it.hq;
    }
    
    let bestUrl = null;
    
    // Vždy se pokusit získat největší verzi z srcset
    if (it.srcset) {
      const best = pickLargestFromSrcset(it.srcset);
      if (best) {
        bestUrl = deThumbURL(best);
      }
    }
    
    // Pokud nebyla největší verze nalezena v srcset, použijte low-res
    if (!bestUrl && it.low) {
      bestUrl = deThumbURL(it.low);
    }
    
    // Uložit do cache
    if (bestUrl) {
      hqCache.set(it.href, { url: bestUrl, timestamp: Date.now() });
      it.hq = bestUrl;
    }
    
    return bestUrl || it.low;
  }

  function swapDisplayedToHQ(item, hqUrl){
    if (!item || !item.node || !hqUrl) return;
    if (!preferHQ) return;
    const imgEl = item.node.querySelector('img');
    if (!imgEl || imgEl.src === hqUrl) return;

    const onload = () => {
      imgEl.classList.remove('igfs-loading');
      const spinner = item.node.querySelector('.igfs-spinner');
      if (spinner) spinner.style.display = 'none';
      // Správně nastavit rozměry z načteného obrázku
      item.w = imgEl.naturalWidth || imgEl.width || 0;
      item.h = imgEl.naturalHeight || imgEl.height || 0;
      imgEl.removeEventListener('load', onload);
      // Aktualizovat index po změně rozměrů
      if (window.IGFS && window.IGFS.App && window.IGFS.App.updateIndex) {
        window.IGFS.App.updateIndex();
      }
    };
    imgEl.addEventListener('load', onload);
    imgEl.setAttribute('data-quality','hq');
    imgEl.src = hqUrl;
  }

  // Pokročilý retry mechanismus s exponenciálním backoffem a detekcí typu chyby
  async function loadWithRetry(url, maxRetries = 4, baseDelay = 250) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const img = new Image();
        return await new Promise((resolve, reject) => {
          img.onload = () => resolve(img.src);
          img.onerror = (error) => {
            const errorType = error.type || 'unknown';
            console.warn(`Attempt ${attempt} failed for ${url} (type: ${errorType}):`, error);
            
            // Pokud je chyba typu "aborted", zkuste okamžitě znovu bez čekání
            if (errorType === 'abort') {
              // Žádné čekání pro aborted požadavky
              reject(new Error(`Aborted attempt ${attempt}`));
              return;
            }
            
            if (attempt === maxRetries) {
              reject(new Error(`Failed to load after ${maxRetries} attempts`));
            } else {
              // Exponenciální backoff s jitterem pro lepší distribuci
              const jitter = Math.random() * 100; // Náhodný jitter 0-100ms
              const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, 5000); // Max 5s
              console.log(`Retrying in ${delay.toFixed(0)}ms (attempt ${attempt})`);
              setTimeout(() => reject(error), delay);
            }
          };
          img.crossOrigin = 'anonymous';
          img.referrerPolicy = 'no-referrer-when-downgrade'; // Pro lepší kompatibilitu
          img.src = url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;
        });
      } catch (error) {
        if (attempt < maxRetries) {
          // Pokud je chyba v síti, zkuste rychleji
          const networkErrorTypes = ['network', 'timeout', 'abort'];
          const delay = networkErrorTypes.includes(error.name) ? 150 : 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return null;
  }

  async function preloadHQIntoCache(item) {
    if (!item || item.hq_preloaded || item.hq_preload_promise) return item.hq_preload_promise;
    
    item.hq_preload_promise = new Promise(async (resolve, reject) => {
      try {
        const hqUrl = await resolveHQ(item);
        if (!hqUrl) {
          item.hq_preloaded = true;
          item.hq_preload_promise = null;
          resolve(null);
          return;
        }

        if (hqUrl === item.low) {
          item.hq_preloaded = true;
          item.hq_preload_promise = null;
          swapDisplayedToHQ(item, hqUrl);
          resolve(hqUrl);
          return;
        }

        // Retry loading HQ URL s error handling
        const loadedUrl = await loadWithRetry(hqUrl, 3, 500);
        if (loadedUrl) {
          item.hq = loadedUrl;
          item.hq_preloaded = true;
          item.hq_preload_promise = null;
          swapDisplayedToHQ(item, loadedUrl);
          resolve(loadedUrl);
        } else {
          console.warn('HQ preload failed, falling back to low-res:', item.href);
          item.hq_preloaded = true;
          item.hq_preload_promise = null;
          swapDisplayedToHQ(item, item.low || hqUrl);
          resolve(item.low || hqUrl);
        }
      } catch (error) {
        console.error('Error in preloadHQIntoCache:', error);
        item.hq_preload_promise = null;
        item.hq_preloaded = true;
        resolve(null);
      }
    });
    return item.hq_preload_promise;
  }

  async function loadImageIOS(img, url, it, spinner){
    if (!url) return false;
    
    img.classList.add('igfs-loading'); 
    if (spinner) spinner.style.display='block';
    
    try {
      // Použij loadWithRetry pro konzistentní retry logiku
      const loadedUrl = await loadWithRetry(url, 3, 300);
      if (loadedUrl) {
        // Vytvoř nový Image element pro získání skutečných rozměrů
        const tempImg = new Image();
        await new Promise((resolve, reject) => {
          tempImg.onload = () => {
            // Nastavit rozměry z temp obrázku
            it.w = tempImg.naturalWidth || tempImg.width || 0;
            it.h = tempImg.naturalHeight || tempImg.height || 0;
            // Nastavit src na display element
            img.src = loadedUrl;
            resolve();
          };
          tempImg.onerror = reject;
          tempImg.src = loadedUrl;
        });
        
        img.classList.remove('igfs-loading');
        if (spinner) spinner.style.display='none';
        return true;
      } else {
        throw new Error('Failed to load after retries');
      }
    } catch (error) {
      console.warn(`Failed to load image: ${url}`, error);
      img.classList.remove('igfs-loading');
      if (spinner) spinner.style.display='none';
      return false;
    }
  }

  // Mapa pro sledování probíhajících načítání obrázků
  const loadingPromises = new Map();
  
  async function loadForIndexIOS(items, i){
    const it = items[i]; if (!it || !it.node) return;
    const img = it.node.querySelector('img');
    const spinner = it.node.querySelector('.igfs-spinner');

    // Kontrola, zda již probíhá načítání pro tento obrázek
    const loadingKey = `${it.href}-${preferHQ ? 'hq' : 'lq'}`;
    if (loadingPromises.has(loadingKey)) {
      // Pokud ano, počkejte na dokončení
      await loadingPromises.get(loadingKey);
      return;
    }

    try {
      // Vytvořit promise pro sledování načítání
      const loadPromise = (async () => {
        if (preferHQ) {
          if (it.hq_preload_promise) {
            const pre = await it.hq_preload_promise;
            if (pre) { 
              await loadImageIOS(img, pre, it, spinner); 
              return; 
            }
          }
          if (it.hq_preloaded && it.hq) { 
            await loadImageIOS(img, it.hq, it, spinner); 
            return; 
          }
        }

        const hq = await resolveHQ(it);
        const lq = it.low || hq;
        const firstUrl = preferHQ ? hq : lq;
        
        // Zkus HQ s retry, pokud selže, zkus low-res
        const ok = await loadImageIOS(img, firstUrl, it, spinner);
        if (!ok && preferHQ && lq && lq !== firstUrl) {
          console.log('HQ failed, trying low-res fallback');
          await loadImageIOS(img, lq, it, spinner);
        }
      })();
      
      // Uložit promise do mapy
      loadingPromises.set(loadingKey, loadPromise);
      
      // Počkat na dokončení načítání
      await loadPromise;
    } finally {
      // Odstranit promise z mapy po dokončení
      loadingPromises.delete(loadingKey);
    }
  }

  IGFS.Qual = { setPreferHQ, getPreferHQ };
  IGFS.Preload = { resolveHQ, preloadHQIntoCache, swapDisplayedToHQ, loadForIndexIOS };
})();
