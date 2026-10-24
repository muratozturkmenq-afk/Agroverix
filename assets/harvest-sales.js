import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=groups-v2';
import {readAll,fmt,money,today} from './inventory-data.js?v=dealer-expenses-v1';
const $=id=>document.getElementById(id),cfg=window.AGROVERIX_SUPABASE||{},params=new URLSearchParams(location.search);
let client=null,session=null,farms=[],sales=[],receipts=[],ready=false,loading=false,queued=false,saving=false,generation=0,channel=null,view='sale',historyMode='company',saleId=crypto.randomUUID(),receiptId=crypto.randomUUID(),editingSale=false,editingReceipt=false,requestedOpened=false;
const num=id=>parseNumberInput($(id).value),day=value=>new Date(value+'T12:00:00').toLocaleDateString('tr-TR'),cents=value=>Math.round(Number(value||0)*100),key=(farm,year)=>farm+'|'+year;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function say(id,text,error=false){$(id).textContent=text;$(id).classList.toggle('is-error',error);}
function errorText(error){const text=error?.message||'';if(/Tahsilat,|Önce bu firma|hesabına|Tarla ve sezon/.test(text))return text;if(['42P01','42703','PGRST202','PGRST205'].includes(error?.code))return 'Hasat ve satış kayıt servisi henüz hazır değil. Biraz sonra yeniden dene.';return 'Kayıt tamamlanamadı. Bağlantını ve girdiğin bilgileri kontrol edip tekrar dene.';}
function button(text,action){const b=node('button',text,'inventory-button');b.type='button';b.addEventListener('click',()=>{if(!saving)action();});return b;}
function activeSales(){return sales.filter(s=>!s.is_void);}
function activeReceipts(){return receipts.filter(r=>!r.is_void);}
function seasonRows(){return farms.flatMap(f=>(f.farmer_seasons||[]).map(s=>({farm:f,season:s,key:key(f.id,s.season_year),label:f.name+' - '+s.crop+' ('+s.season_year+')'})));}
function farmLabel(s){const f=farms.find(f=>f.id===s.farm_id),season=f?.farmer_seasons?.find(y=>Number(y.season_year)===Number(s.season_year));return (f?.name||'Tarla')+' - '+(season?.crop||f?.crop||'')+' ('+s.season_year+')';}
function groups(){
 const result=new Map();
 sales.forEach(s=>{const g=result.get(s.buyer_key)||{key:s.buyer_key,name:s.buyer,sales:[],receipts:[],total:0,paid:0};g.sales.push(s);if(!s.is_void)g.total+=cents(s.total_amount);result.set(g.key,g);});
 receipts.forEach(r=>{const g=result.get(r.buyer_key)||{key:r.buyer_key,name:r.buyer,sales:[],receipts:[],total:0,paid:0};g.receipts.push(r);if(!r.is_void)g.paid+=cents(r.amount);result.set(g.key,g);});
 return [...result.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
function fieldsState(){['harvest-sale-fields','harvest-receipt-fields'].forEach(id=>$(id).disabled=!ready||saving);$('harvest-refresh').disabled=loading||saving;$('receipt-detail-buyer').disabled=!ready||saving||!groups().length;}
function setView(next,{scroll=false}={}){
 view=next;['sale','receipt'].forEach(k=>{const tab=$('harvest-tab-'+k);tab.setAttribute('aria-selected',String(k===next));tab.tabIndex=k===next?0:-1;});
 $('harvest-sales-panel').hidden=next!=='sale';$('harvest-receipts-panel').hidden=next!=='receipt';
 const u=new URL(location.href);u.hash=next==='receipt'?'tahsilat':'satis';history.replaceState(null,'',u);
 if(scroll)$(next==='receipt'?'harvest-receipts-panel':'harvest-sales-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
['sale','receipt'].forEach((kind,index)=>{
 const tab=$('harvest-tab-'+kind);tab.addEventListener('click',()=>setView(kind));
 tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'sale':e.key==='End'?'receipt':index?'sale':'receipt';setView(next);$('harvest-tab-'+next).focus();});
});
['sale-kg','sale-price'].forEach(id=>bindNumberInput($(id),{maximumFractionDigits:6}));bindNumberInput($('receipt-amount'),{maximumFractionDigits:2});
$('sale-date').value=today();$('receipt-date').value=today();
function preview(){const q=num('sale-kg'),p=num('sale-price');$('sale-total').value=q>0&&p!==null&&p>=0&&Number.isFinite(q*p)?money(Math.round((q*p+Number.EPSILON)*100)/100):'—';}
$('harvest-sale-form').addEventListener('input',preview);
function resetSale(preferred=$('sale-farm').value){$('harvest-sale-form').reset();saleId=crypto.randomUUID();editingSale=false;$('sale-date').value=today();$('sale-farm').value=preferred;$('harvest-sale-title').textContent='Hasat & Satış Ekle';$('sale-save').textContent='Satışı Kaydet →';$('sale-cancel').hidden=true;preview();}
function resetReceipt(preferred=$('receipt-buyer').value){$('harvest-receipt-form').reset();receiptId=crypto.randomUUID();editingReceipt=false;$('receipt-date').value=today();$('receipt-buyer').value=preferred;$('harvest-receipt-title').textContent='Tahsilat Ekle';$('receipt-save').textContent='Tahsilatı Kaydet →';$('receipt-cancel').hidden=true;renderCompanies();}
$('sale-cancel').addEventListener('click',()=>{resetSale();say('sale-status','');});
$('receipt-cancel').addEventListener('click',()=>{resetReceipt();say('receipt-status','');});
function options(){
 const previous=$('sale-farm').value,filter=$('sale-filter').value,rows=seasonRows();
 $('sale-farm').replaceChildren(new Option(rows.length?'Tarla ve sezon seç':'Önce tarla ekle',''));$('sale-filter').replaceChildren(new Option('Tarla özetleri',''));
 rows.forEach(row=>{$('sale-farm').add(new Option(row.label,row.key));$('sale-filter').add(new Option(row.label,row.key));});
 if(rows.some(r=>r.key===previous))$('sale-farm').value=previous;if(rows.some(r=>r.key===filter))$('sale-filter').value=filter;
 const year=$('harvest-year').value,years=[...new Set(rows.map(r=>Number(r.season.season_year)))].sort((a,b)=>b-a);
 $('harvest-year').replaceChildren(new Option('Tüm sezonlar',''));years.forEach(y=>$('harvest-year').add(new Option(y,y)));if(years.includes(Number(year)))$('harvest-year').value=year;
 const selected=$('receipt-buyer').value,detailSelected=$('receipt-detail-buyer').value,buyers=groups();
 $('receipt-detail-buyer').replaceChildren(new Option(buyers.length?'Firma seç':'Önce satış kaydet',''));buyers.forEach(g=>$('receipt-detail-buyer').add(new Option(g.name,g.key)));if(buyers.some(g=>g.key===detailSelected))$('receipt-detail-buyer').value=detailSelected;
 const companyFilter=$('sale-company-filter').value;$('sale-company-filter').replaceChildren(new Option('Firma özetleri',''));buyers.filter(g=>g.sales.length).forEach(g=>$('sale-company-filter').add(new Option(g.name,g.key)));if(buyers.some(g=>g.key===companyFilter&&g.sales.length))$('sale-company-filter').value=companyFilter;$('receipt-buyer').replaceChildren(new Option(buyers.length?'Firma seç':'Önce satış kaydet',''));$('harvest-buyers').replaceChildren();
 buyers.forEach(g=>{$('receipt-buyer').add(new Option(g.name+' · Alacak '+money((g.total-g.paid)/100),g.key));$('harvest-buyers').append(new Option(g.name,g.name));});
 if(buyers.some(g=>g.key===selected))$('receipt-buyer').value=selected;
}
function renderFarms(){
 const year=$('harvest-year').value,rows=seasonRows().filter(r=>!year||String(r.season.season_year)===year),list=$('harvest-farm-summaries');list.replaceChildren();
 rows.forEach(({farm,season})=>{
  const records=activeSales().filter(s=>s.farm_id===farm.id&&Number(s.season_year)===Number(season.season_year)),kg=records.reduce((n,r)=>n+Number(r.quantity_kg),0),total=records.reduce((n,r)=>n+cents(r.total_amount),0)/100;
  const card=node('a',undefined,'harvest-farm-card');card.href='tarla-detay.html?farm='+encodeURIComponent(farm.id)+'&year='+season.season_year+'#season-end';card.append(node('h3',farm.name+' - '+season.crop),node('small',season.season_year+' sezonu · '+records.length+' satış / araç kaydı'));
  const grid=node('div',undefined,'harvest-farm-metrics');[['Hasat Toplamı',fmt(kg)+' kg'],['Ortalama Fiyat',kg>0?fmt(total/kg)+' TL/kg':'—'],['Toplam Satış',money(total)],['Alan',fmt(season.area_decare)+' da']].forEach(([label,value])=>{const cell=node('div');cell.append(node('span',label),node('b',value));grid.append(cell);});card.append(grid);list.append(card);
 });$('harvest-farms-empty').hidden=rows.length>0;$('harvest-farms-empty').textContent=session?'Bu sezon için tarla kaydı yok. Tarla Ekle bölümünden başlayabilirsin.':'Tarla özetlerin giriş yaptıktan sonra burada görünür.';
}
function metrics(parent,values){const row=node('div',undefined,'ledger-amounts');values.forEach(([label,value])=>{const cell=node('div');cell.append(node('span',label),node('b',value));row.append(cell);});parent.append(row);}
function editSale(s){
 if(saving)return;resetSale(key(s.farm_id,s.season_year));saleId=s.id;editingSale=true;
 $('sale-date').value=s.sale_date;$('sale-buyer').value=s.buyer;$('sale-vehicle').value=s.vehicle;setNumberInputValue($('sale-kg'),s.quantity_kg);setNumberInputValue($('sale-price'),s.unit_price);$('sale-note').value=s.notes;
 $('harvest-sale-title').textContent='Satışı Düzenle';$('sale-save').textContent='Değişiklikleri Kaydet →';$('sale-cancel').hidden=false;preview();setView('sale',{scroll:true});say('sale-status','Bu satışın bilgilerini düzenleyebilirsin.');
}
function editReceipt(r){
 if(saving)return;$('receipt-detail-buyer').value=r.buyer_key;resetReceipt(r.buyer_key);receiptId=r.id;editingReceipt=true;$('receipt-date').value=r.receipt_date;setNumberInputValue($('receipt-amount'),r.amount);$('receipt-note').value=r.notes;
 $('harvest-receipt-title').textContent='Tahsilatı Düzenle';$('receipt-save').textContent='Değişiklikleri Kaydet →';$('receipt-cancel').hidden=false;setView('receipt',{scroll:true});say('receipt-status','Bu tahsilatın bilgilerini düzenleyebilirsin.');
}
async function toggleRecord(record,type){
 if(saving||!ready)return;
 const label=type==='sale'?'satış':'tahsilat';
 if(!confirm('Bu '+label+' kaydı '+(record.is_void?'yeniden etkinleştirilsin mi?':'iptal edilsin mi? Kayıt silinmez; yeniden etkinleştirilebilir.')))return;
 const payload=type==='sale'?{id:record.id,farm_id:record.farm_id,season_year:record.season_year,sale_date:record.sale_date,buyer:record.buyer,vehicle:record.vehicle,quantity_kg:record.quantity_kg,unit_price:record.unit_price,notes:record.notes,is_void:!record.is_void}:{id:record.id,buyer:record.buyer,receipt_date:record.receipt_date,amount:record.amount,notes:record.notes,is_void:!record.is_void};
 const run=generation;saving=true;fieldsState();
 try{const {error}=await client.rpc(type==='sale'?'agroverix_save_harvest_sale':'agroverix_save_harvest_receipt',type==='sale'?{p_sale:payload}:{p_receipt:payload});if(error)throw error;if(run!==generation)return;if(type==='sale'&&saleId===record.id)resetSale();if(type==='receipt'&&receiptId===record.id)resetReceipt();await refresh();say('harvest-status','Kayıt güncellendi. Toplamlar yeniden hesaplandı.');}
 catch(error){if(run===generation)say('harvest-status',errorText(error),true);}
 finally{saving=false;fieldsState();}
}
function saleCard(s,{company=false}={}){
 const card=node('article',undefined,'purchase-list-card'+(s.is_void?' is-void':''));card.append(node('h3',company?farmLabel(s):s.buyer),node('p',company?'Satılan Firma: '+s.buyer:farmLabel(s)));
 metrics(card,[['Hasat / Satış Tarihi',day(s.sale_date)],['Miktar (kg)',fmt(s.quantity_kg)],['Satış Fiyatı',fmt(s.unit_price)+' TL/kg'],['Toplam Tutar',money(s.total_amount)]]);
 if(s.vehicle)card.append(node('p','Araç / Fiş: '+s.vehicle));if(s.notes)card.append(node('p',s.notes));if(s.is_void)card.append(node('b','İptal edilmiş kayıt'));
 const actions=node('div',undefined,'stock-row-actions');if(!s.is_void)actions.append(button('Düzenle',()=>editSale(s)));actions.append(button(s.is_void?'Yeniden Etkinleştir':'Kaydı İptal Et',()=>toggleRecord(s,'sale')));card.append(actions);return card;
}
function setSalesMode(mode){
 historyMode=mode==='farm'?'farm':'company';
 ['company','farm'].forEach(kind=>{const tab=$('sales-by-'+kind),active=kind===historyMode;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
 $('sale-company-filter-field').hidden=historyMode!=='company';$('sale-farm-filter-field').hidden=historyMode!=='farm';$('harvest-history-panel').setAttribute('aria-labelledby','sales-by-'+historyMode);
 renderSales();
}
function renderSales(){
 const select=$(historyMode==='company'?'sale-company-filter':'sale-filter'),selected=select.value,show=$('harvest-show-void').checked,list=$('harvest-sale-list');list.replaceChildren();
 const grouped=new Map();
 sales.filter(s=>show||!s.is_void).forEach(s=>{
  const groupKey=historyMode==='company'?s.buyer_key:key(s.farm_id,s.season_year),name=historyMode==='company'?s.buyer:farmLabel(s);
  const group=grouped.get(groupKey)||{key:groupKey,name,rows:[]};group.rows.push(s);grouped.set(groupKey,group);
 });
 const rows=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
 rows.forEach(group=>{
  const active=group.rows.filter(s=>!s.is_void),kg=active.reduce((n,s)=>n+Number(s.quantity_kg),0),total=active.reduce((n,s)=>n+cents(s.total_amount),0)/100;
  const details=node('details',undefined,'harvest-sale-group'),summary=node('summary'),title=node('div',undefined,'harvest-group-heading');title.append(node('b',group.name),node('span','⌄','harvest-group-arrow'));summary.append(title,node('small',active.length+' etkin kayıt'+(group.rows.length>active.length?' · '+(group.rows.length-active.length)+' iptal':'')));
  const totals=node('div',undefined,'harvest-group-metrics');
  [['Toplam Miktar',fmt(kg)+' kg'],['Ortalama Fiyat',kg>0?fmt(total/kg)+' TL/kg':'—'],['Toplam Satış',money(total)]].forEach(([label,value])=>{const cell=node('div');cell.append(node('span',label),node('strong',value));totals.append(cell);});
  summary.append(totals);details.append(summary);const records=node('div',undefined,'harvest-group-records');
  function populateGroup(){if(records.childElementCount)return;group.rows.slice().sort((a,b)=>b.sale_date.localeCompare(a.sale_date)||a.id.localeCompare(b.id)).forEach(s=>records.append(saleCard(s,{company:historyMode==='company'})));}
  details.append(records);details.open=group.key===selected;if(details.open)populateGroup();
  details.addEventListener('toggle',()=>{
   if(!details.isConnected)return;
   if(details.open){populateGroup();select.value=group.key;[...list.children].forEach(other=>{if(other!==details)other.open=false;});}
   else{records.replaceChildren();if(select.value===group.key)select.value='';}
  });
  list.append(details);
 });
 $('harvest-sale-empty').hidden=rows.length>0;
 $('harvest-sale-empty').textContent=session?'Bu görünümde satış kaydı yok. Yeni satış ekleyebilirsin.':'Kayıtlarını görmek için giriş yap.';
}
function renderCompanies(){
 const buyers=groups(),group=buyers.find(g=>g.key===$('receipt-detail-buyer').value),entryGroup=buyers.find(g=>g.key===$('receipt-buyer').value),list=$('harvest-company-list'),details=$('harvest-company-detail');list.replaceChildren();details.replaceChildren();$('harvest-all-buyers').hidden=!group;$('harvest-companies-empty').hidden=buyers.length>0;$('harvest-companies-title').textContent='Firma Hesapları';
 $('receipt-buyer-hint').textContent=entryGroup?'Kalan alacak: '+money((entryGroup.total-entryGroup.paid)/100)+'. Tahsilat tarihine kadar olan satış bedeli kadar kayıt yapabilirsin.':'Tahsilat girmek için firmayı seç. Geçmiş ödemeleri sağdaki firma seçiminden görebilirsin.';
 buyers.forEach(g=>{
  const row=node('article',undefined,'dealer-balance-row harvest-company-row');row.setAttribute('aria-label',g.name+' firma hesabı');
  const name=node('span',undefined,'dealer-name');name.append(node('small','Satılan Firma'),node('strong',g.name));row.append(name);
  [['Toplam Satış',g.total],['Tahsil Edilen',g.paid],['Kalan Alacak',g.total-g.paid]].forEach(([label,value])=>{const cell=node('span');cell.append(node('small',label),node('b',money(value/100)));row.append(cell);});list.append(row);
 });
 if(!group){if(buyers.length)details.append(node('p','Tahsilatları görmek için üstteki açılır listeden bir firma seç.','payment-help'));return;}
 details.append(node('h3',group.name+' · Tahsilat Geçmişi','harvest-detail-title'));
 const show=$('harvest-show-void').checked;
 const history=group.receipts.filter(r=>show||!r.is_void).slice().sort((a,b)=>b.receipt_date.localeCompare(a.receipt_date)||a.id.localeCompare(b.id));
 history.forEach(r=>{const card=node('article',undefined,'purchase-list-card'+(r.is_void?' is-void':''));metrics(card,[['Tahsilat Tarihi',day(r.receipt_date)],['Tutar',money(r.amount)]]);if(r.notes)card.append(node('p',r.notes));if(r.is_void)card.append(node('b','İptal edilmiş kayıt'));const actions=node('div',undefined,'stock-row-actions');if(!r.is_void)actions.append(button('Düzenle',()=>editReceipt(r)));actions.append(button(r.is_void?'Yeniden Etkinleştir':'Kaydı İptal Et',()=>toggleRecord(r,'receipt')));card.append(actions);details.append(card);});
 if(!history.length)details.append(node('p','Bu firmadan henüz tahsilat kaydı yok.','payment-help'));
}
function render(){
 options();renderFarms();renderSales();renderCompanies();
 const total=activeSales().reduce((n,s)=>n+cents(s.total_amount),0),paid=activeReceipts().reduce((n,r)=>n+cents(r.amount),0);
 $('harvest-total').textContent=money(total/100);$('harvest-collected').textContent=money(paid/100);$('harvest-due').textContent=money((total-paid)/100);
}
$('receipt-buyer').addEventListener('change',renderCompanies);$('receipt-detail-buyer').addEventListener('change',renderCompanies);$('harvest-all-buyers').addEventListener('click',()=>{if(saving)return;$('receipt-detail-buyer').value='';renderCompanies();});
$('sale-filter').addEventListener('change',renderSales);$('sale-company-filter').addEventListener('change',renderSales);
['company','farm'].forEach((kind,index)=>{const tab=$('sales-by-'+kind);tab.addEventListener('click',()=>setSalesMode(kind));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'company':event.key==='End'?'farm':index?'company':'farm';setSalesMode(next);$('sales-by-'+next).focus();});});['harvest-show-void','harvest-show-void-receipt'].forEach(id=>$(id).addEventListener('change',()=>{const checked=$(id).checked;$('harvest-show-void').checked=checked;$('harvest-show-void-receipt').checked=checked;renderSales();renderCompanies();}));$('harvest-year').addEventListener('change',renderFarms);
$('harvest-sale-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!ready||saving||!session)return;
 const selected=seasonRows().find(r=>r.key===$('sale-farm').value),q=num('sale-kg'),p=num('sale-price');
 if(!selected){say('sale-status','Tarla ve sezon seç.',true);return;}
 if(!($('sale-buyer').value.trim())||!$('sale-date').value||!Number.isFinite(q)||q<=0||q>1e9||p===null||!Number.isFinite(p)||p<0||p>1e9){say('sale-status','Firma ve tarihi doldur. Miktar sıfırdan büyük, fiyat sıfır veya daha büyük olmalı.',true);return;}
 const payload={id:saleId,farm_id:selected.farm.id,season_year:selected.season.season_year,sale_date:$('sale-date').value,buyer:$('sale-buyer').value.trim(),vehicle:$('sale-vehicle').value.trim(),quantity_kg:q,unit_price:p,notes:$('sale-note').value.trim(),is_void:false};
 const run=generation;saving=true;fieldsState();say('sale-status','Satış kaydediliyor…');
 try{const {error}=await client.rpc('agroverix_save_harvest_sale',{p_sale:payload});if(error)throw error;if(run!==generation)return;resetSale(selected.key);await refresh();say('sale-status','Satış kaydedildi. Tarla toplamı, ortalama fiyat ve firma alacağı güncellendi.');}
 catch(error){if(run===generation)say('sale-status',errorText(error),true);}
 finally{saving=false;fieldsState();}
});
$('harvest-receipt-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!ready||saving||!session)return;
 const group=groups().find(g=>g.key===$('receipt-buyer').value),amount=num('receipt-amount');
 if(!group||!$('receipt-date').value||!Number.isFinite(amount)||amount<=0||amount>1e18){say('receipt-status','Firma, tahsilat tarihi ve sıfırdan büyük tahsilat tutarı gir.',true);return;}
 const payload={id:receiptId,buyer:group.name,receipt_date:$('receipt-date').value,amount,notes:$('receipt-note').value.trim(),is_void:false},run=generation;
 saving=true;fieldsState();say('receipt-status','Tahsilat kaydediliyor…');
 try{const {error}=await client.rpc('agroverix_save_harvest_receipt',{p_receipt:payload});if(error)throw error;if(run!==generation)return;$('receipt-detail-buyer').value=group.key;resetReceipt(group.key);await refresh();say('receipt-status','Tahsilat kaydedildi. Firmanın kalan alacağı güncellendi.');}
 catch(error){if(run===generation)say('receipt-status',errorText(error),true);}
 finally{saving=false;fieldsState();}
});
async function refresh(){
 if(!session||!client)return;if(loading){queued=true;return;}loading=true;fieldsState();const run=generation,uid=session.user.id;
 try{
  const [f,s,r]=await Promise.all([readAll(client,'farmer_farms',uid,'*,farmer_seasons(*)'),readAll(client,'farmer_harvest_sales',uid),readAll(client,'farmer_harvest_receipts',uid)]);
  if(run!==generation||session?.user.id!==uid)return;farms=f;sales=s;receipts=r;ready=true;render();say('harvest-status','Güncel hasat, satış ve tahsilat kayıtları · '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
  if(!requestedOpened){requestedOpened=true;const row=seasonRows().find(r=>r.farm.id===params.get('farm')&&(!params.get('year')||Number(params.get('year'))===Number(r.season.season_year)));if(row){$('sale-farm').value=row.key;$('sale-filter').value=row.key;setSalesMode('farm');$('harvest-year').value=row.season.season_year;renderFarms();renderSales();}}
 }catch(error){if(run===generation){ready=false;say('harvest-status',errorText(error),true);}}
 finally{loading=false;fieldsState();if(queued){queued=false;refresh();}}
}
function account(next){
 generation++;session=next;ready=false;farms=[];sales=[];receipts=[];requestedOpened=false;if(channel){client.removeChannel(channel);channel=null;}
 options();$('receipt-detail-buyer').value='';$('sale-filter').value='';$('sale-company-filter').value='';resetSale('');resetReceipt('');renderFarms();setSalesMode('company');['harvest-total','harvest-collected','harvest-due'].forEach(id=>$(id).textContent='—');$('harvest-auth').hidden=!!next;fieldsState();say('sale-status','');say('receipt-status','');
 if(next){refresh();channel=client.channel('harvest-'+next.user.id);['farmer_harvest_sales','farmer_harvest_receipts','farmer_farms','farmer_seasons'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+next.user.id},()=>{if(!saving)refresh();}));channel.subscribe();}
 else say('harvest-status','Hasat, satış ve tahsilatlarını kaydetmek için giriş yap.');
}
$('harvest-refresh').addEventListener('click',()=>{if(!saving)refresh();});
const refreshVisible=()=>{if(session&&!saving&&!document.hidden)refresh();};
window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);let poll=setInterval(refreshVisible,30000);
window.addEventListener('pagehide',()=>{clearInterval(poll);if(channel){client.removeChannel(channel);channel=null;}});
window.addEventListener('pageshow',e=>{if(e.persisted){clearInterval(poll);poll=setInterval(refreshVisible,30000);account(session);}});
if(location.hash==='#tahsilat')setView('receipt');
if(cfg.url&&cfg.publishableKey){client=createClient(cfg.url,cfg.publishableKey);const {data,error}=await client.auth.getSession();if(error){say('harvest-status','Oturum alınamadı. Yeniden giriş yap.',true);$('harvest-auth').hidden=false;}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&session?.user.id!==next?.user.id)setTimeout(()=>account(next),0);});}
else{say('harvest-status','Kayıt servisine bağlanılamadı.',true);$('harvest-auth').hidden=false;}
