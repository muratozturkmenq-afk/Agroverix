import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=international-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {expenseCategories,categoryKind,categoryLabel} from './expense-categories.js?v=international-v1';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=international-v1';
import {units,fmt,money,converted,loadInventory,readAll,today,stockError} from './inventory-data.js?v=international-v1';
import {createPaymentLedger} from './inventory-payments.js?v=international-v1';
import {showInventoryView} from './inventory-views.js?v=international-v1';

const $=s=>document.querySelector(s),form=$('#purchase-form'),cfg=window.AGROVERIX_SUPABASE||{};
let client=null,session=null,items=[],purchases=[],loading=false,refreshQueued=false,generation=0,ready=false,saving=false,channel=null;
let payments=[],paymentsReady=false,purchaseRequestId=crypto.randomUUID(),requestedEditOpened=false;
const requestedEdit=new URLSearchParams(location.search).get('edit');
const ledger=createPaymentLedger({getClient:()=>client,refresh,getSaving:()=>saving,setSaving:value=>saving=value,onEditPurchase:editPurchase});
['purchase-quantity','purchase-package'].forEach(id=>bindNumberInput($('#'+id),{maximumFractionDigits:6}));
bindNumberInput($('#purchase-price'),{maximumFractionDigits:2});
$('#purchase-date').value=today();
const numeric=id=>parseNumberInput($('#'+id).value);
function purchaseTotal(q,p){const value=$('#purchase-price-mode').value==='unit'?q*p:p;return Number.isFinite(value)?Math.round((value+Number.EPSILON)*100)/100:value;}
const date=value=>new Date(value+'T12:00:00').toLocaleDateString(I.locale);
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function message(text,error=false,target=$('#inventory-status')){target.textContent=text;target.classList.toggle('is-error',error);}
function button(text,action){const b=el('button',text,'inventory-button');b.type='button';b.addEventListener('click',action);return b;}
function itemLabel(item){return item.name+(item.brand?' · '+item.brand:'');}
function matchingItem(){
 const unit=['torba','şişe'].includes($('#purchase-unit').value)?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const normalize=value=>String(value||'').trim().toLocaleLowerCase('tr-TR');
 return items.find(i=>normalize(i.name)===normalize($('#purchase-name').value)&&normalize(i.brand)===normalize($('#purchase-kind').value==='service'?'':$('#purchase-brand').value)&&i.base_unit===units[unit]?.[0]&&i.category===$('#purchase-category').value);
}
function purchaseCategories(kind,selected){
 const select=$('#purchase-category');select.replaceChildren();
 Object.entries(expenseCategories).filter(([key])=>categoryKind(key)===kind).forEach(([key,name])=>select.add(new Option(name,key)));
 if(selected&&[...select.options].some(o=>o.value===selected))select.value=selected;
 else select.value=kind==='service'?'maintenance':'fertilizer';
}
function kindChanged(){
 const service=$('#purchase-kind').value==='service';purchaseCategories(service?'service':'stock');
 if(service){$('#purchase-unit').value='adet';if(!$('#purchase-quantity').value.trim())setNumberInputValue($('#purchase-quantity'),1);}
 else $('#purchase-unit').value='kg';
 updateForm();
}
$('#purchase-kind').addEventListener('change',kindChanged);
$('#purchase-category').addEventListener('change',()=>{
 const kind=categoryKind($('#purchase-category').value),changed=$('#purchase-kind').value!==kind;
 $('#purchase-kind').value=kind;
 if(changed&&kind==='service'){$('#purchase-unit').value='adet';if(!$('#purchase-quantity').value.trim())setNumberInputValue($('#purchase-quantity'),1);}
 else if(changed&&kind==='stock')$('#purchase-unit').value=$('#purchase-category').value==='fuel'?'L':'kg';
 else if($('#purchase-category').value==='fuel'&&!$('#purchase-id').value)$('#purchase-unit').value='L';
 updateForm();
});
purchaseCategories('stock','fertilizer');
function populateItems(){updateForm();}
function updateForm(){
 const pack=['torba','şişe'].includes($('#purchase-unit').value),existing=matchingItem();
 $('#purchase-category').disabled=false;
 const service=$('#purchase-kind').value==='service';
 $('#purchase-supplier-field').hidden=service;$('#purchase-supplier').disabled=service;$('#purchase-supplier').required=!service;
 $('#purchase-brand').required=service;$('#purchase-brand-label').textContent=service?__avt("Firma Adı *"):__avt("Firma Adı");
 $('#purchase-service-hint').hidden=!service;
 $('#purchase-quantity-label').textContent=service?__avt("Uygulamalara Dağıtılacak Miktar *"):__avt("Alınan Miktar *");
 $('#purchase-name').placeholder=service?__avt("Örn. traktör bakımı veya elektrik faturası"):__avt("Örn. DAP gübresi veya mazot");
 $('#package-fields').hidden=!pack;$('#purchase-package').required=pack;$('#purchase-package').disabled=!pack;$('#purchase-package-unit').disabled=!pack;
 const unitPrice=$('#purchase-price-mode').value==='unit';
 $('#purchase-price-label').textContent=unitPrice?__avt("Masrafın Adet Alış Fiyatı (TL) *"):__avt("Masraf Toplamı (TL) *");
 const q=numeric('purchase-quantity'),p=numeric('purchase-price'),factor=pack?numeric('purchase-package'):1,unit=pack?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const amount=converted(q*factor,unit),total=purchaseTotal(q,p),item=existing;
 let text=__avt("Miktar ve fiyatı girince masraf özeti burada görünür.");
 if(q>0&&amount>0&&Number.isFinite(amount))text=fmt(q)+' '+$('#purchase-unit').value+(pack?' × '+fmt(factor)+' '+unit:'')+' = '+fmt(amount)+' '+units[unit][0]+(service?__avt(" dağıtılacak gider miktarı"):__avt(" stok girişi"))+(Number.isFinite(total)&&total>=0?' · '+money(total):'');
 if(item&&units[unit]?.[0]!==item.base_unit)text+=__avt(" · Bu ürün için ")+item.base_unit+__avt(" ile uyumlu birim seç.");
 const old=purchases.find(p=>p.id===$('#purchase-id').value),paid=Number(old?.paid_total||0);
 if(paymentsReady&&Number.isFinite(total)&&total>=0&&Number.isFinite(paid))text+=__avt(" · Ödenen: ")+money(paid)+__avt(" · Kalan Borç: ")+money(total-paid);
 $('#purchase-preview').textContent=text;
}
form.addEventListener('input',updateForm);form.addEventListener('change',updateForm);
function resetForm(){form.reset();purchaseCategories('stock','fertilizer');purchaseRequestId=crypto.randomUUID();$('#purchase-id').value='';$('#purchase-date').value=today();$('#purchase-title').textContent=__avt("Masraf Ekle");$('#purchase-save').textContent=__avt("Masrafı Kaydet →");$('#purchase-cancel').hidden=true;updateForm();}
$('#purchase-cancel').addEventListener('click',()=>{resetForm();message('',false,$('#purchase-status'));});
function editPurchase(p){
 showInventoryView('purchase');
 const item=items.find(i=>i.id===p.item_id);if(!item){message(__avt("Masrafın ürün bilgileri yüklenemedi. Sayfayı yenile."),true);return;}
 $('#purchase-kind').value=categoryKind(item.category);purchaseCategories(categoryKind(item.category),item.category);
 $('#purchase-id').value=p.id;$('#purchase-name').value=item.name;$('#purchase-brand').value=categoryKind(item.category)==='service'?p.supplier:item.brand;$('#purchase-category').value=item.category;$('#purchase-supplier').value=p.supplier;$('#purchase-date').value=p.purchase_date;$('#purchase-unit').value=p.purchased_unit;$('#purchase-package-unit').value=p.package_unit||'kg';$('#purchase-price-mode').value='total';
 setNumberInputValue($('#purchase-quantity'),p.purchased_quantity);setNumberInputValue($('#purchase-package'),p.package_quantity??'');setNumberInputValue($('#purchase-price'),p.total_cost);$('#purchase-note').value=p.notes||'';
 $('#purchase-title').textContent=__avt("Masrafı Düzenle");$('#purchase-save').textContent=__avt("Değişiklikleri Kaydet →");$('#purchase-cancel').hidden=false;updateForm();message(__avt("Kaydettiğinde stok fark kadar güncellenir."),false,$('#purchase-status'));form.scrollIntoView({behavior:'smooth',block:'start'});
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||!session||!ready)return;
 const q=numeric('purchase-quantity'),p=numeric('purchase-price'),pack=['torba','şişe'].includes($('#purchase-unit').value),pq=pack?numeric('purchase-package'):null,unit=pack?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const service=$('#purchase-kind').value==='service',total=purchaseTotal(q,p);
 let item=matchingItem();
 const prior=purchases.find(row=>row.id===$('#purchase-id').value),priorItem=items.find(row=>row.id===prior?.item_id);
 if(service&&priorItem&&priorItem.name===$('#purchase-name').value.trim()&&priorItem.category===$('#purchase-category').value&&priorItem.base_unit===units[unit]?.[0])item=priorItem;
 if(service&&!$('#purchase-brand').value.trim()){message(__avt("Firma Adı zorunludur."),true,$('#purchase-status'));return;}
 if(!$('#purchase-name').value.trim()){message(__avt("Ürünün Adı/İçeriği zorunludur."),true,$('#purchase-status'));return;}
 if(!(q>0&&q<=1e9&&Number.isFinite(q))||!(Number.isFinite(p)&&p>=0)||!(total<=1e12)||pack&&!(pq>0&&pq<=1e9)){message(__avt("Miktar sıfırdan büyük, fiyat sıfır veya daha büyük olmalı. Ambalaj içeriğini de kontrol et."),true,$('#purchase-status'));return;}
 if(item&&units[unit]?.[0]!==item.base_unit){message(__avt("Seçilen ürünün stok birimi ")+item.base_unit+__avt(". Uyumlu bir masraf birimi seç."),true,$('#purchase-status'));return;}
 const old=purchases.find(p=>p.id===$('#purchase-id').value);
 if(old&&Math.round(total*100)<Math.round(Number(old.paid_total||0)*100)){message(__avt("Masraf bedeli kaydedilmiş ödemelerden az olamaz. Önce ödeme kayıtlarını kontrol et."),true,$('#purchase-status'));return;}
 const payload={id:$('#purchase-id').value||null,item_id:item?.id||null,name:$('#purchase-name').value.trim(),brand:service?'':$('#purchase-brand').value.trim(),category:$('#purchase-category').value,supplier:(service?$('#purchase-brand'):$('#purchase-supplier')).value.trim(),purchase_date:$('#purchase-date').value,purchased_quantity:q,purchased_unit:$('#purchase-unit').value,package_quantity:pq,package_unit:pack?$('#purchase-package-unit').value:null,total_cost:Number(total.toFixed(2)),notes:$('#purchase-note').value.trim()};
 saving=true;$('#purchase-save').disabled=true;message(__avt("Masraf ve stok kaydediliyor…"),false,$('#purchase-status'));
 try{const {data,error}=paymentsReady?await client.rpc('agroverix_save_purchase_and_payment',{p_purchase:payload,p_payment:null,p_request_id:purchaseRequestId}):await client.rpc('agroverix_save_inventory_purchase',{p_purchase:payload});if(error)throw error;resetForm();message(__avt("Masraf kaydedildi. Ödeme girmek için Ödeme Girişi düğmesini seç."),false,$('#purchase-status'));await refresh();if(data)ledger.selectPurchase(data);}
 catch(error){message(stockError(error),true,$('#purchase-status'));}
 finally{saving=false;$('#purchase-save').disabled=false;}
});
async function removePurchase(p,button){
 if(saving||!session)return;
 if(Number(p.paid_total||0)>0){ledger.selectPurchase(p.id);showInventoryView('payment',{scroll:true});ledger.notify(__avt("Bu masrafta ödeme kayıtları var. Masrafı silmeden önce ilgili ödemeleri kontrol et."));return;}
 if(!confirm(__avt("Bu masraf kaydı silinsin mi? Alınan miktar stoktan çıkarılır. Tarlalarda kullanılmış stok eksiye düşürülemez.")))return;
 saving=true;button.disabled=true;
 try{const {error}=await client.from('farmer_inventory_purchases').delete().eq('id',p.id).eq('user_id',session.user.id).select('id').single();if(error)throw error;if($('#purchase-id').value===p.id)resetForm();await refresh();message(__avt("Masraf silindi, stok güncellendi."));}
 catch(error){message(stockError(error),true);}finally{saving=false;button.disabled=false;}
}
function renderPurchases(){
 const query=$('#purchase-search').value.trim().toLocaleLowerCase('tr-TR'),list=$('#purchase-history-list');list.replaceChildren();
 const rows=purchases.filter(p=>{const item=items.find(i=>i.id===p.item_id);return ((item?itemLabel(item):__avt("Ürün"))+' '+p.supplier).toLocaleLowerCase('tr-TR').includes(query);});
 rows.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||a.id.localeCompare(b.id)).forEach(p=>{
  const item=items.find(i=>i.id===p.item_id),card=el('article',undefined,'purchase-list-card');card.append(el('h3',item?(categoryKind(item.category)==='service'?item.name:itemLabel(item)):__avt("Ürün bilgisi bulunamadı")),el('p',categoryLabel(item?.category)),el('p',(categoryKind(item?.category)==='service'?__avt("Firma Adı: "):__avt("Bayi Adı: "))+p.supplier),el('p',__avt("Masraf Tarihi: ")+date(p.purchase_date)),el('p',__avt("Alınan Miktar: ")+fmt(p.purchased_quantity)+' '+I.t(p.purchased_unit)+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')),el('strong',money(p.total_cost)));
  if(paymentsReady)card.append(el('p',__avt("Ödenen: ")+money(p.paid_total)+__avt(" · Kalan Borç: ")+money((Math.round(Number(p.total_cost)*100)-Math.round(Number(p.paid_total)*100))/100)));
  const actions=el('div',undefined,'stock-row-actions'),remove=button('Sil',()=>removePurchase(p,remove)),pay=button(__avt("Ödeme Girişi"),()=>{ledger.selectPurchase(p.id);showInventoryView('payment',{scroll:true});});pay.disabled=!paymentsReady;
  actions.append(button(__avt("Masrafı Düzenle"),()=>editPurchase(p)),pay,remove);card.append(actions);list.append(card);
 });
 $('#purchase-history-empty').hidden=rows.length>0;$('#purchase-history-empty').textContent=purchases.length?__avt("Aramana uygun masraf bulunamadı."):__avt("Henüz masraf kaydı yok. İlk masrafını kaydettiğinde burada görünür.");
}
async function refresh(){
 if(!session||!client)return;if(loading){refreshQueued=true;return;}loading=true;const run=generation,uid=session.user.id;$('#inventory-refresh').disabled=true;
 try{
  const [stock,paymentRows]=await Promise.all([loadInventory(client,uid),readAll(client,'farmer_inventory_payments',uid).catch(()=>null)]);
  if(run!==generation||session?.user.id!==uid)return;
  items=stock.items;purchases=stock.purchases;payments=paymentRows||[];paymentsReady=paymentRows!==null&&purchases.every(p=>'paid_total' in p);ready=true;$('#purchase-fields').disabled=false;
  populateItems();renderPurchases();$('#inventory-total').textContent=money(purchases.reduce((n,p)=>n+Number(p.total_cost),0));
  $('#inventory-paid').textContent=paymentsReady?money(purchases.reduce((n,p)=>n+Math.round(Number(p.paid_total)*100),0)/100):'—';$('#inventory-debt').textContent=paymentsReady?money(purchases.reduce((n,p)=>n+Math.round(Number(p.total_cost)*100)-Math.round(Number(p.paid_total)*100),0)/100):'—';
  ledger.update({session,purchases,items,payments,available:paymentsReady});
  message(__avt("Güncel masraf ve ödeme kayıtları · ")+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
  if(requestedEdit&&!requestedEditOpened){requestedEditOpened=true;const row=purchases.find(p=>p.id===requestedEdit);if(row)editPurchase(row);else message(__avt("Düzenlenecek masraf bulunamadı veya hesabına ait değil."),true);}
 }catch(error){if(run===generation){ready=false;paymentsReady=false;$('#purchase-fields').disabled=true;updateForm();ledger.update({session,purchases,items,payments,available:false});message(stockError(error),true);}}
 finally{loading=false;$('#inventory-refresh').disabled=false;if(refreshQueued){refreshQueued=false;refresh();}}
}
$('#purchase-search').addEventListener('input',renderPurchases);$('#inventory-refresh').addEventListener('click',refresh);
window.addEventListener('focus',()=>{if(session&&!saving)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!saving)refresh();});
setInterval(()=>{if(!document.hidden&&session&&!saving)refresh();},30000);
function account(next){generation++;if(channel){client.removeChannel(channel);channel=null;}session=next;ready=false;paymentsReady=false;items=[];purchases=[];payments=[];requestedEditOpened=false;resetForm();ledger.update({session,purchases,items,payments,available:false});$('#purchase-fields').disabled=true;$('#purchase-history-list').replaceChildren();$('#purchase-history-empty').hidden=false;$('#purchase-history-empty').textContent=__avt("Masrafların giriş yaptıktan sonra burada görünür.");['inventory-total','inventory-paid','inventory-debt'].forEach(id=>$('#'+id).textContent='—');$('#inventory-auth').hidden=Boolean(session);message('',false,$('#purchase-status'));if(session){
 refresh();channel=client.channel('inventory-'+session.user.id);['farmer_inventory_items','farmer_inventory_purchases','farmer_inventory_payments'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{if(!saving)refresh();}));channel.subscribe();
 }else message(__avt("Giriş yaptıktan sonra masraf ve ödemelerini kaydedebilirsin."));}
if(cfg.url&&cfg.publishableKey){client=(regionalClient||createClient(cfg.url,cfg.publishableKey));const {data,error}=await client.auth.getSession();if(error){message(__avt("Oturum alınamadı. Lütfen tekrar giriş yap."),true);$('#inventory-auth').hidden=false;}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id)setTimeout(()=>account(next),0);});}
else message(__avt("Kayıt servisi henüz yapılandırılmadı."),true);
