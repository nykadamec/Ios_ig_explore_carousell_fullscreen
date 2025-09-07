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

  async function preloadHQIntoCache(item) {
    if (!item || item.hq_preloaded || item.hq_preload_promise) return item.hq_preload_promise;
    item.hq_preload_promise = new Promise(async (resolve) => {
      const hqUrl = await resolveHQ(item);
      if (hqUrl && hqUrl !== item.low) {
        const preloadImg = new Image();
        preloadImg.onload = () => {
          item.hq_preloaded = true;
          item.hq_preload_promise = null;
          swapDisplayedToHQ(item, hqUrl);
          resolve(hqUrl);
        };
        preloadImg.onerror = () => { item.hq_preload_promise = null; resolve(null); };
        preloadImg.src = hqUrl;
      } else {
        item.hq_preloaded = true;
        item.hq_preload_promise = null;
        swapDisplayedToHQ(item, hqUrl);
        resolve(hqUrl);
      }
    });
    return item.hq_preload_promise;
  }

  async function loadImageIOS(img, url, it, spinner){
    img.classList.add('igfs-loading'); if (spinner) spinner.style.display='block';
    return new Promise((resolve)=>{
      img.onload = ()=>{ it.w=img.naturalWidth; it.h=img.naturalHeight; img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; resolve(true); };
      img.onerror = ()=>{ img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; resolve(false); };
      img.src = url;
    });
  }

  async function loadForIndexIOS(items, i){
    const it = items[i]; if (!it || !it.node) return;
    const img = it.node.querySelector('img');
    const spinner = it.node.querySelector('.igfs-spinner');

    if (preferHQ) {
      if (it.hq_preload_promise) {
        const pre = await it.hq_preload_promise;
        if (pre) { await loadImageIOS(img, pre, it, spinner); return; }
      }
      if (it.hq_preloaded && it.hq) { await loadImageIOS(img, it.hq, it, spinner); return; }
    }

    const hq = await resolveHQ(it);
    const lq = it.low || hq;
    const firstUrl = preferHQ ? hq : lq;
    const ok = await loadImageIOS(img, firstUrl, it, spinner);
    if (!ok && preferHQ && lq && lq !== firstUrl) await loadImageIOS(img, lq, it, spinner);
  }

  IGFS.Qual = { setPreferHQ, getPreferHQ };
  IGFS.Preload = { resolveHQ, preloadHQIntoCache, swapDisplayedToHQ, loadForIndexIOS };
})();
