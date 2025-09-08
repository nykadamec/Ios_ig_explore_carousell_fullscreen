// /app/infinite.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { sleep, toast } = IGFS;
  const { collectExploreItems, collectExploreItemsAsync } = IGFS; // Přidáno async verze

  let isLoadingMore = false;

  async function loadMoreImagesHoldBottom(state, minHoldMs = 4000){
    if (isLoadingMore) return false;
    isLoadingMore = true;
    const { UI } = IGFS;
    try {
      UI.showLoading();
      toast('Načítám další obrázky...');
      const doc = document.scrollingElement || document.documentElement;
      const startHeight = doc.scrollHeight;

      // sjede úplně dolů (spustí IG lazyload)
      window.scrollTo({ top: startHeight, behavior: 'instant' });

      const started = Date.now();
      let grown = false;

      // drž bottom min. 4s, nebo skonči dřív, když scrollHeight naroste
      while ((Date.now() - started) < minHoldMs) {
        await sleep(120);
        const nowH = (document.scrollingElement || document.documentElement).scrollHeight;
        if (nowH > startHeight) { grown = true; break; }
      }

      // prodloužený grace delay pro kompletní načtení nových obrázků
      await sleep(500);

      // návrat na top až TEĎ
      window.scrollTo({ top: 0, behavior: 'instant' });

      // re-scan DOMu s async verzí pro čekání na HQ data
      const beforeLen = state.items.length;
      const fresh = await collectExploreItemsAsync(3000); // 3s timeout pro nové obrázky
      state.items = mergeKeepState(state.items, fresh);
      const diff = state.items.length - beforeLen;

      if (diff > 0) {
        toast(`Načteno ${diff} nových obrázků`);
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
        const fresh = collectExploreItems();
        state.items = mergeKeepState(state.items, fresh);
        const diff = state.items.length - beforeLen;
        if (diff > 0) {
          toast(`Načteno ${diff} obrázků (fallback)`)
          return true;
        }
      } catch (e) {
        console.error('Fallback selhal:', e);
      }
      return false;
    } finally {
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
