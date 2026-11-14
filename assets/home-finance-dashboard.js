import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import { bindReportButtons } from './reports.js?v=season-export-v1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance, appendMetric, fmt } from './farm-finance.js?v=international-v1';
import {currentReportYear,reportSeasonYears} from './report-seasons.js?v=season-export-v1';
import {farmsForSeason} from './expense-analysis-model.js?v=home-season-v1';
const seasonSelect=document.querySelector('#home-season');
let cachedFarms=[],cachedRecords=[],seasonOwner=null,initialSeason=new URLSearchParams(location.search).get('season');
function updateSeason(farms,records,owner){
 const sameOwner=seasonOwner===owner,years=reportSeasonYears({farms,operations:records});
 const wanted=sameOwner?seasonSelect.value:seasonOwner===null&&years.includes(initialSeason)?initialSeason:currentReportYear();
 seasonSelect.replaceChildren(...years.map(y=>new Option(y,y)));seasonSelect.value=years.includes(wanted)?wanted:currentReportYear();seasonSelect.disabled=false;seasonOwner=owner;initialSeason=null;
 cachedFarms=farms;cachedRecords=records;renderSelectedSeason();
}
function renderSelectedSeason(){const year=Number(seasonSelect.value);renderHero(farmsForSeason(cachedFarms,year),cachedRecords,year);const u=new URL(location.href);if(String(year)===currentReportYear())u.searchParams.delete('season');else u.searchParams.set('season',year);history.replaceState(null,'',u);}
seasonSelect.addEventListener('change',renderSelectedSeason);
const cfg=window.AGROVERIX_SUPABASE||{},hero=document.querySelector('#hero-farm-cards');
const homeNav=document.querySelector('#nav');
function updateNavSpace(){if(homeNav)document.documentElement.style.setProperty('--home-nav-height',homeNav.offsetHeight+'px');}
updateNavSpace();if(homeNav&&'ResizeObserver' in window)new ResizeObserver(updateNavSpace).observe(homeNav);else window.addEventListener('resize',updateNavSpace);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function notice(copy){const card=el('div','hero-farm-card');card.append(el('b','hero-farm-name',__avt("Tarla Maliyet Özeti")),el('p','hero-farm-note',copy));hero.replaceChildren(card);}
function renderHero(farms,records,year){
 hero.replaceChildren();if(!farms.length){notice(year+" sezonunda kayıtlı tarla yok. Ana ekrandaki Tarla Ekle ile bu sezon için kayıt açabilirsin.");return;}
 farms.forEach(farm=>{const c=farmFinance(farm,records,year),wrap=el('article','hero-farm-card'),card=el('a','hero-farm-open');card.href='tarla-detay.html?rev=personnel-v1&farm='+encodeURIComponent(farm.id)+'&year='+year;card.append(el('b','hero-farm-name hero-farm-title',farm.name+' - '+(c.season.crop||farm.crop)+' ('+fmt(areaDisplay(c.area))+' '+I.t(__avt("da"))+')'),el('small','hero-farm-note',String(year)+__avt(" sezonu")));
 const actual=c.actual.revenue!==null,result=actual?c.actual:c.expected,metrics=el('div','hero-farm-values');
 appendMetric(metrics,__avt("Toplam Maliyet"),c.total,__avt("TL"),'hero-farm-metric');appendMetric(metrics,__avt("Dekara Maliyet"),c.perDecare,__avt("TL/da"),'hero-farm-metric');appendMetric(metrics,__avt("Kg Başına Maliyet"),c.costKg,__avt("TL/kg"),'hero-farm-metric');
 appendMetric(metrics,(actual?__avt("Gerçek"):__avt("Tahmini"))+__avt(" Kâr / Zarar"),result.profit,__avt("TL"),'hero-farm-metric');
 appendMetric(metrics,__avt("Kâr / Zarar Oranı"),result.percent,'%','hero-farm-metric');
 card.append(metrics);card.append(el('small','hero-farm-note',c.missing?__avt("Eski masraf bilgileri eksik; detaydan düzenle."):c.costKg===null?__avt("Kg maliyeti için Sezon Sonu Tahmini sayfasına verim gir."):c.kgBasis));card.append(el('span','hero-farm-action',__avt("Tarla ve Sezon Detayı →")));wrap.append(card);const actualLink=el('a','hero-farm-season-link',__avt("Sezon Sonu Gerçekleşen →"));actualLink.href=card.href+'#season-end';const analysisLink=el('a','hero-farm-season-link','Tarla Masraf Analizi →');analysisLink.href='masraf-analizi.html?farm='+encodeURIComponent(farm.id)+'&year='+year;wrap.append(analysisLink,actualLink);hero.append(wrap);});
}
function guest(){cachedFarms=[];cachedRecords=[];seasonOwner=null;seasonSelect.replaceChildren(new Option(currentReportYear(),currentReportYear()));seasonSelect.disabled=true;notice(__avt("Kendi tarlalarını ve maliyetlerini görmek için giriş yap."));}
if(!cfg.url||!cfg.publishableKey)guest();else{
 const client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));let generation=0,activeSession=null,signature=null,channel=null,refreshTimer=0,pendingLoad=null;
 async function load(session,{quiet=false}={}){activeSession=session;if(!quiet)bindReportButtons(client,session);const request=++generation;if(!session){signature=null;guest();return;}
  const [f,r]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',session.user.id).order('created_at'),client.from('farmer_operations').select('*').eq('user_id',session.user.id)]);
  if(request!==generation)return;if(f.error||r.error){notice(__avt("Tarla özeti yüklenemedi. Sayfayı yenileyerek tekrar dene."));return;}
  const farms=f.data||[],records=r.data||[],nextSignature=JSON.stringify([session.user.id,farms,records]);if(quiet&&nextSignature===signature)return;signature=nextSignature;updateSeason(farms,records,session.user.id);bindReportButtons(client,session,{farms});
  const navLogin=document.querySelector('.nav-in > a.btn');if(navLogin){navLogin.textContent=__avt("Çıkış yap");navLogin.onclick=async e=>{e.preventDefault();await client.auth.signOut();location.assign('index.html');};}
 }
 async function refresh(){if(!activeSession||document.hidden||pendingLoad)return;pendingLoad=load(activeSession,{quiet:true});try{await pendingLoad;}finally{pendingLoad=null;}}
 function subscribe(session){if(channel){client.removeChannel(channel);channel=null;}if(!session)return;channel=client.channel('farm-cost-'+session.user.id);['farmer_operations','farmer_seasons','farmer_farms'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);}));channel.subscribe();}
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});let poll=setInterval(refresh,30000);window.addEventListener('pagehide',()=>{clearInterval(poll);clearTimeout(refreshTimer);if(channel)client.removeChannel(channel);});
 window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(poll);poll=setInterval(refresh,30000);subscribe(activeSession);refresh();updateNavSpace();}});
 const {data}=await client.auth.getSession();await load(data.session);subscribe(data.session);client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>{load(session);subscribe(session);},0);});
}
