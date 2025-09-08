// /app/infinite.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { sleep, toast } = IGFS;
  const { collectExploreItems, collectExploreItemsAsync } = IGFS; // Přidáno async verze

  let isLoadingMore = false;

  async function loadMoreImagesHoldBottom(state, minHoldMs = 5000){
    if (isLoadingMore) return false;
    isLoadingMore = true;
    const { UI, App } = IGFS;
    const wasActive = state.active;
    
    try {
      UI.showLoading();
      toast('Načítám další obrázky...');
      
      // Pokud je fullscreen aktivní, dočasně ho skryj pro scroll
      let overlayHidden = false;
      if (wasActive) {
        UI.hideOverlay();
        state.active = false;
        overlayHidden = true;
        await sleep(100); // Krátký delay pro kompletní skrytí
      }
      
      const doc = document.scrollingElement || document.documentElement;
      const startHeight = doc.scrollHeight;
      let initialItemsCount = state.items.length;

      // sjede úplně dolů (spustí IG lazyload)
      window.scrollTo({ top: startHeight, behavior: 'instant' });

      const started = Date.now();
      let grown = false;
      let maxAttempts = 50; // Max 5s při 100ms intervalech

      // drž bottom a sleduj růst scrollHeight
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(100);
        const nowH = (document.scrollingElement || document.documentElement).scrollHeight;
        
        if (nowH > startHeight) { 
          grown = true; 
          console.log(`[IGFS] Scroll height grew from ${startHeight} to ${nowH}`);
          break; 
        }
        
        // Kontrola, jestli se načetly nové položky (alternativní detekce)
        const currentItems = collectExploreItems(); // Rychlá synchronní kontrola
        if (currentItems.length > initialItemsCount) {
          grown = true;
          console.log(`[IGFS] Found ${currentItems.length - initialItemsCount} new items during scroll`);
          break;
        }
        
        if ((Date.now() - started) >= minHoldMs) break;
      }

      // Delší grace delay pro kompletní načtení nových obrázků a srcset
      await sleep(800);

      // návrat na top až TEĎ
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Krátký delay pro stabilizaci DOM
      await sleep(200);

      // re-scan DOMu s async verzí pro čekání na HQ data
      const beforeLen = state.items.length;
      let fresh;
      try {
        fresh = await collectExploreItemsAsync(4000); // Delší timeout pro nové obrázky
      } catch (e) {
        console.warn('Async collect failed, using sync:', e);
        fresh = collectExploreItems();
      }
      
      state.items = mergeKeepState(state.items, fresh);
      const diff = state.items.length - beforeLen;

      // Obnov fullscreen stav
      if (overlayHidden) {
        state.active = true;
        UI.showOverlay();
        // Obnov aktuální pozici
        const { track } = UI;
        track.style.transition = 'none';
        track.style.transform = `translate3d(${-state.cur*window.innerWidth}px,0,0)`;
        await sleep(50); // Krátký delay pro smooth přechod
        track.style.transition = 'transform 280ms ease';
      }

      if (diff > 0) {
        toast(`Načteno ${diff} nových obrázků`);
        // Preload nově načtené obrázky
        const newStart = beforeLen;
        const newEnd = Math.min(newStart + 5, state.items.length);
        for (let i = newStart; i < newEnd; i++) {
          const it = state.items[i];
          if (it && !it.hq_preloaded && !it.hq_preload_promise) {
            IGFS.Preload.preloadHQIntoCache(it);
          }
        }
        return true;
      } else {
        toast('Žádné nové obrázky nenalezeny');
        return false;
      }
    } catch (error) {
      console.error('Chyba při načítání dalších obrázků:', error);
      toast('Chyba při načítání - zkuste ručně scrollovat');
      
      // Fallback na synchronní verzi
      try {
        if (overlayHidden) {
          state.active = true;
          UI.showOverlay();
        }
        const fresh = collectExploreItems();
        state.items = mergeKeepState(state.items, fresh);
        const diff = state.items.length - beforeLen;
        if (diff > 0) {
          toast(`Načteno ${diff} obrázků (fallback)`);
          return true;
        }
      } catch (e) {
        console.error('Fallback selhal:', e);
      }
      return false;
    } finally {
      // Zajistit, že overlay je ve správném stavu
      if (overlayHidden && !state.active) {
        state.active = true;
        UI.showOverlay();
      }
      UI.hideLoading();
      isLoadingMore = false;
    }
  }

  function mergeKeepState(oldItems, newItems){
    const map = new Map();
    oldItems.forEach(x => map.set(x.href, x));
    for (const ni of newItems) {
      if (!map.has(ni.href)) {
        map.set(ni.href, ni);
      } else {
        // uchovej preload/metainformace
        const oi = map.get(ni.href);
        map.set(ni.href, Object.assign(ni, {
          hq_preloaded: oi.hq_preloaded,
          hq_preload_promise: oi.hq_preload_promise,
          hq: oi.hq, w: oi.w, h: oi.h,
          node: oi.node
        }));
      }
    }
    return Array.from(map.values());
  }

  IGFS.Infinite = { loadMoreImagesHoldBottom, mergeKeepState };
})();
