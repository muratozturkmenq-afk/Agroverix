import {seasonCostChart} from './season-cost-chart.js?v=summary-chart-v1';
import {farmSeasonTotals} from './farm-season-totals.js?v=farm-totals-v1';
import {renderFarmTotals,clearFarmTotals} from './farm-totals-view.js?v=farm-totals-v1';
import {readAll} from './inventory-data.js?v=international-v1';
import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { renderSimulators } from './season-simulator.js?v=farm-totals-v1';
import {currentReportYear,seasonFarms} from './season-scope.js?v=season-scope-v1';
const cfg=window.AGROVERIX_SUPABASE||{},container=document.querySelector('#farm-simulators'),message=document.querySelector('#sim-message'),login=document.querySelector('.nav-in > a.btn');
const totalsRoot=document.querySelector('#forecast-season-totals'),chartHost=document.querySelector('#forecast-cost-chart');
let costChart=null;
function clearCostChart(){costChart?.dispose();costChart=null;chartHost.replaceChildren();}
let totalFarms=[],totalRecords=[],totalYear='',previewOverrides=new Map(),building=false;
function updateTotals(){if(!building)renderFarmTotals(totalsRoot,farmSeasonTotals(totalFarms,totalRecords,totalYear,{forecast:true,overrides:previewOverrides}),{forecast:true,draft:Boolean(container.querySelector('.sim-forecast-form[data-dirty="true"]'))});}
function clearSimulators(){clearCostChart();clearFarmTotals(totalsRoot);totalFarms=[];totalRecords=[];previewOverrides.clear();container.querySelectorAll('.crop-timeline-visual').forEach(v=>v.dispose?.());container.replaceChildren();}
function guest(){clearSimulators();message.textContent=__avt("Kendi tarlaların için sezon sonu tahmini yapmak ve tahminlerini saklamak için hesabına giriş yap.");}
if(!cfg.url||!cfg.publishableKey){message.textContent=__avt("Kayıt servisine bağlanılamadı. Sayfayı yenileyerek tekrar dene.");}
else{
 const client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
 let activeSession=null,generation=0,signature=null,channel=null,refreshTimer=0,pendingLoad=null;
 function loginState(session){if(!login)return;login.textContent=session?__avt("Çıkış yap"):__avt("Giriş Yap");login.href='ciftci-bilgi.html?next=sezon-sonu-tahmini.html';login.onclick=session?async event=>{event.preventDefault();await client.auth.signOut();location.assign('sezon-sonu-tahmini.html');}:null;}
 async function load(session,{quiet=false}={}){
  if(activeSession?.user.id!==session?.user.id){clearSimulators();signature=null;}activeSession=session;const request=++generation;loginState(session);
  if(!session){signature=null;guest();return;}
  if(!quiet)message.textContent=__avt("Tarlaların yükleniyor…");
  let allFarms,allRecords;try{[allFarms,allRecords]=await Promise.all([readAll(client,'farmer_farms',session.user.id,'*,farmer_seasons(*)'),readAll(client,'farmer_operations',session.user.id)]);}
  catch(error){if(request===generation){signature=null;clearSimulators();message.textContent=__avt("Sezon bilgileri yüklenemedi. Sayfayı yenileyerek tekrar dene.");}return;}
  if(request!==generation)return;allFarms.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const year=currentReportYear(),farms=seasonFarms(allFarms,year),records=allRecords.filter(r=>String(r.season_year)===year),nextSignature=JSON.stringify([session.user.id,year,farms,records]);
  if(quiet&&signature===nextSignature)return;signature=nextSignature;
  totalFarms=farms;totalRecords=records;totalYear=year;previewOverrides=new Map();building=true;
  try{renderSimulators(farms,records,client,session.user,updateTotals,(id,values)=>{previewOverrides.set(id,values);updateTotals();});}finally{building=false;}
  updateTotals();clearCostChart();if(farms.length){costChart=seasonCostChart(farms,records,year);chartHost.append(costChart);}
  message.textContent=farms.length?year+' sezonunun ekili tarlaları gösteriliyor.':year+' sezonunda kayıtlı ekili tarla yok.';
 }
 async function refresh(){if(!activeSession||document.hidden||pendingLoad)return;pendingLoad=load(activeSession,{quiet:true});try{await pendingLoad;}finally{pendingLoad=null;}}
 function subscribe(session){if(channel){client.removeChannel(channel);channel=null;}if(!session)return;channel=client.channel('season-forecast-'+session.user.id);['farmer_operations','farmer_seasons','farmer_farms'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);}));channel.subscribe();}
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 let poll=setInterval(refresh,30000);
 window.addEventListener('pagehide',event=>{clearInterval(poll);clearTimeout(refreshTimer);if(channel){client.removeChannel(channel);channel=null;}if(!event.persisted)clearSimulators();});
 window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(poll);poll=setInterval(refresh,30000);subscribe(activeSession);refresh();}});
 const {data}=await client.auth.getSession();await load(data.session);subscribe(data.session);
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>{load(session);subscribe(session);},0);});
}
