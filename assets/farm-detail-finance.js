import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=international-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=international-v1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance,seasonFor,fmt,appendMetric,appendSupportMetrics,operationLabels,serviceTypes } from './farm-finance.js?v=international-v1';
import { costPerDecare } from './operation-cost.js?v=international-v1';
import { locationLabels } from './location-labels.js?v=international-v1';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),farmId=params.get('farm'),cfg=window.AGROVERIX_SUPABASE||{};
let farm,records=[],admin,editing=false,client=null,session=null,savingActual=false,actualFormYear=null;
['actual-yield','actual-price','actual-support'].forEach(id=>bindNumberInput($(id),{maximumFractionDigits:id==='actual-yield'?6:2}));
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function report(parent,result){appendMetric(parent,__avt("Kg Başına Maliyet"),result.costKg,__avt("TL/kg"));appendMetric(parent,__avt("Toplam Ürün"),result.kg,'kg');appendMetric(parent,__avt("Satış Geliri"),result.revenue,__avt("TL"));appendMetric(parent,__avt("Toplam Kâr / Zarar"),result.profit,__avt("TL"));appendMetric(parent,__avt("Kâr / Zarar Oranı"),result.percent,'%');appendMetric(parent,__avt("Kg Başına Kâr / Zarar"),result.unitProfit,__avt("TL/kg"));appendSupportMetrics(parent,result);}
function render(){
 const year=Number($('farm-season-select').value),season=seasonFor(farm,year),c=farmFinance(farm,records,year);
 $('farm-title').textContent=farm.name;$('farm-crop').textContent=season?.crop||farm.crop;$('farm-area').textContent=fmt(areaDisplay(c.area));$('farm-location').textContent=locationLabels(farm,admin);
 $('farm-per-decare').textContent=c.perDecare===null?'—':fmt(perAreaDisplay(c.perDecare));$('farm-total').textContent=c.total===null?'—':fmt(c.total);
 $('farm-cost-note').textContent=c.missing?c.missing+__avt(" eski masraf kaydında hesaplama bilgisi eksik. Kayıtları Düzenle ile düzelt."):year+__avt(" sezonu · ")+c.rows.length+__avt(" masraf · ")+(season?.tenure==='rented'?__avt("Kiralık · ")+fmt(c.rent)+__avt(" TL sezonluk kira dahil."):__avt("Mülk · Kira yok."));
 $('edit-records-toggle').disabled=false;$('edit-records-toggle').textContent=editing?__avt("Düzenlemeyi Kapat"):__avt("Kayıtları Düzenle");$('edit-farm').hidden=!editing;$('edit-farm').href='tarla-bilgileri.html?edit='+farm.id+'&year='+year;
 $('add-operation').href='uretim-kayitlari.html?farm='+farm.id+'&year='+year;
 $('new-season').href='tarla-bilgileri.html?edit='+farm.id+'&year='+(Math.max(...farm.farmer_seasons.map(s=>s.season_year))+1);
 if(actualFormYear!==year){['yield','price','support'].forEach(key=>setNumberInputValue($('actual-'+key),key==='yield'?perAreaDisplay(c.actualYield):key==='price'?c.actualPrice:season?.actual_support));actualFormYear=year;$('actual-save-status').textContent='';}
 const draft={};['yield','price','support'].forEach(key=>draft['actual_'+key]=key==='yield'?perAreaStored(parseNumberInput($('actual-'+key).value)):parseNumberInput($('actual-'+key).value));
 const actual=$('actual-report'),expected=$('expected-report');actual.replaceChildren();expected.replaceChildren();report(actual,farmFinance(farm,records,year,draft).actual);report(expected,c.expected);
 $('actual-report-note').textContent=c.actualFromSales?fmt(season.harvest_sale_count)+__avt(" satış / araç kaydından ")+fmt(c.actual.kg)+__avt(" kg hasat ve ")+fmt(c.actualPrice)+__avt(" TL/kg ağırlıklı ortalama fiyat hesaplandı. Verim ve satış değişikliklerini Hasat & Satış sayfasından yap."):season?.actual_yield==null?__avt("Hasattan sonra bu tarla ve seçili sezon için gerçek verim, satış fiyatı ve gerçekleşen desteklemeyi gir. Sıfır değer de kaydedilebilir."):__avt("Gerçek verim: ")+fmt(perAreaDisplay(season.actual_yield))+__avt(" kg/da · Gerçek satış fiyatı: ")+(season.actual_price==null?'—':fmt(season.actual_price))+__avt(" TL/kg");
 $('actual-season-fields').disabled=!season||!session||savingActual;
 $('actual-yield').disabled=c.actualFromSales;$('actual-price').disabled=c.actualFromSales;
 $('expected-report-note').textContent=season?.expected_yield==null?__avt("Sezon Sonu Tahmini sayfasına bu tarla için verim veya fiyat gir."):__avt("Tahmini verim: ")+fmt(perAreaDisplay(season.expected_yield))+__avt(" kg/da · Tahmini satış fiyatı: ")+(season.expected_price==null?'—':fmt(season.expected_price))+__avt(" TL/kg. Sonuçlar kayıtlı masraflara göre değişir.");
 $('harvest-sales-link').href='hasat-satis.html?farm='+encodeURIComponent(farm.id)+'&year='+year;
 const list=$('farm-records');list.replaceChildren();$('farm-empty').hidden=c.rows.length>0;
 if(c.rent>0){const row=element('article','','farm-detail-record');row.append(element('b',__avt("Sezonluk Kira")),element('b',fmt(c.rent)+__avt(" TL")));list.append(row);}
 c.rows.forEach(r=>{
  const row=element('article','','farm-detail-record'),info=element('div',''),cost=element('div','','farm-detail-record-cost');info.append(element('b',operationLabels[r.operation_type]||r.operation_type));
  const parts=[new Date(r.operation_date+'T12:00:00').toLocaleDateString(I.locale)];
  if(!serviceTypes.has(r.operation_type)||r.inventory_item_id){if(r.product)parts.push(r.product);if(r.quantity)parts.push((r.cost_basis==='field_total'?__avt("Toplam kullanım: "):__avt("Dekara kullanım: "))+fmt(r.cost_basis==='field_total'?r.quantity:perAreaDisplay(r.quantity))+' '+I.t(r.quantity_unit)+(r.inventory_package_quantity?' × '+fmt(r.inventory_package_quantity)+' '+I.t(r.inventory_package_unit):''));}
  if(r.notes)parts.push(r.notes);info.append(element('small',parts.join(' · ')));const per=costPerDecare(r,c.area);cost.append(element('b',per===null?__avt("Hesaplanamadı"):fmt(per*c.area)+__avt(" TL")),element('small',per===null?__avt("Maliyet bilgisini düzenle"):fmt(perAreaDisplay(per))+__avt(" TL/da")));
  const edit=element('a',__avt("Bu Kaydı Düzenle"),'auth-back farm-detail-record-edit');edit.href='uretim-kayitlari.html?farm='+farmId+'&edit='+r.id;edit.hidden=!editing;row.append(info,cost,edit);list.append(row);
 });
 const u=new URL(location.href);u.searchParams.set('year',year);history.replaceState(null,'',u);
}

function actualMessage(text,error=false){$('actual-save-status').textContent=text;$('actual-save-status').classList.toggle('is-error',error);}
$('actual-season-form').addEventListener('input',()=>{
 if(!farm||savingActual)return;
 const overrides={};['yield','price','support'].forEach(key=>overrides['actual_'+key]=key==='yield'?perAreaStored(parseNumberInput($('actual-'+key).value)):parseNumberInput($('actual-'+key).value));
 const c=farmFinance(farm,records,Number($('farm-season-select').value),overrides);
 $('actual-report').replaceChildren();report($('actual-report'),c.actual);
 actualMessage(__avt("Hesaplama güncellendi. Bilgileri hesabında saklamak için kaydet."));
});
$('actual-season-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!farm||!session||savingActual)return;
 const year=Number($('farm-season-select').value),season=seasonFor(farm,year);
 if(!season){actualMessage(__avt("Kaydedilecek sezon bulunamadı. Sayfayı yenile."),true);return;}
 const values={};['yield','price','support'].forEach(key=>values['actual_'+key]=key==='yield'?perAreaStored(parseNumberInput($('actual-'+key).value)):parseNumberInput($('actual-'+key).value));
 if(Object.values(values).some(v=>v!==null&&(!Number.isFinite(v)||v<0))){actualMessage(__avt("Verim, fiyat ve destekleme sıfır veya daha büyük olmalı."),true);return;}
 if(!Number(season.harvest_sale_count||0)&&(values.actual_yield===null)!==(values.actual_price===null)){actualMessage(__avt("Gerçek verim ve satış fiyatını birlikte gir veya ikisini de boş bırak."),true);return;}
 if(Number(season.harvest_sale_count||0)>0){delete values.actual_yield;delete values.actual_price;}
 savingActual=true;$('actual-season-fields').disabled=true;$('farm-season-select').disabled=true;actualMessage(__avt("Gerçekleşen bilgiler kaydediliyor…"));
 try{
  const {data,error}=await client.from('farmer_seasons').update({...values,updated_at:new Date().toISOString()}).eq('farm_id',farm.id).eq('season_year',year).eq('user_id',session.user.id).select('actual_yield,actual_price,actual_support,updated_at').single();
  if(error)throw error;
  Object.assign(season,data);actualFormYear=null;render();actualMessage(__avt("Sezon Sonu Gerçekleşen bilgileri kaydedildi. Tarla özeti ve Excel raporun bu değerlerle güncellenir."));
 }catch(error){actualMessage(__avt("Bilgiler kaydedilemedi. Girdiklerin burada duruyor; tekrar dene."),true);}
 finally{savingActual=false;$('actual-season-fields').disabled=false;const fromSales=Number(season.harvest_sale_count||0)>0;$('actual-yield').disabled=fromSales;$('actual-price').disabled=fromSales;$('farm-season-select').disabled=false;}
});

$('edit-records-toggle').addEventListener('click',()=>{editing=!editing;$('edit-records-toggle').setAttribute('aria-pressed',String(editing));render();});$('farm-season-select').addEventListener('change',render);
if(!farmId||!cfg.url||!cfg.publishableKey){$('farm-title').textContent=__avt("Tarla bağlantısı açılamadı.");}
else{
 client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));const {data}=await client.auth.getSession();session=data.session;
 if(!data.session){location.replace('ciftci-bilgi.html?next='+encodeURIComponent('tarla-detay.html?farm='+encodeURIComponent(farmId)+(params.get('year')?'&year='+encodeURIComponent(params.get('year')):'')+location.hash));}
 else{
  const [f,r,a]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('id',farmId).eq('user_id',data.session.user.id).maybeSingle(),client.from('farmer_operations').select('*').eq('farm_id',farmId).eq('user_id',data.session.user.id).order('operation_date',{ascending:false}),fetch('assets/administrative-units.json?v=2').then(r=>r.ok?r.json():null).catch(()=>null)]);
  if(f.error||r.error||!f.data){$('farm-title').textContent=__avt("Tarla bulunamadı veya hesabına ait değil.");}
  else{farm=f.data;records=r.data||[];admin=a;const select=$('farm-season-select');select.replaceChildren();farm.farmer_seasons.slice().sort((a,b)=>b.season_year-a.season_year).forEach(s=>select.add(new Option(s.season_year+' · '+s.crop,s.season_year)));select.value=String(Number(params.get('year'))||farm.season_year);if(!select.value)select.value=String(farm.season_year);render();}
 }
}

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
