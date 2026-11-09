import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { reportData,saveReport,seasonResults,filterReportData } from './reports.js?v=season-export-v1';
import { fmt,appendMetric } from './farm-finance.js?v=international-v1';
import {fillReportSeasons,reportSeasonLabel} from './report-seasons.js?v=season-export-v1';
const $=id=>document.getElementById(id),cfg=window.AGROVERIX_SUPABASE||{};let client,session,scopeData=null;
const money=(n,code=I.currency)=>n===null?'—':I.money(n,code);
function status(text){$('admin-report-status').textContent=text;}
function filtered(data){return filterReportData(data,{year:$('admin-year').value,crop:$('admin-crop').value});}

function render(){if(!scopeData)return;const data=filtered(scopeData),rows=seasonResults(data),summary=$('admin-summary');summary.replaceChildren();appendMetric(summary,__avt("Çiftçi"),data.accounts.length);appendMetric(summary,__avt("Tarla / Sezon Kaydı"),rows.length);const valid=rows.filter(r=>r.cost.total!==null);for(const code of ['TRY','EUR']){const own=valid.filter(r=>(r.owner.currency||'TRY')===code);if(own.length)appendMetric(summary,__avt("Hesaplanabilen Toplam Maliyet"),own.reduce((n,r)=>n+r.cost.total,0),I.currencyLabel(code));}appendMetric(summary,__avt("Hesaplama Bilgisi Eksik Sezon"),rows.length-valid.length);
 const body=$('admin-season-rows');body.replaceChildren();rows.forEach(({farm,owner,year,cost:c})=>{const code=owner.currency||'TRY',tr=document.createElement('tr');[I.currencyLabel(code),owner.full_name||owner.email||owner.user_id,farm.name+' / '+c.season.crop,year,fmt(areaDisplay(c.area)),money(c.total,code),c.perDecare===null?'—':fmt(perAreaDisplay(c.perDecare)),c.expected.costKg===null?'—':fmt(c.expected.costKg),money(c.expected.profit,code),money(c.expected.support,code),money(c.actual.profit,code),money(c.actual.support,code)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);});
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=12;td.textContent=__avt("Bu seçimde tarla / sezon kaydı yok.");tr.append(td);body.append(tr);}}
function fillFilters(data){const crop=$('admin-crop').value;fillReportSeasons($('admin-year'),data,session.user.id,__avt);$('admin-crop').replaceChildren(new Option(__avt("Tüm Bitkiler"),''));[...new Set(data.seasons.map(s=>s.crop))].sort((a,b)=>a.localeCompare(b,'tr')).forEach(c=>$('admin-crop').add(new Option(c,c)));$('admin-crop').value=crop;}
async function load({year=$('admin-year').value,crop=$('admin-crop').value}={}){status(__avt("Yetkili rapor verileri yükleniyor…"));scopeData=await reportData(client,session.user,{administrator:true,userId:$('admin-farmer').value||null});fillFilters(scopeData);render();status(__avt("Güncel veriler yüklendi."));return filterReportData(scopeData,{year,crop});}
async function action(button,run){button.disabled=true;try{await run();}catch(error){status(error.message||__avt("İşlem tamamlanamadı."));}finally{button.disabled=false;}}
$('admin-load').onclick=()=>action($('admin-load'),()=>load());
$('admin-export').onclick=()=>action($('admin-export'),async()=>{const year=$('admin-year').value;status('Tüm üyeler için '+reportSeasonLabel(year)+' raporu hazırlanıyor…');const data=await reportData(client,session.user,{administrator:true});saveReport(data,{year});status('Tüm üyeler için '+reportSeasonLabel(year)+' Excel raporu indirildi.');});
$('admin-scope-export').onclick=()=>action($('admin-scope-export'),async()=>{const year=$('admin-year').value,crop=$('admin-crop').value;const data=await load({year,crop});saveReport(data,{year});status('Seçili üyeler için '+reportSeasonLabel(year)+' Excel raporu indirildi.');});
$('admin-sms-export').onclick=()=>action($('admin-sms-export'),async()=>{const data=await load();saveReport(data,{smsOnly:true});status(__avt("SMS iletişim izni kayıtlı telefon listesi indirildi. SMS gönderilmedi."));});
['admin-year','admin-crop'].forEach(id=>$(id).addEventListener('change',render));$('admin-farmer').addEventListener('change',()=>{scopeData=null;$('admin-summary').replaceChildren();$('admin-season-rows').replaceChildren();status(__avt("Yeni kapsamı görmek için Analizi Yükle düğmesine bas."));});
if(!cfg.url||!cfg.publishableKey){$('admin-access-status').textContent=__avt("Kayıt servisi bağlanamadı.");}
else{
 client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));const {data}=await client.auth.getSession();session=data.session;
 if(!session){const a=document.createElement('a');a.href='ciftci-bilgi.html?next=yonetici.html';a.textContent=__avt("Yönetici hesabınla giriş yap");$('admin-access-status').replaceChildren(a);}
 else{const check=await client.rpc('is_agroverix_admin');if(check.error||!check.data){$('admin-access-status').textContent=__avt("Bu hesabın yönetici yetkisi bulunmuyor.");}
 else{try{
  scopeData=await reportData(client,session.user,{administrator:true});
  const accounts=scopeData.accounts;
  $('admin-account').textContent=session.user.email;$('admin-access-status').hidden=true;$('admin-content').hidden=false;
  const count=(rows,id)=>(rows||[]).filter(r=>r.user_id===id).length;
  accounts.forEach(a=>{const label=(a.member_code?a.member_code+' · ':'')+(a.full_name? a.full_name+' · '+a.email:a.email||a.user_id);$('admin-farmer').add(new Option(label,a.user_id));const tr=document.createElement('tr');[a.member_code||'—',a.member_number??'—',a.full_name||__avt("Profil bilgisi yok"),a.email||'—',a.phone||'—',a.sms_consent?__avt("İzinli"):__avt("İzin yok"),a.phone_confirmed?__avt("Doğrulanmış"):__avt("Doğrulanmamış"),count(scopeData.farms,a.user_id),count(scopeData.operations,a.user_id),count(scopeData.inventory_purchases,a.user_id)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});$('admin-farmer-rows').append(tr);});
  fillFilters(scopeData);render();status('Tüm üyelerin kayıtları yüklendi. Excel raporları yukarıdaki sezon seçimini kullanır.');

 }catch(error){$('admin-access-status').textContent=__avt("Yönetici listesi yüklenemedi. Yeniden giriş yapıp dene.");}}
 }
}
