// /app/preload.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { deThumbURL, pickLargestFromSrcset } = IGFS;

  let preferHQ = true;

  function setPreferHQ(v){ preferHQ = !!v; }
  function getPreferHQ(){ return !!preferHQ; }

  async function resolveHQ(it){
    if (it.hq) return it.hq;
    if (it.srcset){
      const best = pickLargestFromSrcset(it.srcset);
      if (best) it.hq = deThumbURL(best);
    }
    if (!it.hq && it.low) it.hq = deThumbURL(it.low);
    return it.hq || it.low;
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
      item.w = imgEl.naturalWidth;
      item.h = imgEl.naturalHeight;
      imgEl.removeEventListener('load', onload);
    };
    imgEl.addEventListener('load', onload);
    imgEl.setAttribute('data-quality','hq');
    imgEl.src = hqUrl;
  }

  // Retry mechanismus s optimalizovaným backoffem pro web
  async function loadWithRetry(url, maxRetries = 3, baseDelay = 300) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const img = new Image();
        return await new Promise((resolve, reject) => {
          img.onload = () => resolve(img.src);
          img.onerror = () => {
            if (attempt === maxRetries) {
              reject(new Error(`Failed to load after ${maxRetries} attempts`));
            } else {
              reject(new Error(`Attempt ${attempt} failed`));
            }
          };
          img.crossOrigin = 'anonymous';
          img.src = url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;
        });
      } catch (error) {
        console.warn(`Attempt ${attempt} failed for ${url}:`, error);
        if (attempt < maxRetries) {
          // Mírnější backoff: 300ms, 500ms, 800ms místo 500ms, 1s, 2s
          const delay = baseDelay + (attempt - 1) * 200;
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
    
    return new Promise(async (resolve) => {
      // Retry mechanismus pro zobrazení
      const loadAttempt = async (attempt) => {
        if (attempt > 3) {
          console.warn(`Failed to load image after 3 attempts: ${url}`);
          img.classList.remove('igfs-loading');
          if (spinner) spinner.style.display='none';
          resolve(false);
          return;
        }

        const imgLoad = new Image();
        imgLoad.crossOrigin = 'anonymous';
        imgLoad.onload = () => {
          // Nahraď src pouze pokud se načetlo
          img.src = imgLoad.src;
          it.w = imgLoad.naturalWidth;
          it.h = imgLoad.naturalHeight;
          img.classList.remove('igfs-loading');
          if (spinner) spinner.style.display='none';
          resolve(true);
        };
        imgLoad.onerror = () => {
          if (attempt < 3) {
            // Konzistentní s optimalizovaným backoffem
            const delay = 300 + (attempt - 1) * 200;
            setTimeout(() => loadAttempt(attempt + 1), delay);
          } else {
            img.classList.remove('igfs-loading');
            if (spinner) spinner.style.display='none';
            resolve(false);
          }
        };
        imgLoad.src = url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;
      };
      
      loadAttempt(1);
    });
  }

  async function loadForIndexIOS(items, i){
    const it = items[i]; if (!it || !it.node) return;
    const img = it.node.querySelector('img');
    const spinner = it.node.querySelector('.igfs-spinner');

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
  }

  IGFS.Qual = { setPreferHQ, getPreferHQ };
  IGFS.Preload = { resolveHQ, preloadHQIntoCache, swapDisplayedToHQ, loadForIndexIOS };
})();
