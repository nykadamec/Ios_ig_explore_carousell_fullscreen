// /app/debug.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});
  const { ti } = IGFS;

  // Debug Panel Element
  let debugPanel = null;
  let debugButton = null;

  function createDebugPanel() {
    if (debugPanel) return debugPanel;

    debugPanel = document.createElement('div'); 
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
          <button class="igfs-debug-action-btn" id="debug-copy-logs">Copy Debug Logs</button>
          <button class="igfs-debug-action-btn" id="debug-export-state">Export State</button>
        </div>
      </div>
    `;
    
    debugPanel.appendChild(debugHeader);
    debugPanel.appendChild(debugContent);
    
    return debugPanel;
  }

  function createDebugButton() {
    if (debugButton) return debugButton;
    
    debugButton = document.createElement('button'); 
    debugButton.className='igfs-menu-btn igfs-debug-btn'; 
    debugButton.title='Debug Info'; 
    debugButton.innerHTML = ti('bug',18);
    
    return debugButton;
  }

  function addDebugStyles() {
    const debugCss = `
    .igfs-debug-panel{position:fixed !important;right:8px !important;top:60px !important;bottom:90px !important;width:min(380px, calc(100vw - 16px)) !important;background:rgba(0,0,0,.95) !important;backdrop-filter:blur(16px) !important;-webkit-backdrop-filter:blur(16px) !important;border-radius:16px !important;border:1px solid rgba(255,255,255,.15) !important;box-shadow:0 25px 50px rgba(0,0,0,.8) !important;z-index:2147483647 !important;overflow:hidden !important;transform:translateX(100%) !important;opacity:0 !important;transition:all 0.4s cubic-bezier(0.2, 0, 0.2, 1) !important;touch-action:manipulation !important}
    .igfs-debug-panel.igfs-debug-show{transform:translateX(0) !important;opacity:1 !important}
    
    .igfs-debug-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.12)}
    .igfs-debug-title{font:600 15px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;display:flex;align-items:center;gap:8px}
    .igfs-debug-close{background:none;border:none;color:rgba(255,255,255,.8);cursor:pointer;padding:8px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .3s ease;touch-action:manipulation;min-width:44px;min-height:44px}
    .igfs-debug-close:hover{background:rgba(255,255,255,.15);color:#fff;transform:scale(1.05)}
    .igfs-debug-close:active{transform:scale(.95)}
    
    @media (max-width: 480px) {
      .igfs-debug-panel{right:4px;top:60px;bottom:80px;width:calc(100vw - 8px);border-radius:12px}
      .igfs-debug-header{padding:12px 16px}
      .igfs-debug-title{font-size:14px}
      .igfs-debug-section{padding:12px 16px}
      .igfs-debug-section-title{font-size:13px}
      .igfs-debug-metric{font-size:12px}
      .igfs-debug-value{font-size:11px}
      .igfs-debug-action-btn{padding:10px 14px;font-size:12px;min-height:40px}
    }
    
    @media (max-height: 600px) {
      .igfs-debug-panel{top:40px;bottom:60px}
      .igfs-debug-section{padding:10px 16px}
      .igfs-debug-metrics{gap:8px}
    }
    
    .igfs-debug-content{height:100%;overflow-y:auto;padding:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.3) transparent;-webkit-overflow-scrolling:touch}
    .igfs-debug-content::-webkit-scrollbar{width:8px}
    .igfs-debug-content::-webkit-scrollbar-track{background:transparent}
    .igfs-debug-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.4);border-radius:4px}
    .igfs-debug-content::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.6)}
    
    .igfs-debug-section{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .igfs-debug-section:last-child{border-bottom:none}
    .igfs-debug-section-title{font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:rgba(255,255,255,.95);margin-bottom:12px;display:flex;align-items:center;gap:6px}
    
    .igfs-debug-metrics{display:flex;flex-direction:column;gap:10px}
    .igfs-debug-metric{display:flex;justify-content:space-between;align-items:center;font:400 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:24px}
    .igfs-debug-label{color:rgba(255,255,255,.8);flex:1;padding-right:8px}
    .igfs-debug-value{color:#fff;font-weight:600;text-align:right;max-width:55%;word-break:break-all;font-size:12px}
    
    .igfs-debug-log{max-height:120px;overflow-y:auto;background:rgba(0,0,0,.3);border-radius:6px;padding:8px;font:400 10px 'SF Mono',Consolas,monospace;scrollbar-width:thin}
    .igfs-debug-log::-webkit-scrollbar{width:4px}
    .igfs-debug-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}
    .igfs-debug-log-entry{color:rgba(255,255,255,.8);margin-bottom:4px;line-height:1.3;word-break:break-word}
    .igfs-debug-log-entry:last-child{margin-bottom:0}
    .igfs-debug-log-entry.error{color:#ff6b6b}
    .igfs-debug-log-entry.success{color:#51cf66}
    .igfs-debug-log-entry.warning{color:#ffd43b}
    
    .igfs-debug-actions{display:flex;flex-direction:column;gap:10px}
    .igfs-debug-action-btn{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:12px 16px;font:500 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;transition:all .3s ease;text-align:left;touch-action:manipulation;min-height:44px;display:flex;align-items:center}
    .igfs-debug-action-btn:hover{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);transform:translateY(-1px)}
    .igfs-debug-action-btn:active{transform:translateY(0) scale(.98);background:rgba(255,255,255,.25)}
    `;
    
    const styleTag = document.createElement('style'); 
    styleTag.textContent = debugCss; 
    document.head.appendChild(styleTag);
  }

  function setupDebugEventListeners() {
    // Debug panel event listeners
    const debugCloseBtn = debugPanel.querySelector('.igfs-debug-close');
    if (debugCloseBtn) {
      debugCloseBtn.addEventListener('click', () => IGFS.Debug.hideDebug());
    }
    
    // Debug action buttons
    const forceLoadBtn = document.getElementById('debug-force-load');
    if (forceLoadBtn) {
      forceLoadBtn.addEventListener('click', async () => {
        IGFS.Debug.debugLog('🔄 Force loading new images...', 'info');
        try {
          const state = window.IGFS && window.IGFS.App && window.IGFS.App.state;
          if (state && window.IGFS.Infinite) {
            const result = await window.IGFS.Infinite.loadMoreImagesHoldBottom(state, 2000);
            IGFS.Debug.debugLog(result ? '✅ Force load successful' : '⚠️ No new images found', 
              result ? 'success' : 'warning');
          } else {
            IGFS.Debug.debugLog('❌ App state not available', 'error');
          }
        } catch (error) {
          IGFS.Debug.debugLog(`❌ Force load failed: ${error.message}`, 'error');
        }
      });
    }
    
    const clearCacheBtn = document.getElementById('debug-clear-cache');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        IGFS.Debug.debugLog('🗑️ Clearing preload cache...', 'info');
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
            IGFS.Debug.debugLog(`✅ Cleared ${clearedCount} cached items`, 'success');
          } else {
            IGFS.Debug.debugLog('❌ App state not available', 'error');
          }
        } catch (error) {
          IGFS.Debug.debugLog(`❌ Cache clear failed: ${error.message}`, 'error');
        }
      });
    }
    
    const copyLogsBtn = document.getElementById('debug-copy-logs');
    if (copyLogsBtn) {
      copyLogsBtn.addEventListener('click', async () => {
        IGFS.Debug.debugLog('📋 Copying debug logs...', 'info');
        try {
          // Získej všechny debug logy
          const allLogs = debugState.logEntries.map(entry => entry.message).join('\n');
          
          // Přidej systémové informace
          const systemInfo = [
            `=== IGFS Debug Logs (${new Date().toISOString()}) ===`,
            `Version: ${window.IGFS ? window.IGFS.VERSION : 'Unknown'}`,
            `User Agent: ${navigator.userAgent}`,
            `Screen: ${screen.width}x${screen.height}`,
            `Viewport: ${window.innerWidth}x${window.innerHeight}`,
            `URL: ${window.location.href}`,
            `=== LOGS ===`
          ].join('\n');
          
          // Získej console logy pokud jsou dostupné
          let consoleLogs = '';
          if (window.IGFS && window.IGFS.Console && window.IGFS.Console.getLogs) {
            const cLogs = window.IGFS.Console.getLogs();
            if (cLogs.length > 0) {
              consoleLogs = '\n=== CONSOLE LOGS ===\n' + cLogs.map(log => 
                `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
              ).join('\n');
            }
          }
          
          const fullLogContent = systemInfo + '\n' + allLogs + consoleLogs;
          
          // Zkus použít Clipboard API
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(fullLogContent);
            IGFS.Debug.debugLog('✅ Debug logs copied to clipboard', 'success');
          } else {
            // Fallback pro starší zařízení
            const textarea = document.createElement('textarea');
            textarea.value = fullLogContent;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            try {
              const successful = document.execCommand('copy');
              if (successful) {
                IGFS.Debug.debugLog('✅ Debug logs copied (fallback)', 'success');
              } else {
                throw new Error('Copy command failed');
              }
            } catch (err) {
              throw new Error('Fallback copy failed');
            } finally {
              document.body.removeChild(textarea);
            }
          }
        } catch (error) {
          IGFS.Debug.debugLog(`❌ Copy failed: ${error.message}`, 'error');
          console.error('Copy logs error:', error);
        }
      });
    }
    
    const exportStateBtn = document.getElementById('debug-export-state');
    if (exportStateBtn) {
      exportStateBtn.addEventListener('click', () => {
        IGFS.Debug.debugLog('📤 Exporting state...', 'info');
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
            
            IGFS.Debug.debugLog('✅ State exported successfully', 'success');
          } else {
            IGFS.Debug.debugLog('❌ App state not available', 'error');
          }
        } catch (error) {
          IGFS.Debug.debugLog(`❌ Export failed: ${error.message}`, 'error');
        }
      });
    }
  }

  // Debug State
  const debugState = {
    isVisible: false,
    updateInterval: null,
    logEntries: [],
    startTime: Date.now()
  };

  // Debug API
  const Debug = {
    init() {
      debugPanel = createDebugPanel();
      debugButton = createDebugButton();
      addDebugStyles();
      
      // Add panel to overlay if it exists
      if (IGFS.UI && IGFS.UI.overlay) {
        IGFS.UI.overlay.appendChild(debugPanel);
      }
      
      setupDebugEventListeners();
      this.debugLog('🟢 Debug system initialized');
      
      return debugButton;
    },

    getButton() {
      return debugButton || this.init();
    },

    showDebug() {
      if (!debugPanel) this.init();
      
      debugState.isVisible = true;
      debugPanel.style.display = 'block';
      setTimeout(() => debugPanel.classList.add('igfs-debug-show'), 10);
      this.startDebugUpdates();
      this.debugLog('🟢 Debug panel opened');
    },
    
    hideDebug() {
      if (!debugPanel) return;
      
      debugState.isVisible = false;
      debugPanel.classList.remove('igfs-debug-show');
      setTimeout(() => debugPanel.style.display = 'none', 300);
      this.stopDebugUpdates();
      this.debugLog('🔴 Debug panel closed');
    },
    
    toggleDebug() {
      if (debugState.isVisible) {
        this.hideDebug();
      } else {
        this.showDebug();
      }
    },
    
    debugLog(message, type = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      const entry = `[${timestamp}] ${message}`;
      debugState.logEntries.push({ message: entry, type });
      
      // Keep only last 50 entries
      if (debugState.logEntries.length > 50) {
        debugState.logEntries = debugState.logEntries.slice(-50);
      }
      
      // Update log display if visible
      if (debugState.isVisible) {
        this.updateDebugLog();
      }
    },
    
    updateDebugLog() {
      const logContainer = document.getElementById('debug-log');
      if (!logContainer) return;
      
      logContainer.innerHTML = debugState.logEntries
        .slice(-15) // Show only last 15 entries
        .map(entry => `<div class="igfs-debug-log-entry ${entry.type}">${entry.message}</div>`)
        .join('');
      
      // Auto-scroll to bottom
      logContainer.scrollTop = logContainer.scrollHeight;
    },
    
    startDebugUpdates() {
      if (debugState.updateInterval) return;
      
      debugState.updateInterval = setInterval(() => {
        this.updateDebugInfo();
      }, 500); // Update every 500ms for performance
      
      // Initial update
      this.updateDebugInfo();
    },
    
    stopDebugUpdates() {
      if (debugState.updateInterval) {
        clearInterval(debugState.updateInterval);
        debugState.updateInterval = null;
      }
    },
    
    updateDebugInfo() {
      if (!debugState.isVisible) return;
      
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
        const bgStatus = state.bgPreloader ? 
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

  IGFS.Debug = Debug;
})();