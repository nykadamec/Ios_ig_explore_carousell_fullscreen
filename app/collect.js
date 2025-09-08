// /app/collect.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { decodeEntities, pickLargestFromSrcset } = IGFS;

  // Synchronní verze pro fallback - vylepšená detekce
  function collectExploreItems(){
    // Rozšířené selektory pro zachycení všech možných Instagram explore items
    const selectors = [
      'main a[role="link"]',
      'main a[href^="/p/"]', 
      'main a[href^="/reel/"]',
      'article a[href^="/p/"]',
      'div[role="main"] a[href^="/p/"]',
      // Fallback selektory pro nové Instagram layouts
      'main div > a[href*="/p/"]',
      'section a[href^="/p/"]'
    ];
    
    const roots = [];
    selectors.forEach(selector => {
      try {
        const elements = Array.from(document.querySelectorAll(selector));
        roots.push(...elements);
      } catch (e) {
        // Ignorovat chyby v selectorech
      }
    });
    
    // Deduplikace na základě href
    const uniqueRoots = Array.from(new Set(roots));
    
    const uniq = new Map();
    for (const a of uniqueRoots){
      const href = a.getAttribute('href') || '';
      if (!href) continue;

      // Vynecháme reels/videa
      const isVideo = href.startsWith('/reel/') ||
                      a.querySelector('video') ||
                      a.querySelector('[playsinline]') ||
                      a.querySelector('svg[aria-label="Reel"], svg[aria-label="Video"]') ||
                      a.querySelector('svg[aria-label*="Video"]') ||
                      a.querySelector('svg[aria-label*="Reel"]');
      if (isVideo) continue;

      const key = href.split('?')[0].split('#')[0];
      if (uniq.has(key)) continue;

      const img = a.querySelector('img');
      if (img) {
        // Rozšířené hledání src - zkusíme více možností
        let imgSrc = img.currentSrc || img.src || img.getAttribute('data-src') || 
                     img.getAttribute('data-srcset') || '';
        
        // Pokud není src, zkusíme srcset
        if (!imgSrc && img.srcset) {
          const firstSrcset = img.srcset.split(',')[0];
          if (firstSrcset) {
            imgSrc = firstSrcset.trim().split(' ')[0];
          }
        }
        
        // Pokus o nalezení obrázku v parent picture elementu
        if (!imgSrc) {
          const picture = a.querySelector('picture');
          if (picture) {
            const source = picture.querySelector('source[srcset]');
            if (source && source.getAttribute('srcset')) {
              const srcset = source.getAttribute('srcset');
              const firstSrc = srcset.split(',')[0];
              if (firstSrc) {
                imgSrc = firstSrc.trim().split(' ')[0];
              }
            }
          }
        }
        
        // Pouze pokud máme nějaký src, přidáme položku
        if (imgSrc && imgSrc !== window.location.href) {
          let srcset = '';
          const picture = a.querySelector('picture');
          if (picture){
            const source = picture.querySelector('source[srcset]');
            if (source && source.getAttribute('srcset')) srcset = source.getAttribute('srcset');
          }
          if (img.srcset) srcset = img.srcset || srcset;

          // Vyčistíme URL od entit
          const cleanImgSrc = decodeEntities(imgSrc);
          
          uniq.set(key, {
            href: key,
            low: cleanImgSrc,
            srcset,
            hq: null,
            w:0, h:0,
            node:null,
            hq_preloaded:false,
            hq_preload_promise:null
          });
        } else {
          // Pokračovat bez logování - obrázek nemá platný src
        }
      } else {
        // Vynechat chybové položky bez obrázku
      }
    }
    
    const items = Array.from(uniq.values());
    
    // Seřadit podle pozice v gridu
    items.sort((A,B)=>{
      const elA = document.querySelector(`a[href^="${A.href}"]`);
      const elB = document.querySelector(`a[href^="${B.href}"]`);
      if (!elA || !elB) return 0;
      const rA = elA.getBoundingClientRect();
      const rB = elB.getBoundingClientRect();
      return (rA.top - rB.top) || (rA.left - rB.left);
    });
    return items;
  }

  // Asynchronní verze s čekáním na srcset pomocí MutationObserver - vylepšená
  async function collectExploreItemsAsync(timeout = 5000) {
    return new Promise((resolve, reject) => {
      let items = collectExploreItems();
      
      const completed = new Set();
      const observers = [];
      let globalObserver = null;
      
      // Globální observer pro detekci nových DOM změn
      const observeNewItems = () => {
        globalObserver = new MutationObserver((mutations) => {
          let needsRefresh = false;
          mutations.forEach((mutation) => {
            // Kontrola nových nodes
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  // Kontrola, zda přidaný node obsahuje nové Instagram linky
                  if (node.matches && node.matches('a[href^="/p/"], a[role="link"]')) {
                    needsRefresh = true;
                    break;
                  }
                  if (node.querySelector && node.querySelector('a[href^="/p/"], a[role="link"]')) {
                    needsRefresh = true;
                    break;
                  }
                }
              }
            }
          });
          
          if (needsRefresh) {
            console.log('[IGFS] DOM changes detected, refreshing items');
            const newItems = collectExploreItems();
            if (newItems.length > items.length) {
              console.log(`[IGFS] Found ${newItems.length - items.length} new items via DOM observation`);
              items = newItems;
              // Restart observers for new items
              setupItemObservers();
            }
          }
        });
        
        globalObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      };
      
      const setupItemObservers = () => {
        // Cleanup existing observers
        observers.forEach(obs => {
          try { obs.disconnect(); } catch (e) {}
        });
        observers.length = 0;
        
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
            let newSrc = '';
            
            // Zkusíme získat nejnovější srcset a src
            if (picture && picture.getAttribute('srcset')) {
              newSrcset = picture.getAttribute('srcset');
            } else if (img && img.srcset) {
              newSrcset = img.srcset;
            }
            
            if (img) {
              newSrc = img.currentSrc || img.src || img.getAttribute('data-src') || '';
            }
            
            let updated = false;
            
            // Aktualizace srcset
            if (newSrcset && newSrcset !== item.srcset) {
              item.srcset = newSrcset;
              const best = pickLargestFromSrcset(newSrcset);
              if (best) {
                item.hq = decodeEntities(best);
              }
              updated = true;
            }
            
            // Aktualizace low-res src pokud je lepší
            if (newSrc && newSrc !== window.location.href && 
                (!item.low || newSrc !== item.low)) {
              item.low = decodeEntities(newSrc);
              updated = true;
            }
            
            if (updated) {
              console.log(`[IGFS] Updated item ${index}:`, {
                href: item.href,
                hasNewSrcset: !!newSrcset,
                hasNewSrc: !!newSrc,
                hq: item.hq
              });
              completed.add(item.href);
            }
          };

          const observer = new MutationObserver((mutations) => {
            let changed = false;
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' &&
                  (mutation.attributeName === 'srcset' || 
                   mutation.attributeName === 'src' ||
                   mutation.attributeName === 'data-src' ||
                   mutation.attributeName === 'currentSrc')) {
                changed = true;
              }
            });
            if (changed) updateItem();
          });

          observers.push(observer);

          // Sledování změn na img i picture elementech
          if (img) {
            observer.observe(img, {
              attributes: true,
              attributeFilter: ['srcset', 'src', 'data-src', 'currentSrc']
            });
          }
          if (picture) {
            observer.observe(picture, {
              attributes: true,
              attributeFilter: ['srcset']
            });
          }

          updateItem(); // Okamžitě zkusit aktualizovat

          // Cleanup po timeoutu
          setTimeout(() => {
            observer.disconnect();
            completed.add(item.href);
          }, timeout);
        });
      };

      const checkCompletion = () => {
        const completionRate = completed.size / Math.max(items.length, 1);
        console.log(`[IGFS] Completion: ${completed.size}/${items.length} (${Math.round(completionRate * 100)}%)`);
        
        if (completed.size >= items.length || completionRate >= 0.9) {
          // Finální sorting
          items.sort((A,B)=>{
            const elA = document.querySelector(`a[href^="${A.href}"]`);
            const elB = document.querySelector(`a[href^="${B.href}"]`);
            if (!elA || !elB) return 0;
            const rA = elA.getBoundingClientRect();
            const rB = elB.getBoundingClientRect();
            return (rA.top - rB.top) || (rA.left - rB.left);
          });
          observerCleanup();
          console.log(`[IGFS] Async collect completed with ${items.length} items`);
          resolve(items);
        }
      };

      const observerCleanup = () => {
        observers.forEach(obs => {
          try {
            obs.disconnect();
          } catch (e) {
            console.warn('Failed to disconnect observer:', e);
          }
        });
        observers.length = 0;
        
        if (globalObserver) {
          try {
            globalObserver.disconnect();
          } catch (e) {
            console.warn('Failed to disconnect global observer:', e);
          }
        }
      };

      // Start observing
      observeNewItems();
      setupItemObservers();
      
      const interval = setInterval(checkCompletion, 200); // Častější kontrola
      
      setTimeout(() => {
        clearInterval(interval);
        observerCleanup();
        console.log(`[IGFS] Async collect timeout reached, returning ${items.length} items`);
        resolve(items);
      }, timeout);
    });
  }

  IGFS.collectExploreItems = collectExploreItems;
  IGFS.collectExploreItemsAsync = collectExploreItemsAsync;
})();
