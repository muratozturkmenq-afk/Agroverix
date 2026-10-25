import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
// Decorative illustration, not measured growth or a satellite observation.
const ns='http://www.w3.org/2000/svg';
export function cropVisual(crop) {
 const name=I.cropName(crop||__avt("Bitki")).toLocaleLowerCase('tr-TR'),svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 420 360');svg.setAttribute('role','img');svg.setAttribute('aria-label',crop+__avt(" bitkisinin temsili gelişim görseli"));svg.classList.add('crop-scene');
 const add=(tag,attrs,parent=svg)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.append(n);return n;};
 add('rect',{width:420,height:360,fill:'#e5eddf'});add('circle',{cx:334,cy:65,r:28,fill:'#edb43e'});add('path',{d:'M0 240 Q100 195 220 231 T420 215 V360 H0Z',fill:'#aab98a'});add('path',{d:'M0 267 Q140 240 420 263 V360 H0Z',fill:'#674731'});
 [36,94,152,210,268,326,384].forEach(x=>add('path',{d:`M${x} 360 L${210+(x-210)*.4} 267`,stroke:'#8b6543','stroke-width':3,fill:'none'}));
 const growth=add('g',{class:'crop-growth'}),plant=add('g',{class:'crop-live-plant'},growth),stem=(d,w=5)=>add('path',{d,stroke:'#56733d','stroke-width':w,fill:'none','stroke-linecap':'round'},plant),leaf=(x,y,flip=1,s=1)=>add('path',{d:'M0 0 Q35 -40 65 -23 Q34 4 0 0Z',fill:'#668a47',transform:`translate(${x} ${y}) scale(${flip*s} ${s})`},plant);
 if(/zeytin|meyve|elma|badem|fıstık|ceviz|portakal|limon|kiraz|kayısı/.test(name)){
  stem('M210 273 Q200 195 210 136',15);stem('M207 200 L160 140 M208 180 L260 127',7);[[155,129],[211,96],[264,125],[174,175],[244,170]].forEach(([x,y])=>add('ellipse',{cx:x,cy:y,rx:48,ry:44,fill:'#69854a'},plant));[[143,125],[181,154],[212,105],[243,142],[271,116],[230,174]].forEach(([x,y])=>add('circle',{cx:x,cy:y,r:6,fill:name.includes('zeytin')?'#393a27':'#c38938'},plant));
 }else if(/buğday|arpa|çavdar|yulaf|pirinç/.test(name)){
  [176,210,244].forEach((x,i)=>{stem(`M${x} 275 Q${x-7} 195 ${x} ${92+i*11}`,3);leaf(x,220,i%2?-1:1,.5);for(let j=0;j<7;j++)[-1,1].forEach(k=>add('ellipse',{cx:x+k*7,cy:96+i*11+j*10,rx:5,ry:10,fill:'#d7ad4a',transform:`rotate(${k*32} ${x+k*7} ${96+i*11+j*10})`},plant));});
 }else if(/mısır/.test(name)){
  stem('M210 275 L210 44',7);[94,132,169,204,238].forEach((y,i)=>leaf(210,y,i%2?-1:1,1.1));[[229,171,20],[191,130,-24]].forEach(([x,y,angle])=>{add('ellipse',{cx:x,cy:y,rx:13,ry:35,fill:'#e5b842',transform:`rotate(${angle} ${x} ${y})`},plant);[-5,0,5].forEach(dx=>add('path',{d:`M${x+dx} ${y-25} L${x+dx} ${y+25}`,stroke:'#c59127','stroke-width':1,transform:`rotate(${angle} ${x} ${y})`},plant));});[-18,0,18].forEach(x=>stem(`M210 58 L${210+x} 20`,2));
 }else if(/ayçiçeği/.test(name)){
  stem('M210 275 Q201 190 210 106',7);leaf(210,197);leaf(207,232,-1);for(let i=0;i<12;i++)add('ellipse',{cx:210,cy:78,rx:10,ry:26,fill:'#e9b436',transform:`rotate(${i*30} 210 106)`},plant);add('circle',{cx:210,cy:106,r:24,fill:'#624329'},plant);
 }else if(/üzüm/.test(name)){
  stem('M210 275 Q188 190 216 89',7);leaf(208,125);leaf(204,170,-1,1.2);leaf(210,224);[[229,158],[243,159],[221,173],[237,174],[250,175],[230,188],[244,189],[237,201]].forEach(([x,y])=>add('circle',{cx:x,cy:y,r:9,fill:'#6e587d'},plant));
 }else{
  stem('M210 275 Q203 213 210 158 Q215 117 210 86');[134,168,204,238].forEach((y,i)=>leaf(210,y,i%2?-1:1,.8));
  if(/pamuk/.test(name))[[165,156],[251,187],[174,222],[221,102]].forEach(([x,y])=>{stem(`M210 ${y+20} L${x} ${y}`,2);[[-8,1],[6,2],[0,-7]].forEach(([dx,dy])=>add('circle',{cx:x+dx,cy:y+dy,r:12,fill:'#fffdf6'},plant));});
  else [[176,162],[247,194],[213,87]].forEach(([x,y])=>add('circle',{cx:x,cy:y,r:10,fill:'#d5b86b'},plant));
 }
 const wrap=document.createElement('div');wrap.className='crop-art';const caption=document.createElement('small');caption.textContent=(crop||__avt("Bitki"))+__avt(" · Temsili bitki animasyonu");wrap.append(svg,caption);wrap.setProgress=p=>{const scale=Math.max(0,Math.min(1,p*1.15));growth.setAttribute('transform','translate(210 275) scale('+scale+') translate(-210 -275)');plant.querySelectorAll('circle').forEach(n=>n.style.opacity=String(Math.max(0,Math.min(1,(p-.55)/.3))));};return wrap;
}
