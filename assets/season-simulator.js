import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import { cropTimeline } from './crop-timeline.js?v=international-v1';
import { parseNumberInput as decimal, bindNumberInput, setNumberInputValue } from './number-input.js?v=international-v1';
import { farmFinance, seasonFor, fmt, appendMetric, appendSupportMetrics } from './farm-finance.js?v=international-v1';
import { cropVisual } from './crop-visual.js?v=international-v1';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
export function renderSimulators(farms,records,client,user,onSaved){
 const container=document.querySelector('#farm-simulators');const drafts=new Map([...container.querySelectorAll('.sim-forecast-form[data-dirty="true"] input')].map(i=>[i.id,i.value]));container.querySelectorAll('.crop-timeline-visual').forEach(v=>v.dispose?.());container.replaceChildren();
 document.querySelector('#sim-message').textContent=farms.length?'':__avt("Sezon sonu tahmini için önce bir tarla ekle.");
 farms.forEach(farm=>{
  const season=seasonFor(farm),year=farm.season_year;if(!season)return;
  const card=node('article','farm-simulator'),art=cropTimeline(cropVisual(season.crop),{crop:season.crop,year,area:season.area_decare,rent:season.tenure==='rented'?Number(season.rent_total||0):0,records:records.filter(r=>r.farm_id===farm.id&&Number(r.season_year)===Number(year))}),body=node('div','farm-simulator-body'),header=node('div','sim-farm-head');
  header.append(node('h3','',farm.name),node('p','',season.crop+' · '+fmt(areaDisplay(season.area_decare))+__avt(" da · ")+year+__avt(" sezonu")));
  const fields=node('form','sim-forecast-form');
  function input(label,value,id){const wrap=node('div','sim-input'),l=node('label','',label),i=node('input');i.id=id;l.htmlFor=id;i.type='text';i.inputMode='decimal';i.pattern='[0-9]+([.,][0-9]+)?';i.required=false;bindNumberInput(i,{maximumFractionDigits:id.startsWith('expected-yield-')?20:2});setNumberInputValue(i,value);if(drafts.has(id)){i.value=drafts.get(id);fields.dataset.dirty='true';}i.placeholder=__avt("Elle gir");wrap.append(l,i);fields.append(wrap);return i;}
  const y=input(__avt("Tahmini Verim (kg/da)"),perAreaDisplay(season.expected_yield),'expected-yield-'+farm.id),p=input(__avt("Tahmini Satış Fiyatı (TL/kg)"),season.expected_price,'expected-price-'+farm.id),support=input(__avt("Tahmini Toplam Destekleme (TL)"),season.expected_support,'expected-support-'+farm.id),save=node('button','btn btn-gold',__avt("Tahminleri Kaydet"));save.type='submit';fields.append(save);
  const status=node('p','sim-save-status');status.setAttribute('role','status');if(fields.dataset.dirty==='true')status.textContent=__avt("Kaydedilmemiş tahminlerin korundu.");const supportHelp=node('p','sim-assumption',__avt("Bu tarlanın sezonluk toplam destek tahminini gir. Boş bırakırsan veya 0 yazarsan hesaba eklenmez."));supportHelp.id='expected-support-help-'+farm.id;support.setAttribute('aria-describedby',supportHelp.id);fields.insertBefore(supportHelp,save);
  const metrics=node('div','finance-grid');metrics.setAttribute('aria-live','polite');const foot=node('p','sim-assumption'),link=node('a','sim-detail-link',__avt("Tarla ve sezon detayını gör →"));link.href='tarla-detay.html?farm='+encodeURIComponent(farm.id);
  function render(){
   const vy=perAreaStored(decimal(y.value)),vp=decimal(p.value),validY=vy!==null&&Number.isFinite(vy)&&vy>0,validP=vp!==null&&Number.isFinite(vp)&&vp>=0,c=farmFinance(farm,records,year,{expected_yield:validY?vy:null,expected_price:validP?vp:null,expected_support:decimal(support.value)});metrics.replaceChildren();
   appendMetric(metrics,__avt("Bugüne Kadarki Toplam Maliyet"),c.total,__avt("TL"));appendMetric(metrics,__avt("Dekara Maliyet"),c.perDecare,__avt("TL/da"));appendMetric(metrics,__avt("Tahmini Kg Başına Maliyet"),c.expected.costKg,__avt("TL/kg"));appendMetric(metrics,__avt("Kg Başına Kâr / Zarar"),c.expected.unitProfit,__avt("TL/kg"));appendMetric(metrics,__avt("Tahmini Toplam Ürün"),c.expected.kg,'kg');appendMetric(metrics,__avt("Tahmini Satış Geliri"),c.expected.revenue,__avt("TL"));appendMetric(metrics,__avt("Tahmini Kâr / Zarar"),c.expected.profit,__avt("TL"));appendMetric(metrics,__avt("Kâr / Zarar Oranı"),c.expected.percent,'%');
   appendSupportMetrics(metrics,c.expected);
   metrics.querySelectorAll('article').forEach((el,i)=>{if(i===3||i===6||i===7)el.classList.toggle('is-loss',c.expected.profit!==null&&c.expected.profit<0);});
   foot.textContent=c.missing?__avt("Eski kayıtlarda hesaplama bilgisi eksik. Tarla detayından masrafları düzelt."):__avt("Kira dahil, bugüne kadar kaydettiğin masraflarla hesaplanır. Gelecekteki masraflar dahil değildir. Kâr = satış geliri + girilen destekleme − toplam maliyet. Destek boşsa veya 0 ise eklenmez. Yüzde toplam maliyete göre hesaplanır; sıfır maliyette gösterilmez.");
  }
  [y,p,support].forEach(i=>i.addEventListener('input',()=>{fields.dataset.dirty='true';status.textContent=__avt("Tahmin değişti. Saklamak için kaydet.");render();}));
  fields.addEventListener('submit',async event=>{
   event.preventDefault();const vy=perAreaStored(decimal(y.value)),vp=decimal(p.value),vs=decimal(support.value);if((vy!==null&&(!Number.isFinite(vy)||vy<=0))||(vp!==null&&(!Number.isFinite(vp)||vp<0))||(vs!==null&&(!Number.isFinite(vs)||vs<0))){status.textContent=__avt("Verim girersen sıfırdan büyük, fiyat ve destek girersen sıfır veya daha büyük olmalı. Alanları ayrı ayrı kaydedebilirsin.");return;}
   save.disabled=true;status.textContent=__avt("Tahminler kaydediliyor…");
   const {error}=await client.from('farmer_seasons').update({expected_yield:vy,expected_price:vp,expected_support:vs,updated_at:new Date().toISOString()}).eq('farm_id',farm.id).eq('season_year',year).eq('user_id',user.id).select('farm_id').single();
   save.disabled=false;if(error){status.textContent=__avt("Kaydedilemedi. Bilgilerin bu ekranda duruyor; tekrar dene.");return;}
   fields.dataset.dirty='false';season.expected_yield=vy;season.expected_price=vp;season.expected_support=vs;status.textContent=__avt("Tahminler hesabına kaydedildi.");onSaved();
  });body.append(header,fields,status,metrics,foot,link);card.append(art,body);container.append(card);render();
 });
}
