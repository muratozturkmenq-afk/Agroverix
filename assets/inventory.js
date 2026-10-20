import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=groups-v2';
import {units,fmt,money,converted,loadInventory,readAll,today,stockError} from './inventory-data.js?v=payments-v1';
import {createPaymentLedger} from './inventory-payments.js?v=split-v1';
import {showInventoryView} from './inventory-views.js?v=views-v1';

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
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('tr-TR');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function message(text,error=false,target=$('#inventory-status')){target.textContent=text;target.classList.toggle('is-error',error);}
function button(text,action){const b=el('button',text,'inventory-button');b.type='button';b.addEventListener('click',action);return b;}
function itemLabel(item){return item.name+(item.brand?' · '+item.brand:'');}
function matchingItem(){
 const unit=['torba','şişe'].includes($('#purchase-unit').value)?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const normalize=value=>String(value||'').trim().toLocaleLowerCase('tr-TR');
 return items.find(i=>normalize(i.name)===normalize($('#purchase-name').value)&&normalize(i.brand)===normalize($('#purchase-brand').value)&&i.base_unit===units[unit]?.[0]);
}
function populateItems(){updateForm();}
function updateForm(){
 const pack=['torba','şişe'].includes($('#purchase-unit').value),existing=matchingItem();
 $('#purchase-category').disabled=Boolean(existing);if(existing)$('#purchase-category').value=existing.category;
 $('#package-fields').hidden=!pack;$('#purchase-package').required=pack;$('#purchase-package').disabled=!pack;$('#purchase-package-unit').disabled=!pack;
 const unitPrice=$('#purchase-price-mode').value==='unit';
 $('#purchase-price-label').textContent=unitPrice?'Bir '+$('#purchase-unit').value+' Alış Fiyatı (TL) *':'Toplam Tutar (TL) *';
 const q=numeric('purchase-quantity'),p=numeric('purchase-price'),factor=pack?numeric('purchase-package'):1,unit=pack?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const amount=converted(q*factor,unit),total=purchaseTotal(q,p),item=existing;
 let text='Miktar ve fiyatı girince alışveriş özeti burada görünür.';
 if(q>0&&amount>0&&Number.isFinite(amount))text=fmt(q)+' '+$('#purchase-unit').value+(pack?' × '+fmt(factor)+' '+unit:'')+' = '+fmt(amount)+' '+units[unit][0]+' stok girişi'+(Number.isFinite(total)&&total>=0?' · '+money(total):'');
 if(item&&units[unit]?.[0]!==item.base_unit)text+=' · Bu ürün için '+item.base_unit+' ile uyumlu birim seç.';
 const old=purchases.find(p=>p.id===$('#purchase-id').value),paid=Number(old?.paid_total||0);
 if(paymentsReady&&Number.isFinite(total)&&total>=0&&Number.isFinite(paid))text+=' · Ödenen: '+money(paid)+' · Kalan Borç: '+money(total-paid);
 $('#purchase-preview').textContent=text;
}
form.addEventListener('input',updateForm);form.addEventListener('change',updateForm);
function resetForm(){form.reset();purchaseRequestId=crypto.randomUUID();$('#purchase-id').value='';$('#purchase-date').value=today();$('#purchase-title').textContent='Alışveriş Ekle';$('#purchase-save').textContent='Alışverişi Kaydet →';$('#purchase-cancel').hidden=true;updateForm();}
$('#purchase-cancel').addEventListener('click',()=>{resetForm();message('',false,$('#purchase-status'));});
function editPurchase(p){
 showInventoryView('purchase');
 const item=items.find(i=>i.id===p.item_id);if(!item){message('Alışverişin ürün bilgileri yüklenemedi. Sayfayı yenile.',true);return;}
 $('#purchase-id').value=p.id;$('#purchase-name').value=item.name;$('#purchase-brand').value=item.brand;$('#purchase-category').value=item.category;$('#purchase-supplier').value=p.supplier;$('#purchase-date').value=p.purchase_date;$('#purchase-unit').value=p.purchased_unit;$('#purchase-package-unit').value=p.package_unit||'kg';$('#purchase-price-mode').value='total';
 setNumberInputValue($('#purchase-quantity'),p.purchased_quantity);setNumberInputValue($('#purchase-package'),p.package_quantity??'');setNumberInputValue($('#purchase-price'),p.total_cost);$('#purchase-note').value=p.notes||'';
 $('#purchase-title').textContent='Alışverişi Düzenle';$('#purchase-save').textContent='Değişiklikleri Kaydet →';$('#purchase-cancel').hidden=false;updateForm();message('Kaydettiğinde stok fark kadar güncellenir.',false,$('#purchase-status'));form.scrollIntoView({behavior:'smooth',block:'start'});
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||!session||!ready)return;
 const q=numeric('purchase-quantity'),p=numeric('purchase-price'),pack=['torba','şişe'].includes($('#purchase-unit').value),pq=pack?numeric('purchase-package'):null,unit=pack?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const total=purchaseTotal(q,p),item=matchingItem();
 if(!$('#purchase-name').value.trim()){message('Ürün Adı zorunludur.',true,$('#purchase-status'));return;}
 if(!(q>0&&q<=1e9&&Number.isFinite(q))||!(Number.isFinite(p)&&p>=0)||!(total<=1e12)||pack&&!(pq>0&&pq<=1e9)){message('Miktar sıfırdan büyük, fiyat sıfır veya daha büyük olmalı. Ambalaj içeriğini de kontrol et.',true,$('#purchase-status'));return;}
 if(item&&units[unit]?.[0]!==item.base_unit){message('Seçilen ürünün stok birimi '+item.base_unit+'. Uyumlu bir alışveriş birimi seç.',true,$('#purchase-status'));return;}
 const old=purchases.find(p=>p.id===$('#purchase-id').value);
 if(old&&Math.round(total*100)<Math.round(Number(old.paid_total||0)*100)){message('Alışveriş bedeli kaydedilmiş ödemelerden az olamaz. Önce ödeme kayıtlarını kontrol et.',true,$('#purchase-status'));return;}
 const payload={id:$('#purchase-id').value||null,item_id:item?.id||null,name:$('#purchase-name').value.trim(),brand:$('#purchase-brand').value.trim(),category:$('#purchase-category').value,supplier:$('#purchase-supplier').value.trim(),purchase_date:$('#purchase-date').value,purchased_quantity:q,purchased_unit:$('#purchase-unit').value,package_quantity:pq,package_unit:pack?$('#purchase-package-unit').value:null,total_cost:Number(total.toFixed(2)),notes:$('#purchase-note').value.trim()};
 saving=true;$('#purchase-save').disabled=true;message('Alışveriş ve stok kaydediliyor…',false,$('#purchase-status'));
 try{const {data,error}=paymentsReady?await client.rpc('agroverix_save_purchase_and_payment',{p_purchase:payload,p_payment:null,p_request_id:purchaseRequestId}):await client.rpc('agroverix_save_inventory_purchase',{p_purchase:payload});if(error)throw error;resetForm();message('Alışveriş kaydedildi. Ödeme girmek için Ödeme Girişi düğmesini seç.',false,$('#purchase-status'));await refresh();if(data)ledger.selectPurchase(data);}
 catch(error){message(stockError(error),true,$('#purchase-status'));}
 finally{saving=false;$('#purchase-save').disabled=false;}
});
async function removePurchase(p,button){
 if(saving||!session)return;
 if(Number(p.paid_total||0)>0){ledger.selectPurchase(p.id);showInventoryView('payment',{scroll:true});ledger.notify('Bu alışverişte ödeme kayıtları var. Alışverişi silmeden önce ilgili ödemeleri kontrol et.');return;}
 if(!confirm('Bu alışveriş kaydı silinsin mi? Alınan miktar stoktan çıkarılır. Tarlalarda kullanılmış stok eksiye düşürülemez.'))return;
 saving=true;button.disabled=true;
 try{const {error}=await client.from('farmer_inventory_purchases').delete().eq('id',p.id).eq('user_id',session.user.id).select('id').single();if(error)throw error;if($('#purchase-id').value===p.id)resetForm();await refresh();message('Alışveriş silindi, stok güncellendi.');}
 catch(error){message(stockError(error),true);}finally{saving=false;button.disabled=false;}
}
function renderPurchases(){
 const query=$('#purchase-search').value.trim().toLocaleLowerCase('tr-TR'),list=$('#purchase-history-list');list.replaceChildren();
 const rows=purchases.filter(p=>{const item=items.find(i=>i.id===p.item_id);return ((item?itemLabel(item):'Ürün')+' '+p.supplier).toLocaleLowerCase('tr-TR').includes(query);});
 rows.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||a.id.localeCompare(b.id)).forEach(p=>{
  const item=items.find(i=>i.id===p.item_id),card=el('article',undefined,'purchase-list-card');card.append(el('h3',item?itemLabel(item):'Ürün bilgisi bulunamadı'),el('p','Bayi Adı: '+p.supplier),el('p','Alışveriş Tarihi: '+date(p.purchase_date)),el('p','Alınan Miktar: '+fmt(p.purchased_quantity)+' '+p.purchased_unit+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')),el('strong',money(p.total_cost)));
  if(paymentsReady)card.append(el('p','Ödenen: '+money(p.paid_total)+' · Kalan Borç: '+money((Math.round(Number(p.total_cost)*100)-Math.round(Number(p.paid_total)*100))/100)));
  const actions=el('div',undefined,'stock-row-actions'),remove=button('Sil',()=>removePurchase(p,remove)),pay=button('Ödeme Girişi',()=>{ledger.selectPurchase(p.id);showInventoryView('payment',{scroll:true});});pay.disabled=!paymentsReady;
  actions.append(button('Alışverişi Düzenle',()=>editPurchase(p)),pay,remove);card.append(actions);list.append(card);
 });
 $('#purchase-history-empty').hidden=rows.length>0;$('#purchase-history-empty').textContent=purchases.length?'Aramana uygun alışveriş bulunamadı.':'Henüz alışveriş kaydı yok. İlk alışverişini kaydettiğinde burada görünür.';
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
  message('Güncel alışveriş ve ödeme kayıtları · '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}));
  if(requestedEdit&&!requestedEditOpened){requestedEditOpened=true;const row=purchases.find(p=>p.id===requestedEdit);if(row)editPurchase(row);else message('Düzenlenecek alışveriş bulunamadı veya hesabına ait değil.',true);}
 }catch(error){if(run===generation){ready=false;paymentsReady=false;$('#purchase-fields').disabled=true;updateForm();ledger.update({session,purchases,items,payments,available:false});message(stockError(error),true);}}
 finally{loading=false;$('#inventory-refresh').disabled=false;if(refreshQueued){refreshQueued=false;refresh();}}
}
$('#purchase-search').addEventListener('input',renderPurchases);$('#inventory-refresh').addEventListener('click',refresh);
window.addEventListener('focus',()=>{if(session&&!saving)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!saving)refresh();});
setInterval(()=>{if(!document.hidden&&session&&!saving)refresh();},30000);
function account(next){generation++;if(channel){client.removeChannel(channel);channel=null;}session=next;ready=false;paymentsReady=false;items=[];purchases=[];payments=[];requestedEditOpened=false;resetForm();ledger.update({session,purchases,items,payments,available:false});$('#purchase-fields').disabled=true;$('#purchase-history-list').replaceChildren();$('#purchase-history-empty').hidden=false;$('#purchase-history-empty').textContent='Alışverişlerin giriş yaptıktan sonra burada görünür.';['inventory-total','inventory-paid','inventory-debt'].forEach(id=>$('#'+id).textContent='—');$('#inventory-auth').hidden=Boolean(session);message('',false,$('#purchase-status'));if(session){
 refresh();channel=client.channel('inventory-'+session.user.id);['farmer_inventory_items','farmer_inventory_purchases','farmer_inventory_payments'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{if(!saving)refresh();}));channel.subscribe();
 }else message('Giriş yaptıktan sonra alışveriş ve ödemelerini kaydedebilirsin.');}
if(cfg.url&&cfg.publishableKey){client=createClient(cfg.url,cfg.publishableKey);const {data,error}=await client.auth.getSession();if(error){message('Oturum alınamadı. Lütfen tekrar giriş yap.',true);$('#inventory-auth').hidden=false;}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id)setTimeout(()=>account(next),0);});}
else message('Kayıt servisi henüz yapılandırılmadı.',true);
