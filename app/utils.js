// /app/utils.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  
  const VERSION = '0.1.48-ios';  const ON_IOS = true; // čistě iOS režim (požadavek)

  const sleep = (ms)=> new Promise(res=> setTimeout(res, ms));
  const debounce = (fn, t)=>{ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a),t); }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const decodeEntities = (u) => u
    ? u.replace(/&amp;/g, '&')
        .replace(/&lt;/g,  '<')
        .replace(/&gt;/g,  '>')
        .replace(/&quot;/g,'"')
        .replace(/&#39;/g, "'")
    : u;

  const deThumbURL = (url) => url
    ? url
      .replace(/\/s\d+x\d+\//g, '/')
      .replace(/\/p\d+x\d+\//g, '/')
      .replace(/\/c\d+\.\d+\.\d+\.\d+\//g, '/')
    : url;

  const pickLargestFromSrcset = (srcset) => {
    if (!srcset) return null;
    let best=null, bestW=-1;
    srcset.split(',').forEach(part=>{
      const [u,wRaw] = part.trim().split(/\s+/);
      const w = (wRaw && wRaw.endsWith('w')) ? parseInt(wRaw) : 0;
      if (w>bestW){ bestW=w; best=decodeEntities(u); }
    });
    return best;
  };

  function toast(msg, t=1600){
    let wrap = document.querySelector('.igfs-toast-wrap');
    if (!wrap){
      wrap=document.createElement('div');
      wrap.className='igfs-toast-wrap';
      document.body.appendChild(wrap);
    }
    const el=document.createElement('div');
    el.className='igfs-toast';
    el.textContent=msg;
    wrap.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>el.classList.remove('show'), t);
    setTimeout(()=>{
      el.remove();
      if(!wrap.children.length) wrap.remove();
    }, t+240);
  }

  function openURLWithGesture(url){
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildPostURL(href){
    // Normalizace na absolutní URL a přidání chaining=true
    let path = href || '/';
    if (!path.startsWith('/')) path = '/' + path;
    if (!path.endsWith('/'))  path += '/';
    const url = new URL(path, location.origin);
    url.searchParams.set('chaining','true');
    return url.toString();
  }

  // Inteligentní background preload systém
  class BackgroundPreloader {
    constructor() {
      this.isPreloading = false;
      this.preloadQueue = new Set();
      this.lastPreloadIndex = -1;
      this.preloadThreshold = 5; // Spustit preload když je 5 obrázků od konce načtených
      this.concurrentLimit = 2; // Max 2 souběžné preload operace na iOS
    }

    shouldTriggerPreload(currentIndex, totalItems) {
      // Spustit preload pokud je uživatel 5 míst od konce načtených obrázků
      const remaining = totalItems - 1 - currentIndex;
      return remaining <= this.preloadThreshold && currentIndex !== this.lastPreloadIndex;
    }

    async triggerBackgroundPreload(state) {
      if (this.isPreloading) return false;
      
      this.isPreloading = true;
      this.lastPreloadIndex = state.cur;
      
      try {
        // Zobrazit loading indikátor
        if (IGFS.UI) {
          IGFS.UI.showLoading();
          IGFS.UI.updateLoadingText('🔄 Loading more images...');
        }
        
        // Použij loadMoreImagesHoldBottom pro načtení nových obrázků
        const added = await IGFS.Infinite.loadMoreImagesHoldBottom(state, 3000);
        
        if (added) {
          const newCount = state.items.length - this.lastPreloadIndex;
          toast(`✓ Loaded ${newCount} new images`);
          return true;
        } else {
          toast('No new images found');
          return false;
        }
      } catch (error) {
        console.error('Background preload failed:', error);
        toast('Background loading failed');
        return false;
      } finally {
        this.isPreloading = false;
        // Skrýt loading indikátor
        if (IGFS.UI) {
          IGFS.UI.hideLoading();
        }
      }
    }

    async preloadAhead(items, currentIndex) {
      // Preload několik obrázků dopředu (optimalizováno pro iOS)
      const preloadRange = Math.min(8, items.length - currentIndex - 1);
      const promises = [];
      
      for (let i = 1; i <= preloadRange && promises.length < this.concurrentLimit; i++) {
        const index = currentIndex + i;
        if (index < items.length) {
          const item = items[index];
          if (item && !item.hq_preloaded && !item.hq_preload_promise) {
            promises.push(IGFS.Preload.preloadHQIntoCache(item));
          }
        }
      }
      
      if (promises.length > 0) {
        try {
          await Promise.all(promises);
          console.log(`Preloaded ${promises.length} images ahead of current position`);
        } catch (error) {
          console.warn('Some preload operations failed:', error);
        }
      }
    }
  }

  IGFS.VERSION = VERSION;
  IGFS.ON_IOS = ON_IOS;
  IGFS.sleep = sleep;
  IGFS.debounce = debounce;
  IGFS.clamp = clamp;
  IGFS.decodeEntities = decodeEntities;
  IGFS.deThumbURL = deThumbURL;
  IGFS.pickLargestFromSrcset = pickLargestFromSrcset;
  IGFS.toast = toast;
  IGFS.openURLWithGesture = openURLWithGesture;
  IGFS.buildPostURL = buildPostURL;
  IGFS.BackgroundPreloader = BackgroundPreloader;
})();
