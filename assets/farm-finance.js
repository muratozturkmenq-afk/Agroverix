import { costPerDecare } from './operation-cost.js';
export const fmt = value => Number(value).toLocaleString('tr-TR', {maximumFractionDigits:2});
export const decimal = value => String(value ?? '').trim() === '' ? null : Number(String(value).trim().replace(',','.'));
export function seasonFor(farm, year = farm.season_year) {
  return (farm.farmer_seasons || []).find(s => Number(s.season_year) === Number(year)) || null;
}
export function farmFinance(farm, records, year = farm.season_year, overrides = {}) {
  const season = {...(seasonFor(farm,year) || {crop:farm.crop,area_decare:farm.area_decare,tenure:'owned',rent_total:0}), ...overrides};
  const area = Number(season.area_decare);
  const rows = records.filter(r => r.farm_id === farm.id && Number(r.season_year) === Number(year));
  const values = rows.map(r => costPerDecare(r,area));
  const missing = values.filter(v => v === null).length;
  const operations = values.reduce((sum,v) => sum + (v ?? 0)*area,0);
  const rent = season.tenure === 'rented' ? Number(season.rent_total || 0) : 0;
  const total = missing ? null : operations + rent;
  function result(yieldPerDecare, price, supportAmount) {
    const y=decimal(yieldPerDecare), p=decimal(price);
    const kg=y !== null && Number.isFinite(y) && y >= 0 ? y*area : null;
    const revenue=kg !== null && p !== null && Number.isFinite(p) && p >= 0 ? kg*p : null;
    const costKg=total !== null && kg > 0 ? total/kg : null;
    const enteredSupport=decimal(supportAmount);
    const support=enteredSupport!==null&&Number.isFinite(enteredSupport)&&enteredSupport>=0?enteredSupport:0;
    const profit=total !== null && revenue !== null ? revenue+support-total : null;
    return {support,supportPerDecare:area>0?support/area:null,supportPerKg:kg>0?support/kg:null,kg,revenue,costKg,profit,percent:profit!==null&&total>0?profit/total*100:null,unitProfit:profit!==null&&kg>0?profit/kg:null};

  }
  const expected=result(season.expected_yield,season.expected_price,season.expected_support),actual=result(season.actual_yield,season.actual_price,season.actual_support);
  return {season,area,rows,missing,operations,rent,total,perDecare:total !== null && area>0 ? total/area : null,expected,actual,
    costKg:actual.kg !== null ? actual.costKg : expected.costKg,kgBasis:actual.kg !== null ? 'Gerçek verimle' : 'Tahmini verimle'};
}
export function appendMetric(parent,label,value,unit='',className='finance-metric') {
  const el=document.createElement(className === 'farmer-crop-metric' ? 'span' : 'article'); el.className=className;
  const caption=document.createElement('span'); caption.textContent=label;
  const number=document.createElement('strong'); number.textContent=value === null || !Number.isFinite(value) ? '—' : fmt(value)+(unit?' '+unit:'');
  el.append(caption,number); parent.append(el); return el;
}
export const operationLabels={soil_analysis:'Toprak Analizi',fuel:'Mazot Kullanımı',maintenance:'Araç Bakımı/Tamir',electricity:'Elektrik',transport:'Nakliye',tillage:'Tarla Sürümü',seed:'Tohum',planting:'Ekim Dikim',fertilizing:'Gübreleme',irrigation:'Sulama',spraying:'İlaçlama',weeding:'Yabancı Ot Mücadelesi',harvest:'Hasat',other:'Diğer Girdi',hoeing:'Çapalama',machine_spraying:'İlaçlama (Makine)',machine_fertilizing:'Gübreleme (Makine)',labor:'İşçilik',pruning:'Budama',machine_other:'Diğer Makine / Hizmet'};
export const serviceTypes=new Set(['soil_analysis','maintenance','electricity','transport','tillage','planting','hoeing','machine_spraying','machine_fertilizing','labor','pruning','harvest','machine_other']);

// Support is an additional income; production costs always remain unchanged.
export function appendSupportMetrics(parent,result){
  appendMetric(parent,'Toplam Destekleme',result.support,'TL');
  appendMetric(parent,'Dekara Destekleme',result.supportPerDecare,'TL/da');
  appendMetric(parent,'Kg Başına Destekleme',result.supportPerKg,'TL/kg');
}
