import {ready,client} from './regional-context.js?v=stable-tr-v1';
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=international-v1';
import {today} from './inventory-data.js?v=international-v1';
import {allocatePersonnel,personnelTotal} from './personnel-math.js?v=personnel-v1';
const I=window.AgroIntl,$=id=>document.getElementById(id),money=n=>I.money(n),num=n=>I.num(n,{minimumFractionDigits:2,maximumFractionDigits:2});
let session=null,farms=[],expenses=[],allocations=[],editing=null,requestId=crypto.randomUUID(),saving=false,loading=false,refreshQueued=false,generation=0,requestedEditOpened=false;
const requestedEdit=new URLSearchParams(location.search).get('edit');
const inputs={salary:$('personnel-salary'),insurance:$('personnel-insurance'),other_cost:$('personnel-other')};
Object.values(inputs).forEach(input=>{bindNumberInput(input,{maximumFractionDigits:2});input.addEventListener('blur',()=>{const n=parseNumberInput(input.value);if(Number.isFinite(n)){input.value=num(n);}});});
$('personnel-date').value=today();
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function say(text,error=false,target=$('personnel-status')){target.textContent=text;target.classList.toggle('is-error',error);}
function errorText(error){if(['42P01','PGRST205','PGRST202','42703'].includes(error?.code))return 'Personel giderleri şu anda yüklenemiyor. Lütfen tekrar dene.';return error?.message||'İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.';}
const year=()=>Number($('personnel-year').value);
const values=()=>Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,parseNumberInput(input.value)??0]));
const selected=()=>[...$('personnel-farms').querySelectorAll('input:checked')].map(e=>e.value);
const seasonalFarms=()=>farms.map(f=>{const s=f.farmer_seasons.find(s=>Number(s.season_year)===year());return s?{...f,area_decare:Number(s.area_decare),crop:s.crop}:null;}).filter(Boolean);
function renderFarms(ids=selected()){
 const list=$('personnel-farms');list.replaceChildren();const available=seasonalFarms();
 available.forEach(f=>{const label=node('label',undefined,'personnel-farm'),check=node('input');check.type='checkbox';check.value=f.id;check.checked=ids.includes(f.id);check.addEventListener('change',preview);label.append(check,node('span',f.name+' - '+f.crop+' ('+num(I.area(f.area_decare))+' '+I.t('da')+')'));list.append(label);});
 $('personnel-select-all').disabled=!available.length;
 if(!available.length)list.append(node('p','Bu sezonda kayıtlı tarla yok. Önce Tarla Ekle sayfasından sezon kaydı oluştur.','personnel-help'));
 $('personnel-save').disabled=!available.length||saving||!session;preview();
}
function preview(){
 const target=$('personnel-allocation-preview'),v=values(),total=personnelTotal(v),ids=new Set(selected());target.replaceChildren();
 if(Object.values(v).some(n=>!Number.isFinite(n)||n<0)){target.textContent='Tutarları sıfır veya daha büyük olacak şekilde gir.';return;}
 target.append(node('b','Toplam: '+money(total)));
 const rows=allocatePersonnel(total,seasonalFarms().filter(f=>ids.has(f.id)));
 if(!rows.length){target.append(node('span','Gideri dağıtmak için en az bir tarla seç.'));return;}
 const list=node('ul');rows.forEach(r=>list.append(node('li',r.name+' - '+r.crop+': '+money(r.amount))));target.append(list);
 target.append(node('small','Bu tutar seçilen tarlaların '+year()+' sezon maliyetine eklenecek.'));
}
function resetForm(){editing=null;requestId=crypto.randomUUID();$('personnel-form').reset();$('personnel-date').value=today();$('personnel-form-title').textContent='Personel Gideri Ekle';$('personnel-save').textContent='Personel Giderini Kaydet →';$('personnel-cancel').hidden=true;say('',false,$('personnel-save-status'));renderFarms([]);}
function edit(row){
 editing=row;requestId=crypto.randomUUID();$('personnel-year').value=String(row.season_year);$('personnel-name').value=row.person_name;$('personnel-date').value=row.expense_date;$('personnel-notes').value=row.notes||'';
 Object.entries(inputs).forEach(([key,input])=>{setNumberInputValue(input,row[key]);input.value=num(Number(row[key]));});
 $('personnel-form-title').textContent=row.is_void?'Personel Giderini Yeniden Etkinleştir':'Personel Giderini Düzenle';$('personnel-save').textContent='Değişiklikleri Kaydet →';$('personnel-cancel').hidden=false;
 renderFarms(row.selected_farm_ids||[]);renderRecords();say('Kaydettiğinde tarla payları yeniden hesaplanır.',false,$('personnel-save-status'));$('personnel-form-title').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function renderRecords(){
 const seasonal=expenses.filter(e=>Number(e.season_year)===year()),active=seasonal.filter(e=>!e.is_void),query=$('personnel-filter').value.trim().toLocaleLowerCase('tr-TR');
 for(const [id,key] of [['personnel-salary-total','salary'],['personnel-insurance-total','insurance'],['personnel-other-total','other_cost'],['personnel-grand-total','total_cost']])$(id).textContent=money(active.reduce((n,e)=>n+Math.round(Number(e[key])*100),0)/100);
 const list=$('personnel-records');list.replaceChildren();
 seasonal.filter(e=>(e.person_name+' '+e.notes).toLocaleLowerCase('tr-TR').includes(query)).sort((a,b)=>b.expense_date.localeCompare(a.expense_date)||b.created_at.localeCompare(a.created_at)).forEach(row=>{
  const card=node('article',undefined,'personnel-record'+(row.is_void?' is-void':''));card.append(node('h3',row.person_name),node('p',new Date(row.expense_date+'T12:00:00').toLocaleDateString(I.locale)+' · '+row.season_year+' sezonu'+(row.is_void?' · İptal Edildi':'')),node('strong',money(row.total_cost)),node('p','Maaş: '+money(row.salary)+' · Sigorta: '+money(row.insurance)+' · Diğer: '+money(row.other_cost)));
  if(row.notes)card.append(node('p',row.notes,'personnel-record-note'));
  const parts=allocations.filter(a=>a.expense_id===row.id),ul=node('ul');parts.forEach(a=>{const f=farms.find(f=>f.id===a.farm_id),s=f?.farmer_seasons.find(s=>Number(s.season_year)===Number(a.season_year)),li=node('li'),link=node('a',(f?.name||'Tarla')+(s?' - '+s.crop:''));link.href='tarla-detay.html?rev=personnel-v1&farm='+encodeURIComponent(a.farm_id)+'&year='+a.season_year;li.append(link,document.createTextNode(': '+money(a.amount)));ul.append(li);});if(parts.length)card.append(ul);
  if(row.is_void)card.append(node('p','Bu kayıt tarla maliyetine dahil değil. Düzenleyip kaydederek yeniden etkinleştirebilirsin.','personnel-record-note'));
  const actions=node('div',undefined,'inventory-actions'),editButton=node('button',row.is_void?'Yeniden Düzenle':'Düzenle','inventory-button');editButton.type='button';editButton.disabled=saving;editButton.addEventListener('click',()=>edit(row));actions.append(editButton);
  if(!row.is_void){const cancel=node('button','Kaydı İptal Et','inventory-button');cancel.type='button';cancel.disabled=saving;cancel.addEventListener('click',()=>voidRecord(row));actions.append(cancel);}card.append(actions);list.append(card);
 });$('personnel-empty').hidden=list.children.length>0;$('personnel-empty').textContent=query?'Aramana uygun personel kaydı yok.':'Bu sezonda henüz personel gideri yok.';
 $('personnel-names').replaceChildren(...[...new Set(expenses.map(e=>e.person_name))].sort((a,b)=>a.localeCompare(b,'tr')).map(n=>new Option(n,n)));
}
async function all(table){const rows=[];for(let start=0;;start+=500){let q=client.from(table).select('*').eq('user_id',session.user.id);q=table==='farmer_personnel_allocations'?q.order('expense_id').order('farm_id'):q.order('id');const {data,error}=await q.range(start,start+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
async function refresh(){
 if(!session)return;if(loading){refreshQueued=true;return;}const run=++generation,uid=session.user.id;loading=true;$('personnel-refresh').disabled=true;
 try{
  const [f,e,a]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',uid).order('created_at'),all('farmer_personnel_expenses'),all('farmer_personnel_allocations')]);if(f.error)throw f.error;if(run!==generation||session?.user.id!==uid)return;
  farms=f.data||[];expenses=e;allocations=a;
  const current=$('personnel-year').value,years=[...new Set([...farms.flatMap(f=>f.farmer_seasons.map(s=>Number(s.season_year))),...expenses.map(e=>Number(e.season_year))])].sort((a,b)=>b-a);if(!years.length)years.push(new Date().getFullYear());
  $('personnel-year').replaceChildren(...years.map(y=>new Option(String(y),String(y))));$('personnel-year').value=years.includes(Number(current))?current:String(years.includes(new Date().getFullYear())?new Date().getFullYear():years[0]);
  $('personnel-fields').disabled=saving;$('personnel-year').disabled=saving;renderFarms();renderRecords();say('Personel kayıtların güncel.');
  if(requestedEdit&&!requestedEditOpened){requestedEditOpened=true;const row=expenses.find(e=>e.id===requestedEdit);if(row)edit(row);else say('Personel kaydı bulunamadı veya hesabına ait değil.',true);}
 }catch(error){if(run===generation)say(errorText(error),true);}
 finally{loading=false;$('personnel-refresh').disabled=!session||saving;if(refreshQueued){refreshQueued=false;refresh();}}
}
function busy(value){saving=value;$('personnel-save').disabled=value||!session||!seasonalFarms().length;$('personnel-fields').disabled=value;$('personnel-year').disabled=value;$('personnel-refresh').disabled=value;renderRecords();}
$('personnel-form').addEventListener('input',preview);
$('personnel-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!session||saving||loading)return;
 const amounts=values(),ids=selected(),total=personnelTotal(amounts),name=$('personnel-name').value.trim();
 if(!name||!ids.length){say('Personel adını gir ve en az bir tarla seç.',true,$('personnel-save-status'));return;}
 if(Object.values(amounts).some(n=>!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>1e-6)||!(total>0&&total<=9999999999.99)){say('Toplam sıfırdan büyük olmalı. Tutarları en fazla iki ondalıkla gir.',true,$('personnel-save-status'));return;}
 const payload={id:editing?.id||null,person_name:name,expense_date:$('personnel-date').value,season_year:year(),...amounts,notes:$('personnel-notes').value.trim()};busy(true);say('Personel gideri ve tarla payları kaydediliyor…',false,$('personnel-save-status'));
 try{const {error}=await client.rpc('agroverix_save_personnel_expense',{p_expense:payload,p_farm_ids:ids,p_request_id:requestId});if(error)throw error;resetForm();await refresh();say('Personel gideri kaydedildi ve seçilen tarlaların sezon maliyetine eklendi.',false,$('personnel-save-status'));}
 catch(error){say(errorText(error),true,$('personnel-save-status'));}finally{busy(false);$('personnel-save').disabled=!seasonalFarms().length;}
});
async function voidRecord(row){
 if(saving||!session||!window.confirm('Bu personel gideri iptal edilsin mi? Tarla maliyetlerinden düşülür. Kaydı daha sonra yeniden etkinleştirebilirsin.'))return;
 busy(true);try{const {error}=await client.rpc('agroverix_void_personnel_expense',{p_id:row.id});if(error)throw error;if(editing?.id===row.id)resetForm();await refresh();say('Personel gideri iptal edildi; tarla maliyetleri güncellendi.');}catch(error){say(errorText(error),true);}finally{busy(false);}
}
$('personnel-cancel').addEventListener('click',resetForm);$('personnel-filter').addEventListener('input',renderRecords);$('personnel-refresh').addEventListener('click',refresh);
$('personnel-year').addEventListener('change',()=>{resetForm();renderRecords();});
$('personnel-select-all').addEventListener('click',()=>{const fields=[...$('personnel-farms').querySelectorAll('input')],allSelected=fields.length&&fields.every(e=>e.checked);fields.forEach(e=>e.checked=!allSelected);preview();});
window.addEventListener('focus',()=>{if(!saving)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!saving)refresh();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
try{
 await ready;Object.entries({salary:'Maaş',insurance:'Sigorta',other_cost:'Diğer Personel Giderleri'}).forEach(([key,label])=>inputs[key].parentElement.querySelector('label').textContent=label+' ('+I.currencyLabel()+')');if(!client)throw new Error('Kayıt servisine bağlanılamadı.');const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
 $('personnel-auth').hidden=Boolean(session);
 if(session)await refresh();else say('Giriş yaptıktan sonra personel giderlerini kaydedebilirsin.');
 client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id){generation++;setTimeout(()=>location.reload(),0);}});
}catch(error){say(errorText(error),true);}
