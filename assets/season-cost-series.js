import {costPerDecare} from './operation-cost.js?v=international-v1';
// Each field keeps its own area when older per-decare records are combined.
export function seasonCostSeries(farms,records,year){
 const fields=new Map();let opening=0,missing=0,undated=0,rent=0;
 for(const farm of farms){const season=(farm.farmer_seasons||[]).find(s=>String(s.season_year)===String(year));if(!season)continue;
  fields.set(farm.id,Number(season.area_decare));
  if(season.tenure==='rented')rent+=Number(season.rent_total||0);
 }
 opening=rent;const monthly=new Map();
 for(const record of records){if(!fields.has(record.farm_id)||String(record.season_year)!==String(year))continue;
  const area=fields.get(record.farm_id),per=costPerDecare(record,area);
  const match=String(record.operation_date||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/),y=Number(match?.[1]),m=Number(match?.[2])-1,d=Number(match?.[3]);
  const dated=match&&y>0&&m>=0&&m<12&&d>0&&d<=new Date(y,m+1,0).getDate();
  const key=dated?y*12+m:null;
  if(key!==null&&!monthly.has(key))monthly.set(key,0);
  if(!(area>0)||!Number.isFinite(area)||per===null||!Number.isFinite(per)||per<0){missing++;continue;}
  const value=per*area;
  if(key===null){opening+=value;undated++;}else monthly.set(key,monthly.get(key)+value);
 }
 if(!monthly.size)return {points:opening>0?[{month:null,monthly:opening,total:opening}]:[],rent,undated,missing};
 const keys=[...monthly.keys()],first=Math.min(...keys),last=Math.max(...keys),points=[];let total=opening;
 for(let month=first;month<=last;month++){const amount=monthly.get(month)||0;total+=amount;points.push({month,monthly:amount,total});}
 return {points,rent,undated,missing};
}
