import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {areaDisplay,perAreaDisplay} from './regional-format.js?v=international-v1';
import {today} from './inventory-data.js?v=international-v1';
import {currentReportYear} from './report-seasons.js?v=season-export-v1';
import {loadAdviceData} from './advice-data.js?v=advice-v1';
import {buildAdviceReport} from './advice-model.js?v=advice-v1';
await regionalReady;
const I=window.AgroIntl,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),cfg=window.AGROVERIX_SUPABASE||{};
const number=n=>Number(n).toLocaleString(I.locale,{maximumFractionDigits:2}),money=n=>Number(n).toLocaleString(I.locale,{minimumFractionDigits:0,maximumFractionDigits:0})+' '+I.t('TL'),percent=n=>number(n)+' %';
const format={number,money,percent,area:n=>number(areaDisplay(n))+' '+I.t('da'),perArea:perAreaDisplay,areaUnit:I.t('da')};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let client=null,session=null,data=null,loading=false,queued=false,generation=0,lastLoad=0,first=true,poll=null;
function say(text,error=false){$('advice-status').textContent=text;$('advice-status').classList.toggle('is-error',error);}
function controls(){const available=Boolean(session&&data);$('advice-year').disabled=!available||loading;$('advice-farm').disabled=!available||loading;$('advice-refresh').disabled=!session||loading;}
function selections(){
 const yearSelect=$('advice-year'),farmSelect=$('advice-farm'),wantedYear=first?params.get('year')||currentReportYear():yearSelect.value||currentReportYear(),wantedFarm=first?params.get('farm')||'':farmSelect.value;
 const years=new Set([currentReportYear()]);data.farms.forEach(f=>(f.farmer_seasons||[]).forEach(s=>years.add(String(s.season_year))));for(const key of ['staff','schedules','sales','plannedPayments','plannedReceipts'])for(const row of data[key])years.add(String(row.season_year));for(const p of data.purchases)if(p.purchase_date)years.add(String(p.season_year||p.purchase_date.slice(0,4)));
 const valid=[...years].filter(y=>/^[1-9][0-9]{3}$/.test(y)).sort((a,b)=>b-a);yearSelect.replaceChildren(...valid.map(y=>new Option(y,y)));yearSelect.value=valid.includes(wantedYear)?wantedYear:currentReportYear();
 const farms=data.farms.filter(f=>(f.farmer_seasons||[]).some(s=>String(s.season_year)===yearSelect.value));farmSelect.replaceChildren(new Option('Tüm Tarlalar',''),...farms.map(f=>new Option(f.name+' · '+f.farmer_seasons.find(s=>String(s.season_year)===yearSelect.value).crop,f.id)));if(farms.some(f=>f.id===wantedFarm))farmSelect.value=wantedFarm;first=false;
}
function value(metric){
 if(metric.value===null||metric.value===undefined||typeof metric.value==='number'&&!Number.isFinite(metric.value))return '—';
 const n=metric.value;switch(metric.type){case 'money':return money(n);case 'percent':return percent(n);case 'perArea':return money(perAreaDisplay(n))+'/'+I.t('da');case 'price':return number(n)+' '+I.t('TL/kg');case 'kg':return number(n)+' kg';default:return number(n);}
}
function list(parent,title,rows){if(!rows.length)return;parent.append(el('h4',title));const ul=el('ul');rows.forEach(text=>ul.append(el('li',text)));parent.append(ul);}
function renderCard(c){
 const host=el('article',undefined,'advice-card'+(c.warning?' is-warning':''));host.append(el('h3',c.title));
 if(c.metrics.length){const dl=el('dl',undefined,'advice-metrics');for(const metric of c.metrics){const cell=el('div');cell.append(el('dt',metric.label),el('dd',value(metric)));dl.append(cell);}host.append(dl);}
 list(host,'Analiz',c.analysis);list(host,'Yorum',c.comments);list(host,'Öneriler',c.suggestions);
 if(c.href){const link=el('a',c.label,'advice-record-link');link.href=c.href;host.append(link);}return host;
}
function render(){
 if(!data||!session)return;const open=new Set([...$('advice-sections').querySelectorAll('details[open]')].map(d=>d.id)),report=buildAdviceReport(data,{year:$('advice-year').value,farmId:$('advice-farm').value,today:today(),format});
 $('advice-sections').replaceChildren();$('advice-content').hidden=false;$('advice-scope').textContent=report.year+' sezonu · '+report.farmCount+' tarla · 7 analiz başlığı';
 for(const section of report.sections){const details=el('details',undefined,'advice-section');details.id='report-'+section.id;const summary=el('summary');summary.append(el('span',section.title),el('small','Analiz, yorum ve öneriler'));details.append(summary);const body=el('div',undefined,'advice-section-body');details.append(body);let populated=false;
  const populate=()=>{if(populated)return;populated=true;body.append(el('p',section.scope,'advice-scope-note'));for(const c of section.cards)body.append(renderCard(c));};
  details.open=open.has(details.id);if(details.open)populate();details.addEventListener('toggle',()=>{if(details.isConnected&&details.open)populate();});$('advice-sections').append(details);
 }
 const url=new URL(location.href);url.searchParams.set('year',$('advice-year').value);if($('advice-farm').value)url.searchParams.set('farm',$('advice-farm').value);else url.searchParams.delete('farm');history.replaceState(null,'',url);
}
async function refresh(){
 if(!session||!client)return;if(loading){queued=true;return;}loading=true;controls();const run=generation,uid=session.user.id;say('Kayıtların analiz ediliyor…');
 try{const result=await loadAdviceData(client,uid);if(run!==generation||session?.user.id!==uid)return;data=result;selections();render();lastLoad=Date.now();say(result.missing.length?'Bazı kayıtlar yüklenemedi. Etkilenen başlıklarda eksik veri uyarısı var; Yenile ile tekrar dene.':'Rapor güncel · '+new Date().toLocaleTimeString(I.locale,{hour:'2-digit',minute:'2-digit'}),!!result.missing.length);}
 catch(error){if(run===generation){data=null;$('advice-content').hidden=true;$('advice-sections').replaceChildren();say('Rapor yüklenemedi. Bağlantını kontrol edip Yenile düğmesiyle tekrar dene.',true);}}
 finally{loading=false;controls();if(queued){queued=false;refresh();}}
}
function account(next){generation++;session=next;data=null;lastLoad=0;first=true;$('advice-content').hidden=true;$('advice-sections').replaceChildren();$('advice-year').replaceChildren(new Option(currentReportYear(),currentReportYear()));$('advice-farm').replaceChildren(new Option('Tüm Tarlalar',''));$('advice-login').hidden=!!next;controls();if(next)refresh();else say('Kendi kayıtlarından rapor oluşturmak için giriş yap.');}
$('advice-year').addEventListener('change',()=>{if(!data)return;$('advice-farm').value='';selections();render();});$('advice-farm').addEventListener('change',render);$('advice-refresh').addEventListener('click',refresh);
const refreshVisible=()=>{if(session&&!document.hidden&&!loading&&Date.now()-lastLoad>30000)refresh();};window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);poll=setInterval(refreshVisible,60000);window.addEventListener('pagehide',()=>clearInterval(poll));window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(poll);poll=setInterval(refreshVisible,60000);refreshVisible();}});
if(cfg.url&&cfg.publishableKey){client=regionalClient||createClient(cfg.url,cfg.publishableKey);const {data:auth,error}=await client.auth.getSession();if(error){account(null);say('Oturum alınamadı. Yeniden giriş yap.',true);}else account(auth.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&session?.user.id!==next?.user.id)setTimeout(()=>account(next),0);});}
else{account(null);say('Kayıt servisine bağlanılamadı. Sayfayı yenileyerek tekrar dene.',true);}
