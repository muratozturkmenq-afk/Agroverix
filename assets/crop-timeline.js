const months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
export function cropTimeline(art,{crop,year,records=[]}){
 const wrap=document.createElement('div');wrap.className='crop-timeline-visual';
 const calendar=document.createElement('div');calendar.className='crop-calendar';
 const stage=document.createElement('b');stage.className='crop-stage';stage.setAttribute('aria-live','polite');
 const line=document.createElement('div');line.className='crop-time-controls';
 const play=document.createElement('button');play.type='button';play.className='crop-play';
 const range=document.createElement('input');range.type='range';range.min='0';range.step='.01';range.value='0';range.setAttribute('aria-label',crop+' bitkisinin aylık gelişim zamanı');
 const winter=/buğday|arpa|çavdar|yulaf/.test(crop.toLocaleLowerCase('tr-TR')),tree=/zeytin|meyve|elma|badem|fıstık|ceviz|portakal|limon|kiraz|kayısı|üzüm/.test(crop.toLocaleLowerCase('tr-TR'));
 const first=winter?9:tree?0:3,count=winter?10:tree?12:7;range.max=String(count-1);
 const monthList=document.createElement('div');monthList.className='crop-months';
 const labels=tree?['Dinlenme / Budama','İlk Gelişim','Çiçeklenme','Meyve Gelişimi','Olgunlaşma / Hasat']:['Toprak Hazırlığı','Çıkış','Yaprak ve Gövde Gelişimi','Çiçeklenme','Ürün Gelişimi','Olgunlaşma / Hasat'];
 let playing=false,raf=0,last=0,position=0,observer;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function update(){const progress=Number(range.value)/(count-1),index=Math.round(Number(range.value));art.setProgress(progress);const label=labels[Math.min(labels.length-1,Math.floor(progress*labels.length))];if(stage.textContent!==label)stage.textContent=label;monthList.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',i===index?'date':'false'));}
 function stop(){playing=false;cancelAnimationFrame(raf);play.textContent='▶';play.setAttribute('aria-label','Bitki gelişimini oynat');}
 function frame(t){if(!playing||!wrap.isConnected){stop();return;}const dt=Math.min((t-(last||t))/1000,.1);last=t;position=Math.min(count-1,position+dt*(count-1)/20);range.value=String(position);update();if(position>=count-1){stop();return;}raf=requestAnimationFrame(frame);}
 function start(){if(Number(range.value)>=count-1)range.value='0';position=Number(range.value);playing=true;last=0;play.textContent='Ⅱ';play.setAttribute('aria-label','Bitki gelişimini duraklat');raf=requestAnimationFrame(frame);}
 for(let i=0;i<count;i++){const date=new Date(Number(year)-(winter?1:0),first+i,1),m=date.getMonth(),b=document.createElement('button'),n=records.filter(r=>r.operation_date?.startsWith(date.getFullYear()+'-'+String(m+1).padStart(2,'0'))).length;b.type='button';b.textContent=months[m];b.title=date.getFullYear()+' '+months[m]+' · '+n+' kayıtlı masraf';b.setAttribute('aria-label',b.title);b.className=n?'has-expense':'';b.addEventListener('click',()=>{stop();range.value=i;update();});monthList.append(b);}
 range.addEventListener('input',()=>{stop();update();});play.addEventListener('click',()=>playing?stop():start());
 const note=document.createElement('small');note.textContent='Temsili gelişim takvimi. Hesaplar tüm kayıtlı masrafları kullanır.';note.className='crop-calendar-note';
 line.append(play,range);calendar.append(stage,line,monthList,note);wrap.append(art,calendar);
 stop();if(reduced.matches){range.value=String(count-1);update();}else{update();observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();start();}},{threshold:.25});observer.observe(wrap);}
 const motionChanged=()=>{if(reduced.matches){stop();range.value=String(count-1);update();}};reduced.addEventListener('change',motionChanged);
 wrap.dispose=()=>{stop();observer?.disconnect();reduced.removeEventListener('change',motionChanged);};return wrap;
}
