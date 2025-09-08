// /app/app.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { VERSION, clamp, toast, buildPostURL, openURLWithGesture, debounce, BackgroundPreloader, pickLargestFromSrcset, deThumbURL, decodeEntities } = IGFS;
  const { UI } = IGFS;
  const { collectExploreItems, collectExploreItemsAsync } = IGFS;
  const { setPreferHQ, getPreferHQ } = IGFS.Qual;
  const { resolveHQ, preloadHQIntoCache, loadForIndexIOS } = IGFS.Preload;
  const { loadMoreImagesHoldBottom, mergeKeepState } = IGFS.Infinite;

  const state = {
    items: [],
    cur: 0,
    active: false,
    dragging: false,
    startX: 0,
    curX: 0,
    manualPreloading: false,
    bgPreloader, // Export pro debug
  };

  // Inicializace background preloaderu
  const bgPreloader = new BackgroundPreloader();

  // Preconnect hints pro rychlejší načítání Instagram obrázků
  function addPreconnectHints() {
    const domains = [
      'instagram.fprg2-1.fna.fbcdn.net',
      'scontent-prg2-1.cdninstagram.com', 
      'scontent.cdninstagram.com',
      'instagram.com'
    ];
    
    domains.forEach(domain => {
      if (!document.querySelector(`link[href*="${domain}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = `https://${domain}`;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  }
  
  // Spustit preconnect při načtení
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addPreconnectHints);
  } else {
    addPreconnectHints();
  }

  // ---------- Helpers ----------
  function isUI(t){ return !!(t && t.closest('.igfs-btn,.igfs-fab,.igfs-menu,.igfs-loading-indicator')); }
  function isForm(t){ return !!(t && t.closest('input,textarea,button,select,[contenteditable="true"]')); }

  function makeSlide(it, i){
    const slide = document.createElement('div'); 
    slide.className='igfs-slide'; 
    slide.dataset.index=String(i); 
    it.node = slide;
    
    const img = document.createElement('img'); 
    img.decoding='async'; 
    img.loading='eager'; 
    slide.appendChild(img);
    
    const spinner = document.createElement('div'); 
    spinner.className='igfs-spinner'; 
    slide.appendChild(spinner);
    
    // Listener pro aktualizaci rozměrů po načtení obrázku
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight) {
        it.w = img.naturalWidth;
        it.h = img.naturalHeight;
        if (state.cur === i) {
          updateIndex();
        }
      }
      
      // Animace fade-in po načtení
      setTimeout(() => {
        img.classList.add('loaded');
        if (spinner) {
          spinner.style.opacity = '0';
          setTimeout(() => spinner.style.display = 'none', 200);
        }
      }, 50);
    });
    
    // Enhanced error handler
    img.addEventListener('error', () => {
      console.warn(`Failed to load image for item ${i}:`, it.href, 'Current src:', img.src);
      if (spinner) spinner.style.display = 'none';
      
      // Několik fallback pokusů
      if (it.low && img.src !== it.low) {
        console.info(`Trying fallback to low-res for item ${i}`);
        img.src = it.low;
      } else if (it.srcset) {
        // Zkusíme najít jiný obrázek ze srcset
        const srcsetUrls = it.srcset.split(',').map(s => s.trim().split(' ')[0]);
        for (const url of srcsetUrls) {
          if (url && url !== img.src) {
            console.info(`Trying srcset fallback for item ${i}:`, url);
            img.src = decodeEntities(url);
            break;
          }
        }
      } else {
        // Poslední pokus - hledání v DOM
        const domImg = document.querySelector(`a[href="${it.href}"] img`);
        if (domImg && (domImg.src || domImg.currentSrc)) {
          const lastResort = domImg.currentSrc || domImg.src;
          if (lastResort !== img.src) {
            console.info(`Last resort fallback for item ${i}:`, lastResort);
            img.src = lastResort;
          }
        }
      }
    });
    
    // Inicializace s nejvyšším rozlišením
    let bestUrl = null;
    
    // 1. Zkusit HQ pokud je k dispozici
    if (it.hq) {
      bestUrl = it.hq;
    } else if (it.srcset) {
      // 2. Extrahovat z srcset
      const largest = pickLargestFromSrcset(it.srcset);
      if (largest) {
        bestUrl = deThumbURL(decodeEntities(largest));
        it.hq = bestUrl;
      }
    }
    
    // 3. Nastavit nejlepší dostupný URL
    if (bestUrl) {
      img.src = bestUrl;
      img.setAttribute('data-quality', 'hq');
      it.hq_preloaded = true;
    } else if (it.low) {
      img.src = it.low;
      img.setAttribute('data-quality', 'lq');
      // Rychlý async upgrade na HQ
      setTimeout(() => {
        resolveHQ(it).then(hqUrl => {
          if (hqUrl && hqUrl !== it.low && img.src === it.low) {
            img.src = hqUrl;
            img.setAttribute('data-quality', 'hq');
            it.hq = hqUrl;
            it.hq_preloaded = true;
          }
        }).catch(error => {
          console.error(`Error upgrading to HQ for slide ${i}:`, error);
        });
      }, 50); // Sníženo z 200ms na 50ms
    } else {
      // FALLBACK: Pokud nemáme ani HQ ani LQ, zkusíme extrahovat ze srcset nebo href
      console.warn(`No src available for item ${i}, trying fallback:`, it);
      img.setAttribute('data-quality', 'unknown');
      
      // Pokus o extrakci z href (jako emergency fallback)
      if (it.href) {
        // Nastavíme placeholder nebo pokusíme se najít obrázek v DOM
        const domImg = document.querySelector(`a[href="${it.href}"] img`);
        if (domImg && (domImg.src || domImg.currentSrc)) {
          const fallbackSrc = domImg.currentSrc || domImg.src;
          img.src = fallbackSrc;
          it.low = fallbackSrc; // Uložíme pro příště
          console.info(`Found fallback src for item ${i}:`, fallbackSrc);
        }
      }
    }
    
        // Rychlý iOS loading jako backup s větší prioritou
    setTimeout(() => {
      // Pokud obrázek stále nemá src, prioritně spustíme iOS loading
      if (!img.src || img.src === window.location.href) {
        console.warn(`Image ${i} has no src, triggering priority iOS loading`);
        loadForIndexIOS(state.items, i).then(() => {
          // Po iOS loading zkusíme znovu nastavit src
          if (state.items[i] && state.items[i].low && !img.src) {
            img.src = state.items[i].low;
            img.setAttribute('data-quality', 'lq');
          }
        }).catch(error => {
          console.error(`Error loading image for slide ${i}:`, error);
        });
      } else {
        // Standardní iOS loading pro optimalizaci
        loadForIndexIOS(state.items, i).catch(error => {
          console.error(`Error optimizing image for slide ${i}:`, error);
        });
      }
    }, 20); // Sníženo z 100ms na 20ms pro rychlejší reakci
    
    // Dvaklik → otevřít post
    slide.addEventListener('dblclick', ()=>{ 
      if (it && it.href) openURLWithGesture(buildPostURL(it.href)); 
    }, {passive:true});
    
    return slide;
  }

  function buildSlides(){
    const { track } = UI;
    track.innerHTML = '';
    state.items.forEach((it,i)=> track.appendChild(makeSlide(it,i)));
    updateIndex();
    translateTo(state.cur, false);
  }

  function updateIndex(){
    const it = state.items[state.cur];
    
    // Debug info pro nové obrázky
    if (it && (!it.low || !it.node)) {
      console.warn(`Image ${state.cur} missing data:`, {
        hasLow: !!it.low,
        hasHq: !!it.hq,
        hasSrcset: !!it.srcset,
        hasNode: !!it.node,
        href: it.href
      });
    }
    
    // Detekce skutečné kvality obrázku
    let actualQuality = 'LQ';
    if (it && it.node) {
      const img = it.node.querySelector('img');
      if (img) {
        const isHQ = img.getAttribute('data-quality') === 'hq' || 
                    (it.hq_preloaded && img.src === it.hq) ||
                    (img.naturalWidth > 1000); // Heuristika pro HQ
        actualQuality = isHQ ? 'HQ' : 'LQ';
        
        // Debug pro problematické obrázky
        if (!img.src || img.src === window.location.href) {
          console.error(`Image ${state.cur} has no src:`, {
            imgSrc: img.src,
            itLow: it.low,
            itHq: it.hq,
            imgNaturalWidth: img.naturalWidth
          });
        }
      }
    }
    
    // Zobrazení rozlišení - zkusit více zdrojů
    let res = '…';
    if (it) {
      if (it.w && it.h && it.w > 0 && it.h > 0) {
        res = `${it.w}×${it.h}`;
      } else if (it.node) {
        const img = it.node.querySelector('img');
        if (img && (img.naturalWidth || img.width)) {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (w > 0 && h > 0) {
            res = `${w}×${h}`;
            // Aktualizovat item data
            it.w = w;
            it.h = h;
          }
        }
      }
    }
    
    // Zobrazit indikátor background loading
    const bgLoadingIndicator = bgPreloader.isPreloading ? ' 🔄' : '';
    UI.idxLab.textContent = `${state.items.length?state.cur+1:0} / ${state.items.length} · ${actualQuality} · ${res} · v${VERSION}${bgLoadingIndicator}`;
    
    UI.prevBtn.disabled = state.cur <= 0;
    UI.nextBtn.disabled = state.cur >= state.items.length-1;

    const hasNext = state.cur < state.items.length - 1;
    const hasUnpreloaded = state.items.slice(state.cur + 1, state.cur + 6).some(it => !it.hq_preloaded && !it.hq_preload_promise);
    UI.preloadBtn.disabled = !hasNext || !hasUnpreloaded || bgPreloader.isPreloading;
  }

  function translateTo(i, animate=true){
    state.cur = clamp(i, 0, state.items.length-1);
    const { track } = UI;
    track.style.transition = animate ? 'transform 280ms ease' : 'none';
    track.style.transform  = `translate3d(${-state.cur*window.innerWidth}px,0,0)`;
    updateIndex();

    // Optimalizovaný preload systém pro iOS
    const optimizedPreload = async () => {
      // 1. Prioritní preload: aktuální a sousední obrázky
      const priorityIndexes = [state.cur-1, state.cur, state.cur+1];
      const priorityPromises = priorityIndexes
        .filter(k => k >= 0 && k < state.items.length)
        .map(k => loadForIndexIOS(state.items, k));
      
      await Promise.all(priorityPromises);
      
      // 2. Background preload: další obrázky dopředu
      await bgPreloader.preloadAhead(state.items, state.cur);
      
      // 3. Kontrola, zda spustit načítání nových obrázků
      if (bgPreloader.shouldTriggerPreload(state.cur, state.items.length)) {
        bgPreloader.triggerBackgroundPreload(state).then((added) => {
          if (added) {
            // Přidat nové slidy do track
            const keep = state.cur;
            const trackWas = track.children.length;
            for (let i = trackWas; i < state.items.length; i++){
              const s = makeSlide(state.items[i], i);
              track.appendChild(s);
            }
            
            // Zajistit správnou pozici overlay a track
            setTimeout(() => {
              // Obnovit pozici bez animace
              track.style.transition = 'none';
              track.style.transform = `translate3d(${-keep*window.innerWidth}px,0,0)`;
              state.cur = keep;
              
              // Aktualizovat UI
              updateIndex();
              
              // Obnovit animace po krátké pauze
              setTimeout(() => {
                track.style.transition = '';
              }, 50);
            }, 100);
          }
        }).catch(error => {
          console.error('Background preload failed:', error);
          toast('Background loading failed');
        });
      }
    };
    
    // Spustit optimalizovaný preload s menším zpožděním
    setTimeout(optimizedPreload, 30); // Sníženo z 80ms na 30ms
  }
  const translateToDebounced = debounce(translateTo, 20);
  const next = ()=> { if (state.cur < state.items.length-1) translateToDebounced(state.cur+1); };
  const prev = ()=> { if (state.cur > 0) translateToDebounced(state.cur-1); };

  // Asynchronní otevření s čekáním na kompletní načtení obrázků
  async function open(){
    if (state.active) return;
    
    // Zobraz loading indikátor
    UI.showLoading();
    toast('Načítám obrázky...');
    
    try {
      // Použij async verzi pro kompletní načtení HQ dat
      state.items = await collectExploreItemsAsync(3000); // 3s timeout
      if (!state.items.length){ 
        toast('No images found on Explore'); 
        UI.hideLoading();
        return; 
      }

      UI.setVersion(IGFS.VERSION);
      state.cur = 0;
      buildSlides();
      UI.showOverlay();
      state.active = true;
      UI.hideLoading();
      toast(`Načteno ${state.items.length} obrázků v HQ kvalitě`);
    } catch (error) {
      console.error('Chyba při načítání obrázků:', error);
      // Fallback na synchronní verzi
      toast('Používám rychlé načtení (možná low-res)');
      state.items = collectExploreItems();
      if (!state.items.length){ 
        toast('No images found on Explore'); 
        UI.hideLoading();
        return; 
      }
      UI.setVersion(IGFS.VERSION);
      state.cur = 0;
      buildSlides();
      UI.showOverlay();
      state.active = true;
      UI.hideLoading();
    }
  }

  function close(){
    if (!state.active) return;
    state.active = false;
    
    // Animovaný close efekt
    UI.overlay.style.opacity = '0';
    UI.overlay.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      UI.hideOverlay();
      UI.overlay.style.opacity = '';
      UI.overlay.style.transform = '';
    }, 300);
  }

  // ---------- Akce toolbaru ----------
  async function toggleQuality(){
    const newVal = !getPreferHQ();
    setPreferHQ(newVal);
    toast(newVal ? 'Quality: HQ' : 'Quality: LQ');
    updateIndex();
    
    try {
      await loadForIndexIOS(state.items, state.cur);
      const it = state.items[state.cur];
      if (it && it.hq_preloaded && it.hq) IGFS.Preload.swapDisplayedToHQ(it, it.hq);
      
      // Async preload sousedních obrázků s error handling
      const neighbors = [state.cur-1, state.cur+1];
      await Promise.allSettled(
        neighbors
          .filter(k => k >= 0 && k < state.items.length)
          .map(k => loadForIndexIOS(state.items, k))
      );
    } catch (error) {
      console.error('Error in toggleQuality:', error);
      toast('Chyba při přepínání kvality');
    }
  }

  // Rozšířená verze manual preload s aktualizací dat
  async function manualPreloadNext(){
    if (state.manualPreloading || bgPreloader.isPreloading) return;
    state.manualPreloading = true;
    UI.preloadBtn.classList.add('preloading');
    UI.preloadBtn.disabled = true;

    try {
      // Nejprve zkus background preload pro nové obrázky
      const backgroundAdded = await bgPreloader.triggerBackgroundPreload(state);
      
      if (backgroundAdded) {
        // Přidat nové slidy - makeSlide se postará o načtení obrázků
        const { track } = UI;
        const keep = state.cur;
        const trackWas = track.children.length;
        for (let i = trackWas; i < state.items.length; i++){
          const s = makeSlide(state.items[i], i);
          track.appendChild(s);
        }
        
        // Zajistit správnou pozici overlay a track
        setTimeout(() => {
          // Obnovit pozici bez animace
          track.style.transition = 'none';
          track.style.transform = `translate3d(${-keep*window.innerWidth}px,0,0)`;
          state.cur = keep;
          
          // Aktualizovat UI
          updateIndex();
          
          // Obnovit animace po krátké pauze
          setTimeout(() => {
            track.style.transition = '';
          }, 50);
        }, 100);
      }
      
      // Poté preload existující položky
      const start = state.cur + 1;
      const end = Math.min(start + 8, state.items.length);
      const jobs = [];
      
      for (let i = start; i < end; i++){
        const it = state.items[i];
        if (it && !it.hq_preloaded && !it.hq_preload_promise) {
          jobs.push(preloadHQIntoCache(it));
        }
      }
      
      if (jobs.length > 0) {
        await Promise.all(jobs);
        toast(`✓ Preloaded ${jobs.length} HQ images`);
      } else if (!backgroundAdded) {
        toast('All nearby images already preloaded');
      }

    } catch (error) {
      console.error('Chyba při manual preload:', error);
      toast('Chyba při aktualizaci dat');
    } finally {
      state.manualPreloading = false;
      UI.preloadBtn.classList.remove('preloading');
      UI.preloadBtn.disabled = false;
      updateIndex();
    }
  }

  async function doDownloadCurrent(){
    const it = state.items[state.cur]; if (!it) return;
    const url = (getPreferHQ() ? (await resolveHQ(it)) : (it.low || await resolveHQ(it)));
    if (!url){ toast('No image'); return; }
    // iOS: otevřít v novém tabu → dlouze podržet a uložit
    openURLWithGesture(url);
    toast('Long-press the image → Save');
  }

  async function saveToGalleryCurrent(){
    const it = state.items[state.cur]; if (!it) return;
    const url = (getPreferHQ() ? (await resolveHQ(it)) : (it.low || await resolveHQ(it)));
    if (!url){ toast('No image to save'); return; }
    
    // Detekce iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    try {
      toast('Preparing image for save...');
      
      // Vytvoř nový obrázek pro cross-origin načtení
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        // Přidej timestamp pro bypass cache
        img.src = url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;
      });
      
      // Vytvoř canvas a nakresli obrázek
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);
      
      // Konvertuj na blob s vysokou kvalitou
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.95);
      });
      
      if (isIOS) {
        // Na iOS: zkus Web Share API nejprve
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], `instagram_image_${Date.now()}.jpg`, { type: 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Save to Photos',
                text: 'Instagram image'
              });
              toast('✓ Saved to Photos via Share');
              return;
            }
          } catch (shareError) {
            console.log('Web Share failed, trying download:', shareError);
          }
        }
        
        // iOS fallback: vytvoř download link s specifickými atributy
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `instagram_image_${Date.now()}.jpg`;
        a.style.display = 'none';
        a.target = '_blank';
        document.body.appendChild(a);
        
        // Simuluj user gesture click
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        }, 100);
        
        toast('📱 Tap Downloads → Save to Photos');
        
      } else {
        // Non-iOS: standardní download
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `instagram_image_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        toast('✓ Image downloaded');
      }
      
    } catch (error) {
      console.error('Error saving image:', error);
      
      // Fallback: přímé otevření obrázku
      toast('Using fallback method...');
      openURLWithGesture(url);
      
      if (isIOS) {
        toast('📱 Long-press image → Save to Photos');
      } else {
        toast('Right-click → Save image as...');
      }
    }
  }

  async function copyUrlCurrent(){
    const it = state.items[state.cur]; if (!it) return;
    const url = (getPreferHQ() ? (await resolveHQ(it)) : (it.low || await resolveHQ(it)));
    if (!url){ toast('No image URL'); return; }
    try { await navigator.clipboard.writeText(url); toast('URL copied'); }
    catch {
      const ta=document.createElement('textarea'); ta.value=url; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta);
      ta.focus(); ta.select(); try{ document.execCommand('copy'); toast('URL copied'); }catch{ toast('Copy failed'); } ta.remove();
    }
  }

  function openPostCurrent(){
    const it = state.items[state.cur];
    if (!it || !it.href) return;
    openURLWithGesture(buildPostURL(it.href));
  }

  // ---------- Interakce ----------
  function onPointerDown(e){
    if (!state.active) return;
    if (isUI(e.target) || isForm(e.target)) return;
    state.dragging = true;
    state.startX = e.touches ? e.touches[0].clientX : e.clientX;
    state.curX = state.startX;
    UI.track.style.transition = 'none';
    e.preventDefault();
  }
  const onPointerMove = debounce(function(e){
    if (!state.active || !state.dragging) return;
    if (isUI(e.target) || isForm(e.target)) return;
    state.curX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = state.curX - state.startX;
    UI.track.style.transform = `translate3d(${(-state.cur*window.innerWidth)+dx}px,0,0)`;
    e.preventDefault();
  }, 10);
  function onPointerUp(e){
    if (!state.active || !state.dragging) return;
    state.dragging = false;
    const dx = state.curX - state.startX;
    const min = Math.max(40, Math.round(window.innerWidth * 0.12));
    if (dx <= -min && state.cur < state.items.length-1) next();
    else if (dx >=  min && state.cur > 0) prev();
    else translateTo(state.cur);
    e.preventDefault();
  }

  // ---------- Public API ----------
  const App = {
    state, // Export state pro debug
    updateIndex, // Export pro externí použití
    init(){
      // Verze do FABu
      UI.setVersion(VERSION);

      // FAB a Close
      UI.toggleBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); state.active ? close() : open(); });
      UI.closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); close(); });

      // Ovládací prvky
      UI.prevBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); prev(); });
      UI.nextBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); next(); });
      UI.preloadBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); manualPreloadNext(); });
      UI.btnQual.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggleQuality(); });
      UI.btnDl  .addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); doDownloadCurrent(); });
      UI.btnSave.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); saveToGalleryCurrent(); });
      UI.btnCopy.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); copyUrlCurrent(); });
      UI.btnOpen.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openPostCurrent(); });
      UI.btnDebug.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); UI.toggleDebug(); });

      // Gesta
      UI.track.addEventListener('touchstart', onPointerDown, {passive:false});
      UI.track.addEventListener('touchmove',  onPointerMove,  {passive:false});
      UI.track.addEventListener('touchend',   onPointerUp,    {passive:false});
      UI.track.addEventListener('mousedown',  onPointerDown);
      UI.track.addEventListener('mousemove',  onPointerMove);
      UI.track.addEventListener('mouseup',    onPointerUp);

      window.addEventListener('resize', ()=>{ if (state.active) translateTo(state.cur,false); }, {passive:true});
      window.addEventListener('orientationchange', ()=>{ if (state.active) translateTo(state.cur,false); }, {passive:true});

      console.log(`[IGFS iOS] ready — v${VERSION}`);
    }
  };

  IGFS.App = App;
  
})();