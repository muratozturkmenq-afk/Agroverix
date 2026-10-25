(function () {
  'use strict';
  var nav = document.getElementById('nav');
  var bar = document.querySelector('.progress i');
  var pending = false;
  function update() {
    pending = false;
    var y = window.scrollY || 0;
    if (nav) nav.classList.toggle('solid', y > 40);
    if (bar) {
      var height = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (height > 0 ? Math.min(1, y / height) : 0) + ')';
    }
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('pageshow', schedule);
  update();
  // Optional decoration never controls access to the page or account records.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.kicker, .hero-sub, .hero-cta').forEach(function (el) {
      if (el.animate) el.animate([{transform: 'translateY(8px)', opacity: 0.85}, {transform: 'translateY(0)', opacity: 1}], {duration: 350, easing: 'ease-out'});
    });
  }
})();
