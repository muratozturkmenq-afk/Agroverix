import { costPerDecare } from './operation-cost.js';
const months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const ns='http://www.w3.org/2000/svg';
const money=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2})+' TL';

export function cropTimeline(art,{crop,year,records=[],area=0,rent=0}){
 const wrap=document.createElement('div');wrap.className='crop-timeline-visual';
 const calendar=document.createElement('div');calendar.className='crop-calendar';
 const stage=document.createElement('b');stage.className='crop-stage';stage.setAttribute('aria-live','polite');
 const title=document.createElement('span');title.className='crop-cost-title';title.textContent='Aylık Biriken Masraf';
 const chart=document.createElementNS(ns,'svg');chart.setAttribute('viewBox','0 0 360 112');chart.setAttribute('role','img');chart.classList.add('crop-cost-chart');
 const chartTitle=document.createElementNS(ns,'title');chart.append(chartTitle);
 const monthList=document.createElement('div');monthList.className='crop-months';
 const detail=document.createElement('p');detail.className='crop-cost-detail';detail.setAttribute('role','status');

 // The caller supplies this field's season records. Their dates may cross New Year.
 const dated=records.flatMap(record=>{
  const match=String(record.operation_date||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if(!match)return [];
  const y=Number(match[1]),m=Number(match[2])-1,d=Number(match[3]);
  if(y<1||m<0||m>11||d<1||d>new Date(y,m+1,0).getDate())return [];
  return [{record,month:y*12+m}];
 });
 const first=dated.length?Math.min(...dated.map(r=>r.month)):Number(year)*12;
 const last=dated.length?Math.max(...dated.map(r=>r.month))-first:-1;
 const count=Math.max(12,last+1),monthly=Array(count).fill(0),entered=new Set();let firstMissing=count;
 dated.forEach(({record,month})=>{
  const i=month-first;entered.add(i);const per=costPerDecare(record,area);
  if(per===null){firstMissing=Math.min(firstMissing,i);return;}
  monthly[i]+=per*Number(area);
 });
 let total=Number(rent)||0;
 const sums=monthly.map((value,i)=>{total+=value;return i<=last&&i<firstMissing?total:null;});
 const known=sums.filter(v=>v!==null),max=Math.max(1,...known);
 const x=i=>(i+.5)*360/count,y=value=>98-value/max*72;
 const monthName=i=>months[(first+i)%12]+' '+Math.floor((first+i)/12);
 const path=document.createElementNS(ns,'polyline');
 path.setAttribute('fill','none');path.setAttribute('stroke','#678947');path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');chart.append(path);
 const high=document.createElementNS(ns,'text');high.setAttribute('x','12');high.setAttribute('y','13');chart.append(high);
 const startDot=document.createElementNS(ns,'circle');startDot.setAttribute('r','3');startDot.setAttribute('fill','#678947');chart.append(startDot);
 const cursor=document.createElementNS(ns,'circle');cursor.setAttribute('r','4');cursor.setAttribute('fill','#c38c1b');chart.append(cursor);
 chartTitle.textContent=dated.length?year+' sezonunun ilk masraf ayından itibaren biriken masrafları. '+sums.slice(0,last+1).map((value,i)=>monthName(i)+': '+(value===null?'hesaplama bilgisi eksik':money(value))).join('; '):year+' sezonunda henüz masraf kaydı yok.';
 monthList.style.setProperty('--crop-month-count',count);
 const tree=/zeytin|meyve|elma|badem|fıstık|ceviz|portakal|limon|kiraz|kayısı|üzüm/.test(crop.toLocaleLowerCase('tr-TR'));
 const labels=tree?['Dinlenme / Budama','İlk Gelişim','Çiçeklenme','Meyve Gelişimi','Olgunlaşma / Hasat']:['Toprak Hazırlığı','Çıkış','Yaprak ve Gövde Gelişimi','Çiçeklenme','Ürün Gelişimi','Olgunlaşma / Hasat'];
 let raf=0,previousTime=0,position=0,activeMonth=-1,observer,playing=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');

 function update(){
  const index=Math.min(Math.floor(position),Math.max(0,last)),value=sums[index];
  const growth=last<0?0:Math.min(1,.1+.9*position/(count-1));art.setProgress(growth);
  const label=last<0?'İlk Masraf Bekleniyor':labels[Math.min(labels.length-1,Math.floor(growth*labels.length))];
  if(stage.textContent!==label)stage.textContent=label;
  const points=[];
  for(let i=0;i<=Math.min(Math.floor(position),last);i++)if(sums[i]!==null)points.push(x(i)+','+y(sums[i]));
  const next=index+1,fraction=position-index;
  const between=fraction>0&&next<=last&&value!==null&&sums[next]!==null;
  const currentValue=between?value+(sums[next]-value)*fraction:value;
  if(between)points.push(x(position)+','+y(currentValue));
  path.setAttribute('points',points.join(' '));
  startDot.style.display=sums[0]===null?'none':'';
  if(sums[0]!==null){startDot.setAttribute('cx',x(0));startDot.setAttribute('cy',y(sums[0]));}
  cursor.style.display=currentValue===null?'none':'';
  if(currentValue!==null){cursor.setAttribute('cx',x(position));cursor.setAttribute('cy',y(currentValue));}
  high.textContent=last<0?'Henüz masraf kaydı yok':currentValue===null?'Hesaplama bilgisi eksik':money(value);
  if(activeMonth!==index){
   activeMonth=index;
   detail.textContent=last<0?'İlk masraf girildiğinde grafik bu aydan başlayacak.':monthName(index)+' · '+(value===null?'Hesaplama bilgisi eksik':'Aylık '+money(monthly[index])+' · Biriken '+money(value));
   monthList.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-pressed',String(last>=0&&i===index)));
  }
 }
 function stop(){playing=false;cancelAnimationFrame(raf);}
 const duration=/mısır/.test(crop.toLocaleLowerCase('tr-TR'))?28:20;
 function frame(time){
  if(!playing||!wrap.isConnected){stop();return;}
  const dt=Math.min((time-(previousTime||time))/1000,.1);previousTime=time;
  position=Math.min(last,position+dt*Math.max(1,last)/duration);update();
  if(position>=last){stop();return;}raf=requestAnimationFrame(frame);
 }
 for(let i=0;i<count;i++){
  const button=document.createElement('button');button.type='button';button.textContent=months[(first+i)%12];
  button.setAttribute('aria-label',monthName(i)+' masrafı');button.disabled=i>last;
  if(i===0||(first+i)%12===0){const yearLabel=document.createElement('small');yearLabel.textContent=Math.floor((first+i)/12);button.append(yearLabel);}
  button.className=entered.has(i)?'has-expense':'';
  button.addEventListener('click',()=>{stop();observer?.disconnect();position=i;update();});monthList.append(button);
 }
 const note=document.createElement('small');note.className='crop-calendar-note';
 note.textContent='Çizgi ilk masraf ayından son kayıtlı masraf ayına kadar ilerler.'+(rent>0?' Sezonluk kira başlangıç toplamına dahildir.':'')+' Bitki gelişimi temsilidir.';
 calendar.append(stage,title,chart,monthList,detail,note);wrap.append(art,calendar);update();
 if(reduced.matches){position=Math.max(0,last);update();}
 else if(last>0){observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();previousTime=0;playing=true;raf=requestAnimationFrame(frame);}},{threshold:.25});observer.observe(wrap);}
 const motionChanged=()=>{if(reduced.matches){stop();observer?.disconnect();position=Math.max(0,last);update();}};
 reduced.addEventListener('change',motionChanged);
 wrap.dispose=()=>{stop();observer?.disconnect();reduced.removeEventListener('change',motionChanged);};return wrap;
}
