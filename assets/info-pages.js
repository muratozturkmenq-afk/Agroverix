import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=international-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=international-v1';
(function(){
 'use strict';
 // A public, illustrative calculation only; it never reads or writes account records.
 var yieldInput=document.getElementById('guide-yield'),priceInput=document.getElementById('guide-price');
 if(!yieldInput||!priceInput)return;
 var result=document.getElementById('guide-profit'),revenue=document.getElementById('guide-revenue'),error=document.getElementById('guide-calc-error');
 var formatter=new Intl.NumberFormat(I.locale,{maximumFractionDigits:2});
 const initialYield=Number(yieldInput.value),initialPrice=Number(priceInput.value);bindNumberInput(yieldInput);bindNumberInput(priceInput,{maximumFractionDigits:2});setNumberInputValue(yieldInput,perAreaDisplay(initialYield));setNumberInputValue(priceInput,initialPrice);
 function parse(input){return parseNumberInput(input.value);}
 function update(){
  var y=parse(yieldInput),p=parse(priceInput),validYield=Number.isFinite(y)&&y>0&&y<=100000*I.factor(),validPrice=Number.isFinite(p)&&p>=0&&p<=1000000;
  yieldInput.setAttribute('aria-invalid',String(!validYield));priceInput.setAttribute('aria-invalid',String(!validPrice));
  if(!validYield||!validPrice){result.textContent='—';revenue.textContent='—';error.textContent=__avt("Pozitif bir verim ve sıfır veya daha büyük bir fiyat gir. Ondalık için virgül kullanabilirsin.");return;}
  var income=(I.lang==='en'?y/10:y)*p*20,profit=income-40000;error.textContent='';revenue.textContent=formatter.format(income)+__avt(" TL");result.textContent=formatter.format(profit)+__avt(" TL");
  document.getElementById('guide-profit-label').textContent=profit<0?__avt("Tahmini Zarar"):__avt("Tahmini Kâr");
 }
 yieldInput.addEventListener('input',update);priceInput.addEventListener('input',update);update();
})();
