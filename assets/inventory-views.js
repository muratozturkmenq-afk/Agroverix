import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
let personnelLoad=null;
const views={personnel:{button:document.querySelector('#inventory-tab-personnel'),panel:document.querySelector('#personel-giderleri')},purchase:{button:document.querySelector('#inventory-tab-purchase'),panel:document.querySelector('#alisveris-ekle')},payment:{button:document.querySelector('#inventory-tab-payment'),panel:document.querySelector('#odeme-borc')}};
export function showInventoryView(mode,{focus=false,scroll=false,writeHash=true}={}){
 if(!views[mode]?.button||!views[mode]?.panel)return;
 if(mode==='personnel'&&!personnelLoad)personnelLoad=import('./personnel.js?v=page-reorg-v1').catch(error=>{personnelLoad=null;document.querySelector('#personnel-status').textContent='Personel ekranı yüklenemedi. Tekrar seçerek dene.';});
 Object.entries(views).forEach(([key,{button,panel}])=>{const selected=key===mode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;panel.hidden=!selected;});
 const footnote=document.querySelector('.inventory-footnote');if(footnote)footnote.hidden=mode==='personnel';
 if(writeHash){const url=new URL(location.href);url.hash=views[mode].panel.id;history.replaceState(null,'',url);}
 if(focus)views[mode].button.focus();
 if(scroll)views[mode].panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
Object.entries(views).forEach(([mode,{button}])=>{
 button.addEventListener('click',()=>showInventoryView(mode,{scroll:true}));
 button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const order=['purchase','payment','personnel'],at=order.indexOf(mode),next=event.key==='Home'?order[0]:event.key==='End'?order.at(-1):order[(at+(event.key==='ArrowRight'?1:2))%3];showInventoryView(next,{focus:true,scroll:true});});
});
function readHash(){showInventoryView(location.hash==='#personel-giderleri'?'personnel':location.hash==='#odeme-borc'?'payment':'purchase',{writeHash:false});}
window.addEventListener('hashchange',readHash);readHash();
if(location.hash==='#odeme-borc')requestAnimationFrame(()=>showInventoryView('payment',{scroll:true,writeHash:false}));
