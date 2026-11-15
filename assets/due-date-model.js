export function validDueDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'2200-12-31')return false;const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function dueDateStatus(due,balance,today){
 if(balance===null)return {label:'Hesap kaydı bulunamadı',state:'unknown'};
 if(balance<=0)return {label:'Kalan tutar yok',state:'settled'};
 const days=Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 if(days<0)return {label:Math.abs(days)+' gün geçti',state:'overdue'};
 if(days===0)return {label:'Bugün',state:'today'};
 return {label:days+' gün sonra',state:'upcoming'};
}
export function payableParties(purchases,normalize){
 const groups=new Map();
 for(const p of purchases){const key=normalize(p.supplier);if(!key)continue;const row=groups.get(key)||{key,name:p.supplier,total:0,paid:0};row.total+=Math.round(Number(p.total_cost||0)*100);row.paid+=Math.round(Number(p.paid_total||0)*100);groups.set(key,row);}
 return [...groups.values()].map(g=>({key:g.key,name:g.name,balance:Math.max(0,g.total-g.paid)/100})).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
