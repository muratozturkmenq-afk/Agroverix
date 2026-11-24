import {readAll} from './inventory-data.js?v=currency-symbol-v1';
export const adviceTables={farms:'farmer_farms',operations:'farmer_operations',items:'farmer_inventory_items',purchases:'farmer_inventory_purchases',payments:'farmer_inventory_payments',staff:'farmer_personnel_expenses',schedules:'farmer_personnel_schedules',sales:'farmer_harvest_sales',receipts:'farmer_harvest_receipts',plannedPayments:'farmer_scheduled_payments',plannedReceipts:'farmer_scheduled_receipts'};
export async function loadAdviceData(client,userId){
 const entries=Object.entries(adviceTables),results=await Promise.allSettled(entries.map(([key,table])=>readAll(client,table,userId,key==='farms'?'*,farmer_seasons(*)':'*'))),data={missing:[]};
 results.forEach((r,i)=>{const key=entries[i][0];data[key]=r.status==='fulfilled'?r.value:[];if(r.status==='rejected')data.missing.push(key);});
 if(data.missing.includes('farms')||data.missing.includes('operations'))throw Error('Tarla ve uygulama kayıtları yüklenemedi. Yenile düğmesiyle tekrar dene.');
 return data;
}
