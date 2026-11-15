import {farmFinance} from './farm-finance.js?v=personnel-v1';
// This page compares income with purchased expenses, rather than field-use costs.
export function purchaseSeasonResults(farms,year,purchaseTotal){
 const rows=farms.filter(f=>(f.farmer_seasons||[]).some(s=>String(s.season_year)===String(year)));
 const result={count:rows.length,expected:{missing:0,cents:0},actual:{missing:0,cents:0}};
 for(const farm of rows){
  const finance=farmFinance(farm,[],year);
  for(const kind of ['expected','actual']){
   const income=finance[kind].revenue,support=finance[kind].support;
   if(!(finance.area>0)||income===null||!Number.isFinite(income)||income<0||!Number.isFinite(support)){result[kind].missing++;continue;}
   result[kind].cents+=Math.round((income+support+Number.EPSILON)*100);
  }
 }
 const cost=Math.round((Number(purchaseTotal)+Number.EPSILON)*100);
 for(const kind of ['expected','actual']){
  const item=result[kind],complete=rows.length>0&&!item.missing&&Number.isFinite(cost)&&cost>=0;
  item.income=complete?item.cents/100:null;
  item.profit=complete?(item.cents-cost)/100:null;
  item.percent=complete&&cost>0?(item.cents-cost)/cost*100:null;
 }
 return result;
}
