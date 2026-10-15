import { cropTimeline } from './crop-timeline.js?v=cost-line-v2';
import { parseNumberInput as decimal, bindNumberInput, setNumberInputValue } from './number-input.js?v=groups-v2';
import { farmFinance, seasonFor, fmt, appendMetric } from './farm-finance.js?v=seasons-v1';
import { cropVisual } from './crop-visual.js?v=cost-line-v2';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
export function renderSimulators(farms,records,client,user,onSaved){
 const container=document.querySelector('#farm-simulators');const drafts=new Map([...container.querySelectorAll('.sim-forecast-form[data-dirty="true"] input')].map(i=>[i.id,i.value]));container.querySelectorAll('.crop-timeline-visual').forEach(v=>v.dispose?.());container.replaceChildren();
 document.querySelector('#sim-message').textContent=farms.length?'':'Sezon sonu tahmini için önce bir tarla ekle.';
 farms.forEach(farm=>{
  const season=seasonFor(farm),year=farm.season_year;if(!season)return;
  const card=node('article','farm-simulator'),art=cropTimeline(cropVisual(season.crop),{crop:season.crop,year,area:season.area_decare,rent:season.tenure==='rented'?Number(season.rent_total||0):0,records:records.filter(r=>r.farm_id===farm.id&&Number(r.season_year)===Number(year))}),body=node('div','farm-simulator-body'),header=node('div','sim-farm-head');
  header.append(node('h3','',farm.name),node('p','',season.crop+' · '+fmt(season.area_decare)+' da · '+year+' sezonu'));
  const fields=node('form','sim-forecast-form');
  function input(label,value,id){const wrap=node('div','sim-input'),l=node('label','',label),i=node('input');i.id=id;l.htmlFor=id;i.type='text';i.inputMode='decimal';i.pattern='[0-9]+([.,][0-9]+)?';i.required=false;bindNumberInput(i);setNumberInputValue(i,value);if(drafts.has(id)){i.value=drafts.get(id);fields.dataset.dirty='true';}i.placeholder='Elle gir';wrap.append(l,i);fields.append(wrap);return i;}
  const y=input('Tahmini Verim (kg/da)',season.expected_yield,'expected-yield-'+farm.id),p=input('Tahmini Satış Fiyatı (TL/kg)',season.expected_price,'expected-price-'+farm.id),save=node('button','btn btn-gold','Tahminleri Kaydet');save.type='submit';fields.append(save);
  const status=node('p','sim-save-status');status.setAttribute('role','status');if(fields.dataset.dirty==='true')status.textContent='Kaydedilmemiş tahminlerin korundu.';const metrics=node('div','finance-grid');metrics.setAttribute('aria-live','polite');const foot=node('p','sim-assumption'),link=node('a','sim-detail-link','Tarla ve sezon detayını gör →');link.href='tarla-detay.html?farm='+encodeURIComponent(farm.id);
  function render(){
   const vy=decimal(y.value),vp=decimal(p.value),validY=vy!==null&&Number.isFinite(vy)&&vy>0,validP=vp!==null&&Number.isFinite(vp)&&vp>=0,c=farmFinance(farm,records,year,{expected_yield:validY?vy:null,expected_price:validP?vp:null});metrics.replaceChildren();
   appendMetric(metrics,'Bugüne Kadarki Toplam Maliyet',c.total,'TL');appendMetric(metrics,'Dekara Maliyet',c.perDecare,'TL/da');appendMetric(metrics,'Tahmini Kg Başına Maliyet',c.expected.costKg,'TL/kg');appendMetric(metrics,'Kg Başına Kâr / Zarar',c.expected.unitProfit,'TL/kg');appendMetric(metrics,'Tahmini Toplam Ürün',c.expected.kg,'kg');appendMetric(metrics,'Tahmini Satış Geliri',c.expected.revenue,'TL');appendMetric(metrics,'Tahmini Toplam Kâr / Zarar',c.expected.profit,'TL');appendMetric(metrics,'Maliyete Göre Kâr / Zarar',c.expected.percent,'%');
   metrics.querySelectorAll('article').forEach((el,i)=>{if(i===3||i===6||i===7)el.classList.toggle('is-loss',c.expected.profit!==null&&c.expected.profit<0);});
   foot.textContent=c.missing?'Eski kayıtlarda hesaplama bilgisi eksik. Tarla detayından masrafları düzelt.':'Kira dahil, bugüne kadar kaydettiğin masraflarla hesaplanır. Gelecekteki masraflar dahil değildir. Yüzde = kâr/zarar ÷ toplam maliyet × 100; sıfır maliyette hesaplanmaz.';
  }
  [y,p].forEach(i=>i.addEventListener('input',()=>{fields.dataset.dirty='true';status.textContent='Tahmin değişti. Saklamak için kaydet.';render();}));
  fields.addEventListener('submit',async event=>{
   event.preventDefault();const vy=decimal(y.value),vp=decimal(p.value);if((vy!==null&&(!Number.isFinite(vy)||vy<=0))||(vp!==null&&(!Number.isFinite(vp)||vp<0))){status.textContent='Verim girersen sıfırdan büyük, fiyat girersen sıfır veya daha büyük olmalı. Alanları ayrı ayrı kaydedebilirsin.';return;}
   save.disabled=true;status.textContent='Tahminler kaydediliyor…';
   const {error}=await client.from('farmer_seasons').update({expected_yield:vy,expected_price:vp,updated_at:new Date().toISOString()}).eq('farm_id',farm.id).eq('season_year',year).eq('user_id',user.id).select('farm_id').single();
   save.disabled=false;if(error){status.textContent='Kaydedilemedi. Bilgilerin bu ekranda duruyor; tekrar dene.';return;}
   fields.dataset.dirty='false';season.expected_yield=vy;season.expected_price=vp;status.textContent='Tahminler hesabına kaydedildi.';onSaved();
  });body.append(header,fields,status,metrics,foot,link);card.append(art,body);container.append(card);render();
 });
}
