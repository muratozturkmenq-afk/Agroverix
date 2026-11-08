import {categoryKind,categoryLabel} from './expense-categories.js?v=international-v1';

// Purchases belong to the account's shared stock, not to an individual farm.
// They are exported separately and never added a second time to farm costs.
export function expenseReportSheets(data){
 const items=data.inventory_items||[],purchases=data.inventory_purchases||[],payments=data.inventory_payments||[];
 const accounts=new Map(data.accounts.map(a=>[a.user_id,a]));
 const key=(owner,id)=>owner+'|'+id;
 const itemMap=new Map(items.map(i=>[key(i.user_id,i.id),i]));
 const purchaseMap=new Map(purchases.map(p=>[key(p.user_id,p.id),p]));
 const number=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
 const sum=(rows,field)=>rows.reduce((n,r)=>n+(number(r[field])||0),0);
 const money=n=>Math.round((n+Number.EPSILON)*100)/100;
 const ownerHeaders=['Çiftçi',...(data.administrator?['Üye Kodu']:[]),'Hesap No','Para Birimi'];
 const owner=id=>{const a=accounts.get(id)||{};return [a.full_name||a.email||id,...(data.administrator?[a.member_code||'—']:[]),id,a.currency||'TRY'];};
 const product=p=>itemMap.get(key(p.user_id,p.item_id));
 const brand=(item,p)=>categoryKind(item?.category)==='service'?p?.supplier||'':item?.brand||'';
 const purchaseRows=[...purchases].sort((a,b)=>String(a.purchase_date).localeCompare(String(b.purchase_date))||String(a.id).localeCompare(String(b.id)));
 const expenses={name:'Masraf Girişleri',headers:[...ownerHeaders,'Masraf Tarihi','Masraf Türü','Masrafın Cinsi','Ürünün Adı/İçeriği','Marka/Firma Adı','Bayi/Firma Adı','Alınan Miktar','Alış Birimi','Ambalaj İçeriği','İçerik Birimi','Stok Miktarı','Stok Birimi','Birim Alış Fiyatı','Masraf Toplamı','Toplam Ödenen','Kalan Borç','Açıklama','Masraf Kayıt No'],rows:purchaseRows.map(p=>{
  const item=product(p),quantity=number(p.purchased_quantity),total=number(p.total_cost),paid=number(p.paid_total);
  return [...owner(p.user_id),p.purchase_date,categoryKind(item?.category)==='service'?'Diğer Gider':'Ürün Gideri',categoryLabel(item?.category),item?.name||'Ürün bilgisi bulunamadı',brand(item,p),p.supplier,quantity,p.purchased_unit,number(p.package_quantity),p.package_unit||'',number(p.quantity),item?.base_unit||'',quantity>0&&total!==null?total/quantity:null,total,paid,total!==null&&paid!==null?money(total-paid):null,p.notes||'',p.id];
 })};
 const products={name:'Ürün ve Gider Özeti',headers:[...ownerHeaders,'Masrafın Cinsi','Ürünün Adı/İçeriği','Marka/Firma Adı','Birim','Toplam Alınan Miktar','Kullanılan Miktar','Kalan Miktar','Toplam Alım Maliyeti','Ortalama Birim Alış Fiyatı','Bayi/Firma Adları','Ürün Kayıt No'],rows:items.map(item=>{
  const receipts=purchases.filter(p=>p.user_id===item.user_id&&p.item_id===item.id);
  const bought=sum(receipts,'quantity'),remaining=number(item.stock_quantity),used=remaining===null?null:bought-remaining,cost=money(sum(receipts,'total_cost'));
  const suppliers=[...new Set(receipts.map(p=>p.supplier).filter(Boolean))].join(' · ');
  return [...owner(item.user_id),categoryLabel(item.category),item.name,categoryKind(item.category)==='service'?suppliers:item.brand||'',item.base_unit,bought,used,number(item.stock_quantity),cost,bought>0?cost/bought:null,suppliers,item.id];
 })};
 const paid={name:'Masraf Ödemeleri',headers:[...ownerHeaders,'Ödeme Tarihi','Bayi/Firma Adı','Ürünün Adı/İçeriği','Marka/Firma Adı','Masraf Tarihi','Ödeme Tutarı','Açıklama','Masraf Kayıt No','Ödeme Kayıt No'],rows:[...payments].sort((a,b)=>String(a.payment_date).localeCompare(String(b.payment_date))||String(a.id).localeCompare(String(b.id))).map(payment=>{
  const p=purchaseMap.get(key(payment.user_id,payment.purchase_id)),item=p?product(p):null;
  return [...owner(payment.user_id),payment.payment_date,p?.supplier||'',item?.name||'',brand(item,p),p?.purchase_date||'',number(payment.amount),payment.notes||'',payment.purchase_id,payment.id];
 })};
 const dealers=new Map();
 purchases.forEach(p=>{const k=key(p.user_id,String(p.supplier||'').trim().toLocaleLowerCase('tr-TR'));const g=dealers.get(k)||{owner:p.user_id,supplier:p.supplier,total:0,paid:0,count:0};g.total+=number(p.total_cost)||0;g.paid+=number(p.paid_total)||0;g.count++;dealers.set(k,g);});
 const debts={name:'Bayi ve Borç Özeti',headers:[...ownerHeaders,'Bayi/Firma Adı','Masraf Kayıt Sayısı','Toplam Masraf','Toplam Ödenen','Kalan Borç'],rows:[...dealers.values()].map(g=>[...owner(g.owner),g.supplier,g.count,money(g.total),money(g.paid),money(g.total-g.paid)])};
 return [expenses,products,paid,debts];
}
