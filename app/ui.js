// /app/ui.js
(function(){
  'use strict';
  try {
    const IGFS = (window.IGFS = window.IGFS || {});
    // Zkontroluj dostupnost ti funkce
    let ti = IGFS.ti;
    if (!ti) {
      if (window.IGFS && window.IGFS.Console) {
        window.IGFS.Console.error('[IGFS UI] ti function not available, using fallback');
      }
      ti = (name, size = 18) => `<span style="font-size:${size}px;">${name}</span>`;
    }

    // Debug log na začátku
    if (window.IGFS && window.IGFS.Console) {
      window.IGFS.Console.log('[IGFS UI] Starting UI module initialization, ti function available:', !!ti);
    }

    // Vytvoření UI
    const overlay = document.createElement('div'); overlay.className='igfs-overlay';
  const track   = document.createElement('div'); track.className='igfs-track';
  const idxLab  = document.createElement('div'); idxLab.className='igfs-index';
  const closeBtn = document.createElement('button'); closeBtn.className='igfs-btn igfs-close'; closeBtn.innerHTML = ti('x',16);

  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'igfs-loading-indicator';
  loadingIndicator.innerHTML = `${ti('loader',14)} <span>Loading new images...</span>`;
  loadingIndicator.style.display = 'none';

  const menu = document.createElement('div'); menu.className='igfs-menu';

  const prevBtn = document.createElement('button'); prevBtn.className='igfs-menu-btn igfs-prev-btn'; prevBtn.title='Previous'; prevBtn.innerHTML=ti('chev-left',16);
  const nextBtn = document.createElement('button'); nextBtn.className='igfs-menu-btn igfs-next-btn'; nextBtn.title='Next'; nextBtn.innerHTML=ti('chev-right',16);

  const preloadBtn = document.createElement('button'); preloadBtn.className='igfs-menu-btn igfs-preload-btn'; preloadBtn.title='Manually preload next images'; preloadBtn.innerHTML=ti('refresh-cw',16);

  const btnSave = document.createElement('button'); btnSave.className='igfs-menu-btn'; btnSave.title='Save to Gallery'; btnSave.innerHTML=ti('floppy',18);
  const btnDl   = document.createElement('button'); btnDl.className='igfs-menu-btn';   btnDl.title='Download';         btnDl.innerHTML=ti('download',18);
  const btnCopy = document.createElement('button'); btnCopy.className='igfs-menu-btn'; btnCopy.title='Copy URL';       btnCopy.innerHTML=ti('copy',18);
  const btnOpen = document.createElement('button'); btnOpen.className='igfs-menu-btn'; btnOpen.title='Open Post';      btnOpen.innerHTML=ti('link',18);
  const btnQual = document.createElement('button'); btnQual.className='igfs-menu-btn'; btnQual.title='Toggle HQ/LQ';   btnQual.innerHTML=ti('hd',18);

  menu.append(prevBtn, btnSave, btnDl, preloadBtn, btnCopy, btnOpen, btnQual, nextBtn);
  
  overlay.append(track, idxLab, closeBtn, loadingIndicator, menu);

  // Definovat toggleBtn na vyšší úrovni aby byl dostupný v setVersion
  let toggleBtn;

  // Přidat overlay do DOM
  if (document.body) {
    document.body.appendChild(overlay);

    // Vytvoření toggle buttonu pro fullscreen mód
    toggleBtn = document.createElement('button');
    toggleBtn.className='igfs-fab';
    toggleBtn.innerHTML = `${ti('images',14)} FS <span class="igfs-version"></span>`;
    document.body.appendChild(toggleBtn);

    if (window.IGFS && window.IGFS.Console) {
      window.IGFS.Console.log('[IGFS UI] UI elements added to DOM');
    }
  } else {
    if (window.IGFS && window.IGFS.Console) {
      window.IGFS.Console.error('[IGFS UI] document.body not available, deferring UI creation');
    }
    // Defer UI creation until DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(overlay);
      toggleBtn = document.createElement('button');
      toggleBtn.className='igfs-fab';
      toggleBtn.innerHTML = `${ti('images',14)} FS <span class="igfs-version"></span>`;
      document.body.appendChild(toggleBtn);

      if (window.IGFS && window.IGFS.Console) {
        window.IGFS.Console.log('[IGFS UI] UI elements added to DOM (deferred)');
      }
    });
  }

  // Styly
  const css = `
  .igfs-overlay{
    position:fixed !important;
    inset:0 !important;
    z-index:2147483647 !important;
    background:#000 !important;
    color:#fff !important;
    display:none !important;
    -webkit-tap-highlight-color:transparent !important;
    touch-action:none !important;
    opacity:0 !important;
    transform:scale(0.95) !important;
    transition:opacity 0.3s cubic-bezier(0.2, 0, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0, 0.2, 1) !important;
    max-width:100vw !important;
    max-height:100vh !important;
    overflow:hidden !important;
    box-sizing:border-box !important;
    padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0) !important;
  }
  .igfs-overlay.igfs-show{display:block !important;opacity:1 !important;transform:scale(1) !important}
  .igfs-overlay.igfs-show .igfs-track{animation:slideInUp 0.4s cubic-bezier(0.2, 0, 0.2, 1) 0.1s both}
  body.igfs-overlay-active{overflow:hidden!important;-webkit-overflow-scrolling:touch!important}
  body.igfs-overlay-active>*:not(.igfs-overlay):not(.igfs-fab):not(.igfs-toast-wrap){pointer-events:none!important}

  .igfs-track{
    position:absolute;
    inset:0;
    display:flex;
    height:100%;
    width:100%;
    max-width:100vw;
    max-height:100vh;
    will-change:transform;
    transition:transform 280ms ease;
    overflow:hidden;
    box-sizing:border-box;
  }
  .igfs-slide{
    position:relative;
    flex:0 0 100%;
    height:100vh;
    max-height:100vh;
    max-width:100vw;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#000;
    overflow:hidden;
    box-sizing:border-box;
  }
  .igfs-slide img{
    width:100vw;
    max-width:100vw;
    height:100vh;
    max-height:100vh;
    object-fit:contain;
    object-position:center;
    display:block;
    opacity:0;
    transition:opacity 0.4s ease, filter 0.3s ease, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);
    box-sizing:border-box;
  }
  .igfs-slide img.loaded{opacity:1}
  .igfs-slide img:hover{transform:scale(1.02)}
  .igfs-slide img.igfs-loading{filter:blur(6px) saturate(.8) brightness(.9);opacity:0.7}

  .igfs-spinner{position:absolute;top:50%;left:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border:4px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;z-index:10;pointer-events:none}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideInUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideIn{from{transform:translateX(-10px);opacity:0}to{transform:translateX(0);opacity:1}}

  .igfs-index{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0) + 68px);text-align:center;font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:rgba(255,255,255,.95);user-select:none;pointer-events:none;text-shadow:0 0 5px #0008}

  .igfs-btn{position:absolute;top:calc(env(safe-area-inset-top,0) + 10px);right:10px;z-index:999;background:rgba(0,0,0,.55);color:#fff;border:0;border-radius:999px;padding:6px 10px;cursor:pointer;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;transition:background-color .2s ease;display:flex;align-items:center;justify-content:center}
  .igfs-btn:hover,.igfs-btn:focus{background:rgba(255,255,255,.15);outline:none}

  .igfs-loading-indicator{position:absolute;top:calc(env(safe-area-inset-top,0) + 10px);left:50%;transform:translateX(-50%);z-index:999;background:rgba(0,0,0,.7);color:#fff;border:0;border-radius:20px;padding:6px 12px;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  .igfs-loading-indicator svg{animation:spin 1s linear infinite}

  .igfs-menu{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0) + 14px);z-index:999;display:flex;gap:10px;background:rgba(0,0,0,.45);padding:6px 8px;border-radius:80px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 10px 30px rgba(0,0,0,.45);align-items:center;min-width:320px;justify-content:space-between;font-size:14px;animation:slideInUp 0.5s cubic-bezier(0.2, 0, 0.2, 1) 0.2s both;}
  .igfs-menu-btn{width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;background:rgba(255,255,255,.08);color:#fff;display:flex;align-items:center;justify-content:center;transition:all .2s cubic-bezier(0.2, 0, 0.2, 1);padding:0;}
  .igfs-menu-btn:hover{background:rgba(255,255,255,.18);transform:scale(1.1)}
  .igfs-menu-btn:active{transform:scale(.95)}
  .igfs-menu-btn:disabled{opacity:0.3;cursor:not-allowed;transform:scale(1)}

  .igfs-fab{position:fixed !important;top:calc(env(safe-area-inset-top,0) + 10px) !important;right:calc(env(safe-area-inset-right,0) + 10px) !important;z-index:2147483647 !important;padding:6px 10px !important;font-size:12px !important;border-radius:999px !important;border:none !important;background:rgba(0,0,0,.6) !important;color:#fff !important;cursor:pointer !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;display:flex !important;align-items:center !important;gap:6px !important}
  .igfs-fab:hover,.igfs-fab:focus{background:rgba(255,255,255,.15) !important;outline:none !important}
  .igfs-version{font-size:9px;opacity:0.7;margin-left:6px}

  .igfs-toast-wrap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px calc(env(safe-area-inset-bottom,0) + 6px);pointer-events:none}
  .igfs-toast{background:rgba(34,34,34,.92);color:#fff;padding:6px 10px;border-radius:8px;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 15px rgba(0,0,0,.35);transform:translateY(6px);opacity:0;transition:opacity .18s ease, transform .18s ease}
  .igfs-toast.show{transform:translateY(0);opacity:1}
  `;
  const styleTag=document.createElement('style'); styleTag.textContent=css; document.head.appendChild(styleTag);

  // overlay již přidán výše

  // Debug log pro kontrolu vytvoření UI
  if (window.IGFS && window.IGFS.Console) {
    window.IGFS.Console.log('[IGFS UI] UI module initialized');
  }

  IGFS.UI = {
    overlay, track, idxLab, closeBtn,
    loadingIndicator,
    menu, prevBtn, nextBtn, preloadBtn, btnSave, btnDl, btnCopy, btnOpen, btnQual,
    toggleBtn,
    showOverlay(){ overlay.classList.add('igfs-show'); document.body.classList.add('igfs-overlay-active'); },
    hideOverlay(){ overlay.classList.remove('igfs-show'); document.body.classList.remove('igfs-overlay-active'); },
    showLoading(){ loadingIndicator.style.display = 'flex'; },
    hideLoading(){ loadingIndicator.style.display = 'none'; },
    updateLoadingText(text) {
      const span = loadingIndicator.querySelector('span');
      if (span) span.textContent = text;
    },
    setVersion(v){ 
      if (toggleBtn) {
        const e = toggleBtn.querySelector('.igfs-version'); 
        if (e) e.textContent = 'v'+v;
      }
    },
    
    // Debug integration
    initDebug() {
      if (IGFS.Debug) {
        const debugBtn = IGFS.Debug.init();
        if (debugBtn && menu) {
          // Insert debug button before the last button (next)
          const nextBtn = menu.lastElementChild;
          menu.insertBefore(debugBtn, nextBtn);
        }
      }
    }
  };

  if (window.IGFS && window.IGFS.Console) {
    window.IGFS.Console.log('[IGFS UI] IGFS.UI successfully exported');
  }
} catch (uiError) {
  if (window.IGFS && window.IGFS.Console) {
    window.IGFS.Console.error('[IGFS UI] Module execution failed:', uiError);
  }
  throw uiError; // Re-throw pro zachycení v main.js
}
})();
