import { bindReportButtons } from './reports.js?v=support-simple-v1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance, seasonFor, fmt, appendMetric } from './farm-finance.js?v=support-simple-v1';
const cfg=window.AGROVERIX_SUPABASE||{},hero=document.querySelector('#hero-farm-cards'),grid=document.querySelector('#home-crop-grid'),message=document.querySelector('#home-dashboard-message');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function notice(copy){const card=el('div','hero-farm-card');card.append(el('b','hero-farm-name','Tarla Maliyet Özeti'),el('p','hero-farm-note',copy));hero.replaceChildren(card);}
function renderHero(farms,records){
 hero.replaceChildren();if(!farms.length){notice('İlk tarlanı eklediğinde maliyetlerin burada görünecek.');return;}
 farms.forEach(farm=>{const c=farmFinance(farm,records),wrap=el('article','hero-farm-card'),card=el('a','hero-farm-open');card.href='tarla-detay.html?farm='+encodeURIComponent(farm.id);card.append(el('b','hero-farm-name',farm.name),el('strong','hero-farm-crop',c.season.crop||farm.crop),el('small','hero-farm-note',String(farm.season_year)+' sezonu'));
 appendMetric(card,'Toplam Maliyet',c.total,'TL','hero-farm-metric');appendMetric(card,'Dekara Maliyet',c.perDecare,'TL/da','hero-farm-metric');appendMetric(card,'Kg Başına Maliyet',c.costKg,'TL/kg','hero-farm-metric');
 card.append(el('small','hero-farm-note',c.missing?'Eski masraf bilgileri eksik; detaydan düzenle.':c.costKg===null?'Kg maliyeti için Sezon Sonu Tahmini sayfasına verim gir.':c.kgBasis));wrap.append(card);hero.append(wrap);});
}
function renderCrops(farms,records){
 grid.replaceChildren();const groups=new Map();farms.forEach(f=>{const crop=seasonFor(f)?.crop||f.crop,key=f.id;if(!groups.has(key))groups.set(key,{crop,farms:[]});groups.get(key).farms.push(f);});
 groups.forEach(group=>{
  const wrap=el('div','farmer-crop-wrap'),button=el('button','farmer-crop-card');button.type='button';button.setAttribute('aria-expanded','false');const top=el('span','farmer-crop-top');top.append(el('b','farmer-crop-name',group.farms[0].name+' - '+group.crop),el('span','farmer-crop-arrow','＋'));
  const finance=group.farms.map(f=>farmFinance(f,records)),complete=finance.every(c=>c.total!==null),total=complete?finance.reduce((n,c)=>n+c.total,0):null,area=finance.reduce((n,c)=>n+c.area,0),metrics=el('span','farmer-crop-metrics');
  appendMetric(metrics,'Toplam Maliyet',total,'TL','farmer-crop-metric');appendMetric(metrics,'Dekara Maliyet',total!==null?total/area:null,'TL/da','farmer-crop-metric');appendMetric(metrics,'Toplam Alan',area,'da','farmer-crop-metric');
  const actual=finance.every(c=>c.actual.revenue!==null),results=finance.map(c=>actual?c.actual:c.expected),allRevenue=results.every(r=>r.revenue!==null),revenue=allRevenue?results.reduce((n,r)=>n+r.revenue,0):null,profit=revenue!==null&&total!==null?revenue+results.reduce((n,r)=>n+r.support,0)-total:null,kg=results.every(r=>r.kg!==null)?results.reduce((n,r)=>n+r.kg,0):null;
  appendMetric(metrics,(actual?'Gerçek':'Tahmini')+' Kg Maliyeti',total!==null&&kg>0?total/kg:null,'TL/kg','farmer-crop-metric');appendMetric(metrics,(actual?'Gerçek':'Tahmini')+' Kâr / Zarar',profit,'TL','farmer-crop-metric');appendMetric(metrics,'Kâr / Zarar Oranı',profit!==null&&total>0?profit/total*100:null,'%','farmer-crop-metric');
  const support=results.reduce((n,r)=>n+r.support,0);
  appendMetric(metrics,(actual?'Gerçekleşen':'Tahmini')+' Destekleme',support,'TL','farmer-crop-metric');
  button.append(top,metrics);const list=el('div','farmer-crop-farms');list.hidden=true;
  group.farms.forEach(f=>{const c=farmFinance(f,records),a=el('a','farmer-farm-card'),info=el('span','farmer-farm-info'),numbers=el('span','farmer-farm-cost');a.href='tarla-detay.html?farm='+encodeURIComponent(f.id);info.append(el('b','',f.name+' - '+c.season.crop),el('small','',f.season_year+' · '+fmt(c.area)+' da'));numbers.append(el('b','',c.total===null?'—':fmt(c.total)+' TL'),el('small','',c.perDecare===null?'Hesaplama bilgisi eksik':fmt(c.perDecare)+' TL/da'));a.append(info,numbers,el('span','farmer-farm-arrow','→'));list.append(a);});
  button.addEventListener('click',()=>{list.hidden=!list.hidden;button.setAttribute('aria-expanded',String(!list.hidden));button.querySelector('.farmer-crop-arrow').textContent=list.hidden?'＋':'−';});wrap.append(button,list);grid.append(wrap);
 });
}
function guest(){notice('Kendi tarlalarını ve maliyetlerini görmek için giriş yap.');grid.replaceChildren();message.textContent='Özetler sadece kendi hesabına giriş yaptığında görünür.';}
if(!cfg.url||!cfg.publishableKey)guest();else{
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});let generation=0,activeSession=null,signature=null,channel=null,refreshTimer=0,pendingLoad=null;
 async function load(session,{quiet=false}={}){activeSession=session;if(!quiet)bindReportButtons(client,session);const request=++generation;if(!session){signature=null;guest();return;}
  const [f,r]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',session.user.id).order('created_at'),client.from('farmer_operations').select('*').eq('user_id',session.user.id)]);
  if(request!==generation)return;if(f.error||r.error){notice('Tarla özeti yüklenemedi. Sayfayı yenileyerek tekrar dene.');message.textContent='Kayıtlar yüklenemedi.';return;}
  const farms=f.data||[],records=r.data||[],nextSignature=JSON.stringify([session.user.id,farms,records]);if(quiet&&nextSignature===signature)return;signature=nextSignature;message.textContent='Tarla kartından maliyet detaylarını açabilir, sezon yılını seçerek eski kayıtlarını görebilirsin.';renderHero(farms,records);renderCrops(farms,records);bindReportButtons(client,session);
  const navLogin=document.querySelector('.nav-in > a.btn');if(navLogin){navLogin.textContent='Çıkış yap';navLogin.onclick=async e=>{e.preventDefault();await client.auth.signOut();location.assign('index.html');};}
 }
 async function refresh(){if(!activeSession||document.hidden||pendingLoad)return;pendingLoad=load(activeSession,{quiet:true});try{await pendingLoad;}finally{pendingLoad=null;}}
 function subscribe(session){if(channel){client.removeChannel(channel);channel=null;}if(!session)return;channel=client.channel('farm-cost-'+session.user.id);['farmer_operations','farmer_seasons','farmer_farms'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);}));channel.subscribe();}
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});const poll=setInterval(refresh,30000);window.addEventListener('pagehide',()=>{clearInterval(poll);clearTimeout(refreshTimer);if(channel)client.removeChannel(channel);});
 const {data}=await client.auth.getSession();await load(data.session);subscribe(data.session);client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>{load(session);subscribe(session);},0);});
}
