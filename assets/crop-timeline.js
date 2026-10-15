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
 const monthly=Array(12).fill(0);let firstMissing=12;
 records.forEach(r=>{const date=String(r.operation_date||'');if(!date.startsWith(year+'-'))return;const m=Number(date.slice(5,7))-1;if(m<0||m>11)return;const per=costPerDecare(r,area);if(per===null){firstMissing=Math.min(firstMissing,m);return;}monthly[m]+=per*Number(area);});
 const now=new Date(),currentYear=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Istanbul',year:'numeric'}).format(now)),currentMonth=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Istanbul',month:'numeric'}).format(now))-1;
 const lastRecord=Math.max(-1,...records.filter(r=>String(r.operation_date||'').startsWith(year+'-')).map(r=>Number(r.operation_date.slice(5,7))-1));
 const lastMonth=Number(year)<currentYear?11:Number(year)===currentYear?Math.max(currentMonth,lastRecord):lastRecord;
 let total=Number(rent)||0;const sums=monthly.map((v,i)=>{total+=v;return i<firstMissing&&i<=lastMonth?total:null;});
 const known=sums.filter(v=>v!==null),max=Math.max(1,...known),x=i=>12+i*336/11,y=v=>98-v/max*76;
 const points=sums.map((v,i)=>v===null?null:x(i)+','+y(v)).filter(Boolean);
 if(points.length){const path=document.createElementNS(ns,'polyline');path.setAttribute('points',points.join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#678947');path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');chart.append(path);}
 const high=document.createElementNS(ns,'text');high.setAttribute('x','12');high.setAttribute('y','13');high.textContent=known.length?money(known.at(-1)):'Henüz masraf kaydı yok';chart.append(high);
 const cursor=document.createElementNS(ns,'circle');cursor.setAttribute('r','4');cursor.setAttribute('fill','#c38c1b');cursor.hidden=true;chart.append(cursor);
 chartTitle.textContent=year+' sezonunda aylık biriken kayıtlı masraflar. '+months.map((m,i)=>m+': '+(sums[i]===null?'bilgi yok':money(sums[i]))).join('; ');
 const tree=/zeytin|meyve|elma|badem|fıstık|ceviz|portakal|limon|kiraz|kayısı|üzüm/.test(crop.toLocaleLowerCase('tr-TR'));
 const labels=tree?['Dinlenme / Budama','İlk Gelişim','Çiçeklenme','Meyve Gelişimi','Olgunlaşma / Hasat']:['Toprak Hazırlığı','Çıkış','Yaprak ve Gövde Gelişimi','Çiçeklenme','Ürün Gelişimi','Olgunlaşma / Hasat'];
 let raf=0,last=0,progress=0,observer,playing=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function showMonth(i){detail.textContent=months[i]+' · '+(sums[i]===null?(i>=firstMissing?'Hesaplama bilgisi eksik':'Henüz kayıtlı dönem değil'):'Aylık '+money(monthly[i])+' · Biriken '+money(sums[i]));cursor.style.display=sums[i]===null?'none':'';if(sums[i]!==null){cursor.setAttribute('cx',x(i));cursor.setAttribute('cy',y(sums[i]));}monthList.querySelectorAll('button').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));}
 function update(){art.setProgress(progress);const label=labels[Math.min(labels.length-1,Math.floor(progress*labels.length))];if(stage.textContent!==label)stage.textContent=label;}
 function stop(){playing=false;cancelAnimationFrame(raf);}
 const duration=/mısır/.test(crop.toLocaleLowerCase('tr-TR'))?28:20;
 function frame(t){if(!playing||!wrap.isConnected){stop();return;}const dt=Math.min((t-(last||t))/1000,.1);last=t;progress=Math.min(1,progress+dt/duration);update();if(progress>=1){stop();return;}raf=requestAnimationFrame(frame);}
 for(let i=0;i<12;i++){const b=document.createElement('button');b.type='button';b.textContent=months[i];b.setAttribute('aria-label',months[i]+' '+year+' masrafı');b.className=monthly[i]>0?'has-expense':'';b.addEventListener('click',()=>{stop();progress=i/11;update();showMonth(i);});monthList.append(b);}
 const note=document.createElement('small');note.textContent='Çizgi kayıtlı masrafları gösterir.'+(rent>0?' Sezonluk kira başlangıç toplamına dahildir.':'')+' Bitki gelişimi temsilidir.';note.className='crop-calendar-note';
 calendar.append(stage,title,chart,monthList,detail,note);wrap.append(art,calendar);showMonth(Math.max(0,lastMonth));
 if(reduced.matches){progress=1;update();}else{update();observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();playing=true;raf=requestAnimationFrame(frame);}},{threshold:.25});observer.observe(wrap);}
 const motionChanged=()=>{if(reduced.matches){stop();progress=1;update();}};reduced.addEventListener('change',motionChanged);
 wrap.dispose=()=>{stop();observer?.disconnect();reduced.removeEventListener('change',motionChanged);};return wrap;
}
