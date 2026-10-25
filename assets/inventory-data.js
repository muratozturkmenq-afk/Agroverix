import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
// Stock is held in a canonical unit; bags and bottles are converted at purchase.
export const units = {kg:['kg',1],ton:['kg',1000],g:['kg',.001],L:['L',1],ml:['L',.001],adet:['adet',1],m:['m',1],'m³':['L',1000],saat:['saat',1]};
export const fmt = value => Number(value || 0).toLocaleString(I.locale,{maximumFractionDigits:6});
export const money = value => Number(value || 0).toLocaleString(I.locale,{minimumFractionDigits:2,maximumFractionDigits:2})+__avt(" TL");
export function converted(quantity,unit){const u=units[unit];return u&&Number.isFinite(Number(quantity))?Number(quantity)*u[1]:null;}
export function usedQuantity(quantity,unit,packageQuantity,packageUnit){
 if(['torba','şişe'].includes(unit)){
  if(!(Number(packageQuantity)>0))return null;
  return converted(Number(quantity)*Number(packageQuantity),packageUnit);
 }
 return converted(quantity,unit);
}
export function compatibleUnits(base){return Object.keys(units).filter(k=>units[k][0]===base);}
export function today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
// Database validation messages use the same wording as the visible forms.
function expenseMessage(value){
 return value.replace(/(alışveriş|Alışveriş|ALIŞVERİŞ)([\p{L}]*)/gu,(_,prefix,suffix)=>{
  const base=prefix==='ALIŞVERİŞ'?__avt("MASRAF"):prefix==='Alışveriş'?__avt("Masraf"):'masraf';
  const ending=suffix.toLocaleLowerCase('tr-TR').replaceAll('e','a').replaceAll('i','ı');
  return base+(prefix==='ALIŞVERİŞ'?ending.toLocaleUpperCase('tr-TR'):ending);
 });
}
export function stockError(error){
 if(I.lang==='en')return I.dbError(error);
 const text=expenseMessage(error?.message||'');
 if(/Yetersiz stok|birimi|miktar|hesabına|bulunamadı|eski kaydı|Makine ve işçilik|sahibi|[Öö]deme|[Bb]orç|Masraf bedeli|Kayıt isteği|[Oo]tomatik maliyet|İşlem tarihine|Hesaplanan maliyet|[Bb]ayi|Ambalaj|Ödeme borca|ödeme formunu/.test(text))return text;
 if(['42P01','PGRST205','PGRST202','42703'].includes(error?.code))return __avt("Masraf ve Stok kurulumu henüz etkin değil. Lütfen daha sonra tekrar dene.");
 return __avt("Kayıt tamamlanamadı. Bağlantını kontrol edip tekrar dene.");
}
export async function readAll(client,table,userId,columns='*'){
 const rows=[];
 for(let start=0;;start+=500){
  const {data,error}=await client.from(table).select(columns).eq('user_id',userId).order('id').range(start,start+499);
  if(error)throw error;
  rows.push(...data);if(data.length<500)return rows;
 }
}
export async function loadInventory(client,userId){
 const [items,purchases]=await Promise.all([readAll(client,'farmer_inventory_items',userId),readAll(client,'farmer_inventory_purchases',userId)]);
 return {items:items.sort((a,b)=>a.name.localeCompare(b.name,'tr')),purchases};
}
export function totalsFor(item,purchases,operations){
 const receipts=purchases.filter(p=>p.item_id===item.id);
 const uses=operations.filter(r=>r.inventory_item_id===item.id);
 const purchased=receipts.reduce((n,p)=>n+Number(p.quantity),0),cost=receipts.reduce((n,p)=>n+Number(p.total_cost),0);
 return {receipts,uses,purchased,cost,used:uses.reduce((n,r)=>n+Number(r.inventory_quantity||0),0),remaining:Number(item.stock_quantity),average:purchased>0?cost/purchased:null};
}
