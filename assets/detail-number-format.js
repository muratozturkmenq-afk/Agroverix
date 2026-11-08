import {bindNumberInput,parseNumberInput} from './number-input.js?v=international-v1';
const I=window.AgroIntl;
const originals=new WeakMap();
export function formatDetailNumber(value){
 return value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString(I.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
}
export function setDetailInputValue(input,value){
 const number=value===null||value===undefined||value===''?null:Number(value);
 input.value=number===null||!Number.isFinite(number)?'':formatDetailNumber(number);
 originals.set(input,{display:input.value,value:number});
}
export function readDetailInputValue(input){
 const original=originals.get(input);
 return original&&original.display===input.value?original.value:parseNumberInput(input.value);
}
export function bindDetailInput(input){
 bindNumberInput(input,{maximumFractionDigits:2});
 // Browser-restored values must be formatted before the first farm render too.
 if(input.value){const value=parseNumberInput(input.value);if(Number.isFinite(value))setDetailInputValue(input,value);}
 input.addEventListener('input',()=>originals.delete(input));
 input.addEventListener('blur',()=>{
  const original=originals.get(input);
  if(original&&original.display===input.value)return;
  const value=parseNumberInput(input.value);
  if(value===null||!Number.isFinite(value))return;
  const formatted=formatDetailNumber(value);
  if(input.value!==formatted){input.value=formatted;input.dispatchEvent(new Event('input',{bubbles:true}));}
 });
}
