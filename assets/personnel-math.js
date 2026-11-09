// The server remains authoritative; this mirrors its cent-exact area allocation.
export function allocatePersonnel(total,farms){
 const cents=Math.round(Number(total)*100),area=farms.reduce((n,f)=>n+Number(f.area_decare),0);
 if(!Number.isSafeInteger(cents)||cents<0||!Number.isFinite(area)||area<=0||farms.some(f=>!(Number(f.area_decare)>0)))return [];
 const rows=farms.map(f=>{const exact=cents*Number(f.area_decare)/area,base=Math.floor(exact);return {...f,cents:base,remainder:exact-base};});
 let remaining=cents-rows.reduce((n,r)=>n+r.cents,0);
 [...rows].sort((a,b)=>Math.abs(b.remainder-a.remainder)>1e-9?b.remainder-a.remainder:String(a.id).localeCompare(String(b.id),'en')).forEach(r=>{if(remaining>0){r.cents++;remaining--;}});
 return rows.map(({cents,remainder,...f})=>({...f,amount:cents/100}));
}
export const personnelTotal=values=>['salary','insurance','other_cost'].reduce((n,key)=>n+Math.round(Number(values[key]||0)*100),0)/100;
export function payrollMonths(start,count){
 if(!/^\d{4}-\d{2}$/.test(start)||!Number.isInteger(Number(count))||count<1||count>12)return [];
 const [y,m]=start.split('-').map(Number);if(m<1||m>12||y<2000||y>2200)return [];
 const months=Array.from({length:Number(count)},(_,i)=>{const d=new Date(Date.UTC(y,m-1+i,1));return d.toISOString().slice(0,7);});return months.at(-1)>'2200-12'?[]:months;
}
export const duePersonnelMonths=(start,count,today)=>payrollMonths(start.slice(0,7),count).filter(m=>m<=String(today).slice(0,7)&&(m!==start.slice(0,7)||start.length===7||start<=String(today)));
export const remainingPersonnelPay=e=>Math.round((Number(e.salary||0)+Number(e.extra_pay||0)-Number(e.advance_total||0))*100)/100;
