// /app/ui.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { ti } = IGFS;

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
  const btnDebug = document.createElement('button'); btnDebug.className='igfs-menu-btn igfs-debug-btn'; btnDebug.title='Debug Info'; btnDebug.innerHTML=ti('bug',18);

  menu.append(prevBtn, btnSave, btnDl, preloadBtn, btnCopy, btnOpen, btnQual, btnDebug, nextBtn);
  
  // Debug Panel
  const debugPanel = document.createElement('div'); 
  debugPanel.className='igfs-debug-panel';
  debugPanel.style.display = 'none';
  
  const debugHeader = document.createElement('div');
  debugHeader.className = 'igfs-debug-header';
  debugHeader.innerHTML = `
    <div class="igfs-debug-title">${ti('cpu',16)} Debug Panel</div>
    <button class="igfs-debug-close">${ti('x',14)}</button>
  `;
  
  const debugContent = document.createElement('div');
  debugContent.className = 'igfs-debug-content';
  debugContent.innerHTML = `
    <div class="igfs-debug-section">
      <div class="igfs-debug-section-title">📊 Performance</div>
      <div class="igfs-debug-metrics">
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Current Image:</span>
          <span class="igfs-debug-value" id="debug-current">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Total Images:</span>
          <span class="igfs-debug-value" id="debug-total">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Preloaded:</span>
          <span class="igfs-debug-value" id="debug-preloaded">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Loading:</span>
          <span class="igfs-debug-value" id="debug-loading">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Background Preload:</span>
          <span class="igfs-debug-value" id="debug-bg-preload">Idle</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Memory Usage:</span>
          <span class="igfs-debug-value" id="debug-memory">-</span>
        </div>
      </div>
    </div>
    
    <div class="igfs-debug-section">
      <div class="igfs-debug-section-title">🖼️ Current Image Info</div>
      <div class="igfs-debug-metrics">
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">URL:</span>
          <span class="igfs-debug-value" id="debug-url">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Resolution:</span>
          <span class="igfs-debug-value" id="debug-resolution">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Quality:</span>
          <span class="igfs-debug-value" id="debug-quality">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Load Status:</span>
          <span class="igfs-debug-value" id="debug-load-status">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Has Srcset:</span>
          <span class="igfs-debug-value" id="debug-srcset">-</span>
        </div>
      </div>
    </div>
    
    <div class="igfs-debug-section">
      <div class="igfs-debug-section-title">🔄 Loading Stats</div>
      <div class="igfs-debug-metrics">
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">DOM Images Found:</span>
          <span class="igfs-debug-value" id="debug-dom-images">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Last Scroll Height:</span>
          <span class="igfs-debug-value" id="debug-scroll-height">-</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Infinite Load Status:</span>
          <span class="igfs-debug-value" id="debug-infinite-status">Ready</span>
        </div>
        <div class="igfs-debug-metric">
          <span class="igfs-debug-label">Last Load Time:</span>
          <span class="igfs-debug-value" id="debug-last-load">Never</span>
        </div>
      </div>
    </div>
    
    <div class="igfs-debug-section">
      <div class="igfs-debug-section-title">📈 Real-time Log</div>
      <div class="igfs-debug-log" id="debug-log">
        <div class="igfs-debug-log-entry">🚀 Debug panel initialized</div>
      </div>
    </div>
    
    <div class="igfs-debug-section">
      <div class="igfs-debug-section-title">⚡ Actions</div>
      <div class="igfs-debug-actions">
        <button class="igfs-debug-action-btn" id="debug-force-load">Force Load New Images</button>
        <button class="igfs-debug-action-btn" id="debug-clear-cache">Clear Preload Cache</button>
        <button class="igfs-debug-action-btn" id="debug-export-state">Export State</button>
      </div>
    </div>
  `;
  
  debugPanel.appendChild(debugHeader);
  debugPanel.appendChild(debugContent);
  
  overlay.append(track, idxLab, closeBtn, loadingIndicator, menu, debugPanel);
  document.body.appendChild(overlay);

  const toggleBtn = document.createElement('button');
  toggleBtn.className='igfs-fab';
  toggleBtn.innerHTML = `${ti('images',14)} FS <span class="igfs-version"></span>`;
  document.body.appendChild(toggleBtn);

  // Styly
  const css = `
  .igfs-overlay{position:fixed;inset:0;z-index:2147483646;background:#000;color:#fff;display:none;-webkit-tap-highlight-color:transparent;touch-action:none;opacity:0;transform:scale(0.95);transition:opacity 0.3s cubic-bezier(0.2, 0, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)}
  .igfs-overlay.igfs-show{display:block;opacity:1;transform:scale(1)}
  .igfs-overlay.igfs-show .igfs-track{animation:slideInUp 0.4s cubic-bezier(0.2, 0, 0.2, 1) 0.1s both}
  body.igfs-overlay-active{overflow:hidden!important;-webkit-overflow-scrolling:touch!important}
  body.igfs-overlay-active>*:not(.igfs-overlay):not(.igfs-fab):not(.igfs-toast-wrap){pointer-events:none!important}

  .igfs-track{position:absolute;inset:0;display:flex;height:100%;width:100%;will-change:transform;transition:transform 280ms ease}
  .igfs-slide{position:relative;flex:0 0 100vw; height:100vh; display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden}
  .igfs-slide img{width:100vw;height:100vh;object-fit:contain;object-position:center;display:block;opacity:0;transition:opacity 0.4s ease, filter 0.3s ease, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)}
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

  .igfs-fab{position:fixed;top:10px;right:10px;z-index:2147483647!important;padding:6px 10px;font-size:12px;border-radius:999px;border:none;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;gap:6px}
  .igfs-fab:hover,.igfs-fab:focus{background:rgba(255,255,255,.15);outline:none}
  .igfs-version{font-size:9px;opacity:0.7;margin-left:6px}

  .igfs-toast-wrap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px calc(env(safe-area-inset-bottom,0) + 6px);pointer-events:none}
  .igfs-toast{background:rgba(34,34,34,.92);color:#fff;padding:6px 10px;border-radius:8px;font:600 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 15px rgba(0,0,0,.35);transform:translateY(6px);opacity:0;transition:opacity .18s ease, transform .18s ease}
  .igfs-toast.show{transform:translateY(0);opacity:1}
  
  .igfs-debug-panel{position:absolute;right:10px;top:50px;bottom:80px;width:350px;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:12px;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 40px rgba(0,0,0,.6);z-index:1000;overflow:hidden;transform:translateX(100%);opacity:0;transition:all 0.3s cubic-bezier(0.2, 0, 0.2, 1)}
  .igfs-debug-panel.igfs-debug-show{transform:translateX(0);opacity:1}
  
  .igfs-debug-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.08)}
  .igfs-debug-title{font:600 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;display:flex;align-items:center;gap:6px}
  .igfs-debug-close{background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background-color .2s}
  .igfs-debug-close:hover{background:rgba(255,255,255,.1);color:#fff}
  
  .igfs-debug-content{height:100%;overflow-y:auto;padding:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.3) transparent}
  .igfs-debug-content::-webkit-scrollbar{width:6px}
  .igfs-debug-content::-webkit-scrollbar-track{background:transparent}
  .igfs-debug-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3);border-radius:3px}
  .igfs-debug-content::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.5)}
  
  .igfs-debug-section{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
  .igfs-debug-section:last-child{border-bottom:none}
  .igfs-debug-section-title{font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:rgba(255,255,255,.9);margin-bottom:8px;display:flex;align-items:center;gap:4px}
  
  .igfs-debug-metrics{display:flex;flex-direction:column;gap:6px}
  .igfs-debug-metric{display:flex;justify-content:space-between;align-items:center;font:400 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .igfs-debug-label{color:rgba(255,255,255,.7);flex:1}
  .igfs-debug-value{color:#fff;font-weight:500;text-align:right;max-width:50%;word-break:break-all;font-size:10px}
  
  .igfs-debug-log{max-height:120px;overflow-y:auto;background:rgba(0,0,0,.3);border-radius:6px;padding:8px;font:400 10px 'SF Mono',Consolas,monospace;scrollbar-width:thin}
  .igfs-debug-log::-webkit-scrollbar{width:4px}
  .igfs-debug-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}
  .igfs-debug-log-entry{color:rgba(255,255,255,.8);margin-bottom:4px;line-height:1.3;word-break:break-word}
  .igfs-debug-log-entry:last-child{margin-bottom:0}
  .igfs-debug-log-entry.error{color:#ff6b6b}
  .igfs-debug-log-entry.success{color:#51cf66}
  .igfs-debug-log-entry.warning{color:#ffd43b}
  
  .igfs-debug-actions{display:flex;flex-direction:column;gap:6px}
  .igfs-debug-action-btn{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:8px 12px;font:500 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;transition:all .2s;text-align:left}
  .igfs-debug-action-btn:hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.25)}
  .igfs-debug-action-btn:active{transform:scale(.98)}
  `;
  const styleTag=document.createElement('style'); styleTag.textContent=css; document.head.appendChild(styleTag);

  document.body.appendChild(overlay);

  IGFS.UI = {
    overlay, track, idxLab, closeBtn,
    loadingIndicator,
    menu, prevBtn, nextBtn, preloadBtn, btnSave, btnDl, btnCopy, btnOpen, btnQual, btnDebug,
    debugPanel,
    toggleBtn,
    showOverlay(){ overlay.classList.add('igfs-show'); document.body.classList.add('igfs-overlay-active'); },
    hideOverlay(){ overlay.classList.remove('igfs-show'); document.body.classList.remove('igfs-overlay-active'); },
    showLoading(){ loadingIndicator.style.display = 'flex'; },
    hideLoading(){ loadingIndicator.style.display = 'none'; },
    updateLoadingText(text) { 
      const span = loadingIndicator.querySelector('span');
      if (span) span.textContent = text;
    },
    setVersion(v){ const e = toggleBtn.querySelector('.igfs-version'); if (e) e.textContent = 'v'+v; },
    
    // Debug functionality
    debugState: {
      isVisible: false,
      updateInterval: null,
      logEntries: [],
      startTime: Date.now()
    },
    
    showDebug() {
      this.debugState.isVisible = true;
      debugPanel.style.display = 'block';
      setTimeout(() => debugPanel.classList.add('igfs-debug-show'), 10);
      this.startDebugUpdates();
      this.debugLog('🟢 Debug panel opened');
    },
    
    hideDebug() {
      this.debugState.isVisible = false;
      debugPanel.classList.remove('igfs-debug-show');
      setTimeout(() => debugPanel.style.display = 'none', 300);
      this.stopDebugUpdates();
      this.debugLog('🔴 Debug panel closed');
    },
    
    toggleDebug() {
      if (this.debugState.isVisible) {
        this.hideDebug();
      } else {
        this.showDebug();
      }
    },
    
    debugLog(message, type = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      const entry = `[${timestamp}] ${message}`;
      this.debugState.logEntries.push({ message: entry, type });
      
      // Keep only last 50 entries
      if (this.debugState.logEntries.length > 50) {
        this.debugState.logEntries = this.debugState.logEntries.slice(-50);
      }
      
      // Update log display if visible
      if (this.debugState.isVisible) {
        this.updateDebugLog();
      }
    },
    
    updateDebugLog() {
      const logContainer = document.getElementById('debug-log');
      if (!logContainer) return;
      
      logContainer.innerHTML = this.debugState.logEntries
        .slice(-15) // Show only last 15 entries
        .map(entry => `<div class="igfs-debug-log-entry ${entry.type}">${entry.message}</div>`)
        .join('');
      
      // Auto-scroll to bottom
      logContainer.scrollTop = logContainer.scrollHeight;
    },
    
    startDebugUpdates() {
      if (this.debugState.updateInterval) return;
      
      this.debugState.updateInterval = setInterval(() => {
        this.updateDebugInfo();
      }, 500); // Update every 500ms for performance
      
      // Initial update
      this.updateDebugInfo();
    },
    
    stopDebugUpdates() {
      if (this.debugState.updateInterval) {
        clearInterval(this.debugState.updateInterval);
        this.debugState.updateInterval = null;
      }
    },
    
    updateDebugInfo() {
      if (!this.debugState.isVisible) return;
      
      try {
        const state = window.IGFS && window.IGFS.App && window.IGFS.App.state;
        if (!state) return;
        
        // Performance metrics
        this.updateDebugValue('debug-current', `${state.cur + 1}`);
        this.updateDebugValue('debug-total', `${state.items.length}`);
        
        // Count preloaded images
        const preloadedCount = state.items.filter(item => item.hq_preloaded).length;
        const loadingCount = state.items.filter(item => item.hq_preload_promise).length;
        this.updateDebugValue('debug-preloaded', `${preloadedCount}/${state.items.length}`);
        this.updateDebugValue('debug-loading', loadingCount);
        
        // Background preload status
        const bgPreloader = window.IGFS && window.IGFS.BackgroundPreloader;
        const bgStatus = bgPreloader && state.bgPreloader ? 
          (state.bgPreloader.isPreloading ? 'Loading...' : 'Idle') : 'Not available';
        this.updateDebugValue('debug-bg-preload', bgStatus);
        
        // Memory usage (estimate)
        const memoryEstimate = this.estimateMemoryUsage(state);
        this.updateDebugValue('debug-memory', memoryEstimate);
        
        // Current image info
        const currentItem = state.items[state.cur];
        if (currentItem) {
          this.updateDebugValue('debug-url', this.truncateUrl(currentItem.href || '-'));
          this.updateDebugValue('debug-resolution', 
            currentItem.w && currentItem.h ? `${currentItem.w}×${currentItem.h}` : 'Unknown');
          this.updateDebugValue('debug-quality', 
            currentItem.hq_preloaded ? 'HQ' : (currentItem.low ? 'LQ' : 'Unknown'));
          
          // Load status
          const img = currentItem.node && currentItem.node.querySelector('img');
          const loadStatus = img ? (img.complete ? 'Loaded' : 'Loading') : 'Not rendered';
          this.updateDebugValue('debug-load-status', loadStatus);
          this.updateDebugValue('debug-srcset', currentItem.srcset ? 'Yes' : 'No');
        }
        
        // DOM stats
        const domImages = document.querySelectorAll('main a[role="link"] img, main a[href^="/p/"] img').length;
        this.updateDebugValue('debug-dom-images', domImages);
        
        // Scroll height
        const scrollHeight = (document.scrollingElement || document.documentElement).scrollHeight;
        this.updateDebugValue('debug-scroll-height', `${scrollHeight}px`);
        
        // Infinite load status
        const isLoadingMore = window.IGFS && window.IGFS.Infinite && window.IGFS.Infinite.isLoadingMore;
        this.updateDebugValue('debug-infinite-status', isLoadingMore ? 'Loading...' : 'Ready');
        
      } catch (error) {
        console.error('Debug update error:', error);
        this.debugLog(`❌ Update error: ${error.message}`, 'error');
      }
    },
    
    updateDebugValue(id, value) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    },
    
    truncateUrl(url) {
      if (!url || url.length <= 30) return url;
      return url.substring(0, 15) + '...' + url.substring(url.length - 10);
    },
    
    estimateMemoryUsage(state) {
      if (!state || !state.items) return 'Unknown';
      
      // Rough estimate: assume average image is ~2MB when loaded
      const loadedCount = state.items.filter(item => 
        item.hq_preloaded || (item.node && item.node.querySelector('img[data-quality="hq"]'))
      ).length;
      
      const estimatedMB = Math.round(loadedCount * 2);
      return `~${estimatedMB}MB`;
    }
  };
  
  // Debug panel event listeners
  const debugCloseBtn = debugPanel.querySelector('.igfs-debug-close');
  if (debugCloseBtn) {
    debugCloseBtn.addEventListener('click', () => IGFS.UI.hideDebug());
  }
  
  // Debug action buttons
  const forceLoadBtn = document.getElementById('debug-force-load');
  if (forceLoadBtn) {
    forceLoadBtn.addEventListener('click', async () => {
      IGFS.UI.debugLog('🔄 Force loading new images...', 'info');
      try {
        const state = window.IGFS && window.IGFS.App && window.IGFS.App.state;
        if (state && window.IGFS.Infinite) {
          const result = await window.IGFS.Infinite.loadMoreImagesHoldBottom(state, 2000);
          IGFS.UI.debugLog(result ? '✅ Force load successful' : '⚠️ No new images found', 
            result ? 'success' : 'warning');
        } else {
          IGFS.UI.debugLog('❌ App state not available', 'error');
        }
      } catch (error) {
        IGFS.UI.debugLog(`❌ Force load failed: ${error.message}`, 'error');
      }
    });
  }
  
  const clearCacheBtn = document.getElementById('debug-clear-cache');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      IGFS.UI.debugLog('🗑️ Clearing preload cache...', 'info');
      try {
        const state = window.IGFS && window.IGFS.App && window.IGFS.App.state;
        if (state && state.items) {
          let clearedCount = 0;
          state.items.forEach(item => {
            if (item.hq_preloaded || item.hq_preload_promise) {
              item.hq_preloaded = false;
              item.hq_preload_promise = null;
              clearedCount++;
            }
          });
          IGFS.UI.debugLog(`✅ Cleared ${clearedCount} cached items`, 'success');
        } else {
          IGFS.UI.debugLog('❌ App state not available', 'error');
        }
      } catch (error) {
        IGFS.UI.debugLog(`❌ Cache clear failed: ${error.message}`, 'error');
      }
    });
  }
  
  const exportStateBtn = document.getElementById('debug-export-state');
  if (exportStateBtn) {
    exportStateBtn.addEventListener('click', () => {
      IGFS.UI.debugLog('📤 Exporting state...', 'info');
      try {
        const state = window.IGFS && window.IGFS.App && window.IGFS.App.state;
        if (state) {
          const exportData = {
            timestamp: new Date().toISOString(),
            version: window.IGFS.VERSION,
            currentIndex: state.cur,
            totalItems: state.items.length,
            items: state.items.map((item, index) => ({
              index,
              href: item.href,
              hasLow: !!item.low,
              hasHq: !!item.hq,
              preloaded: item.hq_preloaded,
              loading: !!item.hq_preload_promise,
              dimensions: item.w && item.h ? `${item.w}x${item.h}` : null
            }))
          };
          
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `igfs-debug-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          
          IGFS.UI.debugLog('✅ State exported successfully', 'success');
        } else {
          IGFS.UI.debugLog('❌ App state not available', 'error');
        }
      } catch (error) {
        IGFS.UI.debugLog(`❌ Export failed: ${error.message}`, 'error');
      }
    });
  }
})();
