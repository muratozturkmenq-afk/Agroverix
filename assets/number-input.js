// Turkish display values are separate from the numeric values sent to the API.
function normalized(value) {
  let text=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'');
  if(!text)return '';
  if(text.startsWith(','))text='0'+text;
  return text;
}
export function parseNumberInput(value) {
  const text=normalized(value);
  if(!text)return null;
  if(!/^(?:[0-9]+|[0-9]{1,3}(?:[.][0-9]{3})+)(?:,[0-9]+)?$/.test(text))return NaN;
  return Number(text.replace(/[.]/g,'').replace(',','.'));
}
function grouped(text) {
  const [whole,fraction]=text.split(',');
  return whole.replace(/[.]/g,'').replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction!==undefined?','+fraction:'');
}
export function setNumberInputValue(input,value) {
  if(value===null||value===undefined||value===''){input.value='';return;}
  const number=typeof value==='number'?value:Number(value);
  input.value=Number.isFinite(number)?number.toLocaleString('tr-TR',{maximumFractionDigits:20}):'';
}
export function bindNumberInput(input,{maximumFractionDigits=20}={}) {
  input.type='text';input.inputMode='decimal';
  input.pattern='(?:[0-9]+|[0-9]{1,3}(?:[.][0-9]{3})+)(?:,[0-9]{1,'+maximumFractionDigits+'})?';
  input.title='Binlik ayıracı nokta, ondalık ayıracı virgül. Örnek: 10.000,50';
  function format(event){
    const raw=input.value,position=input.selectionStart??raw.length;
    let normalizedText=normalized(raw);
    if(['insertFromPaste','insertFromDrop'].includes(event?.inputType)&&!normalizedText.includes(',')&&/^(?:[0-9]+)?[.][0-9]{1,2}$/.test(normalizedText))normalizedText=normalized(normalizedText.replace('.',','));
    if(!normalizedText){input.value='';return;}
    if(!/^[0-9.]+(?:,[0-9]*)?$/.test(normalizedText))return;
    const parts=normalizedText.split(',');
    // Do not silently repair malformed pasted group separators.
    if(['insertFromPaste','insertFromDrop'].includes(event?.inputType)&&parts[0].includes('.')&&!/^[0-9]{1,3}(?:[.][0-9]{3})+$/.test(parts[0]))return;
    const formatted=grouped(normalizedText),atEnd=position===raw.length;
    const significant=raw.slice(0,position).replace(/[.]/g,'').length;
    input.value=formatted;
    let caret=formatted.length;
    if(!atEnd){let count=0;caret=0;while(caret<formatted.length&&count<significant){if(formatted[caret]!=='.')count++;caret++;}}
    input.setSelectionRange(caret,caret);
  }
  input.addEventListener('input',format);
  input.addEventListener('beforeinput',event=>{
    const p=input.selectionStart;if(p!==input.selectionEnd||p===null)return;
    if(event.inputType==='insertText'&&event.data==='.'&&!input.value.includes(',')){
      event.preventDefault();input.setRangeText(',',p,p,'end');input.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    if(event.inputType==='deleteContentBackward'&&p>1&&input.value[p-1]==='.'){
      event.preventDefault();input.setRangeText('',p-2,p,'end');input.dispatchEvent(new Event('input',{bubbles:true}));
    }else if(event.inputType==='deleteContentForward'&&input.value[p]==='.'&&p+1<input.value.length){
      event.preventDefault();input.setRangeText('',p,p+2,'end');input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  input.addEventListener('blur',()=>{
    if(input.value.endsWith(',')){
      input.value=input.value.slice(0,-1);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }else format();
  });
  if(input.value)setNumberInputValue(input,input.value);
}
