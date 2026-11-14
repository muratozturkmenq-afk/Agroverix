import {currentReportYear} from './report-seasons.js?v=season-export-v1';
export {currentReportYear};
export function purchaseYear(p){return String(p.season_year||p.purchase_date?.slice(0,4)||'');}
export function seasonPurchases(rows,year){return rows.filter(p=>purchaseYear(p)===String(year));}
export function seasonFarms(rows,year){return rows.filter(f=>(f.farmer_seasons||[]).some(s=>String(s.season_year)===String(year))).map(f=>({...f,season_year:Number(year)}));}
export function seasonYears({farms=[],purchases=[],sales=[]}={}){
 const years=new Set([currentReportYear()]);const add=y=>{if(/^[1-9][0-9]{3}$/.test(String(y)))years.add(String(y));};
 purchases.forEach(p=>add(purchaseYear(p)));sales.forEach(s=>add(s.season_year));farms.forEach(f=>(f.farmer_seasons||[]).forEach(s=>add(s.season_year)));return [...years].sort((a,b)=>b-a);
}
// Receipts have a company account, not a sale/season foreign key. For seasonal
// reporting only, allocate in cents to that company's oldest eligible open sales.
export function allocateReceiptSeasons(sales,receipts){
 const cents=n=>Math.round(Number(n||0)*100),byBuyer=new Map(),allocated=[],unallocated=[];
 const ordered=rows=>rows.slice().sort((a,b)=>String(a.sale_date||a.receipt_date).localeCompare(String(b.sale_date||b.receipt_date))||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 for(const s of ordered(sales.filter(s=>!s.is_void))){const rows=byBuyer.get(s.buyer_key)||[];rows.push({sale:s,remaining:cents(s.total_amount)});byBuyer.set(s.buyer_key,rows);}
 for(const r of ordered(receipts.filter(r=>!r.is_void))){
  let remaining=cents(r.amount);const parts=new Map();
  for(const entry of byBuyer.get(r.buyer_key)||[]){if(!remaining)break;if(entry.sale.sale_date>r.receipt_date||entry.remaining<=0)continue;const amount=Math.min(remaining,entry.remaining),year=String(entry.sale.season_year);remaining-=amount;entry.remaining-=amount;parts.set(year,(parts.get(year)||0)+amount);}
  for(const [year,amount] of parts)allocated.push({...r,amount:amount/100,season_year:Number(year),original_amount:r.amount});
  if(remaining>0)unallocated.push({...r,unallocated_amount:remaining/100});
 }
 return {allocated,unallocated};
}
