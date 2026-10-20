import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=groups-v2';
import {money,today,stockError} from './inventory-data.js?v=payments-v1';
import {showInventoryView} from './inventory-views.js?v=views-v1';

const $=s=>document.querySelector(s);
const cents=value=>Math.round(Number(value||0)*100);
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('tr-TR');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function button(text,action){const b=el('button',text,'inventory-button');b.type='button';b.addEventListener('click',action);return b;}
function message(text,error=false){$('#payment-status').textContent=text;$('#payment-status').classList.toggle('is-error',error);}
export function createPaymentLedger({getClient,refresh,getSaving,setSaving,onEditPurchase}){
 let session=null,purchases=[],items=[],payments=[],available=false,requestId=crypto.randomUUID();
 const form=$('#payment-form'),select=$('#payment-purchase');
 bindNumberInput($('#payment-amount'),{maximumFractionDigits:2});$('#payment-date').value=today();
 const name=p=>{const i=items.find(i=>i.id===p.item_id);return i?i.name+(i.brand?' · '+i.brand:''):'Ürün';};
 const paid=p=>cents(p.paid_total)/100;
 const debt=p=>Math.max(0,cents(p.total_cost)-cents(p.paid_total))/100;
 function selected(){return purchases.find(p=>p.id===select.value);}
 function options(preferred){
  const previous=preferred??select.value;select.replaceChildren(new Option(purchases.length?'Alışveriş seç':'Önce alışveriş kaydet',''));
  purchases.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||a.id.localeCompare(b.id)).forEach(p=>select.add(new Option(p.supplier+' · '+date(p.purchase_date)+' · '+name(p)+' · kalan '+money(debt(p)),p.id)));
  if(purchases.some(p=>p.id===previous))select.value=previous;
  select.disabled=Boolean($('#payment-id').value);
 }
 function reset(){form.reset();$('#payment-id').value='';requestId=crypto.randomUUID();$('#payment-date').value=today();$('#payment-title').textContent='Ödeme Ekle';$('#payment-save').textContent='Ödemeyi Kaydet →';$('#payment-cancel').hidden=true;options();}
 function open(p,record){
  showInventoryView('payment');
  reset();if(record){$('#payment-id').value=record.id;setNumberInputValue($('#payment-amount'),record.amount);$('#payment-date').value=record.payment_date;$('#payment-note').value=record.notes||'';$('#payment-title').textContent='Ödemeyi Düzenle';$('#payment-save').textContent='Değişiklikleri Kaydet →';$('#payment-cancel').hidden=false;}
  options(p.id);message(record?'Kaydettiğinde kalan borç fark kadar güncellenir.':'Ödenen tutarı ve ödeme tarihini gir.');form.scrollIntoView({behavior:'smooth',block:'center'});
 }
 async function remove(record,b){
  if(getSaving()||!session)return;
  if(!confirm('Bu ödeme kaydı silinsin mi? Silinen tutar alışverişin kalan borcuna geri eklenir.'))return;
  setSaving(true);b.disabled=true;
  try{const {error}=await getClient().rpc('agroverix_delete_inventory_payment',{p_id:record.id});if(error)throw error;if($('#payment-id').value===record.id)reset();await refresh();message('Ödeme kaydı silindi. Kalan borç güncellendi.');}
  catch(error){message(stockError(error),true);}finally{setSaving(false);b.disabled=false;}
 }
 function render(){
  const supplierList=$('#supplier-balances'),list=$('#purchase-ledger');supplierList.replaceChildren();list.replaceChildren();
  if(!available){$('#supplier-empty').hidden=false;$('#ledger-empty').hidden=false;return;}
  const suppliers=new Map();
  purchases.forEach(p=>{const key=p.supplier.trim().toLocaleLowerCase('tr-TR'),s=suppliers.get(key)||{name:p.supplier,total:0,paid:0,count:0};s.total+=cents(p.total_cost);s.paid+=cents(p.paid_total);s.count++;suppliers.set(key,s);});
  [...suppliers.values()].sort((a,b)=>(b.total-b.paid)-(a.total-a.paid)||a.name.localeCompare(b.name,'tr')).forEach(s=>{
   const card=el('article',undefined,'supplier-balance'),head=el('div');head.append(el('h4',s.name),el('small',s.count+' alışveriş'));
   const nums=el('div',undefined,'ledger-amounts');[['Alışveriş',s.total/100],['Ödenen',s.paid/100],['Kalan Borç',(s.total-s.paid)/100]].forEach(([label,value])=>{const d=el('div');d.append(el('span',label),el('b',money(value)));nums.append(d);});card.append(head,nums);supplierList.append(card);
  });$('#supplier-empty').hidden=purchases.length>0;
  const filter=$('#ledger-filter').value,rows=purchases.filter(p=>filter==='all'||(filter==='unpaid'?debt(p)>0:debt(p)===0));$('#ledger-empty').hidden=rows.length>0;
  $('#ledger-empty').textContent=purchases.length?'Bu filtreye uygun alışveriş bulunamadı.':'Kayıtlı alışverişler ve ödeme tarihleri bu bölümde listelenir.';
  rows.slice().sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||a.id.localeCompare(b.id)).forEach(p=>{
   const records=payments.filter(x=>x.purchase_id===p.id).sort((a,b)=>b.payment_date.localeCompare(a.payment_date)||a.id.localeCompare(b.id));
   const card=el('article',undefined,'purchase-account'),head=el('div',undefined,'purchase-account-head'),title=el('div');title.append(el('h4',p.supplier+' · '+name(p)),el('p','Alışveriş Tarihi: '+date(p.purchase_date)));head.append(title,el('span',debt(p)>0?(paid(p)>0?'Kısmen Ödendi':'Ödenmedi'):'Ödendi','stock-tag'));
   const nums=el('div',undefined,'ledger-amounts');[['Ödeme Tarihi',records.length?date(records[0].payment_date):'—'],['Alışveriş Bedeli',money(p.total_cost)],['Toplam Ödenen',money(paid(p))],['Kalan Borç',money(debt(p))]].forEach(([label,value])=>{const d=el('div');d.append(el('span',label),el('b',value));if(label==='Ödeme Tarihi')d.append(el('small',records.length>1?'Son ödeme · '+records.length+' ödeme':records.length?'':'Henüz ödeme yok'));nums.append(d);});
   const add=button('Ödeme Ekle',()=>open(p));add.disabled=debt(p)<=0;
   const actions=el('div',undefined,'stock-row-actions');actions.append(add,button('Alışverişi Düzenle',()=>onEditPurchase(p)));
   const details=el('details');details.append(el('summary','Ödeme Geçmişi · '+records.length+' kayıt'));const history=el('div',undefined,'stock-rows');
   records.forEach(record=>{const row=el('div',undefined,'stock-row'),info=el('div');info.append(el('h4','Ödeme Tarihi: '+date(record.payment_date)),el('p',record.notes||'Ödeme kaydı'));const controls=el('div',undefined,'stock-row-actions'),del=button('Sil',()=>remove(record,del));controls.append(button('Düzenle',()=>open(p,record)),del);row.append(info,el('div',money(record.amount),'row-quantity'),controls);history.append(row);});
   if(!records.length)history.append(el('p','Bu alışveriş için henüz ödeme kaydedilmedi.','payment-help'));details.append(history);card.append(head,nums,actions,details);list.append(card);
  });
 }
 $('#payment-cancel').addEventListener('click',()=>{reset();message('');});$('#ledger-filter').addEventListener('change',render);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(getSaving()||!session||!available)return;
  const p=selected(),amount=parseNumberInput($('#payment-amount').value),old=payments.find(x=>x.id===$('#payment-id').value);
  if(!p){message('Önce ödeme yapılan alışverişi seç.',true);return;}
  if(!Number.isFinite(amount)||amount<=0||cents(amount)>cents(debt(p))+cents(old?.amount)){message('Ödeme tutarı sıfırdan büyük ve kalan borçtan fazla olmamalı.',true);return;}
  const payload={id:old?.id||requestId,purchase_id:p.id,amount:Number(amount.toFixed(2)),payment_date:$('#payment-date').value,notes:$('#payment-note').value.trim()};
  setSaving(true);$('#payment-save').disabled=true;message('Ödeme kaydediliyor…');
  try{const {error}=await getClient().rpc('agroverix_save_inventory_payment',{p_payment:payload});if(error)throw error;reset();await refresh();message('Ödeme kaydedildi. Kalan borç güncellendi.');}
  catch(error){message(stockError(error),true);}finally{setSaving(false);$('#payment-save').disabled=false;}
 });
 return {
  update(data){const changed=session?.user.id!==data.session?.user.id;session=data.session;purchases=data.purchases||[];items=data.items||[];payments=data.payments||[];available=Boolean(session&&data.available);if(changed){reset();message('');}
   $('#payment-fields').disabled=!available;$('#payment-availability').textContent=!session?'Ödeme ve borç kayıtlarını görmek için hesabına giriş yap.':available?'Ödemeleri alışveriş bazında kaydet; kalan borç otomatik güncellenir.':'Ödeme kayıtları yüklenemedi. Stok bilgilerini kullanabilirsin; ödeme eklemek için sayfayı yenile.';
   if($('#payment-id').value&&!payments.some(x=>x.id===$('#payment-id').value)){reset();message('Düzenlenen ödeme artık bulunmuyor. Liste güncellendi.');}options();render();
  },
  selectPurchase(id){options(id);},
  notify(text){message(text,true);},
 };
}
