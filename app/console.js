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
      position: fixed;
      right: 10px;
      top: 50px;
      bottom: 80px;
      width: 350px;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 40px rgba(0, 0, 0.6);
      z-index: 1000;
      overflow: hidden;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.2, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
    }
    
    .igfs-console-panel.igfs-console-show {
      transform: translateX(0);
      opacity: 1;
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
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0) + 20px);
      right: 20px;
      z-index: 2147483647;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      border: none;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0.3);
      transition: all 0.2s ease;
    }
    
    .igfs-console-toggle:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.1);
    }
    
    .igfs-console-toggle:active {
      transform: scale(0.95);
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
    
    // Override console methods
    console.log = function(...args) {
      addLogEntry('log', args.join(' '));
      originalLog.apply(console, args);
    };
    
    console.warn = function(...args) {
      addLogEntry('warn', args.join(' '));
      originalWarn.apply(console, args);
    };
    
    console.error = function(...args) {
      addLogEntry('error', args.join(' '));
      originalError.apply(console, args);
    };
    
    console.info = function(...args) {
      addLogEntry('info', args.join(' '));
      originalInfo.apply(console, args);
    };
    
    console.debug = function(...args) {
      addLogEntry('debug', args.join(' '));
      originalDebug.apply(console, args);
    };
    
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      addLogEntry('error', `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      addLogEntry('error', `Unhandled promise rejection: ${event.reason}`);
    });
  }
  
  // Public API
  IGFS.Console = {
    init: initConsole,
    show: showConsole,
    hide: hideConsole,
    toggle: toggleConsole,
    clear: clearConsole,
    log: (message) => addLogEntry('log', message),
    warn: (message) => addLogEntry('warn', message),
    error: (message) => addLogEntry('error', message),
    info: (message) => addLogEntry('info', message),
    debug: (message) => addLogEntry('debug', message),
    getLogs: () => [...consoleState.logs] // Copy logs array for external access
  };
  
  // Auto-initialize if document is already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsole);
  } else {
    initConsole();
  }
})();