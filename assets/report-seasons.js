// Season choices are shared by member and administrator Excel reports.
export const currentReportYear=()=>new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Istanbul',year:'numeric'}).format(new Date());
export function reportSeasonYears(data={}){
 const years=new Set([currentReportYear()]);
 const add=row=>{const value=String(row?.season_year??'');if(/^[1-9][0-9]{3}$/.test(value))years.add(value);};
 for(const key of ['seasons','operations','harvest_sales','personnel_expenses','personnel_schedules'])for(const row of data[key]||[])add(row);
 for(const farm of data.farms||[]){add(farm);for(const row of farm.farmer_seasons||[])add(row);}
 return [...years].sort((a,b)=>Number(b)-Number(a));
}
export function fillReportSeasons(select,data={},ownerKey='',translate=s=>s){
 if(!select)return;
 const sameOwner=select.dataset.reportSeasonOwner===ownerKey;
 const selected=sameOwner?select.value:currentReportYear();
 const years=new Set(reportSeasonYears(data));
 if(sameOwner)for(const option of select.options)if(option.value)years.add(option.value);
 select.replaceChildren(new Option(translate('Tüm Sezonlar'),''));
 for(const year of [...years].sort((a,b)=>Number(b)-Number(a)))select.add(new Option(year,year));
 select.value=selected===''?'':years.has(selected)?selected:currentReportYear();
 select.dataset.reportSeasonOwner=ownerKey;
}
export const reportSeasonLabel=year=>year?year+' sezonu':'tüm sezonlar';
