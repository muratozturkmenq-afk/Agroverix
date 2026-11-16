import {farmFinance} from './farm-finance.js?v=international-v1';
// Sum money first; the combined rate is never an average of field percentages.
export function farmSeasonTotals(farms,records,year,{forecast=false,overrides=new Map()}={}){
 const selected=farms.filter(f=>(f.farmer_seasons||[]).some(s=>String(s.season_year)===String(year))),result={count:selected.length,year:String(year),cost:0,harvestRevenue:0,support:0,income:null,profit:null,percent:null,costMissing:0,incomeMissing:0,actualCount:0,expectedCount:0,basis:'expected'};
 let costCents=0,revenueCents=0,supportCents=0;
 for(const farm of selected){const c=farmFinance(farm,records,year,forecast?(overrides.get(farm.id)||{}):{}),actual=!forecast&&c.actual.revenue!==null&&Number.isFinite(c.actual.revenue),r=actual?c.actual:c.expected;
  if(actual)result.actualCount++;else result.expectedCount++;
  if(c.total===null||!Number.isFinite(c.total)||c.total<0)result.costMissing++;else costCents+=Math.round((c.total+Number.EPSILON)*100);
  if(r.revenue===null||!Number.isFinite(r.revenue)||r.revenue<0||!(c.area>0))result.incomeMissing++;else revenueCents+=Math.round((r.revenue+Number.EPSILON)*100);
  supportCents+=Math.round((r.support+Number.EPSILON)*100);
 }
 result.cost=result.count&&!result.costMissing?costCents/100:null;result.harvestRevenue=result.count&&!result.incomeMissing?revenueCents/100:null;result.support=supportCents/100;
 if(result.harvestRevenue!==null)result.income=(revenueCents+supportCents)/100;
 if(result.cost!==null&&result.income!==null){result.profit=(revenueCents+supportCents-costCents)/100;result.percent=costCents>0?(revenueCents+supportCents-costCents)/costCents*100:null;}
 result.basis=result.actualCount===result.count&&result.count?'actual':result.actualCount?'mixed':'expected';return result;
}
