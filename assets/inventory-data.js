// Stock is held in a canonical unit; bags and bottles are converted at purchase.
export const units = {kg:['kg',1],ton:['kg',1000],g:['kg',.001],L:['L',1],ml:['L',.001],adet:['adet',1],m:['m',1],'m³':['L',1000]};
export const fmt = value => Number(value || 0).toLocaleString('tr-TR',{maximumFractionDigits:3});
export const money = value => Number(value || 0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' TL';
export function converted(quantity,unit){const u=units[unit];return u&&Number.isFinite(Number(quantity))?Number(quantity)*u[1]:null;}
export function compatibleUnits(base){return Object.keys(units).filter(k=>units[k][0]===base);}
export function today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
export function stockError(error){
 const text=error?.message||'';
 if(/Yetersiz stok|birimi|miktar|hesabına|bulunamadı|eski kaydı|Makine ve işçilik|sahibi/.test(text))return text;
 if(['42P01','PGRST205','PGRST202','42703'].includes(error?.code))return 'Alışveriş ve Stok kurulumu henüz etkin değil. Lütfen daha sonra tekrar dene.';
 return 'Kayıt tamamlanamadı. Bağlantını kontrol edip tekrar dene.';
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
