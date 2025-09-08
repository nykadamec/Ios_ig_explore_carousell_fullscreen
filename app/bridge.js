// /app/bridge.js
// Central bridge module for IGFS Instagram carousel fullscreen userscript
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});

  // ---------- Core Dependencies ----------
  // Import all utility functions from utils.js
  const {
    VERSION, ON_IOS, sleep, debounce, clamp,
    decodeEntities, deThumbURL, pickLargestFromSrcset,
    toast, openURLWithGesture, buildPostURL, BackgroundPreloader
  } = IGFS;

  // Import icon function from icons.js
  const { ti } = IGFS;

  // Import UI components from ui.js
  const { UI } = IGFS;

  // Import debug system from debug.js
  const { Debug } = IGFS;

  // Import collection functions from collect.js
  const { collectExploreItems, collectExploreItemsAsync } = IGFS;

  // Import preload system from preload.js
  const { Qual, Preload } = IGFS;

  // Import infinite scroll from infinite.js
  const { Infinite } = IGFS;

  // Import main app from app.js
  const { App } = IGFS;

  // ---------- Centralized API ----------
  const Bridge = {
    // Core utilities
    VERSION,
    ON_IOS,
    sleep,
    debounce,
    clamp,
    decodeEntities,
    deThumbURL,
    pickLargestFromSrcset,
    toast,
    openURLWithGesture,
    buildPostURL,
    BackgroundPreloader,

    // Icons
    ti,

    // UI system
    UI,

    // Debug system
    Debug,

    // Data collection
    collectExploreItems,
    collectExploreItemsAsync,

    // Quality settings
    Qual,

    // Preload system
    Preload,

    // Infinite scroll
    Infinite,

    // Main application
    App,

    // ---------- Bridge-specific methods ----------

    // Initialize all systems in correct order
    async init() {
      console.log(`[IGFS Bridge] Initializing IGFS v${VERSION}...`);

      try {
        // Initialize debug system first (depends on UI)
        if (Debug && Debug.init) {
          Debug.init();
        }

        // Initialize UI system
        if (UI && UI.initDebug) {
          UI.initDebug();
        }

        // Initialize main app (this will set up all event listeners)
        if (App && App.init) {
          App.init();
        }

        console.log(`[IGFS Bridge] Initialization complete`);
        return true;
      } catch (error) {
        console.error('[IGFS Bridge] Initialization failed:', error);
        return false;
      }
    },

    // Get current app state
    getState() {
      return App && App.state ? App.state : null;
    },

    // Get current image data
    getCurrentImage() {
      const state = this.getState();
      if (!state || !state.items || state.cur < 0) return null;
      return state.items[state.cur];
    },

    // Navigate to specific image
    goToImage(index) {
      const state = this.getState();
      if (!state || !App || typeof App.updateIndex !== 'function') return false;

      const clampedIndex = clamp(index, 0, state.items.length - 1);
      if (clampedIndex !== state.cur) {
        // Use the translateTo function if available, otherwise update index
        if (typeof window.IGFS.App.translateTo === 'function') {
          window.IGFS.App.translateTo(clampedIndex);
        } else {
          App.updateIndex();
        }
      }
      return true;
    },

    // Toggle quality preference
    toggleQuality() {
      if (Qual && typeof Qual.setPreferHQ === 'function') {
        const current = Qual.getPreferHQ();
        Qual.setPreferHQ(!current);
        toast(!current ? 'Quality: HQ' : 'Quality: LQ');
        return !current;
      }
      return null;
    },

    // Manual preload trigger
    async preloadNext() {
      if (App && typeof App.manualPreloadNext === 'function') {
        return await App.manualPreloadNext();
      }
      return false;
    },

    // Download current image
    async downloadCurrent() {
      if (App && typeof App.doDownloadCurrent === 'function') {
        return await App.doDownloadCurrent();
      }
      return false;
    },

    // Save current image to gallery
    async saveCurrent() {
      if (App && typeof App.saveToGalleryCurrent === 'function') {
        return await App.saveToGalleryCurrent();
      }
      return false;
    },

    // Copy current image URL
    async copyCurrentUrl() {
      if (App && typeof App.copyUrlCurrent === 'function') {
        return await App.copyUrlCurrent();
      }
      return false;
    },

    // Open current post
    openCurrentPost() {
      if (App && typeof App.openPostCurrent === 'function') {
        App.openPostCurrent();
        return true;
      }
      return false;
    },

    // Get debug information
    getDebugInfo() {
      const state = this.getState();
      const currentImage = this.getCurrentImage();

      return {
        version: VERSION,
        isIOS: ON_IOS,
        active: state ? state.active : false,
        currentIndex: state ? state.cur : -1,
        totalImages: state ? state.items.length : 0,
        currentImage: currentImage ? {
          href: currentImage.href,
          hasLow: !!currentImage.low,
          hasHq: !!currentImage.hq,
          preloaded: currentImage.hq_preloaded,
          dimensions: currentImage.w && currentImage.h ? `${currentImage.w}x${currentImage.h}` : null
        } : null,
        quality: Qual && typeof Qual.getPreferHQ === 'function' ? (Qual.getPreferHQ() ? 'HQ' : 'LQ') : 'unknown'
      };
    }
  };

  // Export bridge to global IGFS namespace
  IGFS.Bridge = Bridge;

  // Auto-initialize if this is the main entry point
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Bridge.init());
  } else {
    Bridge.init();
  }

})();