/* landing redesign: before/after slider + close mobile menu on outside tap */
(function(){
  document.querySelectorAll('.rd-ba').forEach(function(ba){
    var r = ba.querySelector('.rd-ba-range'); if(!r) return;
    r.addEventListener('input', function(){ ba.style.setProperty('--pos', r.value + '%'); });
  });
  document.addEventListener('click', function(e){
    var m = document.getElementById('ln-links');
    if (m && m.classList.contains('open') && !e.target.closest('#land-nav') && typeof landNavClose === 'function') landNavClose();
  });
})();
/* robust scroll reveals for the redesigned landing (threshold 0, reduced-motion aware) */
(function(){
  var els = [].slice.call(document.querySelectorAll('#view-auth .reveal'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function showAll(){ els.forEach(function(el){ el.classList.add('in'); }); }
  if (reduce || !('IntersectionObserver' in window)) return showAll();
  var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  els.forEach(function(el){ io.observe(el); });
  window.addEventListener('beforeprint', showAll);
})();
/* hide the floating tour button while the hero is visible so it never sits on hero content */
(function(){
  var hero = document.querySelector('.rd-hero'); if (!hero || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function(es){ document.body.classList.toggle('rd-hero-on', es[0].isIntersecting && es[0].intersectionRatio > .25); }, { threshold: [0, .25, .5] }).observe(hero);
})();
