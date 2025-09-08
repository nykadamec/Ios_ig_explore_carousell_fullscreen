// /app/infinite.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { sleep, toast } = IGFS;
  const { collectExploreItems, collectExploreItemsAsync } = IGFS;

  let isLoadingMore = false;

  async function loadMoreImagesHoldBottom(state, minHoldMs = 5000){
    if (isLoadingMore) {
      if (IGFS.Debug && IGFS.Debug.debugLog) IGFS.Debug.debugLog('⚠️ Load already in progress, skipping');
      return false;
    }
    isLoadingMore = true;
    const { UI } = IGFS;
    const overlay = UI.overlay;
    const wasActive = state.active;
    
    if (IGFS.Debug && IGFS.Debug.debugLog) {
      IGFS.Debug.debugLog(`🚀 Starting loadMoreImagesHoldBottom (minHold: ${minHoldMs}ms)`);
    }
    
    try {
      UI.showLoading();
      toast('Načítám další obrázky...');
      
      // Uložit původní styly overlayu (použij computed styles jako fallback)
      const computedStyle = window.getComputedStyle(overlay);
      const originalStyles = {
        pointerEvents: overlay.style.pointerEvents || computedStyle.pointerEvents || '',
        zIndex: overlay.style.zIndex || computedStyle.zIndex || '',
        position: overlay.style.position || computedStyle.position || '',
        top: overlay.style.top || computedStyle.top || '',
        left: overlay.style.left || computedStyle.left || '',
        transform: overlay.style.transform || computedStyle.transform || '',
        visibility: overlay.style.visibility || computedStyle.visibility || ''
      };
      
      console.log('[IGFS] Saved original overlay styles:', originalStyles);
      
      // Dočasně umožnit scroll pod overlayem bez skrytí
      if (wasActive) {
        // Postupná úprava stylů pro hladší přechod
        overlay.style.transition = 'opacity 0.2s ease';
        overlay.style.opacity = '0.1'; // Téměř průhledný ale stále viditelný
        await sleep(100); // Krátký delay pro vizuální feedback
        
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1'; // Snížit z-index aby byl pod scrollable obsahem
        overlay.style.position = 'absolute'; // Zabránit blokování layoutu
        overlay.style.visibility = 'hidden'; // Úplně skrýt během scroll
        
        console.log('[IGFS] Overlay temporarily hidden for scrolling');
        await sleep(50); // Krátký delay pro aplikaci stylů
      }
      
      const doc = document.scrollingElement || document.documentElement;
      const startHeight = doc.scrollHeight;
      let initialItemsCount = state.items.length;

      // sjede úplně dolů (spustí IG lazyload)
      window.scrollTo({ top: startHeight, behavior: 'instant' });

      const started = Date.now();
      let grown = false;
      let maxAttempts = 100; // Zvýšeno na 10s při 100ms intervalech
      let consecutiveItemChecks = 0;
      let lastItemCount = initialItemsCount;

      // drž bottom a sleduj růst scrollHeight + robustnější detekce nových položek
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(100);
        const nowH = (document.scrollingElement || document.documentElement).scrollHeight;
        
        if (nowH > startHeight) { 
          grown = true; 
          console.log(`[IGFS] Scroll height grew from ${startHeight} to ${nowH}`);
          // Pokračuj ještě chvíli po růstu pro ujištění kompletního načtení
          await sleep(1500); 
          break; 
        }
        
        // Robustnější kontrola nových položek s vícenásobným ověřením
        const currentItems = collectExploreItems();
        if (currentItems.length > lastItemCount) {
          console.log(`[IGFS] Items increased: ${lastItemCount} → ${currentItems.length}`);
          lastItemCount = currentItems.length;
          consecutiveItemChecks = 0; // Reset počítadla
        } else {
          consecutiveItemChecks++;
        }
        
        // Považuj za úspěšné, pokud se našly nové položky a zůstaly stabilní
        if (currentItems.length > initialItemsCount && consecutiveItemChecks >= 5) {
          grown = true;
          console.log(`[IGFS] Found ${currentItems.length - initialItemsCount} new items (stable for 5 checks)`);
          break;
        }
        
        // Kontrola nových img elementů přímo v DOM jako backup
        const allImages = document.querySelectorAll('main a[role="link"] img, main a[href^="/p/"] img');
        if (allImages.length > initialItemsCount + 5) { // Buffer pro jistotu
          console.log(`[IGFS] DOM img count increased significantly: ${allImages.length}`);
          grown = true;
          await sleep(1000); // Krátké čekání na stabilizaci
          break;
        }
        
        if ((Date.now() - started) >= minHoldMs) break;
      }

      // Delší grace delay pro kompletní načtení nových obrázků a srcset
      // Postupné čekání s kontrolou stability
      console.log('[IGFS] Waiting for images to stabilize...');
      await sleep(800); // Základní čekání
      
      // Ověř stabilitu nových obrázků
      let stabilityChecks = 0;
      let lastImageCount = 0;
      for (let i = 0; i < 15; i++) { // Max 1.5s dalšího čekání
        const currentImages = document.querySelectorAll('main a[role="link"] img, main a[href^="/p/"] img');
        const imgsWithSrc = Array.from(currentImages).filter(img => 
          img.src && img.src !== window.location.href && 
          (img.complete || img.naturalWidth > 0)
        );
        
        if (imgsWithSrc.length === lastImageCount) {
          stabilityChecks++;
        } else {
          stabilityChecks = 0;
          lastImageCount = imgsWithSrc.length;
        }
        
        // Považuj za stabilní pokud se počet nemění 3 kontroly za sebou
        if (stabilityChecks >= 3) {
          console.log(`[IGFS] Images stabilized at ${imgsWithSrc.length} loaded images`);
          break;
        }
        
        await sleep(100);
      }

      // návrat na top až TEĎ
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Krátký delay pro stabilizaci DOM
      await sleep(200);

      // Obnovit původní styly overlayu
      if (wasActive) {
        console.log('[IGFS] Restoring overlay styles...');
        
        // Postupné obnovení s lepší kontrolou
        overlay.style.visibility = originalStyles.visibility === 'hidden' ? '' : originalStyles.visibility;
        overlay.style.opacity = ''; // Obnovit na původní
        
        // Obnovit layoutové vlastnosti
        overlay.style.position = originalStyles.position === 'absolute' ? '' : originalStyles.position;
        overlay.style.zIndex = originalStyles.zIndex === '1' ? '' : originalStyles.zIndex;
        overlay.style.pointerEvents = originalStyles.pointerEvents === 'none' ? '' : originalStyles.pointerEvents;
        
        // Obnovit poziční vlastnosti pokud byly změněny
        if (originalStyles.top && originalStyles.top !== 'auto') {
          overlay.style.top = originalStyles.top;
        }
        if (originalStyles.left && originalStyles.left !== 'auto') {
          overlay.style.left = originalStyles.left;
        }
        if (originalStyles.transform && originalStyles.transform !== 'none') {
          overlay.style.transform = originalStyles.transform;
        }
        
        // Dodatečné zajištění správného zobrazení
        overlay.style.display = '';
        
        console.log('[IGFS] Overlay styles restored');
        await sleep(150); // Delší delay pro smooth přechod a stabilizaci
      }

      // re-scan DOMu s async verzí pro čekání na HQ data
      const beforeLen = state.items.length;
      let fresh;
      try {
        console.log('[IGFS] Re-scanning DOM for new items...');
        fresh = await collectExploreItemsAsync(8000); // Delší timeout pro nové obrázky po scroll
        console.log(`[IGFS] Async collect found ${fresh.length} total items`);
      } catch (e) {
        console.warn('Async collect failed, using sync:', e);
        fresh = collectExploreItems();
        console.log(`[IGFS] Sync collect found ${fresh.length} total items`);
      }
      
      state.items = mergeKeepState(state.items, fresh);
      const diff = state.items.length - beforeLen;

      if (diff > 0) {
        toast(`Načteno ${diff} nových obrázků`);
        if (IGFS.Debug && IGFS.Debug.debugLog) {
          IGFS.Debug.debugLog(`✅ Successfully loaded ${diff} new images`, 'success');
        }
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
        if (IGFS.Debug && IGFS.Debug.debugLog) {
          IGFS.Debug.debugLog('⚠️ No new images found during load', 'warning');
        }
        return false;
      }
    } catch (error) {
      console.error('Chyba při načítání dalších obrázků:', error);
      toast('Chyba při načítání - zkuste ručně scrollovat');
      
      // Obnovit styly overlayu v případě chyby
      if (wasActive && overlay) {
        console.log('[IGFS] Restoring overlay styles after error...');
        try {
          // Robustnější obnova s try-catch
          Object.keys(originalStyles).forEach(key => {
            if (originalStyles[key] && originalStyles[key] !== 'none' && originalStyles[key] !== 'auto') {
              overlay.style[key] = originalStyles[key];
            } else {
              overlay.style[key] = '';
            }
          });
          
          // Zajistit viditelnost
          overlay.style.display = '';
          overlay.style.opacity = '';
          overlay.style.visibility = '';
          
          console.log('[IGFS] Overlay styles restored after error');
        } catch (styleError) {
          console.error('[IGFS] Error restoring overlay styles:', styleError);
          // Fallback - básnicke obnovení
          overlay.style.pointerEvents = '';
          overlay.style.zIndex = '';
          overlay.style.position = '';
          overlay.style.visibility = '';
          overlay.style.opacity = '';
        }
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
      // Zajistit, že styly overlayu jsou vždy obnoveny
      if (wasActive && overlay) {
        console.log('[IGFS] Final overlay cleanup...');
        try {
          // Kompletní obnova s error handling
          if (typeof originalStyles === 'object') {
            Object.keys(originalStyles).forEach(key => {
              try {
                if (originalStyles[key] && originalStyles[key] !== 'none' && originalStyles[key] !== 'auto') {
                  overlay.style[key] = originalStyles[key];
                } else {
                  overlay.style[key] = '';
                }
              } catch (e) {
                console.warn(`Failed to restore style ${key}:`, e);
                overlay.style[key] = '';
              }
            });
          }
          
          // Poslední kontrola - zajistit základní funkčnost
          overlay.style.display = '';
          overlay.style.opacity = '';
          overlay.style.visibility = '';
          overlay.style.transition = '';
          
          console.log('[IGFS] Final overlay cleanup completed');
        } catch (cleanupError) {
          console.error('[IGFS] Error in final overlay cleanup:', cleanupError);
          // Ultimátní fallback
          try {
            overlay.removeAttribute('style');
            console.log('[IGFS] Applied ultimate fallback - removed all styles');
          } catch (ultimateError) {
            console.error('[IGFS] Ultimate fallback failed:', ultimateError);
          }
        }
      }
      
      UI.hideLoading();
      isLoadingMore = false;
      console.log('[IGFS] loadMoreImagesHoldBottom completed');
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
