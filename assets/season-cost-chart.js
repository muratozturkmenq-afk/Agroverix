import {seasonCostSeries} from './season-cost-series.js?v=summary-chart-v1';
const I=window.AgroIntl,ns='http://www.w3.org/2000/svg';
const text=s=>I.t(s),money=n=>Number(n).toLocaleString(I.locale,{maximumFractionDigits:0})+' '+text('TL');
const element=(tag,cls,copy)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(copy)n.textContent=copy;return n;};
const svgNode=(tag,attrs={})=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
export function seasonCostChart(farms,records,year){
 const series=seasonCostSeries(farms,records,year),points=series.points,wrap=element('figure','season-cost-chart');
 const head=element('div','season-cost-chart-head'),title=element('figcaption','',text('Aylık Biriken Masraf')),replay=element('button','season-cost-replay',text('Tekrar Oynat'));
 replay.type='button';head.append(title,replay);
 const chart=svgNode('svg',{viewBox:'0 0 440 155',role:'img','aria-label':text('Tüm tarlaların aylık biriken masraf grafiği')}),chartTitle=svgNode('title');chart.append(chartTitle);
 const maximum=Math.max(1,...points.map(p=>p.total)),left=14,right=426,top=26,bottom=140;
 for(const ratio of [0,.5,1])chart.append(svgNode('line',{x1:left,x2:right,y1:top+(bottom-top)*ratio,y2:top+(bottom-top)*ratio,class:'season-cost-gridline'}));
 const area=svgNode('polygon',{class:'season-cost-fill'}),line=svgNode('polyline',{class:'season-cost-line',fill:'none'}),dot=svgNode('circle',{r:4,class:'season-cost-dot'}),valueLabel=svgNode('text',{x:left,y:16,class:'season-cost-value'});chart.append(area,line,dot,valueLabel);
 const months=element('div','season-cost-months'),detail=element('p','season-cost-detail'),note=element('small','season-cost-note');detail.setAttribute('role','status');
 const monthName=p=>p.month===null?text('Başlangıç'):new Date(Math.floor(p.month/12),p.month%12,1).toLocaleDateString(I.locale,{month:'short',year:'numeric'});
 chartTitle.textContent=points.length?points.map(p=>monthName(p)+': '+money(p.total)).join('; '):text('Henüz masraf kaydı yok.');
 note.textContent=text('Çizgi ilk masraf ayından son kayıtlı masraf ayına kadar ilerler.')+(series.rent>0?' '+text('Sezonluk kira başlangıç toplamına dahildir.'):'')+(series.undated?' '+text('Tarihsiz giderler başlangıç tutarına dahildir.'):'')+(series.missing?' '+text('Hesaplama bilgisi eksik; yalnızca hesaplanabilen giderler gösterilir.'):'');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let position=0,raf=0,start=null,observer,disposed=false,active=-1,playing=false;
 const x=i=>points.length===1?(left+right)/2:left+i/(points.length-1)*(right-left),y=v=>bottom-v/maximum*(bottom-top);
 function draw(){
  if(!points.length){dot.style.display='none';valueLabel.textContent=text('Henüz masraf kaydı yok');detail.textContent=text('İlk masraf girildiğinde grafik bu aydan başlayacak.');return;}
  const index=Math.min(Math.floor(position),points.length-1),next=Math.min(index+1,points.length-1),fraction=position-index,value=points[index].total+(points[next].total-points[index].total)*fraction;
  const visible=points.slice(0,index+1).map((p,i)=>x(i)+','+y(p.total));if(next!==index&&fraction>0)visible.push(x(position)+','+y(value));
  line.setAttribute('points',visible.join(' '));area.setAttribute('points',x(0)+','+bottom+' '+visible.join(' ')+' '+x(position)+','+bottom);dot.setAttribute('cx',x(position));dot.setAttribute('cy',y(value));valueLabel.textContent=money(value);
  if(active!==index){active=index;detail.textContent=monthName(points[index])+' · '+text('Aylık')+' '+money(points[index].monthly)+' · '+text('Biriken')+' '+money(points[index].total);months.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.index)===index)));}
 }
 function stop(){playing=false;cancelAnimationFrame(raf);raf=0;}
 function frame(time){if(disposed||!wrap.isConnected||document.hidden){stop();return;}if(start===null)start=time;position=Math.min(points.length-1,(time-start)/4500*(points.length-1));draw();if(position<points.length-1)raf=requestAnimationFrame(frame);else stop();}
 function play(){stop();observer?.disconnect();if(disposed)return;active=-1;position=0;start=null;if(reduced.matches||points.length<2){position=Math.max(0,points.length-1);draw();return;}draw();playing=true;raf=requestAnimationFrame(frame);}
 // Keep long, cross-year seasons readable without forcing the page wider.
 const step=Math.max(1,Math.ceil(points.length/6));
 points.forEach((p,i)=>{if(i%step&&i!==points.length-1)return;const b=element('button','',monthName(p));b.type='button';b.dataset.index=i;b.setAttribute('aria-label',monthName(p)+' '+text('masrafı'));b.addEventListener('click',()=>{stop();observer?.disconnect();position=i;active=-1;draw();});months.append(b);});
 replay.disabled=points.length<2;replay.addEventListener('click',play);
 wrap.append(head,chart,months,detail,note);draw();
 if(reduced.matches){position=Math.max(0,points.length-1);draw();}
 else if(points.length>1){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))play();},{threshold:.2});observer.observe(wrap);}
 const motionChanged=()=>{if(reduced.matches){stop();observer?.disconnect();position=Math.max(0,points.length-1);active=-1;draw();}},visibilityChanged=()=>{if(document.hidden&&playing){stop();position=Math.max(0,points.length-1);active=-1;draw();}};
 reduced.addEventListener('change',motionChanged);document.addEventListener('visibilitychange',visibilityChanged);
 wrap.dispose=()=>{disposed=true;stop();observer?.disconnect();reduced.removeEventListener('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);};return wrap;
}
