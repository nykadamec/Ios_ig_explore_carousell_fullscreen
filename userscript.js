
// ==UserScript==
// @name         Instagram Explore → Fullscreen Swipe (v2.3.5) — HQ hot-swap, focus fix, smart autoload & proper post links
// @namespace    ig-explore-fullscreen
// @version      2.3.5
// @description  Explore jako fullscreen swipe-carousel jen pro fotky (bez Reels). Správné pořadí, iOS-safe, HQ/LQ toggle. Robustní deduplikace, správný index, LQ→HQ hot-swap po preloadu, fix zamrznutí kliků a chytré autoloadování: pokud nejsou nové fotky, stránka se opakovaně doscrolluje úplně dolů, počká na načtení a pak se vrátí zpět na 0. Odkaz „Open Post“ nyní míří na plné URL ve formátu /p/<shortcode>/?chaining=true .
// @match        https://www.instagram.com/explore/*
// @match        https://www.instagram.com/*explore*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- Singleton guard ----------
  if (window.__IGFS_ACTIVE__) return;
  window.__IGFS_ACTIVE__ = true;

  // ---------- Version ----------
  const VERSION = '2.3.5';

  // ---------- Shorthands ----------
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- Platform ----------
  const isIOS = () => {
    const ua = navigator.userAgent || '';
    const isMobileWebKit = /AppleWebKit/.test(ua) && /Mobile/.test(ua);
    const isIPadOS = /Macintosh/.test(ua) && 'ontouchend' in document;
    return isMobileWebKit || isIPadOS;
  };
  const ON_IOS = isIOS();

  // ---------- Utils ----------
  const sleep = (ms)=> new Promise(res=> setTimeout(res, ms));
  const debounce = (fn, t)=>{ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a),t); }; };
  const decodeEntities = (u) => u ? u.replace(/&amp;/g, '&') : u;
  const deThumbURL = (url) => url
    ? url.replace(/\/s\d+x\d+\//g, '/').replace(/\/p\d+x\d+\//g, '/').replace(/\/c\d+\.\d+\.\d+\.\d+\//g, '/')
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

  // ---------- Inline SVG (Tabler-style) ----------
  function ti(name, size = 18){
    const H = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`;
    const T = `</svg>`;
    const M = {
      x:`<path d="M18 6L6 18"/><path d="M6 6l12 12"/>`,
      'chev-left': `<path d="M15 6l-6 6 6 6"/>`,
      'chev-right': `<path d="M9 6l6 6-6 6"/>`,
      download:`<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/>`,
      copy:`<rect x="8" y="8" width="12" height="12" rx="2"/><rect x="4" y="4" width="12" height="12" rx="2"/>`,
      floppy:`<path d="M6 4h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M12 16a2 2 0 1 0 0 4a2 2 0 0 0 0-4z"/><path d="M6 8h8V4"/>`,
      images:`<rect x="3" y="7" width="18" height="14" rx="2"/><circle cx="8.5" cy="12.5" r="1.5"/><path d="M21 17l-5-5-4 5-3-3-4 5"/>`,
      link:`<path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"/><path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/>`,
      hd:`<path d="M3 7v10M9 7v10M3 12h6M13 7v10M13 12h4a3 3 0 0 0 0-6h-4" />`,
      loader:`<path d="M12 2v4M16.2 7.8l2.8-2.8M18 12h4M16.2 16.2l2.8 2.8M12 18v4M7.8 16.2l-2.8 2.8M6 12H2M7.8 7.8L5 5"/>`,
      'refresh-cw': `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>`,
    };
    return H+(M[name]||'')+T;
  }

  // ---------- Guards ----------
  const isUI = (t)=> !!(t && (t.closest('.igfs-btn,.igfs-fab,.igfs-nav,.igfs-menu,.igfs-loading-indicator')));
  const isForm = (t)=> !!(t && t.closest('input,textarea,button,select,[contenteditable="true"]'));

  // ---------- Toast ----------
  function toast(msg, t=1600){
    let wrap = $('.igfs-toast-wrap');
    if (!wrap){ wrap=document.createElement('div'); wrap.className='igfs-toast-wrap'; document.body.appendChild(wrap); }
    const el=document.createElement('div'); el.className='igfs-toast'; el.textContent=msg; wrap.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>el.classList.remove('show'), t);
    setTimeout(()=>{ el.remove(); if(!wrap.children.length) wrap.remove(); }, t+240);
  }

  // ---------- State ----------
  let items = [];         // {href, low, srcset, hq, w, h, node, hq_preloaded, hq_preload_promise}
  let cur = 0;
  let active = false;
  let dragging=false, startX=0, curX=0;
  let isLoadingMore=false;
  let isManualPreloading=false;
  let preferHQ = true;    // HQ/LQ toggle
  let io=null, mo=null;
  let FEED_ROOT = null;

  // ---------- DOM ----------
  const overlay = document.createElement('div'); overlay.className='igfs-overlay';
  const track   = document.createElement('div'); track.className='igfs-track';
  const idxLab  = document.createElement('div'); idxLab.className='igfs-index';

  const closeBtn = document.createElement('button'); closeBtn.className='igfs-btn igfs-close'; closeBtn.innerHTML = ti('x',16);

  // Loading indicator
  const loadingIndicator = document.createElement('div'); 
  loadingIndicator.className='igfs-loading-indicator';
  loadingIndicator.innerHTML = `${ti('loader',14)} <span>Loading new images...</span>`;
  loadingIndicator.style.display = 'none';

  const menu = document.createElement('div'); menu.className='igfs-menu';
  
  // Prev/Next buttons - now in menu
  const prevBtn = document.createElement('button'); 
  prevBtn.className='igfs-menu-btn igfs-prev-btn'; 
  prevBtn.title='Previous'; 
  prevBtn.innerHTML=ti('chev-left',16);
  
  const nextBtn = document.createElement('button'); 
  nextBtn.className='igfs-menu-btn igfs-next-btn'; 
  nextBtn.title='Next'; 
  nextBtn.innerHTML=ti('chev-right',16);

  // Manual preload button
  const preloadBtn = document.createElement('button'); 
  preloadBtn.className='igfs-menu-btn igfs-preload-btn'; 
  preloadBtn.title='Manually preload next images'; 
  preloadBtn.innerHTML=ti('refresh-cw',16);

  const btnSave = document.createElement('button'); btnSave.className='igfs-menu-btn'; btnSave.title='Save to Gallery'; btnSave.innerHTML=ti('floppy',18);
  const btnDl   = document.createElement('button'); btnDl.className='igfs-menu-btn';   btnDl.title='Download';         btnDl.innerHTML=ti('download',18);
  const btnCopy = document.createElement('button'); btnCopy.className='igfs-menu-btn'; btnCopy.title='Copy URL';       btnCopy.innerHTML=ti('copy',18);
  const btnOpen = document.createElement('button'); btnOpen.className='igfs-menu-btn'; btnOpen.title='Open Post';      btnOpen.innerHTML=ti('link',18);
  const btnQual = document.createElement('button'); btnQual.className='igfs-menu-btn'; btnQual.title='Toggle HQ/LQ';   btnQual.innerHTML=ti('hd',18);
  
  menu.append(prevBtn, btnSave, btnDl, preloadBtn, btnCopy, btnOpen, btnQual, nextBtn);

  overlay.append(track, idxLab, closeBtn, loadingIndicator, menu);
  document.body.appendChild(overlay);

  const toggleBtn = document.createElement('button'); 
  toggleBtn.className='igfs-fab'; 
  toggleBtn.innerHTML = `${ti('images',14)} <span style="margin-left:4px">FS</span> <span class="igfs-version">v${VERSION}</span>`;
  document.body.appendChild(toggleBtn);

  // ---------- Styles ----------
  const css = `
    .igfs-overlay{position:fixed;inset:0;z-index:2147483646;background:#000;color:#fff;display:none;-webkit-tap-highlight-color:transparent;touch-action:none}
    .igfs-overlay.igfs-show{display:block}
    body.igfs-overlay-active{overflow:hidden!important;-webkit-overflow-scrolling:touch!important}
    body.igfs-overlay-active>*:not(.igfs-overlay):not(.igfs-fab):not(.igfs-toast-wrap){pointer-events:none!important}
    .igfs-track{position:absolute;inset:0;display:flex;height:100%;width:100%;will-change:transform;transition:transform 280ms ease}
    .igfs-slide{position:relative;flex:0 0 100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden}
    @media (max-aspect-ratio: 9/16){.igfs-slide{height:auto;min-height:100vh;max-width:100vw}}
    .igfs-slide img{width:100vw;height:100vh;object-fit:contain;object-position:center;display:block;transition:filter .18s ease,transform .12s ease;background:#000;user-select:none;-webkit-user-select:none;-webkit-user-drag:none}
    .igfs-slide img.igfs-loading{filter:blur(6px) saturate(.8) brightness(.9)}
    .igfs-spinner{position:absolute;top:50%;left:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border:4px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;z-index:10;pointer-events:none}
    @keyframes spin{to{transform:rotate(360deg)}}
    .igfs-prog{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.12);opacity:1;transition:opacity .2s ease}
    .igfs-prog>div{height:100%;width:0%;background:#fff;transition:width .08s linear}
    .igfs-index{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0) + 68px);text-align:center;font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:rgba(255,255,255,.95);user-select:none;pointer-events:none;text-shadow:0 0 5px #0008}
    .igfs-btn{position:absolute;top:calc(env(safe-area-inset-top,0) + 10px);z-index:999;background:rgba(0,0,0,.55);color:#fff;border:0;border-radius:999px;padding:6px 10px;cursor:pointer;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;transition:background-color .2s ease;display:flex;align-items:center;justify-content:center}
    .igfs-btn:hover,.igfs-btn:focus{background:rgba(255,255,255,.15);outline:none}
    .igfs-close{right:10px}
    .igfs-loading-indicator{position:absolute;top:calc(env(safe-area-inset-top,0) + 10px);left:50%;transform:translateX(-50%);z-index:999;background:rgba(0,0,0,.7);color:#fff;border:0;border-radius:20px;padding:6px 12px;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
    .igfs-loading-indicator svg{animation:spin 1s linear infinite}
    .igfs-menu{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0) + 14px);z-index:999;display:flex;gap:10px;background:rgba(0,0,0,.45);padding:6px 8px;border-radius:80px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 10px 30px rgba(0,0,0,.45);align-items:center;min-width:320px;justify-content:space-between;font-size:14px;}
    .igfs-menu-btn{width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;background:rgba(255,255,255,.08);color:#fff;display:flex;align-items:center;justify-content:center;transition:background-color .15s ease, transform .1s ease;padding:0;}
    .igfs-menu-btn:hover{background:rgba(255,255,255,.18)} 
    .igfs-menu-btn:active{transform:scale(.96)}
    .igfs-menu-btn:disabled{opacity:0.3;cursor:not-allowed}
    .igfs-menu-btn:disabled:hover{background:rgba(255,255,255,.08)}
    .igfs-prev-btn{order:-1;margin-right:auto}
    .igfs-next-btn{order:1;margin-left:auto}
    .igfs-preload-btn{background:rgba(34,197,94,.15)!important;border:1px solid rgba(34,197,94,.3)}
    .igfs-preload-btn:hover{background:rgba(34,197,94,.25)!important}
    .igfs-preload-btn.preloading{background:rgba(59,130,246,.2)!important;border-color:rgba(59,130,246,.4)}
    .igfs-preload-btn.preloading svg{animation:spin 1s linear infinite}
    .igfs-preload-btn:disabled{background:rgba(34,197,94,.05)!important;border-color:rgba(34,197,94,.1)}
    .igfs-fab{position:fixed;top:10px;right:10px;z-index:2147483647!important;padding:6px 10px;font-size:12px;border-radius:999px;border:none;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;gap:6px}
    .igfs-fab:hover,.igfs-fab:focus{background:rgba(255,255,255,.15);outline:none}
    .igfs-version{font-size:9px;opacity:0.7;margin-left:4px}
    .igfs-toast-wrap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px calc(env(safe-area-inset-bottom,0) + 6px);pointer-events:none}
    .igfs-toast{background:rgba(34,34,34,.92);color:#fff;padding:6px 10px;border-radius:8px;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 15px rgba(0,0,0,.35);transform:translateY(6px);opacity:0;transition:opacity .18s ease, transform .18s ease}
    .igfs-toast.show{transform:translateY(0);opacity:1}
    @media (prefers-reduced-motion: reduce){.igfs-track{transition:none}.igfs-toast{transition:none}}
  `;
  const styleTag=document.createElement('style'); styleTag.textContent=css; document.head.appendChild(styleTag);

  // ---------- Collect & Order ----------
  function collectExploreItems(){
    const roots = $$('main a[role="link"], main a[href^="/p/"], main a[href^="/reel/"]');
    const uniq = new Map();
    for (const a of roots){
      const href = a.getAttribute('href') || '';
      if (!href) continue;

      // Skip reels, videos etc.
      const isVideo = href.startsWith('/reel/') ||
                      $('video', a) ||
                      $('[playsinline]', a) ||
                      $('svg[aria-label="Reel"], svg[aria-label="Video"]', a);

      if (isVideo) continue;

      const key = href.split('?')[0].split('#')[0];
      if (uniq.has(key)) continue;

      const img = $('img', a);
      if (img && (img.src || img.currentSrc)){
        let srcset = '';
        const picture = $('picture', a);
        if (picture){
          const source = $('source[srcset]', picture);
          if (source && source.getAttribute('srcset')) srcset = source.getAttribute('srcset');
        }
        if (img.srcset) srcset = img.srcset || srcset;

        uniq.set(key, {
          type: 'img',
          href: key,
          low: decodeEntities(img.currentSrc || img.src),
          srcset,
          hq: null,
          w:0, h:0,
          node:null,
          hq_preloaded: false,
          hq_preload_promise: null
        });
      }
    }
    // Sort by position on page (top, then left)
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

  // ---------- URL helpers ----------
  function buildPostURL(href){
    // Normalize to /p/<code>/ and add ?chaining=true, make absolute
    let path = href || '/';
    if (!path.startsWith('/')) path = '/' + path;
    // ensure trailing slash
    if (!path.endsWith('/')) path += '/';
    // ensure we're on /p/... (safety: if It's reel, still works but my collector skips reels)
    const u = new URL(location.origin + path);
    u.searchParams.set('chaining', 'true');
    return u.toString();
  }

  // ---------- URL resolution ----------
  async function resolveHQ(it){
    if (it.hq) return it.hq;
    if (it.srcset){
      const best = pickLargestFromSrcset(it.srcset);
      if (best) it.hq = deThumbURL(best);
    }
    if (!it.hq && it.low) it.hq = deThumbURL(it.low);
    return it.hq || it.low;
  }
  async function resolveByQuality(it){ return preferHQ ? await resolveHQ(it) : (it.low || await resolveHQ(it)); }

  // ---------- HQ hot-swap helper ----------
  function swapDisplayedToHQ(item, hqUrl){
    if (!item || !item.node || !hqUrl) return;
    if (!preferHQ) return; // uživatel je v LQ režimu
    const imgEl = item.node.querySelector('img');
    if (!imgEl) return;
    if (imgEl.src === hqUrl) return;

    const onload = () => {
      imgEl.classList.remove('igfs-loading');
      const spinner = item.node.querySelector('.igfs-spinner');
      if (spinner) spinner.style.display = 'none';
      item.w = imgEl.naturalWidth;
      item.h = imgEl.naturalHeight;
      imgEl.removeEventListener('load', onload);
      updateIndex();
    };
    imgEl.addEventListener('load', onload);
    imgEl.setAttribute('data-quality','hq');
    imgEl.src = hqUrl; // díky preloadu je to instant z cache
  }

  // ---------- Preload HQ into Cache (with hot-swap) ----------
  async function preloadHQIntoCache(item) {
    if (!item || item.hq_preloaded || item.hq_preload_promise) {
      return item.hq_preload_promise;
    }
    try {
      item.hq_preload_promise = new Promise(async (resolve) => {
        const hqUrl = await resolveHQ(item);

        if (hqUrl && hqUrl !== item.low) {
          const preloadImg = new Image();
          preloadImg.crossOrigin = 'anonymous';
          preloadImg.onload = () => {
            item.hq_preloaded = true;
            swapDisplayedToHQ(item, hqUrl); // HOT-SWAP
            resolve(hqUrl);
          };
          preloadImg.onerror = () => { resolve(null); };
          preloadImg.src = hqUrl;
        } else {
          item.hq_preloaded = true;
          swapDisplayedToHQ(item, hqUrl);
          resolve(hqUrl);
        }
      });
      return item.hq_preload_promise;
    } catch {
      return null;
    }
  }

  // ---------- Check if HQ is available from preload ----------
  async function getPreloadedHQIfAvailable(item) {
    if (!item) return null;
    if (item.hq_preload_promise) {
      try { return await item.hq_preload_promise; } catch { return null; }
    }
    if (item.hq_preloaded && item.hq) return item.hq;
    return null;
  }

  // ---------- Image Loading ----------
  async function loadImageIOS(img, url, it, spinner){
    img.classList.add('igfs-loading'); if (spinner) spinner.style.display='block';
    return new Promise((resolve)=>{
      img.onload = ()=>{ it.w=img.naturalWidth; it.h=img.naturalHeight; img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; updateIndex(); resolve(true); };
      img.onerror = ()=>{ img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; resolve(false); };
      img.src = url;
    });
  }

  async function loadImageNonIOS(img, url, it, spinner, prog){
    img.classList.add('igfs-loading'); if (spinner) spinner.style.display='block';
    try{
      const r = await fetch(url, { mode:'cors', credentials:'omit' });
      if (!r.ok || !r.body) throw new Error('no-stream');
      const totalStr = r.headers.get('Content-Length'); const total = totalStr ? parseInt(totalStr) : 0;
      if (!total) throw new Error('no-length');

      const reader = r.body.getReader(); const chunks=[]; let rec=0;
      // Throttle progress updates (>=3% delta and >=50ms)
      let lastPct = -1, lastTs = 0;

      while(true){
        const {done, value} = await reader.read(); if (done) break;
        chunks.push(value); rec += value.byteLength;
        if (prog){
          const pct = Math.max(0, Math.min(100, Math.round((rec/total)*100)));
          const now = performance.now();
          if ((pct >= lastPct + 3) && (now - lastTs >= 50)) {
            prog.firstElementChild.style.width = pct+'%';
            lastPct = pct; lastTs = now;
          }
        }
      }
      const blob = new Blob(chunks); const bUrl = URL.createObjectURL(blob);
      return new Promise((resolve)=>{
        img.onload = ()=>{ it.w=img.naturalWidth; it.h=img.naturalHeight; img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; if(prog){ prog.firstElementChild.style.width='100%'; setTimeout(()=>prog.style.opacity='0',240); } URL.revokeObjectURL(bUrl); updateIndex(); resolve(true); };
        img.onerror = ()=>{ img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; if(prog) prog.style.opacity='0'; URL.revokeObjectURL(bUrl); resolve(false); };
        img.src = bUrl;
      });
    }catch{
      return new Promise((resolve)=>{
        if (prog) prog.style.opacity='0';
        img.onload = ()=>{ it.w=img.naturalWidth; it.h=img.naturalHeight; img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; updateIndex(); resolve(true); };
        img.onerror = ()=>{ img.classList.remove('igfs-loading'); if(spinner) spinner.style.display='none'; resolve(false); };
        img.src = url;
      });
    }
  }

  async function loadForIndex(i){
    const it = items[i]; if (!it || !it.node) return;
    const img = it.node.querySelector('img');
    const spinner = it.node.querySelector('.igfs-spinner');
    const prog = it.node.querySelector('.igfs-prog');

    if (preferHQ) {
      const preloadedHQ = await getPreloadedHQIfAvailable(it);
      if (preloadedHQ) {
        const ok = ON_IOS
          ? await loadImageIOS(img, preloadedHQ, it, spinner)
          : await loadImageNonIOS(img, preloadedHQ, it, spinner, prog);
        if (ok) return;
      }
    }

    const hq = await resolveHQ(it);
    const lq = it.low || hq;
    const firstUrl = preferHQ ? hq : lq;

    const ok = ON_IOS
      ? await loadImageIOS(img, firstUrl, it, spinner)
      : await loadImageNonIOS(img, firstUrl, it, spinner, prog);

    if (!ok && preferHQ && lq && lq !== firstUrl){
      if (ON_IOS) await loadImageIOS(img, lq, it, spinner);
      else        await loadImageNonIOS(img, lq, it, spinner, prog);
    }
  }

  // ---------- Slides ----------
  function makeSlide(it, i){
    const slide = document.createElement('div'); slide.className='igfs-slide'; slide.dataset.index=String(i); it.node=slide;
    const img = document.createElement('img'); img.decoding='async'; img.loading='eager'; slide.appendChild(img);
    const spinner = document.createElement('div'); spinner.className='igfs-spinner'; slide.appendChild(spinner);
    const prog = document.createElement('div'); prog.className='igfs-prog'; prog.innerHTML='<div></div>'; slide.appendChild(prog);
    if (ON_IOS) prog.style.opacity='0';

    const left  = document.createElement('div'); left.className='igfs-hit left';
    const right = document.createElement('div'); right.className='igfs-hit right';
    left.addEventListener('click', ()=> translateToDebounced(cur-1), {passive:true});
    right.addEventListener('click',()=> translateToDebounced(cur+1), {passive:true});
    slide.append(left,right);

    slide.addEventListener('dblclick', ()=> {
      // open full post URL with chaining=true
      if (it && it.href) openURLWithGesture(buildPostURL(it.href));
    }, {passive:true});

    loadForIndex(i);
    return slide;
  }

  function buildSlides(){
    track.innerHTML='';
    items.forEach((it,i)=> track.appendChild(makeSlide(it,i)));
    updateIndex();
    translateToDebounced(cur,false);
  }

  // ---------- Merge ----------
  function mergeItems(oldItems, newItems){
    const map = new Map();
    oldItems.forEach(x => map.set(x.href, x));
    newItems.forEach(x => { if (!map.has(x.href)) map.set(x.href, x); });
    return Array.from(map.values());
  }

  // ---------- Index / Nav ----------
  function formatRes(w,h){ return (w&&h) ? `${w}×${h}` : '…'; }
  function updateIndex(){
    const it = items[cur];
    idxLab.textContent = `${items.length?cur+1:0} / ${items.length} · ${it?formatRes(it.w,it.h):'…'} · ${preferHQ?'HQ':'LQ'} · v${VERSION}`;

    prevBtn.disabled = cur <= 0;
    nextBtn.disabled = cur >= items.length - 1;

    const hasNextImages = cur < items.length - 1;
    const hasUnpreloaded = items.slice(cur + 1, cur + 6).some(item => !item.hq_preloaded && !item.hq_preload_promise);
    preloadBtn.disabled = !hasNextImages || (!hasUnpreloaded && !isManualPreloading);
  }

  function translateTo(i, animate=true){
    cur = Math.max(0, Math.min(items.length-1, i));
    track.style.transition = animate ? 'transform 280ms ease' : 'none';
    track.style.transform  = `translate3d(${-cur*window.innerWidth}px,0,0)`;
    updateIndex();

    setTimeout(() => {
      checkAndLoadMore();
      preloadNextImages();
    }, 100);

    [cur-1,cur+1].forEach(j=>{ if (j>=0 && j<items.length) loadForIndex(j); });
  }
  const translateToDebounced = debounce(translateTo, 20);
  const next = ()=>{ if (cur<items.length-1) translateToDebounced(cur+1); };
  const prev = ()=>{ if (cur>0) translateToDebounced(cur-1); };

  // ---------- Preload next images ----------
  function preloadNextImages() {
    if (!active) return;
    const preloadCount = 5;
    const startIdx = cur + 1;
    const endIdx = Math.min(startIdx + preloadCount, items.length);
    for (let i = startIdx; i < endIdx; i++) {
      if (items[i] && !items[i].hq_preloaded && !items[i].hq_preload_promise) {
        preloadHQIntoCache(items[i]);
      }
    }
  }

  // ---------- Manual preload ----------
  async function manualPreloadNext() {
    if (isManualPreloading || !active) return;
    isManualPreloading = true;
    preloadBtn.classList.add('preloading');
    preloadBtn.disabled = true;

    const preloadCount = 10;
    const startIdx = cur + 1;
    const endIdx = Math.min(startIdx + preloadCount, items.length);

    let preloadedCount = 0;
    const promises = [];

    for (let i = startIdx; i < endIdx; i++) {
      if (items[i] && !items[i].hq_preloaded && !items[i].hq_preload_promise) {
        const promise = preloadHQIntoCache(items[i]).then(() => { preloadedCount++; });
        promises.push(promise);
      }
    }

    if (promises.length === 0) {
      toast('All next images already preloaded');
      isManualPreloading = false;
      preloadBtn.classList.remove('preloading');
      updateIndex();
      return;
    }

    try {
      await Promise.all(promises);
      toast(`Preloaded ${preloadedCount} HQ images`);
    } catch {
      toast('Some images failed to preload');
    } finally {
      isManualPreloading = false;
      preloadBtn.classList.remove('preloading');
      updateIndex();
    }
  }

  // ---------- Focus / hit-testing revive helpers ----------
  function nudgeOverlayForHitTest(){
    overlay.style.willChange = 'transform';
    overlay.style.transform  = 'translateZ(0)';
    void overlay.offsetHeight;
    overlay.style.transform  = '';
    overlay.style.willChange = '';
  }
  function revivePointerEvents(){
    overlay.style.pointerEvents = 'none';
    requestAnimationFrame(()=>{ overlay.style.pointerEvents = 'auto'; });
  }
  function ensureOverlayInteractive(){
    nudgeOverlayForHitTest();
    revivePointerEvents();
  }

  // ---------- Show/Hide loading ----------
  function showLoadingIndicator() { loadingIndicator.style.display = 'flex'; }
  function hideLoadingIndicator() { loadingIndicator.style.display = 'none'; }

  // ---------- Append helper ----------
  function appendNewSlidesFrom(itemsOldLen){
    for (let i = itemsOldLen; i < items.length; i++) {
      const slide = makeSlide(items[i], i);
      track.appendChild(slide);
      if (io) io.observe(slide);
    }
  }

  // ---------- Force-load loop if no new images ----------
  async function forceLoadMoreUntilNew(maxAttempts = 8, waitMs = 1200){
    const scrollEl = document.scrollingElement || document.documentElement || document.body;
    let attempts = 0;
    let added = 0;

    while (attempts < maxAttempts) {
      attempts++;
      scrollEl.scrollTo(0, scrollEl.scrollHeight);
      await sleep(waitMs);

      const newItemsRaw = collectExploreItems();
      const merged = mergeItems(items, newItemsRaw);

      if (merged.length > items.length) {
        const oldLen = items.length;
        // preserve preload states
        for (let i = 0; i < items.length; i++) {
          const oldItem = items[i];
          const ni = merged.find(x => x.href === oldItem.href);
          if (ni) Object.assign(ni, {
            hq_preloaded: oldItem.hq_preloaded,
            hq_preload_promise: oldItem.hq_preload_promise,
            hq: oldItem.hq, w: oldItem.w, h: oldItem.h
          });
        }
        items = merged;
        appendNewSlidesFrom(oldLen);
        added = items.length - oldLen;
        toast(`Loaded ${added} new images`);
        updateIndex();
        preloadNextImages();
        break;
      }
    }

    // return to top regardless
    scrollEl.scrollTo(0, 0);
    ensureOverlayInteractive();
    return added;
  }

  // ---------- Infinite load ----------
  async function checkAndLoadMore(){
    if (isLoadingMore || !active) return;
    if (cur >= items.length - 5) {
      isLoadingMore = true;
      showLoadingIndicator();

      const scrollEl = document.scrollingElement || document.documentElement || document.body;
      scrollEl.scrollTo(0, scrollEl.scrollHeight);

      setTimeout(async () => {
        try {
          if (mo) mo.disconnect(); // pause MO during merge

          const newItemsRaw = collectExploreItems();
          const newItems = mergeItems(items, newItemsRaw);

          if (newItems.length > items.length) {
            // Preserve preload state
            for (let i = 0; i < items.length; i++) {
              const oldItem = items[i];
              const ni = newItems.find(x => x.href === oldItem.href);
              if (ni) Object.assign(ni, {
                hq_preloaded: oldItem.hq_preloaded,
                hq_preload_promise: oldItem.hq_preload_promise,
                hq: oldItem.hq, w: oldItem.w, h: oldItem.h
              });
            }

            const oldCount = items.length;
            items = newItems;
            appendNewSlidesFrom(oldCount);

            toast(`Loaded ${items.length - oldCount} new images`);
            updateIndex();
            preloadNextImages();
          } else {
            toast('No new images found');
            // NEW: repeatedly try to force-load until something arrives, then back to top
            await forceLoadMoreUntilNew(8, 1200);
          }
        } finally {
          // Always return to top per your preference
          const scrollEl2 = document.scrollingElement || document.documentElement || document.body;
          scrollEl2.scrollTo(0, 0);
          if (mo && FEED_ROOT) mo.observe(FEED_ROOT, { childList:true, subtree:true });
          hideLoadingIndicator();
          isLoadingMore = false;
          ensureOverlayInteractive();
        }
      }, 1200);
    }
  }

  // ---------- Open / Close ----------
  let originalBodyStyle = '';
  function openOverlay(){
    FEED_ROOT = document.querySelector('main') || document.documentElement;

    const newItemsRaw = collectExploreItems();
    items = mergeItems(items, newItemsRaw);

    if (!items.length) { toast('No images found on Explore yet.'); return; }

    if (!io){
      io = new IntersectionObserver((es)=>{
        for (const e of es){
          if (e.isIntersecting){
            const k = Number(e.target.dataset.index || -1);
            if (!Number.isNaN(k) && k>=0) loadForIndex(k);
          }
        }
      },{root:overlay, threshold:.1});
    }

    if (!mo){
      let rebuilding = false;
      mo = new MutationObserver(debounce((mutations)=>{
        if (!active || rebuilding) return;

        // Ignore overlay/UI mutations
        for (const m of mutations){
          const t = m.target;
          if (t && t.closest && t.closest('.igfs-overlay, .igfs-fab, .igfs-toast-wrap, .igfs-menu')) {
            return;
          }
        }

        const ni = collectExploreItems();
        const merged = mergeItems(items, ni);
        if (merged.length !== items.length){
          rebuilding = true;
          const keep = Math.min(cur, merged.length - 1);
          items = merged;
          buildSlides();
          translateToDebounced(keep,false);
          rebuilding = false;

          ensureOverlayInteractive();
        }
      }, 200));
    }

    if (mo && FEED_ROOT) mo.observe(FEED_ROOT, { childList:true, subtree:true });

    originalBodyStyle = document.body.getAttribute('style') || '';
    document.body.classList.add('igfs-overlay-active');

    buildSlides();
    $$('.igfs-slide', track).forEach(sl=> io.observe(sl));

    overlay.classList.add('igfs-show');
    active = true;

    ensureOverlayInteractive();

    setTimeout(() => { preloadNextImages(); }, 500);
  }

  function closeOverlay(){
    document.body.classList.remove('igfs-overlay-active');
    if (originalBodyStyle) document.body.setAttribute('style', originalBodyStyle); else document.body.removeAttribute('style');
    overlay.classList.remove('igfs-show');
    active=false; isLoadingMore=false; 
    hideLoadingIndicator();
    if (mo) mo.disconnect();
    if (io) $$('.igfs-slide', track).forEach(sl=> io.unobserve(sl));
  }

  // ---------- Helpers: download/save/copy/open ----------
  function inferFilename(url){
    try{
      const u = new URL(url); const last = u.pathname.split('/').filter(Boolean).pop() || 'instagram';
      const ext = last.includes('.') ? last.split('.').pop() : 'jpg';
      return `instagram_${Date.now()}.${ext}`;
    }catch{ return `instagram_${Date.now()}.jpg`; }
  }
  async function resolveFullForCurrent(){
    if (!items.length) return null;
    const it = items[cur];

    if (preferHQ) {
      const preloadedHQ = await getPreloadedHQIfAvailable(it);
      if (preloadedHQ) return { url: preloadedHQ, href: it.href };
    }
    const url = preferHQ ? await resolveHQ(it) : (it.low || await resolveHQ(it));
    return { url, href: it.href };
  }
  function openURLWithGesture(url){ const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; document.body.appendChild(a); a.click(); a.remove(); }

  async function doDownloadCurrent(){
    try{
      const res = await resolveFullForCurrent(); if (!res || !res.url) return;
      if (ON_IOS){ openURLWithGesture(res.url); toast('Long-press the image → Save'); return; }
      try{
        const r = await fetch(res.url, { mode:'cors', credentials:'omit' });
        if (!r.ok || r.type==='opaque') throw new Error('CORS/opaque');
        const blob = await r.blob(); const bUrl = URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=bUrl; a.download=inferFilename(res.url); document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(bUrl), 4000); toast('Downloading…');
      }catch{
        openURLWithGesture(res.url); toast('Opened in new tab');
      }
    }catch(e){ console.error(e); toast('Download failed'); }
  }

  async function saveToGalleryCurrent(){
    try{
      const res = await resolveFullForCurrent(); if (!res || !res.url) return;
      if (ON_IOS && navigator.share){
        try{
          const r = await fetch(res.url, { mode:'cors', credentials:'omit' });
          if (!r.ok || r.type==='opaque') throw new Error('CORS/opaque');
          const blob = await r.blob(); const file = new File([blob], inferFilename(res.url), { type: blob.type||'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:'Instagram Image' }); toast('Shared to Photos'); return; }
        }catch{}
        openURLWithGesture(res.url); toast('Long-press the image → Save'); return;
      }
      try{
        const r = await fetch(res.url, { mode:'cors', credentials:'omit' });
        if (!r.ok || r.type==='opaque') throw new Error('CORS/opaque');
        const blob = await r.blob(); const bUrl = URL.createObjectURL(blob);
        openImageInNewWindow(bUrl); setTimeout(()=>URL.revokeObjectURL(bUrl), 4000); toast('Opened image for saving');
      }catch{
        openImageInNewWindow(res.url); toast('Opened image for saving');
      }
    }catch(e){ console.error(e); toast('Save failed'); }
  }

  function openImageInNewWindow(url){
    if (ON_IOS){ openURLWithGesture(url); return; }
    const w = window.open('about:blank','_blank'); if (!w){ openURLWithGesture(url); return; }
    try{
      w.document.open(); w.document.write(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Save image</title><style>html,body{height:100%;margin:0;background:#000}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}.tip{position:fixed;top:16px;left:0;right:0;color:#fff;text-align:center;font:600 14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-shadow:0 0 5px #0008}</style><div class="tip">📥 Right-click / long-press to save</div><img src="${url}" alt="image">`); w.document.close();
    }catch{ w.location.href=url; }
  }

  async function copyUrlCurrent(){
    try{
      const res = await resolveFullForCurrent(); if (!res) { toast('No image URL'); return; }
      if (navigator.clipboard){ await navigator.clipboard.writeText(res.url); toast('URL copied'); }
      else{
        const ta=document.createElement('textarea'); ta.value=res.url; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.focus(); ta.select();
        try{ document.execCommand('copy'); toast('URL copied'); }catch{ toast('Copy failed'); } ta.remove();
      }
    }catch(e){ console.error(e); toast('Copy failed'); }
  }

  function openPostCurrent(){
    resolveFullForCurrent().then(res=>{
      if (!res || !res.href) return;
      const full = buildPostURL(res.href);
      openURLWithGesture(full);
    }).catch(()=>{});
  }

  // ---------- Events ----------
  const SWIPE_MIN = ()=> Math.max(40, Math.round(window.innerWidth * 0.12));

  function onTouchStart(e){
    if (!active) return;
    if (isUI(e.target) || isForm(e.target)) return;
    e.preventDefault(); dragging=true;
    startX = e.touches ? e.touches[0].clientX : e.clientX; curX=startX;
    track.style.transition='none';
  }
  const onTouchMoveDebounced = debounce(function(e){
    if (!active || !dragging) return;
    if (isUI(e.target) || isForm(e.target)) return;
    e.preventDefault();
    curX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = curX - startX;
    track.style.transform = `translate3d(${(-cur*window.innerWidth)+dx}px,0,0)`;
  },10);
  function onTouchMove(e){ onTouchMoveDebounced(e); }
  function onTouchEnd(e){
    if (!active || !dragging) return;
    if (isUI(e.target) || isForm(e.target)) return;
    e.preventDefault(); dragging=false;
    const dx = curX - startX; const min = SWIPE_MIN();
    if (dx <= -min && cur<items.length-1) next();
    else if (dx >=  min && cur>0) prev();
    else translateTo(cur);
  }

  btnSave.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); saveToGalleryCurrent(); });
  btnDl  .addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); doDownloadCurrent(); });
  btnCopy.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); copyUrlCurrent(); });
  btnOpen.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); openPostCurrent(); });
  btnQual.addEventListener('click',async e=>{ 
    e.preventDefault(); e.stopPropagation(); 
    preferHQ=!preferHQ; 
    toast(preferHQ?'Quality: HQ':'Quality: LQ'); 
    updateIndex(); 
    await loadForIndex(cur); 
    const it = items[cur];
    if (it && it.hq_preloaded && it.hq) swapDisplayedToHQ(it, it.hq);
    [cur-1,cur+1].forEach(j=>{ if(j>=0&&j<items.length) loadForIndex(j); }); 
    preloadNextImages();
  });

  preloadBtn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); manualPreloadNext(); });

  closeBtn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); closeOverlay(); });
  prevBtn .addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); prev(); });
  nextBtn .addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); next(); });
  toggleBtn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); active ? closeOverlay() : openOverlay(); });

  track.addEventListener('touchstart', onTouchStart, {passive:false});
  track.addEventListener('touchmove',  onTouchMove,  {passive:false});
  track.addEventListener('touchend',   onTouchEnd,   {passive:false});
  track.addEventListener('mousedown',  onTouchStart);
  track.addEventListener('mousemove',  onTouchMove);
  track.addEventListener('mouseup',    onTouchEnd);

  overlay.addEventListener('wheel', e=>{ e.preventDefault(); e.stopPropagation(); }, {passive:false});
  overlay.addEventListener('scroll',e=>{ e.preventDefault(); e.stopPropagation(); }, {passive:false});

  window.addEventListener('keydown', (e)=>{
    if (!active || isForm(e.target)) return;
    const k=e.key.toLowerCase();
    if (k==='arrowright'||k==='l') next();
    else if (k==='arrowleft'||k==='h') prev();
    else if (k==='escape') closeOverlay();
    else if (k==='s') doDownloadCurrent();
    else if (k==='g') saveToGalleryCurrent();
    else if (k==='c') copyUrlCurrent();
    else if (k==='o') openPostCurrent();
    else if (k==='q'){ preferHQ=!preferHQ; toast(preferHQ?'Quality: HQ':'Quality: LQ'); updateIndex(); loadForIndex(cur); const it = items[cur]; if (it && it.hq_preloaded && it.hq) swapDisplayedToHQ(it, it.hq); }
    else if (k==='p'){ manualPreloadNext(); }
  });

  window.addEventListener('resize', ()=>{ if (active){ translateTo(cur,false); ensureOverlayInteractive(); } }, {passive:true});
  window.addEventListener('orientationchange', ()=>{ if (active){ translateTo(cur,false); ensureOverlayInteractive(); } }, {passive:true});

  console.log(`Instagram FS userscript loaded (v${VERSION}) — post links use ?chaining=true; smart autoload retries and returns to top.`);
})();