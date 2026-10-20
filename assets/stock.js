import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {units,fmt,money,loadInventory,readAll,totalsFor,stockError} from './inventory-data.js?v=payments-v1';
import {serviceTypes,operationLabels,seasonFor} from './farm-finance.js?v=seasons-v1';
import {costPerDecare} from './operation-cost.js';

const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{};
let client=null,session=null,items=[],purchases=[],operations=[],farms=[],ready=false,loading=false,queued=false,generation=0,saving=false,channel=null;
const expanded=new Set(),unlinkedChoices=new Map();
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
function render(){
 const query=normalize($('#inventory-search').value),list=$('#stock-list');list.replaceChildren();
 const purchased=new Set(purchases.map(p=>p.item_id)),used=new Set(operations.map(r=>r.inventory_item_id));
 const tracked=items.filter(i=>purchased.has(i.id)||used.has(i.id)||Number(i.stock_quantity)>0);
 const selected=tracked.filter(i=>normalize(itemLabel(i)+' '+dealers(purchases.filter(p=>p.item_id===i.id)).join(' ')).includes(query));
 selected.forEach(item=>{
  const totals=totalsFor(item,purchases,operations),card=el('details',undefined,'stock-product');card.id='stok-'+item.id;card.open=expanded.has(item.id);
  card.addEventListener('toggle',()=>{if(card.isConnected){if(card.open)expanded.add(item.id);else expanded.delete(item.id);}});
  const summary=el('summary'),head=el('div',undefined,'stock-product-heading'),title=el('div');title.append(el('h3',item.name),el('p',item.brand||'Marka belirtilmemiş'));head.append(title,el('span',totals.remaining>0?'Stokta':'Tükendi','stock-tag'));
  const seller=el('p',undefined,'stock-dealers');seller.append(el('b','Bayi Adı: '),document.createTextNode(dealers(totals.receipts).join(', ')||'Bayi kaydı bulunamadı'));
  const nums=el('dl',undefined,'stock-product-metrics');metric(nums,'Toplam Maliyet',money(totals.cost));metric(nums,'Toplam Miktar',fmt(totals.purchased)+' '+item.base_unit);metric(nums,'Kullanılan Miktar',fmt(totals.used)+' '+item.base_unit);metric(nums,'Kalan Miktar',fmt(totals.remaining)+' '+item.base_unit);
  summary.append(head,seller,nums,el('span','Tarla kullanım detayları','stock-open-hint'));
  const body=el('div',undefined,'stock-product-body');body.append(el('h4','Tarla Uygulamaları · '+totals.uses.length+' kayıt'));
  const uses=el('div',undefined,'stock-usage-list');
  totals.uses.slice().sort((a,b)=>b.operation_date.localeCompare(a.operation_date)||b.id.localeCompare(a.id)).forEach(record=>{
   const row=el('article',undefined,'stock-usage'),values=el('dl',undefined,'stock-usage-metrics'),farm=farms.find(f=>f.id===record.farm_id),total=applicationTotal(record);
   metric(values,'Tarla Adı',farm?.name||'Tarla kaydı bulunamadı');metric(values,'Uygulama Tarihi',date(record.operation_date));metric(values,'Kullanılan Miktar',fmt(record.inventory_quantity)+' '+item.base_unit);metric(values,'Uygulama Tutarı',total===null?'Maliyet bilgisi eksik':money(total));
   const a=el('a','Uygulama Kaydını Aç →');a.href='uretim-kayitlari.html?edit='+encodeURIComponent(record.id);
   row.append(values,el('p',(operationLabels[record.operation_type]||'Uygulama')+' · '+record.season_year+' sezonu'+(record.notes?' · '+record.notes:'')),a);uses.append(row);
  });
  if(!totals.uses.length)uses.append(el('p','Bu ürün henüz bir tarlada kullanılmadı.','payment-help'));
  body.append(uses);
  const history=el('details',undefined,'stock-receipts');history.append(el('summary','Bayi ve Alışveriş Detayları · '+totals.receipts.length+' kayıt'));
  totals.receipts.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||b.id.localeCompare(a.id)).forEach(p=>{
   const row=el('article',undefined,'stock-receipt');row.append(el('b',p.supplier||'Bayi belirtilmemiş'),el('p','Alışveriş Tarihi: '+date(p.purchase_date)),el('p',fmt(p.purchased_quantity)+' '+p.purchased_unit+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')+' · '+fmt(p.quantity)+' '+item.base_unit),el('p','Alışveriş Tutarı: '+money(p.total_cost)));
   if(p.notes)row.append(el('p',p.notes));const a=el('a','Alışveriş ve Ödeme Detayını Aç →');a.href='alisveris-stok.html?edit='+encodeURIComponent(p.id)+'#alisveris-ekle';row.append(a);history.append(row);
  });
  body.append(history);card.append(summary,body);list.append(card);
 });
 $('#stock-empty').hidden=!ready||tracked.length>0;
 if(tracked.length&&!selected.length)list.append(el('p','Aramana uygun ürün, marka veya bayi bulunamadı.','inventory-empty'));
 $('#stock-total').textContent=money(purchases.reduce((n,p)=>n+Number(p.total_cost),0));$('#stock-count').textContent=fmt(tracked.filter(i=>Number(i.stock_quantity)>0).length);$('#stock-uses').textContent=fmt(operations.filter(r=>r.inventory_item_id).length);
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
  const [stock,ops,fields]=await Promise.all([loadInventory(client,uid),readAll(client,'farmer_operations',uid),readAll(client,'farmer_farms',uid,'*,farmer_seasons(*)')]);
  if(run!==generation||session?.user.id!==uid)return;items=stock.items;purchases=stock.purchases;operations=ops;farms=fields;ready=true;render();message('Güncel stok · '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
 }catch(error){if(run===generation){ready=false;message('Stok bilgileri yenilenemedi. '+stockError(error),true);}}
 finally{loading=false;$('#inventory-refresh').disabled=false;if(queued){queued=false;refresh();}}
}
function account(next){
 generation++;if(channel){client.removeChannel(channel);channel=null;}session=next;items=[];purchases=[];operations=[];farms=[];ready=false;expanded.clear();unlinkedChoices.clear();$('#stock-list').replaceChildren();$('#unlinked-list').replaceChildren();$('#unlinked-section').hidden=true;$('#stock-empty').hidden=true;$('#inventory-search').value='';['stock-total','stock-count','stock-uses'].forEach(id=>$('#'+id).textContent='—');$('#inventory-auth').hidden=Boolean(session);
 if(!session){message('Stoklarını görmek için hesabına giriş yap.');return;}
 message('Stokların yükleniyor…');refresh();channel=client.channel('stock-'+session.user.id);['farmer_inventory_items','farmer_inventory_purchases','farmer_operations','farmer_farms','farmer_seasons'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{if(!saving)refresh();}));channel.subscribe();
}
$('#inventory-search').addEventListener('input',()=>{if(ready)render();});$('#inventory-refresh').addEventListener('click',refresh);
window.addEventListener('focus',()=>{if(session&&!saving)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!saving)refresh();});setInterval(()=>{if(!document.hidden&&session&&!saving)refresh();},30000);
if(cfg.url&&cfg.publishableKey){client=createClient(cfg.url,cfg.publishableKey);const {data,error}=await client.auth.getSession();if(error){$('#inventory-auth').hidden=false;message('Oturum alınamadı. Lütfen tekrar giriş yap.',true);}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id)setTimeout(()=>account(next),0);});}
else message('Kayıt servisi henüz yapılandırılmadı.',true);
