/* tap an image to see it full screen (catalogue highlights, galleries) */
(() => {
  'use strict';
  let box = null, last = null;
  function close() { if (!box) return; box.classList.remove('on'); const b = box; box = null; setTimeout(() => b.remove(), 300); if (last) last.focus({ preventScroll: true }); }
  function open(img) {
    last = document.activeElement;
    box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', img.alt || 'Image');
    box.innerHTML = `<img src="${img.currentSrc || img.src}" alt="${(img.alt || '').replace(/"/g, '&quot;')}"><button type="button" aria-label="Close">×</button>`;
    box.addEventListener('click', close);
    document.body.appendChild(box); requestAnimationFrame(() => box && box.classList.add('on'));
    box.querySelector('button').focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-zoom], .p-gal-grid img, .dk-family img, .dk-switch img, .dk-real img, .hp-gal img');
    if (!img || e.target.closest('a')) return;
    e.preventDefault(); open(img);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
