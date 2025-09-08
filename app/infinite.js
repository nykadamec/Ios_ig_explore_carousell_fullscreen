// /app/infinite.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { sleep, toast } = IGFS;
  const { collectExploreItems, collectExploreItemsAsync } = IGFS;

  let isLoadingMore = false;

  async function loadMoreImagesHoldBottom(state, minHoldMs = 5000){
    if (isLoadingMore) return false;
    isLoadingMore = true;
    const { UI } = IGFS;
    const overlay = UI.overlay;
    const wasActive = state.active;
    
    try {
      UI.showLoading();
      toast('Načítám další obrázky...');
      
      // Uložit původní styly overlayu (použij computed styles jako fallback)
      const computedStyle = window.getComputedStyle(overlay);
      const originalStyles = {
        pointerEvents: overlay.style.pointerEvents || computedStyle.pointerEvents || '',
        zIndex: overlay.style.zIndex || computedStyle.zIndex || '',
        position: overlay.style.position || computedStyle.position || ''
      };
      
      // Dočasně umožnit scroll pod overlayem bez skrytí
      if (wasActive) {
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1'; // Snížit z-index aby byl pod scrollable obsahem
        overlay.style.position = 'absolute'; // Zabránit blokování layoutu
        await sleep(50); // Krátký delay pro aplikaci stylů
      }
      
      const doc = document.scrollingElement || document.documentElement;
      const startHeight = doc.scrollHeight;
      let initialItemsCount = state.items.length;

      // sjede úplně dolů (spustí IG lazyload)
      window.scrollTo({ top: startHeight, behavior: 'instant' });

      const started = Date.now();
      let grown = false;
      let maxAttempts = 60; // Max 6s při 100ms intervalech

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
      await sleep(1000);

      // návrat na top až TEĎ
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Krátký delay pro stabilizaci DOM
      await sleep(200);

      // Obnovit původní styly overlayu
      if (wasActive) {
        // Důkladnější reset overlay stylů
        overlay.style.pointerEvents = originalStyles.pointerEvents === 'none' ? '' : originalStyles.pointerEvents;
        overlay.style.zIndex = originalStyles.zIndex === '1' ? '' : originalStyles.zIndex;
        overlay.style.position = originalStyles.position === 'absolute' ? '' : originalStyles.position;
        
        // Dodatečné zajištění správného zobrazení
        overlay.style.display = '';
        overlay.style.visibility = '';
        
        await sleep(100); // Delší delay pro smooth přechod a stabilizaci
      }

      // re-scan DOMu s async verzí pro čekání na HQ data
      const beforeLen = state.items.length;
      let fresh;
      try {
        fresh = await collectExploreItemsAsync(5000); // Delší timeout pro nové obrázky
      } catch (e) {
        console.warn('Async collect failed, using sync:', e);
        fresh = collectExploreItems();
      }
      
      state.items = mergeKeepState(state.items, fresh);
      const diff = state.items.length - beforeLen;

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
      
      // Obnovit styly overlayu v případě chyby
      if (wasActive) {
        overlay.style.pointerEvents = originalStyles.pointerEvents || '';
        overlay.style.zIndex = originalStyles.zIndex || '';
        overlay.style.position = originalStyles.position || '';
      }
      
      // Fallback na synchronní verzi
      try {
        const fresh = collectExploreItems();
        const merged = mergeKeepState(state.items, fresh);
        const diff = merged.length - state.items.length;
        if (diff > 0) {
          state.items = merged;
          toast(`Načteno ${diff} obrázků (fallback)`);
          return true;
        } else {
          toast('Žádné nové obrázky (fallback)');
        }
      } catch (e) {
        console.error('Fallback selhal:', e);
        toast('Kritická chyba při načítání');
      }
      return false;
    } finally {
      // Zajistit, že styly overlayu jsou obnoveny
      if (wasActive) {
        overlay.style.pointerEvents = originalStyles.pointerEvents || '';
        overlay.style.zIndex = originalStyles.zIndex || '';
        overlay.style.position = originalStyles.position || '';
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
