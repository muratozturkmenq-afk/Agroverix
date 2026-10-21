import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {units,fmt,money,loadInventory,readAll,totalsFor,stockError} from './inventory-data.js?v=expense-wording-v1';
import {serviceTypes,operationLabels,seasonFor} from './farm-finance.js?v=soil-analysis-v1';
import {costPerDecare} from './operation-cost.js';

const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{};
let client=null,session=null,items=[],purchases=[],operations=[],farms=[],payments=[],paymentsReady=false,ready=false,loading=false,queued=false,generation=0,saving=false,channel=null;
const expanded=new Set(),dealerExpanded=new Set(),unlinkedChoices=new Map(),productNodes=new Map(),dealerNodes=new Map();
let stockMode=location.hash==='#bayiler'?'supplier':'product';
const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString('tr-TR'):'—';
const normalize=value=>String(value||'').trim().toLocaleLowerCase('tr-TR');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function message(text,error=false){$('#inventory-status').textContent=text;$('#inventory-status').classList.toggle('is-error',error);}
function metric(list,label,value){const d=el('div');d.append(el('dt',label),el('dd',value));list.append(d);}
function itemLabel(item){return item.name+(item.brand?' · '+item.brand:'');}
function dealers(receipts){return [...new Map(receipts.filter(p=>p.supplier?.trim()).map(p=>[normalize(p.supplier),p.supplier.trim()])).values()];}
function applicationTotal(record){
 if(record.cost_basis==='field_total'){
  const value=record.total_cost==null||record.total_cost===''?NaN:Number(record.total_cost);
  return Number.isFinite(value)&&value>=0?value:null;
 }
 const farm=farms.find(f=>f.id===record.farm_id),area=Number(seasonFor(farm||{},record.season_year)?.area_decare||farm?.area_decare),per=costPerDecare(record,area);
 return per!==null&&area>0?per*area:null;
}
function trackItems(){
 const purchased=new Set(purchases.map(p=>p.item_id)),used=new Set(operations.map(r=>r.inventory_item_id));
 return items.filter(i=>purchased.has(i.id)||used.has(i.id)||Number(i.stock_quantity)>0);
}
function supplierGroups(){
 const groups=new Map();
 purchases.forEach(p=>{const key=normalize(p.supplier)||'__unspecified__',group=groups.get(key)||{key,name:p.supplier?.trim()||'Bayi belirtilmemiş',receipts:[]};group.receipts.push(p);groups.set(key,group);});
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
function nameButton(text,expanded,controls,action){
 const b=el('button',text,'stock-name-button');b.type='button';b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-controls',controls);b.addEventListener('click',action);return b;
}
function quantityRow(values){
 const dl=el('dl',undefined,'stock-quantity-grid');values.forEach(([label,value])=>metric(dl,label,value));return dl;
}
function detailTotal(label,value){const box=el('div',undefined,'stock-row-total');box.append(el('span',label),el('b',value));return box;}
function jumpTo(mode,key){
 if(mode==='product')expanded.add(key);else dealerExpanded.add(key);
 $('#inventory-search').value='';setMode(mode);render();
 (mode==='product'?productNodes:dealerNodes).get(key)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function setMode(mode,{focus=false,writeHash=true}={}){
 stockMode=mode==='supplier'?'supplier':'product';
 ['product','supplier'].forEach(key=>{const selected=stockMode===key,b=$('#stock-tab-'+key);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('#stock-panel-'+key).hidden=!selected;});
 $('#inventory-search').placeholder=stockMode==='supplier'?'Bayi veya ürün ara…':'Ürün, marka veya bayi ara…';
 if(focus)$('#stock-tab-'+stockMode).focus();
 if(writeHash){const url=new URL(location.href);url.hash=stockMode==='supplier'?'bayiler':'urunler';history.replaceState(null,'',url);}
}
function applicationRows(totals,item){
 const uses=el('div',undefined,'stock-usage-list');
 totals.uses.slice().sort((a,b)=>b.operation_date.localeCompare(a.operation_date)||b.id.localeCompare(a.id)).forEach(record=>{
  const row=el('article',undefined,'stock-usage'),values=el('dl',undefined,'stock-usage-metrics'),farm=farms.find(f=>f.id===record.farm_id),total=applicationTotal(record);
  const field=el('div');field.append(el('dt','Tarla Adı'));const fieldValue=el('dd');
  if(farm){const link=el('a',farm.name);link.href='tarla-detay.html?farm='+encodeURIComponent(farm.id)+'&year='+encodeURIComponent(record.season_year);fieldValue.append(link);}else fieldValue.textContent='Tarla kaydı bulunamadı';
  field.append(fieldValue);values.append(field);metric(values,'Uygulama Tarihi',date(record.operation_date));metric(values,'Kullanılan Miktar',fmt(record.inventory_quantity)+' '+item.base_unit);metric(values,'Uygulama Tutarı',total===null?'Maliyet bilgisi eksik':money(total));
  const a=el('a','Uygulama Kaydını Aç →');a.href='uretim-kayitlari.html?edit='+encodeURIComponent(record.id);
  row.append(values,el('p',(operationLabels[record.operation_type]||'Uygulama')+' · '+record.season_year+' sezonu'+(record.notes?' · '+record.notes:'')),a);uses.append(row);
 });
 if(!totals.uses.length)uses.append(el('p','Bu ürün henüz bir tarlada kullanılmadı.','payment-help'));
 return uses;
}
function purchaseHistory(receipts,item){
 const history=el('details',undefined,'stock-receipts');history.append(el('summary','Masraf Kayıtları · '+receipts.length+' kayıt'));
 receipts.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||b.id.localeCompare(a.id)).forEach(p=>{
  const row=el('article',undefined,'stock-receipt'),key=normalize(p.supplier)||'__unspecified__',b=el('button',p.supplier||'Bayi belirtilmemiş','stock-dealer-link');b.type='button';b.addEventListener('click',()=>jumpTo('supplier',key));
  row.append(b,el('p','Masraf Tarihi: '+date(p.purchase_date)),el('p',fmt(p.purchased_quantity)+' '+p.purchased_unit+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')+' · '+fmt(p.quantity)+' '+(item?.base_unit||'')),el('p','Masraf Tutarı: '+money(p.total_cost)));
  if(p.notes)row.append(el('p',p.notes));const a=el('a','Masraf Kaydını Aç →');a.href='alisveris-stok.html?edit='+encodeURIComponent(p.id)+'#alisveris-ekle';row.append(a);history.append(row);
 });return history;
}
function renderProducts(tracked,query){
 const list=$('#stock-list');list.replaceChildren();productNodes.clear();
 const selected=tracked.filter(i=>normalize(itemLabel(i)+' '+dealers(purchases.filter(p=>p.item_id===i.id)).join(' ')).includes(query));
 selected.forEach(item=>{
  const totals=totalsFor(item,purchases,operations),card=el('article',undefined,'stock-product'),head=el('div',undefined,'stock-row-heading'),title=el('div'),isOpen=expanded.has(item.id),bodyId='stock-product-detail-'+item.id;
  card.id='stok-'+item.id;productNodes.set(item.id,card);
  const body=el('div',undefined,'stock-product-body');body.id=bodyId;body.hidden=!isOpen;
  const heading=el('h3'),b=nameButton(item.name,isOpen,bodyId,()=>{const open=body.hidden;body.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)expanded.add(item.id);else expanded.delete(item.id);});heading.append(b);title.append(heading,el('p',item.brand||'Marka belirtilmemiş'));head.append(title,detailTotal('Toplam Maliyet',money(totals.cost)));
  const sellers=el('div',undefined,'stock-row-dealers');sellers.append(el('span','Bayi: '));
  const names=dealers(totals.receipts);if(!names.length)sellers.append(document.createTextNode('Bayi kaydı bulunamadı'));
  names.forEach(name=>{const link=el('button',name,'stock-dealer-link');link.type='button';link.addEventListener('click',()=>jumpTo('supplier',normalize(name)));sellers.append(link);});
  const numbers=quantityRow([['Alınan Miktar',fmt(totals.purchased)+' '+item.base_unit],['Kullanılan Miktar',fmt(totals.used)+' '+item.base_unit],['Kalan Miktar',fmt(totals.remaining)+' '+item.base_unit]]);
  const summary=el('div',undefined,'stock-row-summary');summary.append(head,numbers,sellers);
  body.append(el('h4','Tarla Kullanımları · '+totals.uses.length+' uygulama'),applicationRows(totals,item),purchaseHistory(totals.receipts,item));card.append(summary,body);list.append(card);
 });
 if(ready&&tracked.length&&!selected.length)list.append(el('p','Aramana uygun ürün, marka veya bayi bulunamadı.','inventory-empty'));
}
function renderSuppliers(groups,query){
 const list=$('#stock-dealer-list');list.replaceChildren();dealerNodes.clear();
 const selected=groups.filter(g=>normalize(g.name+' '+g.receipts.map(p=>{const item=items.find(i=>i.id===p.item_id);return item?itemLabel(item):'';}).join(' ')).includes(query));
 selected.forEach((group,index)=>{
  const card=el('article',undefined,'stock-supplier'),head=el('div',undefined,'stock-row-heading'),title=el('div'),heading=el('h3'),body=el('div',undefined,'stock-product-body'),bodyId='stock-supplier-detail-'+index,open=dealerExpanded.has(group.key);
  body.id=bodyId;body.hidden=!open;dealerNodes.set(group.key,card);
  const b=nameButton(group.name,open,bodyId,()=>{const next=body.hidden;body.hidden=!next;b.setAttribute('aria-expanded',String(next));if(next)dealerExpanded.add(group.key);else dealerExpanded.delete(group.key);});heading.append(b);
  const itemIds=[...new Set(group.receipts.map(p=>p.item_id))],totalCents=group.receipts.reduce((n,p)=>n+Math.round(Number(p.total_cost)*100),0),paidCents=group.receipts.reduce((n,p)=>n+Math.round(Number(p.paid_total||0)*100),0);
  title.append(heading,el('p',itemIds.length+' ürün · '+group.receipts.length+' masraf'));head.append(title);
  const summary=el('div',undefined,'stock-row-summary');summary.append(head,quantityRow([['Toplam Masraf',money(totalCents/100)],['Toplam Ödenen',paymentsReady?money(paidCents/100):'—'],['Kalan Borç',paymentsReady?money((totalCents-paidCents)/100):'—']]));
  body.append(el('h4','Bu Bayiden Alınan Ürünler'),el('p','Kullanılan ve kalan miktar, ürünün bütün bayilerden alınan ortak stoğudur.','payment-help'));
  itemIds.forEach(id=>{
   const item=items.find(i=>i.id===id),receipts=group.receipts.filter(p=>p.item_id===id),row=el('article',undefined,'supplier-product');
   const name=el('button',item?itemLabel(item):'Ürün bilgisi bulunamadı','stock-name-button');name.type='button';name.disabled=!item;name.addEventListener('click',()=>jumpTo('product',id));const h=el('h5');h.append(name);row.append(h);
   const totals=item?totalsFor(item,purchases,operations):null,amount=receipts.reduce((n,p)=>n+Number(p.quantity),0),unit=item?.base_unit||'';
   row.append(quantityRow([['Bu Bayiden Alınan',fmt(amount)+' '+unit],['Kullanılan · Tüm Bayiler',totals?fmt(totals.used)+' '+unit:'—'],['Kalan · Tüm Bayiler',totals?fmt(totals.remaining)+' '+unit:'—']]),detailTotal('Bu Bayideki Toplam Maliyet',money(receipts.reduce((n,p)=>n+Number(p.total_cost),0))),purchaseHistory(receipts,item));body.append(row);
  });
  body.append(el('h4','Bayi Ödeme Geçmişi'));
  const receiptIds=new Set(group.receipts.map(p=>p.id)),records=payments.filter(p=>receiptIds.has(p.purchase_id)).sort((a,b)=>b.payment_date.localeCompare(a.payment_date)||b.id.localeCompare(a.id));
  if(!paymentsReady)body.append(el('p','Ödeme bilgileri yüklenemedi. Masraf ve Ödeme sayfasından yeniden deneyebilirsin.','payment-help'));
  else if(!records.length)body.append(el('p','Bu bayi için kayıtlı ödeme yok.','payment-help'));
  records.forEach(p=>{const row=el('div',undefined,'stock-receipt'),receipt=group.receipts.find(r=>r.id===p.purchase_id),item=items.find(i=>i.id===receipt?.item_id);row.append(el('b',date(p.payment_date)+' · '+money(p.amount)),el('p',item?itemLabel(item):'Masraf ödemesi'));if(p.notes)row.append(el('p',p.notes));body.append(row);});
  const a=el('a','Ödeme Girişi →','inventory-button');a.href='alisveris-stok.html#odeme-borc';body.append(a);card.append(summary,body);list.append(card);
 });
 if(ready&&!selected.length)list.append(el('p',groups.length?'Aramana uygun bayi veya ürün bulunamadı.':'Masraf kaydettiğinde bayilerin burada görünür.','inventory-empty'));
}
function render(){
 const tracked=trackItems(),groups=supplierGroups(),query=normalize($('#inventory-search').value);
 renderProducts(tracked,query);renderSuppliers(groups,query);
 $('#stock-empty').hidden=!ready||tracked.length>0||stockMode!=='product';
 $('#stock-total').textContent=money(purchases.reduce((n,p)=>n+Number(p.total_cost),0));$('#stock-count').textContent=fmt(tracked.filter(i=>Number(i.stock_quantity)>0).length);$('#stock-dealers').textContent=fmt(groups.length);
 renderUnlinked();
}

function renderUnlinked(){
 const rows=operations.filter(r=>!r.inventory_item_id&&!serviceTypes.has(r.operation_type)),section=$('#unlinked-section'),list=$('#unlinked-list');section.hidden=!rows.length;list.replaceChildren();
 rows.slice().sort((a,b)=>b.operation_date.localeCompare(a.operation_date)).forEach(r=>{
  const row=el('div',undefined,'stock-row'),info=el('div'),farm=farms.find(f=>f.id===r.farm_id);info.append(el('h4',(farm?.name||'Tarla')+' · '+(r.product||operationLabels[r.operation_type])),el('p',r.notes||operationLabels[r.operation_type]),el('small',date(r.operation_date)));
  row.append(info,el('div',r.quantity?fmt(r.quantity)+' '+(r.quantity_unit||''):'Miktar eksik','row-quantity'));
  const actions=el('div',undefined,'stock-row-actions');
  if(r.cost_basis==='field_total'&&r.quantity>0&&units[r.quantity_unit]){
   const select=el('select');select.setAttribute('aria-label',(farm?.name||'Tarla')+' '+r.product+' için stok ürünü');select.add(new Option('Stok ürününü seç',''));items.filter(i=>i.base_unit===units[r.quantity_unit][0]).forEach(i=>select.add(new Option(itemLabel(i)+' · kalan '+fmt(i.stock_quantity)+' '+i.base_unit,i.id)));
   select.value=unlinkedChoices.get(r.id)||'';select.addEventListener('change',()=>unlinkedChoices.set(r.id,select.value));
   const save=el('button','Stokla Eşleştir','inventory-button');save.type='button';save.addEventListener('click',async()=>{
    if(saving||!session)return;if(!select.value){message('Önce kullanımın ait olduğu stok ürününü seç.',true);return;}saving=true;save.disabled=true;
    try{const {error}=await client.from('farmer_operations').update({inventory_item_id:select.value}).eq('id',r.id).eq('user_id',session.user.id).select('id').single();if(error)throw error;unlinkedChoices.delete(r.id);await refresh();message('Uygulama stokla eşleştirildi. Kalan miktar güncellendi.');}
    catch(error){message(stockError(error),true);}finally{saving=false;save.disabled=false;}
   });actions.append(select,save);
  }else info.append(el('p','Kaydı açıp kullanılan toplam miktarı ve birimini kontrol et.'));
  const a=el('a','Uygulama Kaydını Aç','inventory-button');a.href='uretim-kayitlari.html?edit='+encodeURIComponent(r.id);actions.append(a);row.append(actions);list.append(row);
 });
}
async function refresh(){
 if(!session||!client)return;if(loading){queued=true;return;}loading=true;const run=generation,uid=session.user.id;$('#inventory-refresh').disabled=true;
 try{
  const [stock,ops,fields,paymentRows]=await Promise.all([loadInventory(client,uid),readAll(client,'farmer_operations',uid),readAll(client,'farmer_farms',uid,'*,farmer_seasons(*)'),readAll(client,'farmer_inventory_payments',uid).catch(()=>null)]);
  if(run!==generation||session?.user.id!==uid)return;items=stock.items;purchases=stock.purchases;operations=ops;farms=fields;payments=paymentRows||[];paymentsReady=paymentRows!==null&&purchases.every(p=>p.paid_total!=null);ready=true;render();message('Güncel stok · '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
 }catch(error){if(run===generation){ready=false;message('Stok bilgileri yenilenemedi. '+stockError(error),true);}}
 finally{loading=false;$('#inventory-refresh').disabled=false;if(queued){queued=false;refresh();}}
}
function account(next){
 generation++;if(channel){client.removeChannel(channel);channel=null;}session=next;items=[];purchases=[];operations=[];farms=[];payments=[];paymentsReady=false;ready=false;expanded.clear();dealerExpanded.clear();productNodes.clear();dealerNodes.clear();unlinkedChoices.clear();$('#stock-list').replaceChildren();$('#stock-dealer-list').replaceChildren();$('#unlinked-list').replaceChildren();$('#unlinked-section').hidden=true;$('#stock-empty').hidden=true;$('#inventory-search').value='';['stock-total','stock-count','stock-dealers'].forEach(id=>$('#'+id).textContent='—');$('#inventory-auth').hidden=Boolean(session);
 if(!session){message('Stoklarını görmek için hesabına giriş yap.');return;}
 message('Stokların yükleniyor…');refresh();channel=client.channel('stock-'+session.user.id);['farmer_inventory_items','farmer_inventory_purchases','farmer_operations','farmer_farms','farmer_seasons','farmer_inventory_payments'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{if(!saving)refresh();}));channel.subscribe();
}
setMode(stockMode,{writeHash:false});
['product','supplier'].forEach(key=>{const button=$('#stock-tab-'+key);button.addEventListener('click',()=>{setMode(key);if(ready)render();});button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'product':event.key==='End'?'supplier':key==='product'?'supplier':'product';setMode(next,{focus:true});if(ready)render();});});
window.addEventListener('hashchange',()=>{setMode(location.hash==='#bayiler'?'supplier':'product',{writeHash:false});if(ready)render();});
$('#inventory-search').addEventListener('input',()=>{if(ready)render();});$('#inventory-refresh').addEventListener('click',refresh);
window.addEventListener('focus',()=>{if(session&&!saving)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!saving)refresh();});setInterval(()=>{if(!document.hidden&&session&&!saving)refresh();},30000);
if(cfg.url&&cfg.publishableKey){client=createClient(cfg.url,cfg.publishableKey);const {data,error}=await client.auth.getSession();if(error){$('#inventory-auth').hidden=false;message('Oturum alınamadı. Lütfen tekrar giriş yap.',true);}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id)setTimeout(()=>account(next),0);});}
else message('Kayıt servisi henüz yapılandırılmadı.',true);
