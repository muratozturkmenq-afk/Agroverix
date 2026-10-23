import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=groups-v2';
import {money,today,stockError,fmt} from './inventory-data.js?v=dealer-expenses-v1';
import {normalizeSupplier,categoryLabel} from './expense-categories.js?v=dealer-expenses-v1';
import {showInventoryView} from './inventory-views.js?v=views-v1';

const $=s=>document.querySelector(s),cents=value=>Math.round(Number(value||0)*100);
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('tr-TR');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function button(text,action){const b=el('button',text,'inventory-button');b.type='button';b.addEventListener('click',action);return b;}
function message(text,error=false){$('#payment-status').textContent=text;$('#payment-status').classList.toggle('is-error',error);}
export function createPaymentLedger({getClient,refresh,getSaving,setSaving,onEditPurchase}){
 let session=null,purchases=[],items=[],payments=[],available=false,requestId=crypto.randomUUID(),editing=null;
 const form=$('#payment-form'),select=$('#payment-purchase');
 bindNumberInput($('#payment-amount'),{maximumFractionDigits:2});$('#payment-date').value=today();
 const name=p=>{const item=items.find(i=>i.id===p.item_id);return item?item.name+(item.brand?' · '+item.brand:''):'Masraf';};
 const debt=p=>Math.max(0,cents(p.total_cost)-cents(p.paid_total))/100;
 function suppliers(){
  const groups=new Map();purchases.forEach(p=>{const key=normalizeSupplier(p.supplier),g=groups.get(key)||{key,name:p.supplier,rows:[],total:0,paid:0};g.rows.push(p);g.total+=cents(p.total_cost);g.paid+=cents(p.paid_total);groups.set(key,g);});
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
 }
 function selected(){return suppliers().find(g=>g.key===select.value);}
 function options(preferred){
  const previous=preferred??select.value,groups=suppliers();
  select.replaceChildren(new Option(groups.length?'Bayi/firma seç':'Önce masraf kaydet',''));
  groups.forEach(g=>select.add(new Option(g.name+' · Kalan '+money((g.total-g.paid)/100),g.key)));
  if(groups.some(g=>g.key===previous))select.value=previous;
  select.disabled=Boolean(editing);
 }
 function reset(preferred=''){
  form.reset();editing=null;$('#payment-id').value='';requestId=crypto.randomUUID();$('#payment-date').value=today();
  $('#payment-title').textContent='Ödeme Ekle';$('#payment-save').textContent='Ödemeyi Kaydet →';$('#payment-cancel').hidden=true;options(preferred);
 }
 function paymentGroups(group){
  const ids=new Set(group.rows.map(p=>p.id)),result=new Map();
  payments.filter(p=>ids.has(p.purchase_id)).forEach(p=>{
   const key=p.payment_group_id||p.id,entry=result.get(key)||{id:key,legacy:!p.payment_group_id,purchase_id:p.purchase_id,date:p.payment_date,notes:p.notes||'',amount:0,rows:[]};
   entry.amount+=cents(p.amount);entry.rows.push(p);result.set(key,entry);
  });
  return [...result.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 }
 function open(group,record){
  reset(group.key);showInventoryView('payment');
  if(record){editing=record;$('#payment-id').value=record.id;setNumberInputValue($('#payment-amount'),record.amount/100);$('#payment-date').value=record.date;$('#payment-note').value=record.notes;$('#payment-title').textContent='Ödemeyi Düzenle';$('#payment-save').textContent='Değişiklikleri Kaydet →';$('#payment-cancel').hidden=false;options(group.key);}
  render();message(record?'Kaydettiğinde ödeme ve bayi borcu birlikte güncellenir.':'Ödenen tutarı ve tarihi gir.');form.scrollIntoView({behavior:'smooth',block:'center'});
 }
 async function remove(record,control){
  if(getSaving()||!session)return;
  if(!confirm('Bu ödeme kaydı silinsin mi? Tutar, ilgili masrafların kalan borcuna geri eklenecek.'))return;
  setSaving(true);control.disabled=true;const key=select.value;
  try{
   const {error}=await getClient().rpc(record.legacy?'agroverix_delete_inventory_payment':'agroverix_delete_dealer_payment',{p_id:record.id});if(error)throw error;
   if(editing?.id===record.id)reset(key);await refresh();message('Ödeme silindi. Bayi borcu güncellendi.');
  }catch(error){message(stockError(error),true);}finally{setSaving(false);control.disabled=false;}
 }
 function metrics(parent,values){const row=el('div',undefined,'ledger-amounts');values.forEach(([label,value])=>{const item=el('div');item.append(el('span',label),el('b',value));row.append(item);});parent.append(row);}
 function render(){
  const supplierList=$('#supplier-balances'),list=$('#purchase-ledger');supplierList.replaceChildren();list.replaceChildren();
  const groups=suppliers(),group=selected();
  $('#supplier-title').textContent=group?group.name+' · Bayi Hesabı':'Bayi Hesapları';
  $('#dealer-detail-title').textContent=group?group.name+' · Masraflar ve Ödemeler':'Bayi Masrafları ve Ödemeleri';
  $('#payment-dealer-hint').textContent=group?'Kalan borç: '+money((group.total-group.paid)/100)+'. Ödeme, en eski açık masraftan başlayarak dağıtılır.':'Bayi/firma seçtiğinde masrafları sağ tarafta görünür.';
  if(!available){$('#supplier-empty').hidden=false;$('#ledger-empty').hidden=false;return;}
  (group?[group]:groups).forEach(g=>{
   const row=button('',()=>{if(editing)return;select.value=g.key;render();});row.classList.add('dealer-balance-row');row.setAttribute('aria-label',g.name+' bayi detayları');row.setAttribute('aria-pressed',String(group?.key===g.key));
   const label=el('span',undefined,'dealer-name');label.append(el('small','Bayi Adı'),el('strong',g.name));row.append(label);
   [['Toplam Alışveriş',g.total],['Toplam Ödenen',g.paid],['Kalan',g.total-g.paid]].forEach(([caption,value])=>{const cell=el('span');cell.append(el('small',caption),el('b',money(value/100)));row.append(cell);});supplierList.append(row);
  });
  $('#supplier-empty').hidden=groups.length>0;
  $('#ledger-empty').hidden=Boolean(group);$('#ledger-empty').textContent='Bir bayi/firma seçerek o bayiden yapılan masrafları ve ödemelerini görebilirsin.';
  if(!group)return;
  const filter=$('#ledger-filter').value,rows=group.rows.filter(p=>filter==='all'||(filter==='unpaid'?debt(p)>0:debt(p)===0)).sort((a,b)=>a.purchase_date.localeCompare(b.purchase_date)||a.id.localeCompare(b.id));
  rows.forEach(p=>{
   const card=el('article',undefined,'purchase-account'),item=items.find(i=>i.id===p.item_id),history=payments.filter(x=>x.purchase_id===p.id).sort((a,b)=>b.payment_date.localeCompare(a.payment_date));
   card.append(el('h4',name(p)),el('p',categoryLabel(item?.category)+' · '+fmt(p.purchased_quantity)+' '+p.purchased_unit+(p.package_quantity?' × '+fmt(p.package_quantity)+' '+p.package_unit:'')));
   metrics(card,[['Masraf Tarihi',date(p.purchase_date)],['Toplam Alışveriş',money(p.total_cost)],['Toplam Ödenen',money(p.paid_total)],['Kalan',money(debt(p))]]);
   if(history.length)card.append(el('p','Son Ödeme Tarihi: '+date(history[0].payment_date)));
   if(p.notes)card.append(el('p',p.notes));const actions=el('div',undefined,'stock-row-actions');actions.append(button('Masrafı Düzenle',()=>onEditPurchase(p)));card.append(actions);list.append(card);
  });
  if(!rows.length)list.append(el('p','Bu filtreye uygun masraf bulunamadı.','payment-help'));
  const history=el('section',undefined,'dealer-payment-history');history.append(el('h4','Ödeme Geçmişi'));
  const records=paymentGroups(group);
  records.forEach(record=>{
   const card=el('article',undefined,'stock-row'),info=el('div');info.append(el('h4',date(record.date)+' · '+money(record.amount/100)),el('p',record.notes||'Bayi ödemesi'));
   const details=el('details');details.append(el('summary',record.rows.length+' masraftan düşüldü'));
   record.rows.forEach(row=>{const p=purchases.find(p=>p.id===row.purchase_id);details.append(el('p',(p?date(p.purchase_date)+' · '+name(p):'Masraf')+' · '+money(row.amount)));});
   info.append(details);const actions=el('div',undefined,'stock-row-actions'),del=button('Sil',()=>remove(record,del));actions.append(button('Düzenle',()=>open(group,record)),del);card.append(info,actions);history.append(card);
  });
  if(!records.length)history.append(el('p','Bu bayi için henüz ödeme kaydı yok.','payment-help'));list.append(history);
 }
 select.addEventListener('change',render);
 $('#payment-cancel').addEventListener('click',()=>{reset(select.value);render();message('');});
 $('#ledger-filter').addEventListener('change',render);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(getSaving()||!session||!available)return;
  const group=selected(),amount=parseNumberInput($('#payment-amount').value),paymentDate=$('#payment-date').value;
  if(!group){message('Önce bayi/firma seç.',true);return;}
  const eligible=group.rows.filter(p=>p.purchase_date<=paymentDate),oldRows=editing?.rows||[];
  let max=eligible.reduce((n,p)=>n+cents(debt(p))+oldRows.filter(r=>r.purchase_id===p.id).reduce((n,r)=>n+cents(r.amount),0),0);
  if(editing?.legacy){const p=purchases.find(p=>p.id===editing.purchase_id);max=cents(debt(p))+editing.amount;}
  if(!paymentDate||!Number.isFinite(amount)||amount<=0||cents(amount)>max){message('Ödeme tutarı sıfırdan büyük ve ödeme tarihine kadar olan kalan borçtan fazla olmamalı.',true);return;}
  const key=group.key,payload={id:editing?.id||requestId,supplier:group.name,amount:Number(amount.toFixed(2)),payment_date:paymentDate,notes:$('#payment-note').value.trim(),editing:Boolean(editing)};
  if(editing?.legacy)payload.purchase_id=editing.purchase_id;
  setSaving(true);$('#payment-save').disabled=true;message('Bayi ödemesi kaydediliyor…');
  try{
   const {error}=await getClient().rpc(editing?.legacy?'agroverix_save_inventory_payment':'agroverix_save_dealer_payment',{p_payment:payload});if(error)throw error;
   reset(key);await refresh();message('Ödeme kaydedildi. Bayinin kalan borcu güncellendi.');
  }catch(error){message(stockError(error),true);}finally{setSaving(false);$('#payment-save').disabled=false;}
 });
 return {
  update(data){
   const changed=session?.user.id!==data.session?.user.id;session=data.session;purchases=data.purchases||[];items=data.items||[];payments=data.payments||[];available=Boolean(session&&data.available);
   if(changed){reset();message('');}
   if(editing&&!payments.some(p=>(p.payment_group_id||p.id)===editing.id)){reset(select.value);message('Düzenlenen ödeme artık bulunmuyor. Liste güncellendi.');}
   $('#payment-fields').disabled=!available;$('#payment-availability').textContent=!session?'Ödeme ve bayi hesaplarını görmek için giriş yap.':available?'Bayi/firma seçerek ödemeni kaydet. Sağ tarafta seçtiğin bayinin masrafları ve ödemeleri görünür.':'Ödeme bilgileri yüklenemedi. Sayfayı yenileyerek tekrar dene.';
   options();render();
  },
  selectPurchase(id){const p=purchases.find(p=>p.id===id);if(p){if(editing)reset();options(normalizeSupplier(p.supplier));render();}},
  notify(text){message(text,true);}
 };
}
