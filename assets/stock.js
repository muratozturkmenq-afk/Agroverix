import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {expenseCategories,categoryLabel,categoryKind} from './expense-categories.js?v=international-v1';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {units,fmt,money,loadInventory,readAll,totalsFor,stockError} from './inventory-data.js?v=international-v1';
import {serviceTypes,operationLabels,seasonFor} from './farm-finance.js?v=international-v1';
import {costPerDecare} from './operation-cost.js?v=international-v1';

const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{};
let client=null,session=null,items=[],purchases=[],operations=[],farms=[],ready=false,loading=false,queued=false,generation=0,saving=false,channel=null;
const expanded=new Set(),unlinkedChoices=new Map();
const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString(I.locale):'—';
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
function nameButton(text,expanded,controls,action){
 const b=el('button',text,'stock-name-button');b.type='button';b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-controls',controls);b.addEventListener('click',action);return b;
}
function quantityRow(values){
 const dl=el('dl',undefined,'stock-quantity-grid');values.forEach(([label,value])=>metric(dl,label,value));return dl;
}
function detailTotal(label,value){const box=el('div',undefined,'stock-row-total');box.append(el('span',label),el('b',value));return box;}
function applicationRows(totals,item){
 const uses=el('div',undefined,'stock-usage-list');
 totals.uses.slice().sort((a,b)=>a.operation_date.localeCompare(b.operation_date)||a.id.localeCompare(b.id)).forEach(record=>{
  const row=el('article',undefined,'stock-usage'),values=el('dl',undefined,'stock-usage-metrics'),farm=farms.find(f=>f.id===record.farm_id),total=applicationTotal(record);
  const field=el('div');field.append(el('dt',__avt("Tarla Adı")));const fieldValue=el('dd');
  if(farm){const link=el('a',farm.name);link.href='tarla-detay.html?farm='+encodeURIComponent(farm.id)+'&year='+encodeURIComponent(record.season_year);fieldValue.append(link);}else fieldValue.textContent=__avt("Tarla kaydı bulunamadı");
  field.append(fieldValue);values.append(field);metric(values,__avt("Uygulama Tarihi"),date(record.operation_date));metric(values,__avt("Kullanılan Miktar"),fmt(record.inventory_quantity)+' '+I.t(item.base_unit));metric(values,__avt("Uygulama Tutarı"),total===null?__avt("Maliyet bilgisi eksik"):money(total));
  const a=el('a',__avt("Uygulama Kaydını Aç →"));a.href='uretim-kayitlari.html?edit='+encodeURIComponent(record.id);
  row.append(values,el('p',(operationLabels[record.operation_type]||__avt("Uygulama"))+' · '+record.season_year+__avt(" sezonu")+(record.notes?' · '+record.notes:'')),a);uses.append(row);
 });
 if(!totals.uses.length)uses.append(el('p',__avt("Bu ürün henüz bir tarlada kullanılmadı."),'payment-help'));
 return uses;
}
function purchaseHistory(receipts,item){
 const history=el('details',undefined,'stock-receipts');history.append(el('summary',__avt("Masraf Kayıtları · ")+receipts.length+__avt(" kayıt")));
 receipts.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||b.id.localeCompare(a.id)).forEach(p=>{
  const row=el('article',undefined,'stock-receipt'),b=el('b',p.supplier||__avt("Bayi belirtilmemiş"));
  row.append(b,el('p',__avt("Masraf Tarihi: ")+date(p.purchase_date)),el('p',fmt(p.purchased_quantity)+' '+I.t(p.purchased_unit)+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')+' · '+fmt(p.quantity)+' '+(item?.base_unit||'')),el('p',__avt("Masraf Tutarı: ")+money(p.total_cost)));
  if(p.notes)row.append(el('p',p.notes));const a=el('a',__avt("Masraf Kaydını Aç →"));a.href='alisveris-stok.html?edit='+encodeURIComponent(p.id)+'#alisveris-ekle';row.append(a);history.append(row);
 });return history;
}
function renderProducts(tracked,query){
 const list=$('#stock-list');list.replaceChildren();
 const selected=tracked.filter(i=>normalize(categoryLabel(i.category)+' '+itemLabel(i)+' '+dealers(purchases.filter(p=>p.item_id===i.id)).join(' ')).includes(query));
 const categoryNodes=new Map();
 selected.sort((a,b)=>Object.keys(expenseCategories).indexOf(a.category)-Object.keys(expenseCategories).indexOf(b.category)||a.name.localeCompare(b.name,'tr'));
 selected.forEach(item=>{
  if(!categoryNodes.has(item.category)){
   const section=el('section',undefined,'stock-category'),head=el('div',undefined,'stock-category-head'),grid=el('div',undefined,'stock-category-grid');head.append(el('h3',categoryLabel(item.category)),el('span',selected.filter(i=>i.category===item.category).length+__avt(" kayıt")));section.append(head);
   if(categoryKind(item.category)==='service')section.append(el('p',__avt("Bu bölümde fiziksel stok yerine tarlalara dağıtılan ve henüz dağıtılmamış gider miktarı gösterilir."),'stock-category-note'));
   section.append(grid);list.append(section);categoryNodes.set(item.category,grid);
  }
  const totals=totalsFor(item,purchases,operations),card=el('article',undefined,'stock-product'),head=el('div',undefined,'stock-row-heading'),title=el('div'),isOpen=expanded.has(item.id),bodyId='stock-product-detail-'+item.id;
  card.id='stok-'+item.id;
  const body=el('div',undefined,'stock-product-body');body.id=bodyId;body.hidden=!isOpen;
  const heading=el('h3'),b=nameButton(item.name,isOpen,bodyId,()=>{const open=body.hidden;body.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)expanded.add(item.id);else expanded.delete(item.id);});heading.append(b);title.append(heading,el('p',item.brand||__avt("Firma belirtilmemiş")));head.append(title,detailTotal(__avt("Toplam Maliyet"),money(totals.cost)));
  const sellers=el('div',undefined,'stock-row-dealers');sellers.append(el('span',__avt("Bayi: ")));
  const names=dealers(totals.receipts);if(!names.length)sellers.append(document.createTextNode(__avt("Bayi kaydı bulunamadı")));
  names.forEach(name=>sellers.append(el('span',name)));
  const service=categoryKind(item.category)==='service';
  const numbers=quantityRow([[service?__avt("Kaydedilen Miktar"):__avt("Alınan Miktar"),fmt(totals.purchased)+' '+I.t(item.base_unit)],[service?__avt("Tarlalara Dağıtılan"):__avt("Kullanılan Miktar"),fmt(totals.used)+' '+I.t(item.base_unit)],[service?__avt("Dağıtılmamış Miktar"):__avt("Kalan Miktar"),fmt(totals.remaining)+' '+I.t(item.base_unit)]]);
  const summary=el('div',undefined,'stock-row-summary');summary.append(head,numbers,sellers);
  body.append(el('h4',__avt("Tarla Kullanımları · ")+totals.uses.length+__avt(" uygulama")),applicationRows(totals,item),purchaseHistory(totals.receipts,item));card.append(summary,body);categoryNodes.get(item.category).append(card);
 });
 if(ready&&tracked.length&&!selected.length)list.append(el('p',__avt("Aramana uygun ürün, firma veya bayi bulunamadı."),'inventory-empty'));
}
function render(){
 const tracked=trackItems(),query=normalize($('#inventory-search').value);
 renderProducts(tracked,query);
 $('#stock-empty').hidden=!ready||tracked.length>0;
 renderUnlinked();
}

function renderUnlinked(){
 const rows=operations.filter(r=>!r.inventory_item_id&&!serviceTypes.has(r.operation_type)),section=$('#unlinked-section'),list=$('#unlinked-list');section.hidden=!rows.length;list.replaceChildren();
 rows.slice().sort((a,b)=>b.operation_date.localeCompare(a.operation_date)).forEach(r=>{
  const row=el('div',undefined,'stock-row'),info=el('div'),farm=farms.find(f=>f.id===r.farm_id);info.append(el('h4',(farm?.name||__avt("Tarla"))+' · '+(r.product||operationLabels[r.operation_type])),el('p',r.notes||operationLabels[r.operation_type]),el('small',date(r.operation_date)));
  row.append(info,el('div',r.quantity?fmt(r.quantity)+' '+(r.quantity_unit||''):__avt("Miktar eksik"),'row-quantity'));
  const actions=el('div',undefined,'stock-row-actions');
  if(r.cost_basis==='field_total'&&r.quantity>0&&units[r.quantity_unit]){
   const select=el('select');select.setAttribute('aria-label',(farm?.name||__avt("Tarla"))+' '+r.product+__avt(" için stok ürünü"));select.add(new Option(__avt("Stok ürününü seç"),''));items.filter(i=>i.base_unit===units[r.quantity_unit][0]).forEach(i=>select.add(new Option(itemLabel(i)+__avt(" · kalan ")+fmt(i.stock_quantity)+' '+i.base_unit,i.id)));
   select.value=unlinkedChoices.get(r.id)||'';select.addEventListener('change',()=>unlinkedChoices.set(r.id,select.value));
   const save=el('button',__avt("Stokla Eşleştir"),'inventory-button');save.type='button';save.addEventListener('click',async()=>{
    if(saving||!session)return;if(!select.value){message(__avt("Önce kullanımın ait olduğu stok ürününü seç."),true);return;}saving=true;save.disabled=true;
    try{const {error}=await client.from('farmer_operations').update({inventory_item_id:select.value}).eq('id',r.id).eq('user_id',session.user.id).select('id').single();if(error)throw error;unlinkedChoices.delete(r.id);await refresh();message(__avt("Uygulama stokla eşleştirildi. Kalan miktar güncellendi."));}
    catch(error){message(stockError(error),true);}finally{saving=false;save.disabled=false;}
   });actions.append(select,save);
  }else info.append(el('p',__avt("Kaydı açıp kullanılan toplam miktarı ve birimini kontrol et.")));
  const a=el('a',__avt("Uygulama Kaydını Aç"),'inventory-button');a.href='uretim-kayitlari.html?edit='+encodeURIComponent(r.id);actions.append(a);row.append(actions);list.append(row);
 });
}
async function refresh(){
 if(!session||!client)return;if(loading){queued=true;return;}loading=true;const run=generation,uid=session.user.id;$('#inventory-refresh').disabled=true;
 try{
  const [stock,ops,fields]=await Promise.all([loadInventory(client,uid),readAll(client,'farmer_operations',uid),readAll(client,'farmer_farms',uid,'*,farmer_seasons(*)')]);
  if(run!==generation||session?.user.id!==uid)return;items=stock.items;purchases=stock.purchases;operations=ops;farms=fields;ready=true;render();message(__avt("Güncel stok · ")+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
 }catch(error){if(run===generation){ready=false;message(__avt("Stok bilgileri yenilenemedi. ")+stockError(error),true);}}
 finally{loading=false;$('#inventory-refresh').disabled=false;if(queued){queued=false;refresh();}}
}
function account(next){
 generation++;if(channel){client.removeChannel(channel);channel=null;}session=next;items=[];purchases=[];operations=[];farms=[];ready=false;expanded.clear();unlinkedChoices.clear();$('#stock-list').replaceChildren();$('#unlinked-list').replaceChildren();$('#unlinked-section').hidden=true;$('#stock-empty').hidden=true;$('#inventory-search').value='';$('#inventory-auth').hidden=Boolean(session);
 if(!session){message(__avt("Stoklarını görmek için hesabına giriş yap."));return;}
 message(__avt("Stokların yükleniyor…"));refresh();channel=client.channel('stock-'+session.user.id);['farmer_inventory_items','farmer_inventory_purchases','farmer_operations','farmer_farms','farmer_seasons'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{if(!saving)refresh();}));channel.subscribe();
}
$('#inventory-search').addEventListener('input',()=>{if(ready)render();});$('#inventory-refresh').addEventListener('click',refresh);
window.addEventListener('focus',()=>{if(session&&!saving)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!saving)refresh();});setInterval(()=>{if(!document.hidden&&session&&!saving)refresh();},30000);
if(cfg.url&&cfg.publishableKey){client=(regionalClient||createClient(cfg.url,cfg.publishableKey));const {data,error}=await client.auth.getSession();if(error){$('#inventory-auth').hidden=false;message(__avt("Oturum alınamadı. Lütfen tekrar giriş yap."),true);}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id)setTimeout(()=>account(next),0);});}
else message(__avt("Kayıt servisi henüz yapılandırılmadı."),true);
