import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance, seasonFor, fmt, appendMetric } from './farm-finance.js?v=seasons-v1';
import { renderSimulators } from './season-simulator.js?v=groups-v1';
const cfg=window.AGROVERIX_SUPABASE||{},hero=document.querySelector('#hero-farm-cards'),grid=document.querySelector('#home-crop-grid'),message=document.querySelector('#home-dashboard-message'),login=document.querySelector('#home-dashboard-login');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function notice(copy){const card=el('div','hero-farm-card');card.append(el('b','hero-farm-name','Tarla Maliyet Özeti'),el('p','hero-farm-note',copy));hero.replaceChildren(card);}
function renderHero(farms,records){
 hero.replaceChildren();if(!farms.length){notice('İlk tarlanı eklediğinde maliyetlerin burada görünecek.');return;}
 farms.forEach(farm=>{const c=farmFinance(farm,records),card=el('a','hero-farm-card');card.href='tarla-detay.html?farm='+encodeURIComponent(farm.id);card.append(el('b','hero-farm-name',farm.name),el('small','hero-farm-note',(c.season.crop||farm.crop)+' · '+farm.season_year));
 appendMetric(card,'Toplam Maliyet',c.total,'TL','hero-farm-metric');appendMetric(card,'Dekara Maliyet',c.perDecare,'TL/da','hero-farm-metric');appendMetric(card,'Kg Başına Maliyet',c.costKg,'TL/kg','hero-farm-metric');
 card.append(el('small','hero-farm-note',c.missing?'Eski masraf bilgileri eksik; detaydan düzenle.':c.costKg===null?'Kg maliyeti için simülatöre tahmini verim gir.':c.kgBasis));hero.append(card);});
}
function renderCrops(farms,records){
 grid.replaceChildren();const groups=new Map();farms.forEach(f=>{const crop=seasonFor(f)?.crop||f.crop,key=crop.toLocaleLowerCase('tr-TR');if(!groups.has(key))groups.set(key,{crop,farms:[]});groups.get(key).farms.push(f);});
 groups.forEach(group=>{
  const wrap=el('div','farmer-crop-wrap'),button=el('button','farmer-crop-card');button.type='button';button.setAttribute('aria-expanded','false');const top=el('span','farmer-crop-top');top.append(el('b','farmer-crop-name',group.crop),el('span','farmer-crop-arrow','＋'));
  const finance=group.farms.map(f=>farmFinance(f,records)),complete=finance.every(c=>c.total!==null),total=complete?finance.reduce((n,c)=>n+c.total,0):null,area=finance.reduce((n,c)=>n+c.area,0),metrics=el('span','farmer-crop-metrics');
  appendMetric(metrics,'Toplam Maliyet',total,'TL','farmer-crop-metric');appendMetric(metrics,'Dekara Maliyet',total!==null?total/area:null,'TL/da','farmer-crop-metric');appendMetric(metrics,'Toplam Alan',area,'da','farmer-crop-metric');
  const actual=finance.every(c=>c.actual.revenue!==null),results=finance.map(c=>actual?c.actual:c.expected),allRevenue=results.every(r=>r.revenue!==null),revenue=allRevenue?results.reduce((n,r)=>n+r.revenue,0):null,profit=revenue!==null&&total!==null?revenue-total:null,kg=results.every(r=>r.kg!==null)?results.reduce((n,r)=>n+r.kg,0):null;
  appendMetric(metrics,(actual?'Gerçek':'Tahmini')+' Kg Maliyeti',total!==null&&kg>0?total/kg:null,'TL/kg','farmer-crop-metric');appendMetric(metrics,(actual?'Gerçek':'Tahmini')+' Kâr / Zarar',profit,'TL','farmer-crop-metric');appendMetric(metrics,'Maliyete Göre Kâr / Zarar',profit!==null&&total>0?profit/total*100:null,'%','farmer-crop-metric');
  button.append(top,metrics);const list=el('div','farmer-crop-farms');list.hidden=true;
  group.farms.forEach(f=>{const c=farmFinance(f,records),a=el('a','farmer-farm-card'),info=el('span','farmer-farm-info'),numbers=el('span','farmer-farm-cost');a.href='tarla-detay.html?farm='+encodeURIComponent(f.id);info.append(el('b','',f.name),el('small','',f.season_year+' · '+fmt(c.area)+' da'));numbers.append(el('b','',c.total===null?'—':fmt(c.total)+' TL'),el('small','',c.perDecare===null?'Hesaplama bilgisi eksik':fmt(c.perDecare)+' TL/da'));a.append(info,numbers,el('span','farmer-farm-arrow','→'));list.append(a);});
  button.addEventListener('click',()=>{list.hidden=!list.hidden;button.setAttribute('aria-expanded',String(!list.hidden));button.querySelector('.farmer-crop-arrow').textContent=list.hidden?'＋':'−';});wrap.append(button,list);grid.append(wrap);
 });
}
function guest(){notice('Kendi tarlalarını ve maliyetlerini görmek için giriş yap.');grid.replaceChildren();login.hidden=false;message.textContent='Özetler sadece kendi hesabına giriş yaptığında görünür.';document.querySelector('#farm-simulators').replaceChildren();document.querySelector('#sim-message').textContent='Kişisel sezon simülatörünü kullanmak için giriş yap.';}
if(!cfg.url||!cfg.publishableKey)guest();else{
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});let generation=0;
 async function load(session){const request=++generation;if(!session){guest();return;}
  const [f,r]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',session.user.id).order('created_at'),client.from('farmer_operations').select('*').eq('user_id',session.user.id)]);
  if(request!==generation)return;if(f.error||r.error){notice('Tarla özeti yüklenemedi. Sayfayı yenileyerek tekrar dene.');message.textContent='Kayıtlar yüklenemedi.';document.querySelector('#sim-message').textContent='Sezon bilgileri yüklenemedi.';return;}
  const farms=f.data||[],records=r.data||[];login.hidden=true;message.textContent='Tarla kartından maliyet detaylarını açabilir, sezon yılını seçerek eski kayıtlarını görebilirsin.';renderHero(farms,records);renderCrops(farms,records);renderSimulators(farms,records,client,session.user,()=>{renderHero(farms,records);renderCrops(farms,records);});
  const navLogin=document.querySelector('.nav-in > a.btn');if(navLogin){navLogin.textContent='Çıkış yap';navLogin.onclick=async e=>{e.preventDefault();await client.auth.signOut();location.assign('index.html');};}
 }
 const {data}=await client.auth.getSession();await load(data.session);client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>load(session),0);});
}
