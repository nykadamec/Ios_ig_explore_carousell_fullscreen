// /app/collect.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { decodeEntities, pickLargestFromSrcset } = IGFS;

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

  IGFS.collectExploreItems = collectExploreItems;
})();
