// /app/console.js
// Enhanced console logging and error capturing system
(function(){
  'use strict';
  
  // Create IGFS namespace if it doesn't exist
  const IGFS = (window.IGFS = window.IGFS || {});
  
  // Console panel element
  let consolePanel = null;
  let consoleContent = null;
  let consoleToggle = null;
  
  // State management
  const consoleState = {
    isVisible: false,
    logs: [],
    maxLogs: 100,
    updateInterval: null
  };
  
  // Create console panel
  function createConsolePanel() {
    if (consolePanel) return consolePanel;
    
    consolePanel = document.createElement('div');
    consolePanel.className = 'igfs-console-panel';
    consolePanel.style.display = 'none';
    
    const header = document.createElement('div');
    header.className = 'igfs-console-header';
    header.innerHTML = `
      <div class="igfs-console-title">Console</div>
      <div class="igfs-console-controls">
        <button class="igfs-console-btn igfs-console-copy">Copy</button>
        <button class="igfs-console-btn igfs-console-clear">Clear</button>
        <button class="igfs-console-btn igfs-console-close">${IGFS.ti ? IGFS.ti('x', 14) : '×'}</button>
      </div>
    `;
    
    consoleContent = document.createElement('div');
    consoleContent.className = 'igfs-console-content';
    
    consolePanel.appendChild(header);
    consolePanel.appendChild(consoleContent);
    
    // Add event listeners
    const closeBtn = header.querySelector('.igfs-console-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hideConsole();
      });
    }
    
    const clearBtn = header.querySelector('.igfs-console-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearConsole();
      });
    }
    
    const copyBtn = header.querySelector('.igfs-console-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyConsoleOutput();
      });
    }
    
    return consolePanel;
  }
  
  // Create console toggle button
  function createConsoleToggle() {
    if (consoleToggle) return consoleToggle;
    
    consoleToggle = document.createElement('button');
    consoleToggle.className = 'igfs-console-toggle';
    consoleToggle.title = 'Toggle Console';
    consoleToggle.innerHTML = IGFS.ti ? IGFS.ti('terminal', 16) : 'Console';
    
    consoleToggle.addEventListener('click', () => {
      toggleConsole();
    });
    
    return consoleToggle;
  }
  
  // Add console styles
  function addConsoleStyles() {
    const css = `
    .igfs-console-panel {
      position: fixed !important;
      right: 10px !important;
      top: 50px !important;
      bottom: 80px !important;
      width: 350px !important;
      background: rgba(0, 0, 0, 0.92) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border-radius: 12px !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0.6) !important;
      z-index: 2147483647 !important;
      overflow: hidden !important;
      transform: translateX(100%) !important;
      opacity: 0 !important;
      transition: all 0.3s cubic-bezier(0.2, 0, 0.2, 1) !important;
      display: flex !important;
      flex-direction: column !important;
    }

    .igfs-console-panel.igfs-console-show {
      transform: translateX(0) !important;
      opacity: 1 !important;
    }
    
    .igfs-console-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .igfs-console-title {
      font: 600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .igfs-console-controls {
      display: flex;
      gap: 8px;
    }
    
    .igfs-console-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
      font: 500 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    
    .igfs-console-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    .igfs-console-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      font: 400 11px 'SF Mono', Consolas, monospace;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
    }
    
    .igfs-console-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .igfs-console-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .igfs-console-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }
    
    .igfs-console-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
    
    .igfs-console-entry {
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 4px;
      line-height: 1.4;
      word-break: break-word;
      white-space: pre-wrap;
    }
    
    .igfs-console-entry.error {
      color: #ff6b6b;
    }
    
    .igfs-console-entry.warn {
      color: #ffd43b;
    }
    
    .igfs-console-entry.info {
      color: #51cf66;
    }
    
    .igfs-console-entry.debug {
      color: #74c0fc;
    }
    
    .igfs-console-toggle {
      position: fixed !important;
      bottom: calc(env(safe-area-inset-bottom, 0) + 20px) !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      width: 40px !important;
      height: 40px !important;
      border-radius: 50% !important;
      background: rgba(0, 0, 0, 0.6) !important;
      color: #fff !important;
      border: none !important;
      cursor: pointer !important;
      backdrop-filter: blur(6px) !important;
      -webkit-backdrop-filter: blur(6px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0.3) !important;
      transition: all 0.2s ease !important;
    }

    .igfs-console-toggle:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      transform: scale(1.1) !important;
    }

    .igfs-console-toggle:active {
      transform: scale(0.95) !important;
    }
    `;
    
    const styleTag = document.createElement('style');
    styleTag.textContent = css;
    document.head.appendChild(styleTag);
  }
  
  // Show console
  function showConsole() {
    if (!consolePanel) {
      initConsole();
    }
    
    consoleState.isVisible = true;
    consolePanel.style.display = 'flex';
    setTimeout(() => consolePanel.classList.add('igfs-console-show'), 10);
    updateConsoleContent();
  }
  
  // Hide console
  function hideConsole() {
    if (!consolePanel) return;
    
    consoleState.isVisible = false;
    consolePanel.classList.remove('igfs-console-show');
    setTimeout(() => consolePanel.style.display = 'none', 300);
  }
  
  // Toggle console
  function toggleConsole() {
    if (consoleState.isVisible) {
      hideConsole();
    } else {
      showConsole();
    }
  }
  
  // Clear console
  function clearConsole() {
    consoleState.logs = [];
    updateConsoleContent();
  }
  
  // Copy console output
  function copyConsoleOutput() {
    // Přidej systémové informace
    const systemInfo = [
      `=== IGFS Console Logs (${new Date().toISOString()}) ===`,
      `Version: ${window.IGFS ? window.IGFS.VERSION : 'Unknown'}`,
      `User Agent: ${navigator.userAgent}`,
      `Screen: ${screen.width}x${screen.height}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight}`,
      `URL: ${window.location.href}`,
      `Total Logs: ${consoleState.logs.length}`,
      `=== LOGS ===`
    ].join('\n');

    const output = systemInfo + '\n' + consoleState.logs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(output).then(() => {
        addLogEntry('info', '📋 Console output copied to clipboard');
      }).catch(() => {
        fallbackCopyText(output);
      });
    } else {
      fallbackCopyText(output);
    }
  }
  
  // Fallback copy method
  function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      addLogEntry('info', '📋 Console output copied to clipboard (fallback)');
    } catch (err) {
      addLogEntry('error', '❌ Failed to copy console output');
    }
    
    document.body.removeChild(textArea);
  }
  
  // Add log entry
  function addLogEntry(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
      timestamp,
      level,
      message: typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message)
    };
    
    consoleState.logs.push(entry);
    
    // Keep only last N entries
    if (consoleState.logs.length > consoleState.maxLogs) {
      consoleState.logs = consoleState.logs.slice(-consoleState.maxLogs);
    }
    
    // Update display if visible
    if (consoleState.isVisible) {
      updateConsoleContent();
    }
  }
  
  // Update console content
  function updateConsoleContent() {
    if (!consoleContent) return;
    
    consoleContent.innerHTML = consoleState.logs
      .map(log => `<div class="igfs-console-entry ${log.level}">[${log.timestamp}] ${log.message}</div>`)
      .join('');
    
    // Scroll to bottom
    consoleContent.scrollTop = consoleContent.scrollHeight;
  }
  
  // Initialize console
  function initConsole() {
    consolePanel = createConsolePanel();
    consoleToggle = createConsoleToggle();
    addConsoleStyles();
    
    // Add panel to document
    document.body.appendChild(consolePanel);
    document.body.appendChild(consoleToggle);
    
    // Capture console methods
    captureConsoleMethods();
    
    // Log initialization
    addLogEntry('info', 'Console system initialized');
  }
  
  // Capture console methods
  function captureConsoleMethods() {
    // Save original methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;
    const originalDebug = console.debug;
    const originalTable = console.table;
    const originalGroup = console.group;
    const originalGroupEnd = console.groupEnd;
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;
    
    // Helper to format console arguments properly
    function formatConsoleArgs(args) {
      return args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    }
    
    // Override console methods to capture real devtools output
    console.log = function(...args) {
      const formatted = formatConsoleArgs(args);
      addLogEntry('log', formatted);
      originalLog.apply(console, args);
    };
    
    console.warn = function(...args) {
      const formatted = formatConsoleArgs(args);
      addLogEntry('warn', formatted);
      originalWarn.apply(console, args);
    };
    
    console.error = function(...args) {
      const formatted = formatConsoleArgs(args);
      addLogEntry('error', formatted);
      originalError.apply(console, args);
    };
    
    console.info = function(...args) {
      const formatted = formatConsoleArgs(args);
      addLogEntry('info', formatted);
      originalInfo.apply(console, args);
    };
    
    console.debug = function(...args) {
      const formatted = formatConsoleArgs(args);
      addLogEntry('debug', formatted);
      originalDebug.apply(console, args);
    };
    
    // Capture console.table
    console.table = function(...args) {
      const formatted = `[TABLE] ${formatConsoleArgs(args)}`;
      addLogEntry('log', formatted);
      if (originalTable) originalTable.apply(console, args);
    };
    
    // Capture console.group
    console.group = function(...args) {
      const formatted = `[GROUP] ${formatConsoleArgs(args)}`;
      addLogEntry('log', formatted);
      if (originalGroup) originalGroup.apply(console, args);
    };
    
    console.groupEnd = function() {
      addLogEntry('log', '[GROUP END]');
      if (originalGroupEnd) originalGroupEnd.apply(console);
    };
    
    // Capture console.time/timeEnd
    console.time = function(label) {
      addLogEntry('debug', `[TIMER START] ${label || 'default'}`);
      if (originalTime) originalTime.apply(console, arguments);
    };
    
    console.timeEnd = function(label) {
      addLogEntry('debug', `[TIMER END] ${label || 'default'}`);
      if (originalTimeEnd) originalTimeEnd.apply(console, arguments);
    };
    
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      const errorMsg = `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      addLogEntry('error', errorMsg);
      
      // Special handling for "IGFS failed to load modules" error
      if (event.message && event.message.includes("IGFS failed to load modules")) {
        addLogEntry('error', `🚨 IGFS MODULE LOADING FAILURE DETECTED!`);
        addLogEntry('error', `🔴 Critical system error: IGFS failed to load modules`);
        addLogEntry('error', `📋 Diagnostic information:`);
        
        // Immediate IGFS state check
        const igfsState = window.IGFS ? Object.keys(window.IGFS) : [];
        addLogEntry('error', `   📊 Available IGFS modules: ${igfsState.length ? igfsState.join(', ') : 'NONE'}`);
        
        // Check critical modules
        const criticalModules = [
          { name: 'App', key: 'App', file: 'app.js' },
          { name: 'UI', key: 'UI', file: 'ui.js' },
          { name: 'Icons', key: 'ti', file: 'icons.js' },
          { name: 'Utils', key: 'VERSION', file: 'utils.js' },
          { name: 'Console', key: 'Console', file: 'console.js' },
          { name: 'Debug', key: 'Debug', file: 'debug.js' },
          { name: 'Infinite', key: 'Infinite', file: 'infinite.js' },
          { name: 'Collect', key: 'Collect', file: 'collect.js' },
          { name: 'Preload', key: 'Preload', file: 'preload.js' }
        ];
        
        criticalModules.forEach(module => {
          const isLoaded = window.IGFS && window.IGFS[module.key];
          const status = isLoaded ? '✅' : '❌';
          addLogEntry('error', `   ${status} ${module.name} (${module.file}): ${isLoaded ? 'LOADED' : 'MISSING'}`);
        });
        
        addLogEntry('error', `🔧 Suggested recovery actions:`);
        addLogEntry('error', `   1. Check browser console for script loading errors`);
        addLogEntry('error', `   2. Verify userscript manager is working properly`);
        addLogEntry('error', `   3. Check if GM_xmlhttpRequest is available`);
        addLogEntry('error', `   4. Refresh page to retry module loading`);
        addLogEntry('error', `   5. Check network connection and try again`);
        
        // Trigger module health check after a delay
        setTimeout(() => checkIGFSModuleHealth(), 500);
        
        return; // Skip generic module error handling
      }
      
      // Generic IGFS module loading error detection
      if (event.message && (
        event.message.includes("Can't find variable") ||
        event.message.includes("ReferenceError") ||
        event.message.includes("TypeError") ||
        event.message.includes("SyntaxError")
      )) {
        addLogEntry('error', `🚨 CRITICAL: Possible module loading issue detected!`);
        addLogEntry('error', `💡 Check module order and dependencies in main.js`);
        addLogEntry('error', `🔍 Error details: ${event.message}`);
        
        // Check current IGFS state
        setTimeout(() => {
          const igfsState = window.IGFS ? Object.keys(window.IGFS) : [];
          addLogEntry('info', `📊 Current IGFS modules: ${igfsState.join(', ')}`);
          
          if (!window.IGFS || !window.IGFS.App) {
            addLogEntry('error', `❌ IGFS.App not loaded - module loading failed!`);
          }
          if (!window.IGFS || !window.IGFS.UI) {
            addLogEntry('error', `❌ IGFS.UI not loaded - check ui.js dependency`);
          }
          if (!window.IGFS || !window.IGFS.ti) {
            addLogEntry('error', `❌ IGFS.ti not loaded - check icons.js dependency`);
          }
        }, 100);
      }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      const rejectionMsg = `Unhandled promise rejection: ${event.reason}`;
      addLogEntry('error', rejectionMsg);
      
      // Special handling for module loading promise rejections
      if (event.reason && event.reason.toString().includes('Module load failed')) {
        addLogEntry('error', `🚨 MODULE LOADING FAILURE DETECTED!`);
        addLogEntry('error', `💥 Reason: ${event.reason}`);
        addLogEntry('error', `🔧 Suggested fixes:`);
        addLogEntry('error', `   1. Check network connectivity`);
        addLogEntry('error', `   2. Verify module URLs in main.js`);
        addLogEntry('error', `   3. Check browser console for syntax errors`);
        addLogEntry('error', `   4. Ensure GM_xmlhttpRequest is available`);
      }
    });
  }
  
  // IGFS Module Health Check Function
  function checkIGFSModuleHealth() {
    addLogEntry('info', '🔍 Performing IGFS module health check...');
    
    const requiredModules = [
      { name: 'App', key: 'App', critical: true },
      { name: 'UI', key: 'UI', critical: true },
      { name: 'Icons', key: 'ti', critical: true },
      { name: 'Utils', key: 'VERSION', critical: true },
      { name: 'Console', key: 'Console', critical: false },
      { name: 'Debug', key: 'Debug', critical: false },
      { name: 'Infinite', key: 'Infinite', critical: true },
      { name: 'Collect', key: 'Collect', critical: false },
      { name: 'Preload', key: 'Preload', critical: false }
    ];
    
    let totalModules = requiredModules.length;
    let loadedModules = 0;
    let criticalMissing = 0;
    
    requiredModules.forEach(module => {
      const isLoaded = window.IGFS && window.IGFS[module.key];
      if (isLoaded) {
        loadedModules++;
      } else if (module.critical) {
        criticalMissing++;
      }
    });
    
    const healthPercentage = Math.round((loadedModules / totalModules) * 100);
    
    if (criticalMissing === 0) {
      addLogEntry('info', `✅ Module health check complete: ${healthPercentage}% (${loadedModules}/${totalModules} modules loaded)`);
    } else {
      addLogEntry('error', `❌ Module health check failed: ${criticalMissing} critical modules missing`);
      addLogEntry('error', `📊 Overall health: ${healthPercentage}% (${loadedModules}/${totalModules} modules loaded)`);
    }
    
    // Check userscript environment
    if (typeof GM_xmlhttpRequest === 'undefined') {
      addLogEntry('error', '❌ GM_xmlhttpRequest not available - userscript manager issue');
    } else {
      addLogEntry('info', '✅ GM_xmlhttpRequest available');
    }
    
    // Check if we're in the right domain
    if (!location.hostname.includes('instagram.com')) {
      addLogEntry('warn', '⚠️ Not running on Instagram domain');
    } else {
      addLogEntry('info', '✅ Running on Instagram domain');
    }
  }
  
  // Public API
  IGFS.Console = {
    init: initConsole,
    show: showConsole,
    hide: hideConsole,
    toggle: toggleConsole,
    clear: clearConsole,
    copy: copyConsoleOutput,
    log: (message) => addLogEntry('log', message),
    warn: (message) => addLogEntry('warn', message),
    error: (message) => addLogEntry('error', message),
    info: (message) => addLogEntry('info', message),
    debug: (message) => addLogEntry('debug', message),
    getLogs: () => [...consoleState.logs], // Copy logs array for external access
    checkHealth: checkIGFSModuleHealth,
    getState: () => ({ ...consoleState })
  };
  
  // Auto-initialize if document is already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsole);
  } else {
    initConsole();
  }
})();