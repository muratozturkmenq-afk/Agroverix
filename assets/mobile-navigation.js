import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
(function(){
 'use strict';
 var nav=document.getElementById('nav'),menu=document.getElementById('mobile-page-menu'),summary=document.getElementById('nav-toggle');
 if(!nav||!menu||!summary)return;
 var mobile=window.matchMedia('(max-width:1100px)'),reduced=window.matchMedia('(prefers-reduced-motion:reduce)');
 function close(){menu.open=false;}
 // Opening/closing the summary is native HTML; these handlers only assist navigation.
 menu.addEventListener('click',function(event){
  var link=event.target.closest('a');if(!link)return;close();var href=link.getAttribute('href');if(!href||href.charAt(0)!=='#')return;
  var target=document.getElementById(href.slice(1));if(!target)return;event.preventDefault();event.stopPropagation();
  var top=target.getBoundingClientRect().top+window.scrollY-nav.getBoundingClientRect().height-12;
  window.scrollTo({top:Math.max(0,top),behavior:reduced.matches?'auto':'smooth'});window.history.replaceState(null,'',href);
  var focusTarget=target.querySelector('h2')||target,hadTabIndex=focusTarget.hasAttribute('tabindex');if(!hadTabIndex)focusTarget.setAttribute('tabindex','-1');focusTarget.focus({preventScroll:true});if(!hadTabIndex)focusTarget.addEventListener('blur',function(){focusTarget.removeAttribute('tabindex');},{once:true});
 },true);
 document.addEventListener('keydown',function(event){if(event.key==='Escape'&&menu.open){close();summary.focus();}});
 document.addEventListener('click',function(event){if(!nav.contains(event.target))close();});
 if(mobile.addEventListener)mobile.addEventListener('change',close);else if(mobile.addListener)mobile.addListener(close);
})();
