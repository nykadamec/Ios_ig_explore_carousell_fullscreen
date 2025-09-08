// /app/utils.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});

  const VERSION = '0.1.1-ios';

  function isIOS(){
    const ua = navigator.userAgent || '';
    const isMobileWebKit = /AppleWebKit/.test(ua) && /Mobile/.test(ua);
    const isIPadOS = /Macintosh/.test(ua) && 'ontouchend' in document;
    return isMobileWebKit || isIPadOS;
  }

  const ON_IOS = true; // čistě iOS režim (požadavek)

  const sleep = (ms)=> new Promise(res=> setTimeout(res, ms));
  const debounce = (fn, t)=>{ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a),t); }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const decodeEntities = (u) => u
    ? u.replace(/&amp;/g, '&')
        .replace(/&lt;/g,  '<')
        .replace(/&gt;/g,  '>')
        .replace(/&quot;/g,'"')
        .replace(/&#39;/g, "'")
    : u;

  const deThumbURL = (url) => url
    ? url
      .replace(/\/s\d+x\d+\//g, '/')
      .replace(/\/p\d+x\d+\//g, '/')
      .replace(/\/c\d+\.\d+\.\d+\.\d+\//g, '/')
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

  function toast(msg, t=1600){
    let wrap = document.querySelector('.igfs-toast-wrap');
    if (!wrap){
      wrap=document.createElement('div');
      wrap.className='igfs-toast-wrap';
      document.body.appendChild(wrap);
    }
    const el=document.createElement('div');
    el.className='igfs-toast';
    el.textContent=msg;
    wrap.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>el.classList.remove('show'), t);
    setTimeout(()=>{
      el.remove();
      if(!wrap.children.length) wrap.remove();
    }, t+240);
  }

  function openURLWithGesture(url){
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildPostURL(href){
    // Normalizace na absolutní URL a přidání chaining=true
    let path = href || '/';
    if (!path.startsWith('/')) path = '/' + path;
    if (!path.endsWith('/'))  path += '/';
    const url = new URL(path, location.origin);
    url.searchParams.set('chaining','true');
    return url.toString();
  }

  IGFS.VERSION = VERSION;
  IGFS.ON_IOS = ON_IOS;
  IGFS.sleep = sleep;
  IGFS.debounce = debounce;
  IGFS.clamp = clamp;
  IGFS.decodeEntities = decodeEntities;
  IGFS.deThumbURL = deThumbURL;
  IGFS.pickLargestFromSrcset = pickLargestFromSrcset;
  IGFS.toast = toast;
  IGFS.openURLWithGesture = openURLWithGesture;
  IGFS.buildPostURL = buildPostURL;
})();
