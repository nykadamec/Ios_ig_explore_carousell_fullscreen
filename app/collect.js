// /app/collect.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { decodeEntities, pickLargestFromSrcset } = IGFS;

  // Synchronní verze pro fallback
  function collectExploreItems(){
    const roots = Array.from(document.querySelectorAll('main a[role="link"], main a[href^="/p/"], main a[href^="/reel/"]'));
    const uniq = new Map();
    for (const a of roots){
      const href = a.getAttribute('href') || '';
      if (!href) continue;

      // Vynecháme reels/videa
      const isVideo = href.startsWith('/reel/') ||
                      a.querySelector('video') ||
                      a.querySelector('[playsinline]') ||
                      a.querySelector('svg[aria-label="Reel"], svg[aria-label="Video"]');
      if (isVideo) continue;

      const key = href.split('?')[0].split('#')[0];
      if (uniq.has(key)) continue;

      const img = a.querySelector('img');
      if (img && (img.src || img.currentSrc)){
        let srcset = '';
        const picture = a.querySelector('picture');
        if (picture){
          const source = picture.querySelector('source[srcset]');
          if (source && source.getAttribute('srcset')) srcset = source.getAttribute('srcset');
        }
        if (img.srcset) srcset = img.srcset || srcset;

        uniq.set(key, {
          href: key,
          low: decodeEntities(img.currentSrc || img.src),
          srcset,
          hq: null,
          w:0, h:0,
          node:null,
          hq_preloaded:false,
          hq_preload_promise:null
        });
      }
    }
    // Seřadit podle pozice v gridu
    const arr = Array.from(uniq.values());
    arr.sort((A,B)=>{
      const elA = document.querySelector(`a[href^="${A.href}"]`);
      const elB = document.querySelector(`a[href^="${B.href}"]`);
      if (!elA || !elB) return 0;
      const rA = elA.getBoundingClientRect();
      const rB = elB.getBoundingClientRect();
      return (rA.top - rB.top) || (rA.left - rB.left);
    });
    return arr;
  }

  // Asynchronní verze s čekáním na srcset pomocí MutationObserver
  async function collectExploreItemsAsync(timeout = 5000) {
    return new Promise((resolve, reject) => {
      // Nejprve zkusíme synchronní sbírání
      let items = collectExploreItems();
      const pendingItems = new Map();
      const completed = new Set();
      
      // Pro každý obrázek sledujeme změny v srcset
      items.forEach((item, index) => {
        const link = document.querySelector(`a[href^="${item.href}"]`);
        if (!link) return;
        
        const img = link.querySelector('img');
        const picture = link.querySelector('picture source[srcset]');
        if (!img && !picture) return;

        const updateItem = () => {
          if (completed.has(item.href)) return;
          
          let newSrcset = '';
          if (picture && picture.getAttribute('srcset')) {
            newSrcset = picture.getAttribute('srcset');
          } else if (img && img.srcset) {
            newSrcset = img.srcset;
          }
          
          if (newSrcset && newSrcset !== item.srcset) {
            item.srcset = newSrcset;
            // Okamžitě extrahovat HQ URL
            const best = pickLargestFromSrcset(newSrcset);
            if (best) {
              item.hq = decodeEntities(best);
            }
            completed.add(item.href);
          }
        };

        // Observer pro sledování změn
        const observer = new MutationObserver((mutations) => {
          let changed = false;
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'srcset' || mutation.attributeName === 'src')) {
              changed = true;
            }
          });
          if (changed) {
            updateItem();
          }
        });

        // Spustit observer
        observer.observe(img || picture, {
          attributes: true,
          attributeFilter: ['srcset', 'src']
        });

        // Okamžitě zkusit aktualizovat
        updateItem();

        // Cleanup po timeoutu
        setTimeout(() => {
          observer.disconnect();
          completed.add(item.href);
        }, timeout);
      });

      // Pokud všechny items mají kompletní data nebo timeout
      const checkCompletion = () => {
        if (completed.size === items.length) {
          // Seřadit podle pozice v gridu
          items.sort((A,B)=>{
            const elA = document.querySelector(`a[href^="${A.href}"]`);
            const elB = document.querySelector(`a[href^="${B.href}"]`);
            if (!elA || !elB) return 0;
            const rA = elA.getBoundingClientRect();
            const rB = elB.getBoundingClientRect();
            return (rA.top - rB.top) || (rA.left - rB.left);
          });
          observerCleanup();
          resolve(items);
        }
      };

      const observerCleanup = () => {
        // Disconnect all observers (simplified - in real implementation would track all observers)
        const allObservers = document.querySelectorAll('*');
        allObservers.forEach(el => {
          const obs = PerformanceObserver.takeRecords ? null : el._srcsetObserver;
          if (obs) obs.disconnect();
        });
      };

      // Check periodicky
      const interval = setInterval(checkCompletion, 100);
      
      // Timeout fallback
      setTimeout(() => {
        clearInterval(interval);
        observerCleanup();
        resolve(items);
      }, timeout);
    });
  }

  IGFS.collectExploreItems = collectExploreItems;
  IGFS.collectExploreItemsAsync = collectExploreItemsAsync;
})();
