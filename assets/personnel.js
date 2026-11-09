import {ready,client} from './regional-context.js?v=stable-tr-v1';
import {bindNumberInput,parseNumberInput,setNumberInputValue} from './number-input.js?v=international-v1';
import {today} from './inventory-data.js?v=international-v1';
import {allocatePersonnel,personnelTotal,payrollMonths,duePersonnelMonths,remainingPersonnelPay} from './personnel-math.js?v=payroll-v1';
const I=window.AgroIntl,$=id=>document.getElementById(id),money=n=>I.money(n),num=n=>I.num(n,{minimumFractionDigits:2,maximumFractionDigits:2});
let session=null,farms=[],expenses=[],allocations=[],schedules=[],adjustments=[],editing=null,editingAdjustment=null,adjustmentRequestId=crypto.randomUUID(),requestId=crypto.randomUUID(),saving=false,loading=false,refreshQueued=false,generation=0,requestedEditOpened=false;
const requestedEdit=new URLSearchParams(location.search).get('edit');
const inputs={salary:$('personnel-salary'),insurance:$('personnel-insurance'),other_cost:$('personnel-other')};
Object.values(inputs).forEach(input=>{bindNumberInput(input,{maximumFractionDigits:2});input.addEventListener('blur',()=>{const n=parseNumberInput(input.value);if(Number.isFinite(n)){input.value=num(n);}});});
$('personnel-date').value=today();$('personnel-start-month').value=today().slice(0,7);$('personnel-adjustment-date').value=today();bindNumberInput($('personnel-adjustment-amount'),{maximumFractionDigits:2});
const monthLabel=m=>new Date(m.slice(0,7)+'-01T12:00:00').toLocaleDateString(I.locale,{year:'numeric',month:'long'});
const workLabel=t=>t==='permanent'?'Daimi':'Geçici';
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
 const start=$('personnel-start-month').value,count=editing?1:Number($('personnel-months').value),months=payrollMonths(start,count),due=editing?1:duePersonnelMonths(start,count,today()).length;
 target.append(node('b','Aylık Toplam: '+money(total)));
 if(!editing&&months.length)target.append(node('p',count+' ay · '+monthLabel(months[0])+' – '+monthLabel(months.at(-1))+'. Toplam plan: '+money(Math.round(total*100)*count/100)+'. Bugüne kadar '+due+' ay gideri oluşur; kalan aylar zamanı geldiğinde eklenir.'));
 if(editing)target.append(node('p','Yalnızca bu ayın gideri güncellenir. Çalışma planının sonraki ayları değişmez.'));
 const rows=allocatePersonnel(total,seasonalFarms().filter(f=>ids.has(f.id)));
 if(!rows.length){target.append(node('span','Gideri dağıtmak için en az bir tarla seç.'));return;}
 const list=node('ul');rows.forEach(r=>list.append(node('li',r.name+' - '+r.crop+': '+money(r.amount))));target.append(list);
 target.append(node('small','Bu tutar seçilen tarlaların '+year()+' sezon maliyetine eklenecek.'));
}
function resetForm(){editing=null;$('personnel-months').disabled=false;$('personnel-start-month').disabled=false;$('personnel-employment').disabled=false;requestId=crypto.randomUUID();$('personnel-form').reset();$('personnel-date').value=today();$('personnel-start-month').value=today().slice(0,7);$('personnel-form-title').textContent='Çalışma Planı Ekle';$('personnel-save').textContent='Çalışma Planını Kaydet →';$('personnel-cancel').hidden=true;say('',false,$('personnel-save-status'));renderFarms([]);}
function edit(row){
 showPersonnelTab('plan');editing=row;requestId=crypto.randomUUID();$('personnel-start-month').value=(row.period_month||row.expense_date).slice(0,7);$('personnel-months').value='1';$('personnel-months').disabled=true;$('personnel-start-month').disabled=true;$('personnel-employment').value=row.employment_type||'temporary';$('personnel-employment').disabled=true;$('personnel-year').value=String(row.season_year);$('personnel-name').value=row.person_name;$('personnel-date').value=row.expense_date;$('personnel-notes').value=row.notes||'';
 Object.entries(inputs).forEach(([key,input])=>{const value=key==='other_cost'?row.base_other_cost??row.other_cost:row[key];setNumberInputValue(input,value);input.value=num(Number(value));});
 $('personnel-form-title').textContent=row.is_void?'Bu Ayın Kaydını Yeniden Etkinleştir':'Bu Ayın Giderini Düzenle';$('personnel-save').textContent='Bu Ayı Kaydet →';$('personnel-cancel').hidden=false;
 renderFarms(row.selected_farm_ids||[]);renderRecords();say('Kaydettiğinde tarla payları yeniden hesaplanır.',false,$('personnel-save-status'));$('personnel-form-title').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function renderRecords(){
 const seasonal=expenses.filter(e=>Number(e.season_year)===year()),active=seasonal.filter(e=>!e.is_void),query=$('personnel-filter').value.trim().toLocaleLowerCase('tr-TR');
 for(const [id,key] of [['personnel-salary-total','salary'],['personnel-insurance-total','insurance'],['personnel-other-total','other_cost'],['personnel-grand-total','total_cost']])$(id).textContent=money(active.reduce((n,e)=>n+Math.round(Number(e[key])*100),0)/100);
 $('personnel-advance-total').textContent=money(active.reduce((n,e)=>n+Math.round(Number(e.advance_total||0)*100),0)/100);$('personnel-remaining-total').textContent=money(active.reduce((n,e)=>n+Math.round(remainingPersonnelPay(e)*100),0)/100);
 const month=$('personnel-month-filter').value,availableMonths=[...new Set(seasonal.map(e=>(e.period_month||e.expense_date).slice(0,7)))].sort().reverse();$('personnel-month-filter').replaceChildren(new Option('Tüm Aylar',''),...availableMonths.map(m=>new Option(monthLabel(m),m)));$('personnel-month-filter').value=availableMonths.includes(month)?month:'';
 const list=$('personnel-records');list.replaceChildren();
 seasonal.filter(e=>!$('personnel-month-filter').value||(e.period_month||e.expense_date).slice(0,7)===$('personnel-month-filter').value).filter(e=>(e.person_name+' '+e.notes).toLocaleLowerCase('tr-TR').includes(query)).sort((a,b)=>b.expense_date.localeCompare(a.expense_date)||b.created_at.localeCompare(a.created_at)).forEach(row=>{
  const card=node('article',undefined,'personnel-record'+(row.is_void?' is-void':''));card.append(node('h3',row.person_name),node('p',monthLabel(row.period_month||row.expense_date)+' · '+workLabel(row.employment_type)+' · '+row.season_year+' sezonu'+(row.is_void?' · İptal Edildi':'')),node('strong',money(row.total_cost)),node('p','Maaş: '+money(row.salary)+' · Sigorta: '+money(row.insurance)+' · Diğer: '+money(row.base_other_cost??row.other_cost)+' · Ek Ödeme: '+money(row.extra_pay||0)));
  card.append(node('p','Avans: '+money(row.advance_total||0)+' · Kalan Maaş ve Ek Ödeme: '+money(remainingPersonnelPay(row)),'personnel-payment-line'));
  if(row.notes)card.append(node('p',row.notes,'personnel-record-note'));
  const parts=allocations.filter(a=>a.expense_id===row.id),ul=node('ul');parts.forEach(a=>{const f=farms.find(f=>f.id===a.farm_id),s=f?.farmer_seasons.find(s=>Number(s.season_year)===Number(a.season_year)),li=node('li'),link=node('a',(f?.name||'Tarla')+(s?' - '+s.crop:''));link.href='tarla-detay.html?rev=personnel-v1&farm='+encodeURIComponent(a.farm_id)+'&year='+a.season_year;li.append(link,document.createTextNode(': '+money(a.amount)));ul.append(li);});if(parts.length)card.append(ul);
  if(row.is_void)card.append(node('p','Bu kayıt tarla maliyetine dahil değil. Düzenleyip kaydederek yeniden etkinleştirebilirsin.','personnel-record-note'));
  const actions=node('div',undefined,'inventory-actions'),editButton=node('button',row.is_void?'Yeniden Düzenle':'Düzenle','inventory-button');editButton.type='button';editButton.disabled=saving;editButton.addEventListener('click',()=>edit(row));actions.append(editButton);
  if(!row.is_void){const pay=node('button','Avans / Ek Ödeme','inventory-button');pay.type='button';pay.disabled=saving;pay.addEventListener('click',()=>{showPersonnelTab('adjustment');$('personnel-adjustment-expense').value=row.id;adjustmentExpenseChanged();});actions.append(pay);const cancel=node('button','Kaydı İptal Et','inventory-button');cancel.type='button';cancel.disabled=saving;cancel.addEventListener('click',()=>voidRecord(row));actions.append(cancel);}card.append(actions);list.append(card);
 });$('personnel-empty').hidden=list.children.length>0;$('personnel-empty').textContent=query?'Aramana uygun personel kaydı yok.':'Bu sezonda henüz personel gideri yok.';
 $('personnel-names').replaceChildren(...[...new Set(expenses.map(e=>e.person_name))].sort((a,b)=>a.localeCompare(b,'tr')).map(n=>new Option(n,n)));
}
async function all(table){const rows=[];for(let start=0;;start+=500){let q=client.from(table).select('*').eq('user_id',session.user.id);q=table==='farmer_personnel_allocations'?q.order('expense_id').order('farm_id'):q.order('id');const {data,error}=await q.range(start,start+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
async function refresh(){
 if(!session)return;if(loading){refreshQueued=true;return;}const run=++generation,uid=session.user.id;loading=true;$('personnel-refresh').disabled=true;
 try{
  await client.rpc('agroverix_refresh_personnel_due').then(result=>{if(result.error)throw result.error;});
  const [f,e,a,plans,payments]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('user_id',uid).order('created_at'),all('farmer_personnel_expenses'),all('farmer_personnel_allocations'),all('farmer_personnel_schedules'),all('farmer_personnel_adjustments')]);if(f.error)throw f.error;if(run!==generation||session?.user.id!==uid)return;
  farms=f.data||[];expenses=e;allocations=a;schedules=plans;adjustments=payments;
  const current=$('personnel-year').value,years=[...new Set([...farms.flatMap(f=>f.farmer_seasons.map(s=>Number(s.season_year))),...expenses.map(e=>Number(e.season_year)),...schedules.map(e=>Number(e.season_year))])].sort((a,b)=>b-a);if(!years.length)years.push(new Date().getFullYear());
  $('personnel-year').replaceChildren(...years.map(y=>new Option(String(y),String(y))));$('personnel-year').value=years.includes(Number(current))?current:String(years.includes(new Date().getFullYear())?new Date().getFullYear():years[0]);
  $('personnel-fields').disabled=saving;$('personnel-year').disabled=saving;renderFarms();renderRecords();renderSchedules();renderAdjustmentOptions();say('Personel kayıtların ve zamanı gelen aylık giderlerin güncel.');
  if(requestedEdit&&!requestedEditOpened){requestedEditOpened=true;const row=expenses.find(e=>e.id===requestedEdit);if(row)edit(row);else say('Personel kaydı bulunamadı veya hesabına ait değil.',true);}
 }catch(error){if(run===generation)say(errorText(error),true);}
 finally{loading=false;$('personnel-refresh').disabled=!session||saving;if(refreshQueued){refreshQueued=false;refresh();}}
}
function busy(value){saving=value;$('personnel-adjustment-fields').disabled=value||!session;$('personnel-adjustment-save').disabled=value||!expenses.some(e=>!e.is_void&&Number(e.season_year)===year());$('personnel-tab-plan').disabled=value;$('personnel-tab-adjustment').disabled=value;$('personnel-save').disabled=value||!session||!seasonalFarms().length;$('personnel-fields').disabled=value;$('personnel-year').disabled=value;$('personnel-refresh').disabled=value;renderRecords();renderSchedules();renderAdjustmentRecords();}
$('personnel-form').addEventListener('input',preview);$('personnel-form').addEventListener('change',preview);
$('personnel-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!session||saving||loading)return;
 const amounts=values(),ids=selected(),total=personnelTotal(amounts),name=$('personnel-name').value.trim();
 if(!name||!ids.length){say('Personel adını gir ve en az bir tarla seç.',true,$('personnel-save-status'));return;}
 if(Object.values(amounts).some(n=>!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>1e-6)||!(total>0&&total<=9999999999.99)){say('Toplam sıfırdan büyük olmalı. Tutarları en fazla iki ondalıkla gir.',true,$('personnel-save-status'));return;}
 const payload={id:editing?.id||null,person_name:name,expense_date:editing?editing.expense_date:$('personnel-start-month').value+'-01',start_month:$('personnel-start-month').value+'-01',month_count:Number($('personnel-months').value),employment_type:$('personnel-employment').value,base_other_cost:amounts.other_cost,season_year:year(),...amounts,notes:$('personnel-notes').value.trim()};busy(true);say('Personel gideri ve tarla payları kaydediliyor…',false,$('personnel-save-status'));
 try{const {error}=editing?await client.rpc('agroverix_save_personnel_expense',{p_expense:payload,p_farm_ids:ids,p_request_id:requestId}):await client.rpc('agroverix_save_personnel_schedule',{p_schedule:payload,p_farm_ids:ids,p_request_id:requestId});if(error)throw error;resetForm();await refresh();say('Kayıt saklandı. Zamanı gelen aylar tarla maliyetine eklendi; gelecek aylar otomatik oluşacak.',false,$('personnel-save-status'));}
 catch(error){say(errorText(error),true,$('personnel-save-status'));}finally{busy(false);$('personnel-save').disabled=!seasonalFarms().length;}
});
async function voidRecord(row){
 if(saving||!session||!window.confirm('Bu personel gideri iptal edilsin mi? Tarla maliyetlerinden düşülür. Kaydı daha sonra yeniden etkinleştirebilirsin.'))return;
 busy(true);try{const {error}=await client.rpc('agroverix_void_personnel_expense',{p_id:row.id});if(error)throw error;if(editing?.id===row.id)resetForm();await refresh();say('Personel gideri iptal edildi; tarla maliyetleri güncellendi.');}catch(error){say(errorText(error),true);}finally{busy(false);}
}
$('personnel-cancel').addEventListener('click',resetForm);$('personnel-filter').addEventListener('input',renderRecords);$('personnel-refresh').addEventListener('click',refresh);
$('personnel-year').addEventListener('change',()=>{resetForm();resetAdjustment();renderRecords();renderSchedules();renderAdjustmentOptions();});$('personnel-month-filter').addEventListener('change',renderRecords);$('personnel-employment').addEventListener('change',()=>{if(!editing)$('personnel-months').value=$('personnel-employment').value==='permanent'?'12':'1';preview();});
$('personnel-select-all').addEventListener('click',()=>{const fields=[...$('personnel-farms').querySelectorAll('input')],allSelected=fields.length&&fields.every(e=>e.checked);fields.forEach(e=>e.checked=!allSelected);preview();});
window.addEventListener('focus',()=>{if(!saving)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!saving)refresh();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
function showPersonnelTab(tab){
 for(const name of ['plan','adjustment']){const active=name===tab,button=$('personnel-tab-'+name);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$('personnel-'+name+'-panel').hidden=!active;}
}
function renderSchedules(){
 const list=$('personnel-schedules');list.replaceChildren();
 schedules.filter(p=>Number(p.season_year)===year()).sort((a,b)=>b.start_month.localeCompare(a.start_month)).forEach(p=>{
  const months=payrollMonths(p.start_month.slice(0,7),p.month_count),posted=expenses.filter(e=>e.schedule_id===p.id).length,complete=posted>=p.month_count;
  const card=node('article',undefined,'personnel-record');card.append(node('h3',p.person_name+' · '+workLabel(p.employment_type)),node('p',monthLabel(months[0])+' – '+monthLabel(months.at(-1))+' · '+p.month_count+' ay'),node('p','Aylık Maaş: '+money(p.salary)+' · Sigorta: '+money(p.insurance)+' · Diğer: '+money(p.other_cost)),node('p','Aylık Toplam: '+money(personnelTotal(p))+' · Oluşan Ay: '+posted+'/'+p.month_count),node('p',!p.is_active?'Otomatik kayıt durduruldu.':complete?'Planın bütün ayları oluştu.':'Zamanı gelen aylarda otomatik gider oluşur.','personnel-schedule-state'));
  if(p.last_error)card.append(node('p','Otomatik kayıt bekliyor: '+p.last_error+' Tarla ve sezon bilgilerini kontrol et.','personnel-plan-error'));
  if(p.is_active&&!complete){const stop=node('button','Gelecek Ayları Durdur','inventory-button');stop.type='button';stop.disabled=saving;stop.addEventListener('click',async()=>{if(saving||!window.confirm('Henüz oluşmamış aylık giderler durdurulsun mu? Daha önce oluşan ayların kayıtları korunur.'))return;busy(true);try{const {error}=await client.rpc('agroverix_stop_personnel_schedule',{p_id:p.id});if(error)throw error;await refresh();say('Çalışma planı durduruldu. Oluşmuş aylık kayıtlar korundu.');}catch(error){say(errorText(error),true);}finally{busy(false);renderSchedules();}});card.append(stop);}list.append(card);
 });
}
function renderAdjustmentOptions(){
 const select=$('personnel-adjustment-expense'),previous=select.value,available=expenses.filter(e=>!e.is_void&&Number(e.season_year)===year()).sort((a,b)=>(b.period_month||b.expense_date).localeCompare(a.period_month||a.expense_date)||a.person_name.localeCompare(b.person_name,'tr'));
 select.replaceChildren(new Option('Personel ve ay seç',''),...available.map(e=>new Option(e.person_name+' · '+monthLabel(e.period_month||e.expense_date),e.id)));
 select.value=available.some(e=>e.id===previous)?previous:available.find(e=>(e.period_month||e.expense_date).slice(0,7)===today().slice(0,7))?.id||'';
 $('personnel-adjustment-save').disabled=!available.length||saving;$('personnel-adjustment-fields').disabled=!session||saving;
 adjustmentPreview();renderAdjustmentRecords();
}
function adjustmentExpenseChanged(){
 const e=expenses.find(e=>e.id===$('personnel-adjustment-expense').value);
 if(e&&!editingAdjustment){const m=(e.period_month||e.expense_date).slice(0,7);$('personnel-adjustment-date').value=m===today().slice(0,7)?today():m+'-01';}
 adjustmentPreview();renderAdjustmentRecords();
}
function adjustmentPreview(){
 const e=expenses.find(e=>e.id===$('personnel-adjustment-expense').value),target=$('personnel-adjustment-preview');target.replaceChildren();
 if(!e){target.textContent='Önce zamanı gelmiş bir personel ve ay kaydı seç.';return;}
 const amount=parseNumberInput($('personnel-adjustment-amount').value)??0,kind=$('personnel-adjustment-kind').value,date=$('personnel-adjustment-date').value;
 const oldAdvance=editingAdjustment&&!editingAdjustment.is_void&&editingAdjustment.kind==='advance'?Number(editingAdjustment.amount):0,oldExtra=editingAdjustment&&!editingAdjustment.is_void&&editingAdjustment.kind==='extra'?Number(editingAdjustment.amount):0;
 const advance=Number(e.advance_total||0)-oldAdvance+(kind==='advance'?amount:0),extra=Number(e.extra_pay||0)-oldExtra+(kind==='extra'?amount:0);
 target.append(node('b',e.person_name+' · '+monthLabel(e.period_month||e.expense_date)),node('p','Maaş: '+money(e.salary)+' · Verilen Avans: '+money(e.advance_total||0)+' · Ek Ödeme: '+money(e.extra_pay||0)));
 if(date&&date.slice(0,7)!==(e.period_month||e.expense_date).slice(0,7)){target.append(node('p','Ödeme tarihiyle aynı ayın personel kaydını seç. Avans, verildiği ayın maaşından düşülür.','is-error'));return;}
 if(!Number.isFinite(amount)||amount<0){target.append(node('p','Geçerli bir tutar gir.','is-error'));return;}
 target.append(node('strong','Kayıttan Sonra Kalan Maaş ve Ek Ödeme: '+money(Number(e.salary)+extra-advance)));
 target.append(node('p',kind==='advance'?'Avans toplam maaş maliyetini değiştirmez; yalnızca kalan maaş ödemesinden düşer.':'Ek ödeme bu ayın personel maliyetine ve tarla paylarına eklenir.'));
}
function resetAdjustment(){
 editingAdjustment=null;adjustmentRequestId=crypto.randomUUID();$('personnel-adjustment-form').reset();$('personnel-adjustment-date').value=today();$('personnel-adjustment-expense').disabled=false;$('personnel-adjustment-kind').disabled=false;$('personnel-adjustment-title').textContent='Avans / Ek Ödeme Ekle';$('personnel-adjustment-cancel').hidden=true;say('',false,$('personnel-adjustment-status'));renderAdjustmentOptions();
}
function renderAdjustmentRecords(){
 const id=$('personnel-adjustment-expense').value,list=$('personnel-adjustment-records');list.replaceChildren();
 adjustments.filter(a=>a.expense_id===id).sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.created_at.localeCompare(a.created_at)).forEach(a=>{
  const card=node('article',undefined,'personnel-record'+(a.is_void?' is-void':''));card.append(node('h3',(a.kind==='advance'?'Avans':'Ek Ödeme')+(a.is_void?' · İptal Edildi':'')),node('p',new Date(a.entry_date+'T12:00:00').toLocaleDateString(I.locale)),node('strong',money(a.amount)));if(a.notes)card.append(node('p',a.notes));
  const actions=node('div',undefined,'inventory-actions'),edit=node('button',a.is_void?'Yeniden Düzenle':'Düzenle','inventory-button');edit.type='button';edit.disabled=saving;edit.addEventListener('click',()=>{
   editingAdjustment=a;adjustmentRequestId=crypto.randomUUID();$('personnel-adjustment-expense').value=a.expense_id;$('personnel-adjustment-expense').disabled=true;$('personnel-adjustment-kind').value=a.kind;$('personnel-adjustment-kind').disabled=true;$('personnel-adjustment-date').value=a.entry_date;$('personnel-adjustment-amount').value=num(Number(a.amount));$('personnel-adjustment-notes').value=a.notes||'';$('personnel-adjustment-title').textContent='Avans / Ek Ödemeyi Düzenle';$('personnel-adjustment-cancel').hidden=false;adjustmentPreview();
  });actions.append(edit);
  if(!a.is_void){const cancel=node('button','Kaydı İptal Et','inventory-button');cancel.type='button';cancel.disabled=saving;cancel.addEventListener('click',async()=>{if(saving||!window.confirm('Bu avans veya ek ödeme kaydı iptal edilsin mi? Kalan maaş ve ilgili maliyetler yeniden hesaplanır.'))return;busy(true);try{const {error}=await client.rpc('agroverix_void_personnel_adjustment',{p_id:a.id});if(error)throw error;if(editingAdjustment?.id===a.id)resetAdjustment();await refresh();say('Kayıt iptal edildi; kalan maaş ve maliyetler güncellendi.',false,$('personnel-adjustment-status'));}catch(error){say(errorText(error),true,$('personnel-adjustment-status'));}finally{busy(false);renderAdjustmentRecords();}});actions.append(cancel);}card.append(actions);list.append(card);
 });$('personnel-adjustment-empty').hidden=list.children.length>0;$('personnel-adjustment-empty').textContent=id?'Bu personel ve ay için avans veya ek ödeme kaydı yok.':'Personel ve ay seç.';
}
$('personnel-tab-plan').addEventListener('click',()=>showPersonnelTab('plan'));
$('personnel-tab-adjustment').addEventListener('click',()=>showPersonnelTab('adjustment'));
for(const tab of ['plan','adjustment'])$('personnel-tab-'+tab).addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const other=tab==='plan'?'adjustment':'plan';showPersonnelTab(other);$('personnel-tab-'+other).focus();});
$('personnel-adjustment-expense').addEventListener('change',adjustmentExpenseChanged);
$('personnel-adjustment-form').addEventListener('input',adjustmentPreview);
$('personnel-adjustment-kind').addEventListener('change',adjustmentPreview);
$('personnel-adjustment-cancel').addEventListener('click',resetAdjustment);
$('personnel-adjustment-amount').addEventListener('blur',()=>{const n=parseNumberInput($('personnel-adjustment-amount').value);if(Number.isFinite(n))$('personnel-adjustment-amount').value=num(n);});
$('personnel-adjustment-date').addEventListener('change',()=>{
 if(editingAdjustment){adjustmentPreview();return;}
 const current=expenses.find(e=>e.id===$('personnel-adjustment-expense').value),month=$('personnel-adjustment-date').value.slice(0,7);
 if(current&&(current.period_month||current.expense_date).slice(0,7)!==month){const candidates=expenses.filter(e=>!e.is_void&&e.person_name===current.person_name&&(e.period_month||e.expense_date).slice(0,7)===month&&Number(e.season_year)===year()&&(!current.schedule_id||e.schedule_id===current.schedule_id));if(candidates.length===1)$('personnel-adjustment-expense').value=candidates[0].id;}
 adjustmentPreview();renderAdjustmentRecords();
});
$('personnel-adjustment-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!session||saving||loading)return;
 const expense=expenses.find(e=>e.id===$('personnel-adjustment-expense').value),amount=parseNumberInput($('personnel-adjustment-amount').value),date=$('personnel-adjustment-date').value;
 if(!expense||expense.is_void||!(amount>0&&Number.isFinite(amount))||Math.abs(amount*100-Math.round(amount*100))>1e-6){say('Etkin personel ve ayı seçip sıfırdan büyük, en fazla iki ondalıklı tutar gir.',true,$('personnel-adjustment-status'));return;}
 if(date.slice(0,7)!==(expense.period_month||expense.expense_date).slice(0,7)){say('Avans veya ek ödemeyi, verildiği tarihle aynı ayın personel kaydına gir.',true,$('personnel-adjustment-status'));return;}
 const payload={id:editingAdjustment?.id||null,expense_id:expense.id,kind:$('personnel-adjustment-kind').value,entry_date:date,amount,notes:$('personnel-adjustment-notes').value.trim()};busy(true);
 try{const {error}=await client.rpc('agroverix_save_personnel_adjustment',{p_adjustment:payload,p_request_id:adjustmentRequestId});if(error)throw error;resetAdjustment();await refresh();say('Kayıt saklandı; bu ayın kalan maaşı ve maliyetleri güncellendi.',false,$('personnel-adjustment-status'));}
 catch(error){say(errorText(error),true,$('personnel-adjustment-status'));}finally{busy(false);renderAdjustmentRecords();}
});

try{
 showPersonnelTab('plan');
 await ready;$('personnel-adjustment-date').max=today();$('personnel-adjustment-amount').parentElement.querySelector('label').textContent='Tutar ('+I.currencyLabel()+')';Object.entries({salary:'Aylık Maaş',insurance:'Aylık Sigorta',other_cost:'Aylık Diğer Personel Giderleri'}).forEach(([key,label])=>inputs[key].parentElement.querySelector('label').textContent=label+' ('+I.currencyLabel()+')');if(!client)throw new Error('Kayıt servisine bağlanılamadı.');const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
 $('personnel-auth').hidden=Boolean(session);
 if(session){$('personnel-adjustment-fields').disabled=false;await refresh();}else say('Giriş yaptıktan sonra personel giderlerini kaydedebilirsin.');
 client.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&next?.user.id!==session?.user.id){generation++;setTimeout(()=>location.reload(),0);}});
}catch(error){say(errorText(error),true);}
