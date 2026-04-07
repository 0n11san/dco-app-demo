// js/tooltip.js — Cross-browser tooltip for [data-tooltip] elements
// Uses a floating div instead of CSS ::after, which fails on <th> in Firefox.

(function() {
  const tip = document.createElement('div');
  tip.id = 'dco-tooltip';
  Object.assign(tip.style, {
    position:     'fixed',
    background:   '#1e2e1e',
    color:        '#e0e0e0',
    border:       '1px solid #C5A028',
    padding:      '6px 10px',
    fontSize:     '11px',
    lineHeight:   '1.5',
    maxWidth:     '240px',
    pointerEvents:'none',
    zIndex:       '9999',
    boxShadow:    '0 4px 12px rgba(0,0,0,0.6)',
    display:      'none',
    whiteSpace:   'normal',
  });
  document.body.appendChild(tip);

  document.addEventListener('mouseover', function(e) {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    tip.textContent = el.getAttribute('data-tooltip');
    tip.style.display = 'block';
    position(e);
  });

  document.addEventListener('mousemove', function(e) {
    if (tip.style.display === 'none') return;
    position(e);
  });

  document.addEventListener('mouseout', function(e) {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    tip.style.display = 'none';
  });

  function position(e) {
    const pad = 12;
    const tw  = tip.offsetWidth;
    const th  = tip.offsetHeight;
    let x = e.clientX + pad;
    let y = e.clientY - th - pad;
    // Keep within viewport
    if (x + tw > window.innerWidth  - pad) x = e.clientX - tw - pad;
    if (y < pad) y = e.clientY + pad;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }
})();
