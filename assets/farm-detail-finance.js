import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=groups-v2';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance,seasonFor,fmt,appendMetric,appendSupportMetrics,operationLabels,serviceTypes } from './farm-finance.js?v=support-simple-v1';
import { costPerDecare } from './operation-cost.js';
import { locationLabels } from './location-labels.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),farmId=params.get('farm'),cfg=window.AGROVERIX_SUPABASE||{};
let farm,records=[],admin,editing=false,client=null,session=null,savingActual=false,actualFormYear=null;
['actual-yield','actual-price','actual-support'].forEach(id=>bindNumberInput($(id),{maximumFractionDigits:id==='actual-yield'?6:2}));
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function report(parent,result){appendMetric(parent,'Kg Başına Maliyet',result.costKg,'TL/kg');appendMetric(parent,'Toplam Ürün',result.kg,'kg');appendMetric(parent,'Satış Geliri',result.revenue,'TL');appendMetric(parent,'Toplam Kâr / Zarar',result.profit,'TL');appendMetric(parent,'Kâr / Zarar Oranı',result.percent,'%');appendMetric(parent,'Kg Başına Kâr / Zarar',result.unitProfit,'TL/kg');appendSupportMetrics(parent,result);}
function render(){
 const year=Number($('farm-season-select').value),season=seasonFor(farm,year),c=farmFinance(farm,records,year);
 $('farm-title').textContent=farm.name;$('farm-crop').textContent=season?.crop||farm.crop;$('farm-area').textContent=fmt(c.area);$('farm-location').textContent=locationLabels(farm,admin);
 $('farm-per-decare').textContent=c.perDecare===null?'—':fmt(c.perDecare);$('farm-total').textContent=c.total===null?'—':fmt(c.total);
 $('farm-cost-note').textContent=c.missing?c.missing+' eski masraf kaydında hesaplama bilgisi eksik. Kayıtları Düzenle ile düzelt.':year+' sezonu · '+c.rows.length+' masraf · '+(season?.tenure==='rented'?'Kiralık · '+fmt(c.rent)+' TL sezonluk kira dahil.':'Mülk · Kira yok.');
 $('edit-records-toggle').disabled=false;$('edit-records-toggle').textContent=editing?'Düzenlemeyi Kapat':'Kayıtları Düzenle';$('edit-farm').hidden=!editing;$('edit-farm').href='tarla-bilgileri.html?edit='+farm.id+'&year='+year;
 $('add-operation').href='uretim-kayitlari.html?farm='+farm.id+'&year='+year;
 $('new-season').href='tarla-bilgileri.html?edit='+farm.id+'&year='+(Math.max(...farm.farmer_seasons.map(s=>s.season_year))+1);
 if(actualFormYear!==year){['yield','price','support'].forEach(key=>setNumberInputValue($('actual-'+key),season?.['actual_'+key]));actualFormYear=year;$('actual-save-status').textContent='';}
 const draft={};['yield','price','support'].forEach(key=>draft['actual_'+key]=parseNumberInput($('actual-'+key).value));
 const actual=$('actual-report'),expected=$('expected-report');actual.replaceChildren();expected.replaceChildren();report(actual,farmFinance(farm,records,year,draft).actual);report(expected,c.expected);
 $('actual-report-note').textContent=season?.actual_yield==null?'Hasattan sonra bu tarla ve seçili sezon için gerçek verim, satış fiyatı ve gerçekleşen desteklemeyi gir. Sıfır değer de kaydedilebilir.':'Gerçek verim: '+fmt(season.actual_yield)+' kg/da · Gerçek satış fiyatı: '+(season.actual_price==null?'—':fmt(season.actual_price))+' TL/kg';
 $('actual-season-fields').disabled=!season||!session||savingActual;
 $('expected-report-note').textContent=season?.expected_yield==null?'Sezon Sonu Tahmini sayfasına bu tarla için verim veya fiyat gir.':'Tahmini verim: '+fmt(season.expected_yield)+' kg/da · Tahmini satış fiyatı: '+(season.expected_price==null?'—':fmt(season.expected_price))+' TL/kg. Sonuçlar kayıtlı masraflara göre değişir.';
 const list=$('farm-records');list.replaceChildren();$('farm-empty').hidden=c.rows.length>0;
 if(c.rent>0){const row=element('article','','farm-detail-record');row.append(element('b','Sezonluk Kira'),element('b',fmt(c.rent)+' TL'));list.append(row);}
 c.rows.forEach(r=>{
  const row=element('article','','farm-detail-record'),info=element('div',''),cost=element('div','','farm-detail-record-cost');info.append(element('b',operationLabels[r.operation_type]||r.operation_type));
  const parts=[new Date(r.operation_date+'T12:00:00').toLocaleDateString('tr-TR')];
  if(!serviceTypes.has(r.operation_type)||r.inventory_item_id){if(r.product)parts.push(r.product);if(r.quantity)parts.push((r.cost_basis==='field_total'?'Toplam kullanım: ':'Dekara kullanım: ')+fmt(r.quantity)+' '+r.quantity_unit+(r.inventory_package_quantity?' × '+fmt(r.inventory_package_quantity)+' '+r.inventory_package_unit:''));}
  if(r.notes)parts.push(r.notes);info.append(element('small',parts.join(' · ')));const per=costPerDecare(r,c.area);cost.append(element('b',per===null?'Hesaplanamadı':fmt(per*c.area)+' TL'),element('small',per===null?'Maliyet bilgisini düzenle':fmt(per)+' TL/da'));
  const edit=element('a','Bu Kaydı Düzenle','auth-back farm-detail-record-edit');edit.href='uretim-kayitlari.html?farm='+farmId+'&edit='+r.id;edit.hidden=!editing;row.append(info,cost,edit);list.append(row);
 });
 const u=new URL(location.href);u.searchParams.set('year',year);history.replaceState(null,'',u);
}

function actualMessage(text,error=false){$('actual-save-status').textContent=text;$('actual-save-status').classList.toggle('is-error',error);}
$('actual-season-form').addEventListener('input',()=>{
 if(!farm||savingActual)return;
 const overrides={};['yield','price','support'].forEach(key=>overrides['actual_'+key]=parseNumberInput($('actual-'+key).value));
 const c=farmFinance(farm,records,Number($('farm-season-select').value),overrides);
 $('actual-report').replaceChildren();report($('actual-report'),c.actual);
 actualMessage('Hesaplama güncellendi. Bilgileri hesabında saklamak için kaydet.');
});
$('actual-season-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!farm||!session||savingActual)return;
 const year=Number($('farm-season-select').value),season=seasonFor(farm,year);
 if(!season){actualMessage('Kaydedilecek sezon bulunamadı. Sayfayı yenile.',true);return;}
 const values={};['yield','price','support'].forEach(key=>values['actual_'+key]=parseNumberInput($('actual-'+key).value));
 if(Object.values(values).some(v=>v!==null&&(!Number.isFinite(v)||v<0))){actualMessage('Verim, fiyat ve destekleme sıfır veya daha büyük olmalı.',true);return;}
 if((values.actual_yield===null)!==(values.actual_price===null)){actualMessage('Gerçek verim ve satış fiyatını birlikte gir veya ikisini de boş bırak.',true);return;}
 savingActual=true;$('actual-season-fields').disabled=true;$('farm-season-select').disabled=true;actualMessage('Gerçekleşen bilgiler kaydediliyor…');
 try{
  const {data,error}=await client.from('farmer_seasons').update({...values,updated_at:new Date().toISOString()}).eq('farm_id',farm.id).eq('season_year',year).eq('user_id',session.user.id).select('actual_yield,actual_price,actual_support,updated_at').single();
  if(error)throw error;
  Object.assign(season,data);actualFormYear=null;render();actualMessage('Sezon Sonu Gerçekleşen bilgileri kaydedildi. Tarla özeti ve Excel raporun bu değerlerle güncellenir.');
 }catch(error){actualMessage('Bilgiler kaydedilemedi. Girdiklerin burada duruyor; tekrar dene.',true);}
 finally{savingActual=false;$('actual-season-fields').disabled=false;$('farm-season-select').disabled=false;}
});

$('edit-records-toggle').addEventListener('click',()=>{editing=!editing;$('edit-records-toggle').setAttribute('aria-pressed',String(editing));render();});$('farm-season-select').addEventListener('change',render);
if(!farmId||!cfg.url||!cfg.publishableKey){$('farm-title').textContent='Tarla bağlantısı açılamadı.';}
else{
 client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await client.auth.getSession();session=data.session;
 if(!data.session){location.replace('ciftci-bilgi.html?next='+encodeURIComponent('tarla-detay.html?farm='+encodeURIComponent(farmId)+(params.get('year')?'&year='+encodeURIComponent(params.get('year')):'')+location.hash));}
 else{
  const [f,r,a]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('id',farmId).eq('user_id',data.session.user.id).maybeSingle(),client.from('farmer_operations').select('*').eq('farm_id',farmId).eq('user_id',data.session.user.id).order('operation_date',{ascending:false}),fetch('assets/administrative-units.json?v=2').then(r=>r.ok?r.json():null).catch(()=>null)]);
  if(f.error||r.error||!f.data){$('farm-title').textContent='Tarla bulunamadı veya hesabına ait değil.';}
  else{farm=f.data;records=r.data||[];admin=a;const select=$('farm-season-select');select.replaceChildren();farm.farmer_seasons.slice().sort((a,b)=>b.season_year-a.season_year).forEach(s=>select.add(new Option(s.season_year+' · '+s.crop,s.season_year)));select.value=String(Number(params.get('year'))||farm.season_year);if(!select.value)select.value=String(farm.season_year);render();}
 }
}
