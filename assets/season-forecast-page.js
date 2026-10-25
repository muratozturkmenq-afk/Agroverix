import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { renderSimulators } from './season-simulator.js?v=international-v1';
const cfg=window.AGROVERIX_SUPABASE||{},container=document.querySelector('#farm-simulators'),message=document.querySelector('#sim-message'),login=document.querySelector('.nav-in > a.btn');
function clearSimulators(){container.querySelectorAll('.crop-timeline-visual').forEach(v=>v.dispose?.());container.replaceChildren();}
function guest(){clearSimulators();message.textContent=__avt("Kendi tarlaların için sezon sonu tahmini yapmak ve tahminlerini saklamak için hesabına giriş yap.");}
if(!cfg.url||!cfg.publishableKey){message.textContent=__avt("Kayıt servisine bağlanılamadı. Sayfayı yenileyerek tekrar dene.");}
else{
 const client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
 let activeSession=null,generation=0,signature=null,channel=null,refreshTimer=0,pendingLoad=null;
 function loginState(session){if(!login)return;login.textContent=session?__avt("Çıkış yap"):__avt("Giriş Yap");login.href='ciftci-bilgi.html?next=sezon-sonu-tahmini.html';login.onclick=session?async event=>{event.preventDefault();await client.auth.signOut();location.assign('sezon-sonu-tahmini.html');}:null;}
 async function load(session,{quiet=false}={}){
  activeSession=session;const request=++generation;loginState(session);
  if(!session){signature=null;guest();return;}
  if(!quiet)message.textContent=__avt("Tarlaların yükleniyor…");
  const [farmsResult,recordsResult]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',session.user.id).order('created_at'),client.from('farmer_operations').select('*').eq('user_id',session.user.id)]);
  if(request!==generation)return;
  if(farmsResult.error||recordsResult.error){message.textContent=__avt("Sezon bilgileri yüklenemedi. Sayfayı yenileyerek tekrar dene.");return;}
  const farms=farmsResult.data||[],records=recordsResult.data||[],nextSignature=JSON.stringify([session.user.id,farms,records]);
  if(quiet&&signature===nextSignature)return;signature=nextSignature;
  renderSimulators(farms,records,client,session.user,()=>{});
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
