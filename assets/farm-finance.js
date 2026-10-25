import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import { costPerDecare } from './operation-cost.js?v=international-v1';
export const fmt = value => Number(value).toLocaleString(I.locale, {maximumFractionDigits:2});
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
  function result(yieldPerDecare, price, supportAmount, saleTotals=null) {
    const y=decimal(yieldPerDecare), p=decimal(price);
    const kg=saleTotals?Number(saleTotals.kg):y !== null && Number.isFinite(y) && y >= 0 ? y*area : null;
    const revenue=saleTotals?Number(saleTotals.total):kg !== null && p !== null && Number.isFinite(p) && p >= 0 ? kg*p : null;
    const costKg=total !== null && kg > 0 ? total/kg : null;
    const enteredSupport=decimal(supportAmount);
    const support=enteredSupport!==null&&Number.isFinite(enteredSupport)&&enteredSupport>=0?enteredSupport:0;
    const profit=total !== null && revenue !== null ? revenue+support-total : null;
    return {support,supportPerDecare:area>0?support/area:null,supportPerKg:kg>0?support/kg:null,kg,revenue,costKg,profit,percent:profit!==null&&total>0?profit/total*100:null,unitProfit:profit!==null&&kg>0?profit/kg:null};

  }
  const actualFromSales=Number(season.harvest_sale_count||0)>0;
  const actualYield=actualFromSales?Number(season.harvest_sale_kg)/area:season.actual_yield,actualPrice=actualFromSales?Number(season.harvest_sale_total)/Number(season.harvest_sale_kg):season.actual_price;
  const expected=result(season.expected_yield,season.expected_price,season.expected_support),actual=result(actualYield,actualPrice,season.actual_support,actualFromSales?{kg:season.harvest_sale_kg,total:season.harvest_sale_total}:null);
  return {season,area,actualFromSales,actualYield,actualPrice,rows,missing,operations,rent,total,perDecare:total !== null && area>0 ? total/area : null,expected,actual,
    costKg:actual.kg !== null ? actual.costKg : expected.costKg,kgBasis:actual.kg !== null ? __avt("Gerçek verimle") : __avt("Tahmini verimle")};
}
export function appendMetric(parent,label,value,unit='',className='finance-metric') {
  const el=document.createElement(className === 'farmer-crop-metric' ? 'span' : 'article'); el.className=className;
  const caption=document.createElement('span'); caption.textContent=label;
  if(I.lang==='en'&&/\/(?:da|ha)$/.test(unit)&&value!==null)value=perAreaDisplay(value);
  const number=document.createElement('strong'); number.textContent=value === null || !Number.isFinite(value) ? '—' : fmt(value)+(unit?' '+unit:'');
  el.append(caption,number); parent.append(el); return el;
}
export const operationLabels={soil_analysis:__avt("Toprak Analizi"),fuel:__avt("Mazot Kullanımı"),maintenance:__avt("Araç Bakımı/Tamir"),electricity:__avt("Elektrik"),transport:__avt("Nakliye"),tillage:__avt("Tarla Sürümü"),seed:__avt("Tohum"),planting:__avt("Ekim Dikim"),fertilizing:__avt("Gübreleme"),irrigation:__avt("Sulama"),spraying:__avt("İlaçlama"),weeding:__avt("Yabancı Ot Mücadelesi"),harvest:__avt("Hasat"),other:__avt("Diğer Girdi"),hoeing:__avt("Çapalama"),machine_spraying:__avt("İlaçlama (Makine)"),machine_fertilizing:__avt("Gübreleme (Makine)"),labor:__avt("İşçilik"),pruning:__avt("Budama"),machine_other:__avt("Diğer Makine / Hizmet")};
export const serviceTypes=new Set(['soil_analysis','maintenance','electricity','transport','tillage','planting','hoeing','machine_spraying','machine_fertilizing','labor','pruning','harvest','machine_other']);

// Support is an additional income; production costs always remain unchanged.
export function appendSupportMetrics(parent,result){
  appendMetric(parent,__avt("Toplam Destekleme"),result.support,__avt("TL"));
  appendMetric(parent,__avt("Dekara Destekleme"),result.supportPerDecare,__avt("TL/da"));
  appendMetric(parent,__avt("Kg Başına Destekleme"),result.supportPerKg,__avt("TL/kg"));
}
