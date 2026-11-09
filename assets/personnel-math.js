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
