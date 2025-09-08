// /app/icons.js
(function(){
  'use strict';
  const IGFS = (window.IGFS = window.IGFS || {});

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
      bug: `<path d="M8 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm8 0c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zM8 12v4m8-4v4M6 10h2m8 0h2M6 14h2m8 0h2M8 18h8c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2z"/>`,
      cpu: `<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>`,
    };
    return H+(M[name]||'')+T;
  }

  IGFS.ti = ti;

  // Debug log pro kontrolu načtení ikon
  if (window.IGFS && window.IGFS.Console) {
    window.IGFS.Console.log('[IGFS Icons] Icons module loaded, ti function available');
  }
})();
