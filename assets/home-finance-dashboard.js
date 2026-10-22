import { bindReportButtons } from './reports.js?v=support-simple-v1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance, appendMetric } from './farm-finance.js?v=support-simple-v1';
const cfg=window.AGROVERIX_SUPABASE||{},hero=document.querySelector('#hero-farm-cards');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function notice(copy){const card=el('div','hero-farm-card');card.append(el('b','hero-farm-name','Tarla Maliyet Özeti'),el('p','hero-farm-note',copy));hero.replaceChildren(card);}
function renderHero(farms,records){
 hero.replaceChildren();if(!farms.length){notice('İlk tarlanı eklediğinde maliyetlerin burada görünecek.');return;}
 farms.forEach(farm=>{const c=farmFinance(farm,records),wrap=el('article','hero-farm-card'),card=el('a','hero-farm-open');card.href='tarla-detay.html?farm='+encodeURIComponent(farm.id);card.append(el('b','hero-farm-name',farm.name),el('strong','hero-farm-crop',c.season.crop||farm.crop),el('small','hero-farm-note',String(farm.season_year)+' sezonu'));
 const actual=c.actual.revenue!==null,result=actual?c.actual:c.expected;
 appendMetric(card,'Toplam Maliyet',c.total,'TL','hero-farm-metric');appendMetric(card,'Dekara Maliyet',c.perDecare,'TL/da','hero-farm-metric');appendMetric(card,'Kg Başına Maliyet',c.costKg,'TL/kg','hero-farm-metric');
 appendMetric(card,'Toplam Alan',c.area,'da','hero-farm-metric');
 appendMetric(card,(actual?'Gerçek':'Tahmini')+' Kâr / Zarar',result.profit,'TL','hero-farm-metric');
 appendMetric(card,'Kâr / Zarar Oranı',result.percent,'%','hero-farm-metric');
 appendMetric(card,(actual?'Gerçekleşen':'Tahmini')+' Destekleme',result.support,'TL','hero-farm-metric');
 card.append(el('small','hero-farm-note',c.missing?'Eski masraf bilgileri eksik; detaydan düzenle.':c.costKg===null?'Kg maliyeti için Sezon Sonu Tahmini sayfasına verim gir.':c.kgBasis));card.append(el('span','hero-farm-action','Tarla ve Sezon Detayı →'));wrap.append(card);hero.append(wrap);});
}
function guest(){notice('Kendi tarlalarını ve maliyetlerini görmek için giriş yap.');}
if(!cfg.url||!cfg.publishableKey)guest();else{
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});let generation=0,activeSession=null,signature=null,channel=null,refreshTimer=0,pendingLoad=null;
 async function load(session,{quiet=false}={}){activeSession=session;if(!quiet)bindReportButtons(client,session);const request=++generation;if(!session){signature=null;guest();return;}
  const [f,r]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',session.user.id).order('created_at'),client.from('farmer_operations').select('*').eq('user_id',session.user.id)]);
  if(request!==generation)return;if(f.error||r.error){notice('Tarla özeti yüklenemedi. Sayfayı yenileyerek tekrar dene.');return;}
  const farms=f.data||[],records=r.data||[],nextSignature=JSON.stringify([session.user.id,farms,records]);if(quiet&&nextSignature===signature)return;signature=nextSignature;renderHero(farms,records);bindReportButtons(client,session);
  const navLogin=document.querySelector('.nav-in > a.btn');if(navLogin){navLogin.textContent='Çıkış yap';navLogin.onclick=async e=>{e.preventDefault();await client.auth.signOut();location.assign('index.html');};}
 }
 async function refresh(){if(!activeSession||document.hidden||pendingLoad)return;pendingLoad=load(activeSession,{quiet:true});try{await pendingLoad;}finally{pendingLoad=null;}}
 function subscribe(session){if(channel){client.removeChannel(channel);channel=null;}if(!session)return;channel=client.channel('farm-cost-'+session.user.id);['farmer_operations','farmer_seasons','farmer_farms'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);}));channel.subscribe();}
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});const poll=setInterval(refresh,30000);window.addEventListener('pagehide',()=>{clearInterval(poll);clearTimeout(refreshTimer);if(channel)client.removeChannel(channel);});
 const {data}=await client.auth.getSession();await load(data.session);subscribe(data.session);client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>{load(session);subscribe(session);},0);});
}
