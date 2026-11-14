import {costPerDecare} from './operation-cost.js?v=international-v1';
export function farmsForSeason(farms,year){
 return farms.filter(farm=>(farm.farmer_seasons||[]).some(s=>Number(s.season_year)===Number(year)));
}
// Shared costs enter the chart only through the field's application/allocation records.
// Personnel allocations already exist among those records; never add them a second time.
export function expenseAnalysis(farm,records,year){
 const season=(farm.farmer_seasons||[]).find(s=>Number(s.season_year)===Number(year));
 if(!season)return null;
 const area=Number(season.area_decare),groups=new Map();let missing=0,count=0,first=null,last=null;
 for(const row of records){
  if(row.farm_id!==farm.id||Number(row.season_year)!==Number(year))continue;
  count++;const per=costPerDecare(row,area);
  if(per===null||!Number.isFinite(per)||per<0){missing++;continue;}
  const amount=per*area,key=row.personnel_expense_id?'personnel':row.operation_type||'other';
  const group=groups.get(key)||{key,amount:0,count:0};group.amount+=amount;group.count++;groups.set(key,group);
  if(row.operation_date){if(!first||row.operation_date<first)first=row.operation_date;if(!last||row.operation_date>last)last=row.operation_date;}
 }
 const entries=[...groups.values()].sort((a,b)=>b.amount-a.amount||a.key.localeCompare(b.key));
 const applications=entries.reduce((sum,g)=>sum+g.amount,0);
 const rent=season.tenure==='rented'?Number(season.rent_total||0):0;
 return {season,area,entries:entries.map(g=>({...g,share:applications>0?g.amount/applications*100:0})),applications,rent,total:missing?null:applications+rent,missing,count,first,last};
}
