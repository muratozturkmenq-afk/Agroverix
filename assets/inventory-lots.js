import {categoryKind} from './expense-categories.js?v=international-v1';
import {units,usedQuantity} from './inventory-data.js?v=international-v1';
export function purchaseFactor(p){const q=Number(p.purchased_quantity),base=Number(p.quantity);if(q>0&&base>0)return base/q;const pack=['torba','şişe'].includes(p.purchased_unit);return usedQuantity(1,p.purchased_unit,pack?p.package_quantity:null,p.package_unit);}
export function displayPurchaseQuantity(p,base){const factor=purchaseFactor(p);return factor>0?Number(base)/factor:null;}
export function inventoryLots(purchases,operations,{excludeOperationId=null,asOfDate=null}={}){
 const lots=purchases.map(p=>({...p,used:0,explicitUsed:0,legacyUsed:0,remaining:Number(p.quantity),uses:[]}));
 const byId=new Map(lots.map(p=>[p.id,p])),byItem=new Map(),legacy=new Map();
 for(const lot of lots){const group=byItem.get(lot.item_id)||[];group.push(lot);byItem.set(lot.item_id,group);}
 for(const r of operations){
  if(r.id===excludeOperationId||!r.inventory_item_id||asOfDate&&r.operation_date>asOfDate)continue;
  const q=Number(r.inventory_quantity||0);if(!(q>0))continue;
  const lot=byId.get(r.inventory_purchase_id);
  if(lot&&lot.item_id===r.inventory_item_id){lot.explicitUsed+=q;lot.uses.push({record:r,quantity:q,legacy:false});}
  else {const group=legacy.get(r.inventory_item_id)||[];group.push(r);legacy.set(r.inventory_item_id,group);}
 }
 for(const [itemId,group] of byItem){
  group.sort((a,b)=>a.purchase_date.localeCompare(b.purchase_date)||String(a.created_at||'').localeCompare(String(b.created_at||''))||a.id.localeCompare(b.id));
  for(const lot of group)lot.remaining=Math.max(0,Number(lot.quantity)-lot.explicitUsed);
  const old=(legacy.get(itemId)||[]).sort((a,b)=>a.operation_date.localeCompare(b.operation_date)||String(a.created_at||'').localeCompare(String(b.created_at||''))||a.id.localeCompare(b.id));
  for(const r of old){let left=Number(r.inventory_quantity);for(const lot of group){if(left<=.0000001)break;const q=Math.min(left,lot.remaining);if(q<=0)continue;lot.legacyUsed+=q;lot.remaining=Math.max(0,lot.remaining-q);lot.uses.push({record:r,quantity:q,legacy:true});left-=q;}}
  for(const lot of group){lot.used=lot.explicitUsed+lot.legacyUsed;lot.remaining=Math.max(0,Number(lot.quantity)-lot.used);}
 }
 return lots;
}
export function lotPrice(p){const quantity=Number(p?.quantity),cost=Number(p?.total_cost);return quantity>0&&Number.isFinite(cost)?cost/quantity:null;}
export function lotAutomaticCost({purchase,quantity,unit,date,packageQuantity,packageUnit,oldRecord}){
 if(!purchase)return {error:'Alım tarihli stok kaydını seç.'};
 if(!date||purchase.purchase_date>date)return {error:'Uygulama tarihi seçilen ürünün alım tarihinden önce olamaz.'};
 const effective=['torba','şişe'].includes(unit)?packageUnit:unit,purchasedEffective=['torba','şişe'].includes(purchase.purchased_unit)?purchase.package_unit:purchase.purchased_unit;
 if(units[effective]?.[0]!==units[purchasedEffective]?.[0])return {error:'Seçilen birim bu alımın birimiyle uyumlu değil.'};
 const amount=usedQuantity(quantity,unit,packageQuantity,packageUnit);
 if(!(amount>0&&Number.isFinite(amount)))return {error:'Kullanılan miktarı ve ambalaj içeriğini kontrol et.'};
 const stored=oldRecord?.inventory_purchase_id===purchase.id&&oldRecord.operation_date===date&&oldRecord.inventory_unit_cost!=null;
 const unitCost=stored?Number(oldRecord.inventory_unit_cost):lotPrice(purchase),total=Math.round((amount*unitCost+Number.EPSILON)*100)/100;
 if(!(unitCost>=0&&Number.isFinite(total)&&total<=9999999999.99))return {error:'Hesaplanan maliyet izin verilen aralığı aşıyor.'};
 return {quantity:amount,unitCost,total,stored,lot:true};
}

export function stockValuation(lots,items){
 const isPhysical=i=>i&&categoryKind(i.category)!=='service'&&!(i.category==='fuel'&&i.base_unit==='adet');
 return lots.reduce((sum,lot)=>{const item=items.find(i=>i.id===lot.item_id),price=lotPrice(lot);return isPhysical(item)&&price!==null?sum+Math.max(0,lot.remaining)*price:sum;},0);
}
