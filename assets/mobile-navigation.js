(function(){
 'use strict';
 const nav=document.getElementById('nav'),button=document.getElementById('nav-toggle'),links=document.getElementById('primary-navigation');
 if(!nav||!button||!links)return;
 const mobile=matchMedia('(max-width:1100px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const icon=button.querySelector('.nav-toggle-icon');
 function setOpen(open){nav.classList.toggle('is-menu-open',open);button.setAttribute('aria-expanded',String(open));icon.textContent=open?'×':'☰';}
 button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
 links.addEventListener('click',event=>{
  const link=event.target.closest('a');if(!link||!mobile.matches)return;setOpen(false);
  const href=link.getAttribute('href');if(!href?.startsWith('#'))return;
  const target=document.getElementById(href.slice(1));if(!target)return;
  event.preventDefault();event.stopPropagation();
  const top=target.getBoundingClientRect().top+window.scrollY-nav.getBoundingClientRect().height-12;
  window.scrollTo({top:Math.max(0,top),behavior:reduced.matches?'instant':'smooth'});
  history.replaceState(null,'',href);
  const focusTarget=target.querySelector('h2')||target;const hadTabIndex=focusTarget.hasAttribute('tabindex');if(!hadTabIndex)focusTarget.setAttribute('tabindex','-1');focusTarget.focus({preventScroll:true});if(!hadTabIndex)focusTarget.addEventListener('blur',()=>focusTarget.removeAttribute('tabindex'),{once:true});
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){setOpen(false);button.focus();}});
 document.addEventListener('pointerdown',event=>{if(!nav.contains(event.target))setOpen(false);});
 nav.addEventListener('focusout',()=>setTimeout(()=>{if(!nav.contains(document.activeElement))setOpen(false);},0));
 mobile.addEventListener('change',()=>setOpen(false));
})();
