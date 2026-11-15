import {money,today} from './inventory-data.js?v=international-v1';
import {validDueDate,dueDateStatus} from './due-date-model.js?v=account-due-v1';
const I=window.AgroIntl;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function createDueDateTracker({root,kind,getClient}){
 const form=root.querySelector('form'),party=root.querySelector('[data-due-party]'),date=root.querySelector('[data-due-date]'),save=root.querySelector('[data-due-save]'),list=root.querySelector('[data-due-list]'),status=root.querySelector('[data-due-status]'),scope=root.querySelector('[data-due-scope]'),refreshButton=root.querySelector('[data-due-refresh]');
 let session=null,year=null,parties=[],rows=[],available=false,loaded=false,saving=false,loading=false,queued=false,generation=0;
 const payable=kind==='payable',balanceLabel=payable?'Ödenecek Kalan Tutar':'Alınacak Kalan Tutar';
 function message(text,error=false){status.textContent=text;status.classList.toggle('is-error',error);}
 function controls(){const disabled=!session||!available||!loaded||saving||loading;party.disabled=disabled;date.disabled=disabled;save.disabled=disabled;refreshButton.disabled=!session||!available||loading||saving;}
 function options(){
  const previous=party.value,all=new Map(parties.map(p=>[p.key,p]));
  for(const row of rows)if(!all.has(row.party_key))all.set(row.party_key,{key:row.party_key,name:row.party_name,balance:null});
  party.replaceChildren(new Option(payable?'Bayi/Firma seç':'Firma seç',''));
  [...all.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr')).forEach(p=>party.add(new Option(p.name+(p.balance===null?' · Eski kayıt':' · Kalan '+money(p.balance)),p.key)));
  if(all.has(previous))party.value=previous;
 }
 function render(){
  scope.textContent=year?year+' sezonu':'Hesabına giriş yap';
  options();list.replaceChildren();
  rows.slice().sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.party_name.localeCompare(b.party_name,'tr')).forEach(row=>{
   const account=available?parties.find(p=>p.key===row.party_key):null,balance=account?Number(account.balance):null,notice=dueDateStatus(row.due_date,balance,today());
   const card=el('article',undefined,'due-date-card is-'+notice.state),heading=el('div',undefined,'due-date-heading');
   heading.append(el('h3',account?.name||row.party_name),el('span',notice.label,'due-date-badge'));card.append(heading);
   const facts=el('dl',undefined,'due-date-facts');
   for(const [label,value] of [[payable?'Planlanan Ödeme Tarihi':'Beklenen Tahsilat Tarihi',new Date(row.due_date+'T12:00:00').toLocaleDateString(I.locale)],[balanceLabel,balance===null?'—':money(balance)]]){const cell=el('div');cell.append(el('dt',label),el('dd',value));facts.append(cell);}
   card.append(facts);const actions=el('div',undefined,'stock-row-actions');
   const edit=el('button','Tarihi Düzenle','inventory-button');edit.type='button';edit.disabled=saving||loading||!available||!loaded;edit.addEventListener('click',()=>{if(saving||loading||!available||!loaded)return;party.value=row.party_key;date.value=row.due_date;date.focus();message('Tarihi değiştirip kaydedebilirsin.');});
   const remove=el('button','Tarihi Kaldır','inventory-button');remove.type='button';remove.disabled=saving||loading||!available||!loaded;remove.addEventListener('click',async()=>{
    if(saving||loading||!available||!loaded||!session||!window.confirm('Bu planlanan tarih kaldırılsın mı? Ödeme ve tahsilat kayıtların değişmez.'))return;
    const request=generation,uid=session.user.id;saving=true;controls();message('Tarih kaldırılıyor…');
    try{const {error}=await getClient().from('farmer_account_due_dates').delete().eq('id',row.id).eq('user_id',uid).eq('kind',kind).eq('season_year',year).select('id').single();if(error)throw error;if(request!==generation)return;rows=rows.filter(r=>r.id!==row.id);if(party.value===row.party_key){party.value='';date.value='';}render();message('Planlanan tarih kaldırıldı.');}
    catch{if(request===generation)message('Tarih kaldırılamadı. Tekrar dene.',true);}
    finally{if(request===generation){saving=false;render();controls();if(queued){queued=false;refresh();}}}
   });
   actions.append(edit,remove);card.append(actions);list.append(card);
  });
  if(loaded&&!rows.length)list.append(el('p',session?'Bu sezon için henüz tarih kaydetmedin.':'Tarihlerini görmek için hesabına giriş yap.','due-date-empty'));
  controls();
 }
 async function refresh(){
  if(!session||!available)return;if(saving){queued=true;return;}if(loading){queued=true;return;}
  const request=generation,uid=session.user.id,activeYear=year;loading=true;controls();
  try{
   const data=[];for(let start=0;;start+=500){const r=await getClient().from('farmer_account_due_dates').select('*').eq('user_id',uid).eq('kind',kind).eq('season_year',activeYear).order('id').range(start,start+499);if(r.error)throw r.error;if(request!==generation||session?.user.id!==uid)return;data.push(...r.data);if(r.data.length<500)break;}
   if(request!==generation||session?.user.id!==uid)return;rows=data;loaded=true;render();message('');
  }catch{if(request===generation){loaded=false;message('Tarihler yüklenemedi. Yenile ile tekrar dene.',true);}}
  finally{loading=false;if(request===generation)render();if(queued){queued=false;refresh();}}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!session||!available||!loaded||saving||loading)return;
  const account=parties.find(p=>p.key===party.value)||rows.find(p=>p.party_key===party.value)&&{key:party.value,name:rows.find(p=>p.party_key===party.value).party_name};
  if(!account){message(payable?'Bayi/Firma seç.':'Firma seç.',true);return;}if(!validDueDate(date.value)){message('Geçerli bir tarih gir.',true);return;}
  const uid=session.user.id,request=generation,payload={user_id:uid,kind,party_key:account.key,party_name:account.name,season_year:Number(year),due_date:date.value,updated_at:new Date().toISOString()};
  saving=true;controls();message('Tarih kaydediliyor…');
  try{
   const {data,error}=await getClient().from('farmer_account_due_dates').upsert(payload,{onConflict:'user_id,kind,party_key,season_year'}).select('*').single();if(error)throw error;if(request!==generation||session?.user.id!==uid)return;
   rows=rows.filter(r=>r.party_key!==data.party_key);rows.push(data);render();message('Tarih hesabına kaydedildi.');
  }catch{if(request===generation)message('Tarih kaydedilemedi. Girdiğin bilgiler burada duruyor; tekrar dene.',true);}
  finally{if(request===generation){saving=false;render();controls();if(queued){queued=false;refresh();}}}
 });
 party.addEventListener('change',()=>{date.value=rows.find(r=>r.party_key===party.value)?.due_date||'';message('');});
 refreshButton.addEventListener('click',()=>{if(!saving)refresh();});
 function update(data){
  const changed=session?.user.id!==data.session?.user.id||String(year)!==String(data.year);
  if(changed){generation++;session=data.session;year=String(data.year);parties=data.parties||[];rows=[];loaded=false;saving=false;party.value='';date.value='';message('');}
  else{session=data.session;parties=data.parties||[];}
  available=Boolean(session&&data.available);render();
  if(!session){message('Tarihlerini görmek ve kaydetmek için giriş yap.');return;}
  if(available)refresh();
 }
 return {update,refresh};
}
