import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {allocatePersonnel,personnelTotal} from '../assets/personnel-math.js';
class Element{
 value='';children=[];listeners={};classList={toggle(){}};checked=false;disabled=false;hidden=false;label={textContent:''};
 constructor(tag='div'){this.tag=tag;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 addEventListener(key,fn){this.listeners[key]=fn;}
 querySelectorAll(selector){const rows=[];const visit=e=>{if(e.tag==='input'&&(selector==='input'||selector==='input:checked'&&e.checked))rows.push(e);for(const c of e.children||[])visit(c);};visit(this);return rows;}
 querySelector(){return this.label;}scrollIntoView(){}
}
async function harness(){
 const html=await readFile(new URL('../personel.html',import.meta.url),'utf8'),source=await readFile(new URL('../assets/personnel.js',import.meta.url),'utf8');
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()])),get=id=>{assert.ok(nodes.has(id),'Unknown element '+id);return nodes.get(id);};
 for(const id of ['personnel-salary','personnel-insurance','personnel-other'])get(id).parentElement=new Element();
 get('personnel-form').reset=()=>{for(const id of ['personnel-name','personnel-date','personnel-salary','personnel-insurance','personnel-other','personnel-notes'])get(id).value='';for(const e of get('personnel-farms').querySelectorAll('input'))e.checked=false;};
 const data={farmer_personnel_expenses:[],farmer_personnel_allocations:[]},calls=[];
 const farmRows=[{id:'a',name:'Örnek Tarla A',farmer_seasons:[{season_year:2026,crop:'Buğday',area_decare:30}]},{id:'b',name:'Örnek Tarla B',farmer_seasons:[{season_year:2026,crop:'Pamuk',area_decare:70}]}];
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}}),onAuthStateChange(){}},from:table=>({select(){return this;},eq(column,value){assert.equal(column,'user_id');assert.equal(value,'owner');return this;},order(){return this;},range:async()=>({data:data[table]||[]}),then(resolve){return Promise.resolve({data:farmRows}).then(resolve);}}),rpc:async(name,args)=>{calls.push({name,args});if(name==='agroverix_save_personnel_expense'){const p=args.p_expense;data.farmer_personnel_expenses=[{...p,id:'expense',created_at:'2026-06-01T00:00:00Z',total_cost:personnelTotal(p),selected_farm_ids:args.p_farm_ids,is_void:false}];data.farmer_personnel_allocations=allocatePersonnel(personnelTotal(p),args.p_farm_ids.map(id=>({id,area_decare:id==='a'?30:70}))).map(r=>({expense_id:'expense',farm_id:r.id,amount:r.amount,season_year:2026}));}else{data.farmer_personnel_expenses[0].is_void=true;data.farmer_personnel_allocations=[];}return {data:'expense'};}};
 const I={locale:'tr-TR',currencyLabel:()=> 'TL',area:n=>n,t:s=>s,num:(n,o)=>Number(n).toLocaleString('tr-TR',o),money:n=>Number(n).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' TL'};
 await vm.runInNewContext('(async()=>{'+source.replace(/^import .*\n/gm,'')+'})()',{
  document:{getElementById:get,createElement:tag=>new Element(tag),createTextNode:s=>({textContent:s}),addEventListener(){}},window:{AgroIntl:I,addEventListener(){},matchMedia:()=>({matches:true}),confirm:()=>true},
  ready:Promise.resolve(),client,allocatePersonnel,personnelTotal,bindNumberInput(){},parseNumberInput:s=>s===''?null:Number(s.split('.').join('').replace(',','.')),setNumberInputValue:(e,v)=>e.value=String(v),today:()=> '2026-06-01',crypto:{randomUUID:()=> 'request'},location:{search:'',reload(){}},URLSearchParams,Option:class{constructor(text,value){this.textContent=text;this.value=value;}},setTimeout
 });return {get,calls,data};
}
const fill=({get})=>{get('personnel-name').value='Örnek Personel';get('personnel-salary').value='800,00';get('personnel-insurance').value='100,00';get('personnel-other').value='100,00';get('personnel-select-all').listeners.click();};
test('personnel form saves salary components, selected farms and season; clears form and re-enables Save',async()=>{const h=await harness();fill(h);await h.get('personnel-form').listeners.submit({preventDefault(){}});assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'agroverix_save_personnel_expense');assert.equal(h.calls[0].args.p_expense.salary,800);assert.equal(h.calls[0].args.p_expense.insurance,100);assert.equal(h.calls[0].args.p_expense.other_cost,100);assert.equal(h.calls[0].args.p_expense.season_year,2026);assert.deepEqual(Array.from(h.calls[0].args.p_farm_ids),['a','b']);assert.equal(h.get('personnel-name').value,'');assert.equal(h.get('personnel-save').disabled,false);assert.equal(h.get('personnel-fields').disabled,false);});
test('cancelling a saved personnel record removes total and leaves the new-entry form usable',async()=>{const h=await harness();fill(h);await h.get('personnel-form').listeners.submit({preventDefault(){}});const card=h.get('personnel-records').children[0],actions=card.children.at(-1),cancel=actions.children.find(e=>e.textContent==='Kaydı İptal Et');await cancel.listeners.click();assert.equal(h.calls.at(-1).name,'agroverix_void_personnel_expense');assert.equal(h.data.farmer_personnel_expenses[0].is_void,true);assert.equal(h.get('personnel-grand-total').textContent,'0,00 TL');assert.equal(h.get('personnel-save').disabled,false);assert.equal(h.get('personnel-fields').disabled,false);});
