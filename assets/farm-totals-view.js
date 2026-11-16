const I=window.AgroIntl;
const whole=value=>Number(Math.abs(value)<.5?0:value).toLocaleString(I.locale,{maximumFractionDigits:0});
export function clearFarmTotals(root){root.hidden=true;root.querySelectorAll('[data-total]').forEach(n=>n.textContent='—');root.querySelector('[data-total-note]').textContent='';}
export function renderFarmTotals(root,result,{forecast=false,draft=false}={}){
 if(!result.count){clearFarmTotals(root);return;}root.hidden=false;
 root.querySelectorAll('[data-total]').forEach(node=>{const key=node.dataset.total,value=result[key],valid=value!==null&&Number.isFinite(value);node.textContent=valid?whole(value)+(key==='percent'?' %':' '+I.t('TL')):'—';const card=node.closest('div');card.classList.toggle('is-loss',valid&&['profit','percent'].includes(key)&&value<0);card.classList.toggle('is-gain',valid&&['profit','percent'].includes(key)&&value>0);});
 const profitLabel=root.querySelector('[data-profit-label]');if(profitLabel)profitLabel.textContent=result.basis==='actual'?'Gerçekleşen Kâr / Zarar':result.basis==='mixed'?'Güncel Kâr / Zarar':'Tahmini Kâr / Zarar';
 let note=result.year+' sezonu · '+result.count+' tarla. ';
 if(!forecast)note+=result.basis==='mixed'?result.actualCount+' tarla gerçekleşen, '+result.expectedCount+' tarla tahmini sonuçla hesaplandı. ':result.basis==='actual'?'Gerçekleşen gelirler kullanıldı. ':'Tahmini gelirler kullanıldı. ';
 if(result.costMissing)note+=result.costMissing+' tarlada maliyet bilgisi eksik. ';
 if(result.incomeMissing)note+=result.incomeMissing+' tarlada '+(forecast?'tahmini':'kullanılabilecek')+' verim/fiyat bilgisi eksik. ';
 if(forecast)note+='Toplam destekleme '+whole(result.support)+' '+I.t('TL')+' kârlılık hesabına dahildir; hasat cirosuna eklenmez. ';
 else note+='Destekleme kârlılığa dahildir. ';
 if(result.cost===0)note+='Toplam maliyet sıfır olduğundan yüzde gösterilmez. ';
 if(draft)note+='Kaydedilmemiş tahmin değişiklikleri dahildir.';
 root.querySelector('[data-total-note]').textContent=note.trim();
}
