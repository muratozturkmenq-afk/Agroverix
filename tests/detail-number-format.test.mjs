import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
globalThis.window={AgroIntl:{locale:'tr-TR',lang:'tr',t:s=>s,perArea:n=>n}};
const {formatDetailNumber,setDetailInputValue,readDetailInputValue,bindDetailInput}=await import('../assets/detail-number-format.js');
const {appendMetric,appendSupportMetrics,farmFinance,seasonFor,operationLabels,serviceTypes}=await import('../assets/farm-finance.js');
const {costPerDecare}=await import('../assets/operation-cost.js');
class Field extends EventTarget{value='';selectionStart=0;selectionEnd=0;setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}}
test('weighted sale price and all decimal displays use exactly two places',()=>{assert.equal(formatDetailNumber(12.709743),'12,71');assert.equal(formatDetailNumber(1000.5),'1.000,50');assert.equal(formatDetailNumber(35),'35,00');assert.equal(formatDetailNumber(0),'0,00');assert.equal(formatDetailNumber(null),'—');});
test('loading an unedited legacy value preserves its full calculation precision',()=>{const field=new Field();bindDetailInput(field);setDetailInputValue(field,12.709743);assert.equal(field.value,'12,71');assert.equal(readDetailInputValue(field),12.709743);field.dispatchEvent(new Event('blur'));assert.equal(readDetailInputValue(field),12.709743);});
test('edited amounts get a two-place display and are read as the new amount',()=>{const field=new Field();bindDetailInput(field);setDetailInputValue(field,12.709743);field.value='14,2';field.selectionStart=field.value.length;field.dispatchEvent(new Event('input'));field.dispatchEvent(new Event('blur'));assert.equal(field.value,'14,20');assert.equal(readDetailInputValue(field),14.2);});
test('pasted excess decimals round on leaving a field',()=>{const field=new Field();bindDetailInput(field);field.value='14,236';field.selectionStart=field.value.length;field.dispatchEvent(new Event('input'));field.dispatchEvent(new Event('blur'));assert.equal(field.value,'14,24');assert.equal(readDetailInputValue(field),14.24);});
test('blank fields stay blank and do not become a zero',()=>{const field=new Field();bindDetailInput(field);setDetailInputValue(field,null);field.dispatchEvent(new Event('blur'));assert.equal(field.value,'');assert.equal(readDetailInputValue(field),null);});
test('a browser-restored price has two decimals as soon as input binding runs',()=>{const field=new Field();field.value='12,709743';bindDetailInput(field);assert.equal(field.value,'12,71');assert.equal(readDetailInputValue(field),12.709743);});

test('first direct navigation to actual results formats weighted price without a reload and has no forecast section',async()=>{
 const html=await readFile(new URL('../tarla-detay.html',import.meta.url),'utf8');
 const source=await readFile(new URL('../assets/farm-detail-finance.js',import.meta.url),'utf8');
 const home=await readFile(new URL('../assets/home-finance-dashboard.js',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="expected-report(?:-note)?"|Sezon İçi Tahmini Sonuç/);
 assert.doesNotMatch(source,/\$\('expected-report/);
 assert.match(home,/card.href='tarla-detay.html\?rev=actual-only-v2&farm='/);
 class Element extends Field{
  children=[];textContent='';classList={toggle(){}};
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(){}add(option){this.children.push(option);}
 }
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document={getElementById:id=>{assert.ok(elements.has(id),'Unexpected DOM reference: '+id);return elements.get(id);},createElement:()=>new Element()};
 const season={season_year:2026,crop:'Örnek Bitki',area_decare:35,tenure:'owned',harvest_sale_count:2,harvest_sale_kg:9800,harvest_sale_total:124555.4814,actual_support:0};
 const farm={id:'sample-farm',name:'Örnek Tarla',season_year:2026,farmer_seasons:[season]};
 const regionalClient={auth:{getSession:async()=>({data:{session:{user:{id:'sample-user'}}}})},from:table=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:farm};},async order(){return {data:[]};}})};
 const old=globalThis.document;globalThis.document=document;
 try{
  await vm.runInNewContext('(async()=>{'+source.replace(/^import .*\n/gm,'')+'})()',{
   window:{AgroIntl:globalThis.window.AgroIntl,AGROVERIX_SUPABASE:{url:'example',publishableKey:'public-test'},addEventListener(){}},
   document,regionalReady:Promise.resolve(),regionalClient,fmt:formatDetailNumber,setNumberInputValue:setDetailInputValue,readDetailInputValue,bindDetailInput,
   farmFinance,seasonFor,sharedMetric:appendMetric,sharedSupportMetrics:appendSupportMetrics,operationLabels,serviceTypes,costPerDecare,
   locationLabels:()=>'',areaDisplay:n=>n,perAreaDisplay:n=>n,perAreaStored:n=>n,
   URLSearchParams,URL,location:{search:'?rev=actual-only-v2&farm=sample-farm&year=2026',href:'https://example.test/tarla-detay.html?rev=actual-only-v2&farm=sample-farm&year=2026',hash:'#season-end'},history:{replaceState(){}},
   Option:class{constructor(text,value){this.text=text;this.value=value;}},fetch:async()=>({ok:false})
  });
  assert.equal(elements.get('actual-price').value,'12,71');
  assert.equal(elements.get('actual-price').disabled,true);
  assert.match(elements.get('actual-report-note').textContent,/12,71 TL\/kg/);
  assert.doesNotMatch(elements.get('actual-report-note').textContent,/12,709743/);
  assert.equal(elements.get('actual-yield').value,'280,00');
 }finally{globalThis.document=old;}
});
test('detail metrics and support use the same two-place formatter while other pages keep their default',()=>{const old=globalThis.document;globalThis.document={createElement:()=>({children:[],append(...values){this.children.push(...values);}})};const parent={children:[],append(e){this.children.push(e);}};try{appendMetric(parent,'Fiyat',12.7,'TL/kg','finance-metric',formatDetailNumber);assert.equal(parent.children[0].children[1].textContent,'12,70 TL/kg');appendSupportMetrics(parent,{support:1000,supportPerDecare:35.5,supportPerKg:0.1},formatDetailNumber);assert.deepEqual(parent.children.slice(1).map(e=>e.children[1].textContent),['1.000,00 TL','35,50 TL/da','0,10 TL/kg']);appendMetric(parent,'Diğer sayfa',12.7);assert.equal(parent.children.at(-1).children[1].textContent,'12,7');}finally{globalThis.document=old;}});
