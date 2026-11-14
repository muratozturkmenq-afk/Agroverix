import {ready as regionalReady,client} from './regional-context.js?v=stable-tr-v1';
import {areaDisplay,perAreaDisplay} from './regional-format.js?v=international-v1';
import {farmFinance,appendMetric,operationLabels} from './farm-finance.js?v=international-v1';
import {expenseAnalysis} from './expense-analysis-model.js?v=home-season-v1';
await regionalReady;
const I=window.AgroIntl,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),farmId=params.get('farm');
const format=v=>Number(v).toLocaleString(I.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
const money=v=>format(v)+' '+I.t('TL'),label=key=>key==='personnel'?'Personel Gideri':operationLabels[key]||'Diğer Uygulama';
const colors=['var(--analysis-gold)','var(--analysis-blue)','var(--analysis-green)','var(--analysis-orange)','var(--analysis-purple)','var(--analysis-teal)','var(--analysis-rose)','var(--analysis-gray)'];
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let farm=null,records=[],session=null,busy=false,channel=null,refreshTimer=null,revision=0;
function status(text){$('analysis-status').textContent=text;}
function pie(model){
 const host=$('analysis-chart');host.replaceChildren();
 if(model.applications<=0){host.append(el('p',model.count?'Pozitif tutarlı uygulama maliyeti yok.':'Bu sezonda henüz uygulama kaydı yok.','analysis-empty'));return;}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),title=document.createElementNS(ns,'title');
 svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('role','img');svg.setAttribute('aria-labelledby','analysis-pie-title');title.id='analysis-pie-title';title.textContent='Uygulama masrafları dağılımı. Tutarlar ve yüzdeler yanındaki tabloda listelenmiştir.';svg.append(title);
 let angle=-Math.PI/2;
 model.entries.forEach((g,i)=>{if(g.amount<=0)return;const end=angle+g.share/100*Math.PI*2;let shape;
  if(g.share>=99.999999){shape=document.createElementNS(ns,'circle');shape.setAttribute('cx','60');shape.setAttribute('cy','60');shape.setAttribute('r','53');}
  else{shape=document.createElementNS(ns,'path');shape.setAttribute('d','M 60 60 L '+(60+53*Math.cos(angle))+' '+(60+53*Math.sin(angle))+' A 53 53 0 '+(g.share>50?1:0)+' 1 '+(60+53*Math.cos(end))+' '+(60+53*Math.sin(end))+' Z');}
  shape.setAttribute('fill',colors[i%colors.length]);shape.setAttribute('stroke','var(--paper,#fffdf6)');shape.setAttribute('stroke-width','0.6');const tip=document.createElementNS(ns,'title');tip.textContent=label(g.key)+': '+money(g.amount)+' · %'+format(g.share);shape.append(tip);svg.append(shape);angle=end;
 });host.append(svg);
}
function render(){
 const year=Number($('analysis-year').value),model=expenseAnalysis(farm,records,year);
 $('analysis-content').hidden=!model;if(!model){status('Bu sezon için tarla kaydı bulunamadı.');return;}
 const finance=farmFinance(farm,records,year);
 $('analysis-title').textContent=farm.name+' - '+model.season.crop+' ('+format(areaDisplay(model.area))+' '+I.t('da')+')';
 $('analysis-home').href='index.html?season='+year+'#ciftci-ozet';
 $('analysis-detail').href='tarla-detay.html?farm='+encodeURIComponent(farm.id)+'&year='+year;$('analysis-detail').hidden=false;
 const metrics=$('analysis-metrics');metrics.replaceChildren();
 appendMetric(metrics,'Hesaplanan Uygulama Gideri',model.applications,I.t('TL'),'finance-metric',format);
 appendMetric(metrics,'Sezonluk Kira',model.rent,I.t('TL'),'finance-metric',format);
 appendMetric(metrics,'Toplam Maliyet',model.total,I.t('TL'),'finance-metric',format);
 appendMetric(metrics,'Dekara Maliyet',finance.perDecare,I.t('TL/da'),'finance-metric',format);
 pie(model);
 $('analysis-chart-caption').textContent=year+' sezonu · '+model.count+' kayıt'+(model.missing?' · '+model.missing+' eksik maliyetli kayıt grafiğe dahil edilmedi.':'');
 const tbody=$('analysis-rows');tbody.replaceChildren();
 model.entries.forEach((g,i)=>{const tr=el('tr'),name=el('th');name.scope='row';const dot=el('span',undefined,'analysis-swatch');dot.style.setProperty('--swatch',colors[i%colors.length]);dot.setAttribute('aria-hidden','true');name.append(dot,document.createTextNode(label(g.key)));tr.append(name,el('td',money(g.amount)),el('td','%'+format(g.share)));tbody.append(tr);});
 if(!model.entries.length){const tr=el('tr'),td=el('td','Bu sezon için hesaplanabilir uygulama gideri yok.');td.colSpan=3;tr.append(td);tbody.append(tr);}
 const insights=$('analysis-insights');insights.replaceChildren();const add=text=>insights.append(el('li',text));
 const top=model.entries.find(g=>g.amount>0);
 if(top)add('En büyük masraf '+label(top.key)+': '+money(top.amount)+'. Hesaplanan uygulama giderinin %'+format(top.share)+' kısmını oluşturuyor.');
 if(model.entries.filter(g=>g.amount>0).length>1){const firstTwo=model.entries.slice(0,2),sum=firstTwo.reduce((n,g)=>n+g.amount,0);add('İlk iki masraf cinsi toplam '+money(sum)+' ile uygulama giderinin %'+format(sum/model.applications*100)+' kısmını oluşturuyor. Alım fiyatı ve kullanılan miktarı incelerken bu iki kalemden başlayabilirsin.');}
 if(model.area>0)add('Hesaplanan uygulama gideri dekar başına '+money(perAreaDisplay(model.applications/model.area))+'/'+I.t('da')+'.'+(model.rent>0?' Sezonluk '+money(model.rent)+' kira, toplam maliyete ayrıca eklenmiştir.':' Bu sezon için kayıtlı kira gideri yok.'));
 if(model.first&&model.last){const date=s=>new Date(s+'T12:00:00').toLocaleDateString(I.locale);add('Hesaplanan kayıtlar '+date(model.first)+' – '+date(model.last)+' tarihleri arasındaki uygulamaları kapsıyor.');}
 if(model.missing)add(model.missing+' kaydın maliyet bilgisi eksik. Grafik yalnızca hesaplanabilen giderleri gösterir; eksikler tamamlanmadan toplam maliyet kesinleştirilemez.');
 if(!model.count)add('Uygulama Girişi sayfasından tarla ve sezon seçerek kullanım kaydettiğinde masraf dağılımı burada oluşur.');
 status(model.missing?'Eksik maliyetli kayıtlar var. Tarla ve Sezon Detayı üzerinden kontrol edebilirsin.':'Kayıtlı verilere göre güncellendi.');
 const u=new URL(location.href);u.searchParams.set('year',year);history.replaceState(null,'',u);
}
async function load(){
 if(busy||!session)return;busy=true;$('analysis-refresh').disabled=true;const request=++revision;
 try{
  const [f,r]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('id',farmId).eq('user_id',session.user.id).maybeSingle(),client.from('farmer_operations').select('*').eq('farm_id',farmId).eq('user_id',session.user.id)]);
  if(request!==revision)return;if(f.error||r.error||!f.data)throw new Error('load');
  const previous=farm?$('analysis-year').value:params.get('year');farm=f.data;records=r.data||[];
  const years=[...new Set((farm.farmer_seasons||[]).map(s=>String(s.season_year)))].sort((a,b)=>b-a);
  $('analysis-year').replaceChildren(...years.map(y=>new Option(y,y)));$('analysis-year').value=years.includes(previous)?previous:String(farm.season_year);if(!$('analysis-year').value&&years.length)$('analysis-year').value=years[0];
  $('analysis-year').disabled=!years.length;render();
 }catch{status(farm?'Güncelleme alınamadı. Aşağıdaki grafik son yüklenen kayıtlara aittir; Yenile ile tekrar dene.':'Tarla bulunamadı veya bilgiler yüklenemedi. Yalnızca kendi tarlalarını görebilirsin.');}
 finally{busy=false;$('analysis-refresh').disabled=false;}
}
$('analysis-year').addEventListener('change',render);$('analysis-refresh').addEventListener('click',load);
window.addEventListener('focus',()=>{if(!document.hidden)load();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
if(!farmId||!client){status('Tarla bağlantısı geçersiz. Ana sayfadaki tarla özetinden Tarla Masraf Analizi bağlantısını aç.');}
else{
 const {data}=await client.auth.getSession();session=data.session;
 if(!session){status('Masraf analizini görmek için hesabına giriş yap.');$('analysis-login').href='ciftci-bilgi.html?next='+encodeURIComponent(location.pathname+location.search);$('analysis-login').hidden=false;}
 else{await load();channel=client.channel('expense-analysis-'+farmId);for(const table of ['farmer_operations','farmer_seasons','farmer_farms'])channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(load,350);});channel.subscribe();}
 client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){revision++;session=null;farm=null;records=[];$('analysis-content').hidden=true;$('analysis-title').textContent='Tarla Masraf Analizi';$('analysis-detail').hidden=true;$('analysis-year').replaceChildren();$('analysis-year').disabled=true;$('analysis-refresh').disabled=true;status('Oturum kapatıldı. Analizi görmek için tekrar giriş yap.');}});
}
window.addEventListener('pagehide',()=>{clearTimeout(refreshTimer);if(channel)client.removeChannel(channel);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
