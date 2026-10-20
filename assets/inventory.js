import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=groups-v2';
import {units,fmt,money,converted,loadInventory,readAll,totalsFor,today,stockError} from './inventory-data.js?v=stock-v1';
import {serviceTypes,operationLabels} from './farm-finance.js?v=seasons-v1';

const $=s=>document.querySelector(s),form=$('#purchase-form'),cfg=window.AGROVERIX_SUPABASE||{};
let client=null,session=null,items=[],purchases=[],operations=[],farms=[],loading=false,refreshQueued=false,generation=0,ready=false,saving=false,channel=null;
['purchase-quantity','purchase-package'].forEach(id=>bindNumberInput($('#'+id),{maximumFractionDigits:6}));
bindNumberInput($('#purchase-price'),{maximumFractionDigits:2});
$('#purchase-date').value=today();
const numeric=id=>parseNumberInput($('#'+id).value);
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('tr-TR');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function message(text,error=false,target=$('#inventory-status')){target.textContent=text;target.classList.toggle('is-error',error);}
function button(text,action){const b=el('button',text,'inventory-button');b.type='button';b.addEventListener('click',action);return b;}
function itemLabel(item){return item.name+(item.brand?' · '+item.brand:'');}
function populateItems(){const s=$('#purchase-item'),old=s.value;s.replaceChildren(new Option('Yeni Ürün Ekle',''));items.forEach(i=>s.add(new Option(itemLabel(i)+' · '+i.base_unit,i.id)));if(items.some(i=>i.id===old))s.value=old;updateForm();}
function updateForm(){
 const existing=Boolean($('#purchase-item').value),pack=['torba','şişe'].includes($('#purchase-unit').value);
 $('#new-product-fields').hidden=existing;$('#purchase-name').required=!existing;
 ['purchase-name','purchase-brand','purchase-category'].forEach(id=>$('#'+id).disabled=existing);
 $('#package-fields').hidden=!pack;$('#purchase-package').required=pack;$('#purchase-package').disabled=!pack;$('#purchase-package-unit').disabled=!pack;
 const unitPrice=$('#purchase-price-mode').value==='unit';
 $('#purchase-price-label').textContent=unitPrice?'Bir '+$('#purchase-unit').value+' Alış Fiyatı (TL) *':'Toplam Tutar (TL) *';
 const q=numeric('purchase-quantity'),p=numeric('purchase-price'),factor=pack?numeric('purchase-package'):1,unit=pack?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const amount=converted(q*factor,unit),total=unitPrice?q*p:p,item=items.find(i=>i.id===$('#purchase-item').value);
 let text='Miktar ve fiyatı girince alışveriş özeti burada görünür.';
 if(q>0&&amount>0&&Number.isFinite(amount))text=fmt(q)+' '+$('#purchase-unit').value+(pack?' × '+fmt(factor)+' '+unit:'')+' = '+fmt(amount)+' '+units[unit][0]+' stok girişi'+(Number.isFinite(total)&&total>=0?' · '+money(total):'');
 if(item&&units[unit]?.[0]!==item.base_unit)text+=' · Bu ürün için '+item.base_unit+' ile uyumlu birim seç.';
 $('#purchase-preview').textContent=text;
}
form.addEventListener('input',updateForm);form.addEventListener('change',updateForm);
function resetForm(){form.reset();$('#purchase-id').value='';$('#purchase-date').value=today();$('#purchase-title').textContent='Alışveriş Ekle';$('#purchase-save').textContent='Alışverişi Kaydet →';$('#purchase-cancel').hidden=true;updateForm();}
$('#purchase-cancel').addEventListener('click',()=>{resetForm();message('',false,$('#purchase-status'));});
function editPurchase(p){
 $('#purchase-id').value=p.id;$('#purchase-item').value=p.item_id;$('#purchase-supplier').value=p.supplier;$('#purchase-date').value=p.purchase_date;$('#purchase-unit').value=p.purchased_unit;$('#purchase-package-unit').value=p.package_unit||'kg';$('#purchase-price-mode').value='total';
 setNumberInputValue($('#purchase-quantity'),p.purchased_quantity);setNumberInputValue($('#purchase-package'),p.package_quantity??'');setNumberInputValue($('#purchase-price'),p.total_cost);$('#purchase-note').value=p.notes||'';
 $('#purchase-title').textContent='Alışverişi Düzenle';$('#purchase-save').textContent='Değişiklikleri Kaydet →';$('#purchase-cancel').hidden=false;updateForm();message('Kaydettiğinde stok fark kadar güncellenir.',false,$('#purchase-status'));form.scrollIntoView({behavior:'smooth',block:'start'});
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||!session||!ready)return;
 const q=numeric('purchase-quantity'),p=numeric('purchase-price'),pack=['torba','şişe'].includes($('#purchase-unit').value),pq=pack?numeric('purchase-package'):null,unit=pack?$('#purchase-package-unit').value:$('#purchase-unit').value;
 const total=$('#purchase-price-mode').value==='unit'?q*p:p,item=items.find(i=>i.id===$('#purchase-item').value);
 if(!(q>0&&q<=1e9&&Number.isFinite(q))||!(Number.isFinite(p)&&p>=0)||!(total<=1e12)||pack&&!(pq>0&&pq<=1e9)){message('Miktar sıfırdan büyük, fiyat sıfır veya daha büyük olmalı. Ambalaj içeriğini de kontrol et.',true,$('#purchase-status'));return;}
 if(item&&units[unit]?.[0]!==item.base_unit){message('Seçilen ürünün stok birimi '+item.base_unit+'. Uyumlu bir alışveriş birimi seç.',true,$('#purchase-status'));return;}
 const payload={id:$('#purchase-id').value||null,item_id:item?.id||null,name:$('#purchase-name').value.trim(),brand:$('#purchase-brand').value.trim(),category:$('#purchase-category').value,supplier:$('#purchase-supplier').value.trim(),purchase_date:$('#purchase-date').value,purchased_quantity:q,purchased_unit:$('#purchase-unit').value,package_quantity:pq,package_unit:pack?$('#purchase-package-unit').value:null,total_cost:Number(total.toFixed(2)),notes:$('#purchase-note').value.trim()};
 saving=true;$('#purchase-save').disabled=true;message('Alışveriş ve stok kaydediliyor…',false,$('#purchase-status'));
 try{const {error}=await client.rpc('agroverix_save_inventory_purchase',{p_purchase:payload});if(error)throw error;resetForm();message('Alışveriş kaydedildi. Stok güncellendi.',false,$('#purchase-status'));await refresh();}
 catch(error){message(stockError(error),true,$('#purchase-status'));}
 finally{saving=false;$('#purchase-save').disabled=false;}
});
async function removePurchase(p,button){
 if(!confirm('Bu alışveriş kaydı silinsin mi? Alınan miktar stoktan çıkarılır. Tarlalarda kullanılmış stok eksiye düşürülemez.'))return;
 button.disabled=true;
 try{const {error}=await client.from('farmer_inventory_purchases').delete().eq('id',p.id).eq('user_id',session.user.id).select('id').single();if(error)throw error;if($('#purchase-id').value===p.id)resetForm();await refresh();message('Alışveriş silindi, stok güncellendi.');}
 catch(error){message(stockError(error),true);}finally{button.disabled=false;}
}
function detail(title){const d=el('details'),s=el('summary',title),body=el('div',undefined,'stock-rows');d.append(s,body);return {d,body};}
function renderStock(){
 const query=$('#inventory-search').value.trim().toLocaleLowerCase('tr'),list=$('#stock-list');list.replaceChildren();
 const chosen=items.filter(i=>itemLabel(i).toLocaleLowerCase('tr').includes(query));
 for(const item of chosen){
  const t=totalsFor(item,purchases,operations),card=el('article',undefined,'stock-card'),head=el('div',undefined,'stock-card-head'),title=el('div');title.append(el('h3',item.name),el('p',item.brand||'Marka belirtilmedi'));head.append(title,el('span',t.remaining>0?'Stokta':'Tükendi','stock-tag'));
  const nums=el('div',undefined,'stock-numbers');[['Alınan',t.purchased],['Kullanılan',t.used],['Kalan Stok',t.remaining]].forEach(([label,value],idx)=>{const n=el('div',undefined,idx===2?'stock-remaining':'');n.append(el('span',label),el('b',fmt(value)+' '+item.base_unit));nums.append(n);});
  const cost=el('div',undefined,'stock-cost'),costTotal=el('span','Toplam Alışveriş: '),avg=el('span','Ortalama Alış: ');costTotal.append(el('strong',money(t.cost)));avg.append(el('strong',t.average===null?'—':money(t.average)+' / '+item.base_unit));cost.append(costTotal,avg);
  const uses=detail('Kullanım Dökümü · '+t.uses.length+' uygulama');
  t.uses.slice().sort((a,b)=>b.operation_date.localeCompare(a.operation_date)).forEach(r=>{
   const row=el('div',undefined,'stock-row'),info=el('div'),f=farms.find(f=>f.id===r.farm_id);info.append(el('h4',f?.name||'Tarla kaydı bulunamadı'),el('p',r.notes||operationLabels[r.operation_type]||'Amaç belirtilmedi'),el('small',date(r.operation_date)+' · '+r.season_year+' sezonu'));
   const quantity=el('div',fmt(r.inventory_quantity)+' '+item.base_unit,'row-quantity');const actions=el('div',undefined,'stock-row-actions'),a=el('a','Kullanımı Düzenle','inventory-button');a.href='uretim-kayitlari.html?edit='+encodeURIComponent(r.id);actions.append(a);row.append(info,quantity,actions);uses.body.append(row);
  });
  if(!t.uses.length)uses.body.append(el('p','Bu ürün henüz bir tarlada kullanılmadı.','inventory-empty'));
  const history=detail('Alışveriş Geçmişi · '+t.receipts.length+' kayıt');
  t.receipts.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)).forEach(p=>{
   const row=el('div',undefined,'stock-row'),info=el('div');info.append(el('h4',p.supplier),el('p',date(p.purchase_date)+' · '+fmt(p.purchased_quantity)+' '+p.purchased_unit+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')),el('small',p.notes||'Alışveriş kaydı'));
   const value=el('div',money(p.total_cost),'row-quantity'),actions=el('div',undefined,'stock-row-actions'),remove=button('Sil',()=>removePurchase(p,remove));actions.append(button('Düzenle',()=>editPurchase(p)),remove);row.append(info,value,actions);history.body.append(row);
  });
  card.append(head,nums,cost,uses.d,history.d);list.append(card);
 }
 $('#stock-empty').hidden=!ready||items.length>0;if(items.length&&!chosen.length)list.append(el('p','Aramana uygun stok ürünü bulunamadı.','inventory-empty'));
}
function renderUnlinked(){
 const rows=operations.filter(r=>!r.inventory_item_id&&!serviceTypes.has(r.operation_type)),section=$('#unlinked-section'),list=$('#unlinked-list');section.hidden=!rows.length;list.replaceChildren();
 rows.slice().sort((a,b)=>b.operation_date.localeCompare(a.operation_date)).forEach(r=>{
  const row=el('div',undefined,'stock-row'),info=el('div'),farm=farms.find(f=>f.id===r.farm_id);info.append(el('h4',(farm?.name||'Tarla')+' · '+(r.product||operationLabels[r.operation_type])),el('p',r.notes||operationLabels[r.operation_type]),el('small',date(r.operation_date)));
  row.append(info,el('div',r.quantity?fmt(r.quantity)+' '+(r.quantity_unit||''):'Miktar eksik','row-quantity'));
  const actions=el('div',undefined,'stock-row-actions');
  if(r.cost_basis==='field_total'&&r.quantity>0&&units[r.quantity_unit]){
   const select=el('select');select.setAttribute('aria-label',(farm?.name||'Tarla')+' '+r.product+' için stok ürünü');select.add(new Option('Stok ürününü seç',''));items.filter(i=>i.base_unit===units[r.quantity_unit][0]).forEach(i=>select.add(new Option(itemLabel(i)+' · kalan '+fmt(i.stock_quantity)+' '+i.base_unit,i.id)));
   const save=button('Stokla Eşleştir',async()=>{if(!select.value){message('Önce bu kullanımın ait olduğu stok ürününü seç.',true);return;}save.disabled=true;try{const {error}=await client.from('farmer_operations').update({inventory_item_id:select.value}).eq('id',r.id).eq('user_id',session.user.id).select('id').single();if(error)throw error;await refresh();message('Kullanım stokla eşleştirildi. Kalan miktar güncellendi.');}catch(error){message(stockError(error),true);}finally{save.disabled=false;}});actions.append(select,save);
  }else{info.append(el('p','Eski kaydı açıp kullanılan toplam miktarı ve birimini kontrol et.'));}
  const a=el('a','Kaydı Aç','inventory-button');a.href='uretim-kayitlari.html?edit='+encodeURIComponent(r.id);actions.append(a);row.append(actions);list.append(row);
 });
}
async function refresh(){
 if(!session||!client)return;if(loading){refreshQueued=true;return;}loading=true;const run=generation,uid=session.user.id;$('#inventory-refresh').disabled=true;
 try{
  const [stock,ops,fields]=await Promise.all([loadInventory(client,uid),readAll(client,'farmer_operations',uid),readAll(client,'farmer_farms',uid)]);
  if(run!==generation)return;
  items=stock.items;purchases=stock.purchases;operations=ops;farms=fields;ready=true;$('#purchase-fields').disabled=false;
  populateItems();renderStock();renderUnlinked();$('#inventory-total').textContent=money(purchases.reduce((n,p)=>n+Number(p.total_cost),0));$('#inventory-count').textContent=fmt(items.filter(i=>Number(i.stock_quantity)>0).length);$('#inventory-uses').textContent=fmt(operations.filter(r=>r.inventory_item_id).length);
  message('Güncel stok · '+new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})+' · Tarladaki kullanımlarla birlikte hesaplanır.');
 }catch(error){if(run===generation){ready=false;$('#purchase-fields').disabled=true;message(stockError(error),true);}}
 finally{loading=false;$('#inventory-refresh').disabled=false;if(refreshQueued){refreshQueued=false;refresh();}}
}
$('#inventory-search').addEventListener('input',renderStock);$('#inventory-refresh').addEventListener('click',refresh);
window.addEventListener('focus',()=>{if(session&&!saving)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!saving)refresh();});
setInterval(()=>{if(!document.hidden&&session&&!saving)refresh();},30000);
function account(next){generation++;if(channel){client.removeChannel(channel);channel=null;}session=next;ready=false;items=[];purchases=[];operations=[];farms=[];resetForm();$('#purchase-fields').disabled=true;$('#stock-list').replaceChildren();$('#unlinked-section').hidden=true;$('#stock-empty').hidden=true;['inventory-total','inventory-count','inventory-uses'].forEach(id=>$('#'+id).textContent='—');$('#inventory-auth').hidden=Boolean(session);message('',false,$('#purchase-status'));if(session){
 refresh();channel=client.channel('inventory-'+session.user.id);['farmer_inventory_items','farmer_inventory_purchases','farmer_operations'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'user_id=eq.'+session.user.id},()=>{if(!saving)refresh();}));channel.subscribe();
 }else message('Giriş yaptıktan sonra alışveriş ekleyebilir ve stoklarını takip edebilirsin.');}
if(cfg.url&&cfg.publishableKey){client=createClient(cfg.url,cfg.publishableKey);const {data,error}=await client.auth.getSession();if(error){message('Oturum alınamadı. Lütfen tekrar giriş yap.',true);$('#inventory-auth').hidden=false;}else account(data.session);client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id)setTimeout(()=>account(next),0);});}
else message('Kayıt servisi henüz yapılandırılmadı.',true);
