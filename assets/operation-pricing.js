import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {usedQuantity,units} from './inventory-data.js?v=international-v1';
export function acquisitionPrice(itemId,purchases,operationDate){
 const rows=purchases.filter(p=>p.item_id===itemId&&p.purchase_date<=operationDate);
 const quantity=rows.reduce((n,p)=>n+Number(p.quantity),0),cost=rows.reduce((n,p)=>n+Number(p.total_cost),0);
 return quantity>0?{unitCost:cost/quantity,count:rows.length}:null;
}
export function automaticOperationCost({itemId,quantity,unit,date,purchases,oldRecord,packageQuantity,packageUnit,itemBaseUnit}){
 const effectiveUnit=['torba','şişe'].includes(unit)?packageUnit:unit;
 if(itemBaseUnit&&units[effectiveUnit]?.[0]!==itemBaseUnit)return {error:__avt("Seçilen birim, giderin kayıtlı birimiyle uyumlu değil.")};
 const amount=usedQuantity(quantity,unit,packageQuantity,packageUnit);
 if(!itemId||!date||!(amount>0))return {error:__avt("Stok ürünü, işlem tarihi ve kullanılan toplam miktarı gir.")};
 let price;
 if(oldRecord?.cost_source==='inventory_average'&&oldRecord.inventory_item_id===itemId&&oldRecord.operation_date===date&&oldRecord.inventory_unit_cost!==null&&oldRecord.inventory_unit_cost!==undefined){price={unitCost:Number(oldRecord.inventory_unit_cost),stored:true};}
 else price=acquisitionPrice(itemId,purchases,date);
 if(!price)return {error:__avt("İşlem tarihine kadar bu ürünün masraf kaydı yok. Masraf kaydını ve uygulama tarihini kontrol et.")};
 const total=Math.round((amount*price.unitCost+Number.EPSILON)*100)/100;
 if(!Number.isFinite(total)||total<0||total>9999999999.99)return {error:__avt("Hesaplanan maliyet izin verilen aralığı aşıyor.")};
 return {...price,quantity:amount,total};
}
