(function(){
 'use strict';
 // A public, illustrative calculation only; it never reads or writes account records.
 var yieldInput=document.getElementById('guide-yield'),priceInput=document.getElementById('guide-price');
 if(!yieldInput||!priceInput)return;
 var result=document.getElementById('guide-profit'),revenue=document.getElementById('guide-revenue'),error=document.getElementById('guide-calc-error');
 var formatter=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2});
 function parse(input){var raw=input.value.trim().replace(/\s/g,'');if(!/^\d+(?:[,.]\d{1,2})?$/.test(raw))return NaN;return Number(raw.replace(',','.'));}
 function update(){
  var y=parse(yieldInput),p=parse(priceInput),validYield=Number.isFinite(y)&&y>0&&y<=100000,validPrice=Number.isFinite(p)&&p>=0&&p<=1000000;
  yieldInput.setAttribute('aria-invalid',String(!validYield));priceInput.setAttribute('aria-invalid',String(!validPrice));
  if(!validYield||!validPrice){result.textContent='—';revenue.textContent='—';error.textContent='Pozitif bir verim ve sıfır veya daha büyük bir fiyat gir. Ondalık için virgül kullanabilirsin.';return;}
  var income=y*p*20,profit=income-40000;error.textContent='';revenue.textContent=formatter.format(income)+' TL';result.textContent=formatter.format(profit)+' TL';
  document.getElementById('guide-profit-label').textContent=profit<0?'Tahmini Zarar':'Tahmini Kâr';
 }
 yieldInput.addEventListener('input',update);priceInput.addEventListener('input',update);update();
})();
