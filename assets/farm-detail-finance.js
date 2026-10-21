import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import { farmFinance,seasonFor,fmt,appendMetric,operationLabels,serviceTypes } from './farm-finance.js?v=dealer-expenses-v1';
import { costPerDecare } from './operation-cost.js';
import { locationLabels } from './location-labels.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),farmId=params.get('farm'),cfg=window.AGROVERIX_SUPABASE||{};
let farm,records=[],admin,editing=false;
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function report(parent,result){appendMetric(parent,'Kg Başına Maliyet',result.costKg,'TL/kg');appendMetric(parent,'Toplam Ürün',result.kg,'kg');appendMetric(parent,'Satış Geliri',result.revenue,'TL');appendMetric(parent,'Toplam Kâr / Zarar',result.profit,'TL');appendMetric(parent,'Maliyete Göre Kâr / Zarar',result.percent,'%');appendMetric(parent,'Kg Başına Kâr / Zarar',result.unitProfit,'TL/kg');}
function render(){
 const year=Number($('farm-season-select').value),season=seasonFor(farm,year),c=farmFinance(farm,records,year);
 $('farm-title').textContent=farm.name;$('farm-crop').textContent=season?.crop||farm.crop;$('farm-area').textContent=fmt(c.area);$('farm-location').textContent=locationLabels(farm,admin);
 $('farm-per-decare').textContent=c.perDecare===null?'—':fmt(c.perDecare);$('farm-total').textContent=c.total===null?'—':fmt(c.total);
 $('farm-cost-note').textContent=c.missing?c.missing+' eski masraf kaydında hesaplama bilgisi eksik. Kayıtları Düzenle ile düzelt.':year+' sezonu · '+c.rows.length+' masraf · '+(season?.tenure==='rented'?'Kiralık · '+fmt(c.rent)+' TL sezonluk kira dahil.':'Mülk · Kira yok.');
 $('edit-records-toggle').disabled=false;$('edit-records-toggle').textContent=editing?'Düzenlemeyi Kapat':'Kayıtları Düzenle';$('edit-farm').hidden=!editing;$('edit-farm').href='tarla-bilgileri.html?edit='+farm.id+'&year='+year;
 $('add-operation').href='uretim-kayitlari.html?farm='+farm.id+'&year='+year;
 $('new-season').href='tarla-bilgileri.html?edit='+farm.id+'&year='+(Math.max(...farm.farmer_seasons.map(s=>s.season_year))+1);
 const actual=$('actual-report'),expected=$('expected-report');actual.replaceChildren();expected.replaceChildren();report(actual,c.actual);report(expected,c.expected);
 $('actual-report-note').textContent=season?.actual_yield==null?'Hasattan sonra Kayıtları Düzenle → Tarla Bilgilerini Düzenle sayfasının Sezon Sonu bölümüne gerçek verim ve satış fiyatını gir.':'Gerçek verim: '+fmt(season.actual_yield)+' kg/da · Gerçek satış fiyatı: '+fmt(season.actual_price)+' TL/kg';
 $('expected-report-note').textContent=season?.expected_yield==null?'Ana sayfadaki Sezon Sonu Tahmini bölümüne bu tarla için verim veya fiyat gir.':'Tahmini verim: '+fmt(season.expected_yield)+' kg/da · Tahmini satış fiyatı: '+(season.expected_price==null?'—':fmt(season.expected_price))+' TL/kg. Sonuçlar kayıtlı masraflara göre değişir.';
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
$('edit-records-toggle').addEventListener('click',()=>{editing=!editing;$('edit-records-toggle').setAttribute('aria-pressed',String(editing));render();});$('farm-season-select').addEventListener('change',render);
if(!farmId||!cfg.url||!cfg.publishableKey){$('farm-title').textContent='Tarla bağlantısı açılamadı.';}
else{
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}),{data}=await client.auth.getSession();
 if(!data.session){location.replace('ciftci-bilgi.html?next='+encodeURIComponent('tarla-detay.html?farm='+farmId));}
 else{
  const [f,r,a]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('id',farmId).eq('user_id',data.session.user.id).maybeSingle(),client.from('farmer_operations').select('*').eq('farm_id',farmId).eq('user_id',data.session.user.id).order('operation_date',{ascending:false}),fetch('assets/administrative-units.json?v=2').then(r=>r.ok?r.json():null).catch(()=>null)]);
  if(f.error||r.error||!f.data){$('farm-title').textContent='Tarla bulunamadı veya hesabına ait değil.';}
  else{farm=f.data;records=r.data||[];admin=a;const select=$('farm-season-select');select.replaceChildren();farm.farmer_seasons.slice().sort((a,b)=>b.season_year-a.season_year).forEach(s=>select.add(new Option(s.season_year+' · '+s.crop,s.season_year)));select.value=String(Number(params.get('year'))||farm.season_year);if(!select.value)select.value=String(farm.season_year);render();}
 }
}
