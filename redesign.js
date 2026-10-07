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
/* hide the floating tour button while the hero is on screen; single threshold + rAF debounce so
   iOS address-bar resizes don't make it blink */
(function(){
  var hero = document.querySelector('.rd-hero'); if (!hero || !('IntersectionObserver' in window)) return;
  var state = null;
  new IntersectionObserver(function(es){ var on = es[es.length-1].isIntersecting;
    if (on === state) return; state = on; requestAnimationFrame(function(){ document.body.classList.toggle('rd-hero-on', on); });
  }, { threshold: 0, rootMargin: '0px 0px -55% 0px' }).observe(hero);
})();
/* mobile: mark marquee duplicates (carousel shows each shop once) + sticky bottom CTA after hero, hidden near signup card */
(function(){
  document.querySelectorAll('.dest-track').forEach(function(t){ var k=t.children, n=k.length/2; if (n%1===0) for (var i=n;i<k.length;i++) k[i].classList.add('rd-dup'); });
  var src = document.querySelector('.rd-hero .rd-cta'), card = document.querySelector('.land-card'), hero = document.querySelector('.rd-hero');
  if (!src || !hero || !('IntersectionObserver' in window) || !matchMedia('(max-width:767px)').matches) return;
  var bar = document.createElement('div'); bar.className = 'rd-bcta'; var b = src.cloneNode(true); b.removeAttribute('data-tip'); bar.appendChild(b);
  document.body.appendChild(bar);
  var heroOn = true, cardOn = false;
  function upd(){ var on = !heroOn && !cardOn; bar.classList.toggle('on', on); document.body.classList.toggle('rd-bcta-on', on); }
  new IntersectionObserver(function(e){ heroOn = e[e.length-1].isIntersecting; upd(); }, {rootMargin:'0px 0px -40% 0px'}).observe(hero);
  if (card) new IntersectionObserver(function(e){ cardOn = e[e.length-1].isIntersecting; upd(); }).observe(card);
})();
/* rotating pill: replay a soft settle on each word change (word is never hidden) */
(function(){
  var w = document.getElementById('rot-word'); if (!w || !('MutationObserver' in window)) return;
  new MutationObserver(function(){ w.classList.remove('rd-swap'); void w.offsetWidth; w.classList.add('rd-swap'); }).observe(w, {childList:true, characterData:true, subtree:true});
})();
