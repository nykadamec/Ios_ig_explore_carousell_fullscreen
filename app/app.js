// /app/app.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { VERSION, clamp, toast, buildPostURL, openURLWithGesture, debounce } = IGFS;
  const { UI } = IGFS;
  const { collectExploreItems } = IGFS;
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
  };

  // ---------- Helpers ----------
  function isUI(t){ return !!(t && t.closest('.igfs-btn,.igfs-fab,.igfs-menu,.igfs-loading-indicator')); }
  function isForm(t){ return !!(t && t.closest('input,textarea,button,select,[contenteditable="true"]')); }

  function makeSlide(it, i){
    const slide = document.createElement('div'); slide.className='igfs-slide'; slide.dataset.index=String(i); it.node=slide;
    const img = document.createElement('img'); img.decoding='async'; img.loading='eager'; slide.appendChild(img);
    const spinner = document.createElement('div'); spinner.className='igfs-spinner'; slide.appendChild(spinner);
    // Načti obrázek (iOS)
    loadForIndexIOS(state.items, i);
    // Dvaklik → otevřít post
    slide.addEventListener('dblclick', ()=>{ if (it && it.href) openURLWithGesture(buildPostURL(it.href)); }, {passive:true});
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
    const res = (it && it.w && it.h) ? `${it.w}×${it.h}` : '…';
    UI.idxLab.textContent = `${state.items.length?state.cur+1:0} / ${state.items.length} · ${getPreferHQ()?'HQ':'LQ'} · ${res} · v${VERSION}`;
    UI.prevBtn.disabled = state.cur <= 0;
    UI.nextBtn.disabled = state.cur >= state.items.length-1;

    const hasNext = state.cur < state.items.length - 1;
    const hasUnpreloaded = state.items.slice(state.cur + 1, state.cur + 6).some(it => !it.hq_preloaded && !it.hq_preload_promise);
    UI.preloadBtn.disabled = !hasNext || !hasUnpreloaded;
  }

  function translateTo(i, animate=true){
    state.cur = clamp(i, 0, state.items.length-1);
    const { track } = UI;
    track.style.transition = animate ? 'transform 280ms ease' : 'none';
    track.style.transform  = `translate3d(${-state.cur*window.innerWidth}px,0,0)`;
    updateIndex();

    // Preload sousedy
    setTimeout(()=> {
      [state.cur-1, state.cur+1, state.cur+2].forEach(k=>{
        if (k>=0 && k<state.items.length) loadForIndexIOS(state.items, k);
      });
      // Pokud se blížíme ke konci, spustíme hold-bottom autoload
      const remaining = state.items.length - 1 - state.cur;
      if (remaining <= 4) {
        loadMoreImagesHoldBottom(state, 4000).then((added) => {
          if (added) {
            // přidat nové slidy, zachovat index
            const keep = state.cur;
            const trackWas = track.children.length;
            // doplníme jen nově přidané
            for (let i = trackWas; i < state.items.length; i++){
              const s = makeSlide(state.items[i], i);
              track.appendChild(s);
            }
            translateTo(keep, false);
          }
        });
      }
    }, 60);
  }
  const translateToDebounced = debounce(translateTo, 20);
  const next = ()=> { if (state.cur < state.items.length-1) translateToDebounced(state.cur+1); };
  const prev = ()=> { if (state.cur > 0) translateToDebounced(state.cur-1); };

  function open(){
    if (state.active) return;
    state.items = collectExploreItems();
    if (!state.items.length){ toast('No images found on Explore'); return; }

    UI.setVersion(IGFS.VERSION);
    state.cur = 0;
    buildSlides();
    UI.showOverlay();
    state.active = true;
  }

  function close(){
    if (!state.active) return;
    state.active = false;
    UI.hideOverlay();
  }

  // ---------- Akce toolbaru ----------
  async function toggleQuality(){
    const newVal = !getPreferHQ();
    setPreferHQ(newVal);
    toast(newVal ? 'Quality: HQ' : 'Quality: LQ');
    updateIndex();
    await loadForIndexIOS(state.items, state.cur);
    const it = state.items[state.cur];
    if (it && it.hq_preloaded && it.hq) IGFS.Preload.swapDisplayedToHQ(it, it.hq);
    [state.cur-1, state.cur+1].forEach(k=>{ if(k>=0 && k<state.items.length) loadForIndexIOS(state.items, k); });
  }

  async function manualPreloadNext(){
    if (state.manualPreloading) return;
    state.manualPreloading = true;
    UI.preloadBtn.classList.add('preloading');
    UI.preloadBtn.disabled = true;

    let cnt = 0;
    const start = state.cur + 1;
    const end = Math.min(start + 8, state.items.length);
    const jobs = [];
    for (let i = start; i < end; i++){
      const it = state.items[i];
      if (it && !it.hq_preloaded && !it.hq_preload_promise) {
        jobs.push(preloadHQIntoCache(it).then(()=>{ cnt++; }));
      }
    }
    if (!jobs.length) {
      toast('All next images already preloaded');
      state.manualPreloading = false;
      UI.preloadBtn.classList.remove('preloading');
      updateIndex();
      return;
    }
    try {
      await Promise.all(jobs);
      toast(`Preloaded ${cnt} HQ images`);
    } finally {
      state.manualPreloading = false;
      UI.preloadBtn.classList.remove('preloading');
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
    // Na iOS: stejné jako download (bez přímého uložení do Photos)
    return doDownloadCurrent();
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
  const onPointerMoveDebounced = debounce(function(e){
    if (!state.active || !state.dragging) return;
    if (isUI(e.target) || isForm(e.target)) return;
    state.curX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = state.curX - state.startX;
    UI.track.style.transform = `translate3d(${(-state.cur*window.innerWidth)+dx}px,0,0)`;
    e.preventDefault();
  }, 10);
  function onPointerMove(e){ onPointerMoveDebounced(e); }
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
