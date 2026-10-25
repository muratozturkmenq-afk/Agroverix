// Display uses the selected language; API values are always plain numbers.
const I=window.AgroIntl;
const separators=()=>I?.lang==='en'?{group:',',decimal:'.'}:{group:'.',decimal:','};
const escape=s=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
function normalized(value){let text=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'');const {decimal}=separators();if(text.startsWith(decimal))text='0'+text;return text;}
function pattern(max=20){const{group,decimal}=separators();return '(?:[0-9]+|[0-9]{1,3}(?:'+escape(group)+'[0-9]{3})+)(?:'+escape(decimal)+'[0-9]{1,'+max+'})?';}
export function parseNumberInput(value){const text=normalized(value);if(!text)return null;if(!new RegExp('^'+pattern()+'$').test(text))return NaN;const{group,decimal}=separators();return Number(text.split(group).join('').replace(decimal,'.'));}
function grouped(text){const{group,decimal}=separators(),[whole,fraction]=text.split(decimal);return whole.split(group).join('').replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,group)+(fraction!==undefined?decimal+fraction:'');}
export function setNumberInputValue(input,value){if(value===null||value===undefined||value===''){input.value='';return;}const n=Number(value);input.value=Number.isFinite(n)?n.toLocaleString(I?.locale||'tr-TR',{maximumFractionDigits:20}):'';}
export function bindNumberInput(input,{maximumFractionDigits=20}={}){
 input.type='text';input.inputMode='decimal';input.pattern=pattern(maximumFractionDigits);
 input.title=I?.lang==='en'?'Use commas for thousands and a decimal point. Example: 10,000.50':'Binlik ayıracı nokta, ondalık ayıracı virgül. Örnek: 10.000,50';
 function format(event){
  const{group,decimal}=separators(),raw=input.value,pos=input.selectionStart??raw.length;let norm=normalized(raw);
  if(['insertFromPaste','insertFromDrop'].includes(event?.inputType)&&!norm.includes(decimal)&&new RegExp('^(?:[0-9]+)?'+escape(group)+'[0-9]{1,2}$').test(norm))norm=normalized(norm.replace(group,decimal));
  if(!norm){input.value='';return;}if(!new RegExp('^[0-9'+escape(group)+']+(?:'+escape(decimal)+'[0-9]*)?$').test(norm))return;
  const parts=norm.split(decimal);
  if(['insertFromPaste','insertFromDrop'].includes(event?.inputType)&&parts[0].includes(group)&&!new RegExp('^[0-9]{1,3}(?:'+escape(group)+'[0-9]{3})+$').test(parts[0]))return;
  const formatted=grouped(norm),atEnd=pos===raw.length,significant=raw.slice(0,pos).split(group).join('').length;input.value=formatted;let caret=formatted.length;
  if(!atEnd){let count=0;caret=0;while(caret<formatted.length&&count<significant){if(formatted[caret]!==group)count++;caret++;}}input.setSelectionRange(caret,caret);
 }
 input.addEventListener('input',format);
 input.addEventListener('beforeinput',event=>{
  const p=input.selectionStart,{group,decimal}=separators();if(p!==input.selectionEnd||p===null)return;
  if(I?.lang!=='en'&&event.inputType==='insertText'&&event.data==='.'&&!input.value.includes(decimal)){event.preventDefault();input.setRangeText(decimal,p,p,'end');input.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(event.inputType==='deleteContentBackward'&&p>1&&input.value[p-1]===group){event.preventDefault();input.setRangeText('',p-2,p,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}
  else if(event.inputType==='deleteContentForward'&&input.value[p]===group&&p+1<input.value.length){event.preventDefault();input.setRangeText('',p,p+2,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}
 });
 input.addEventListener('blur',()=>{const{decimal}=separators();if(input.value.endsWith(decimal)){input.value=input.value.slice(0,-1);input.dispatchEvent(new Event('input',{bubbles:true}));}else format();});
 if(input.value){const parsed=parseNumberInput(input.value);setNumberInputValue(input,parsed);}
}