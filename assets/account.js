import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {addressForm} from './international-address.js?v=international-v1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{};
const auth=$('#auth-card'),profile=$('#profile-card'),credentials=$('#signup-credentials');
const profileForm=$('#farmer-profile-form'),profileSubmit=$('#profile-submit');
const personalFields=$('#profile-personal-fields')||profileForm.querySelector('.profile-section');
let profileRetry=$('#profile-retry');if(!profileRetry){profileRetry=document.createElement('button');profileRetry.type='button';profileRetry.id='profile-retry';profileRetry.className='auth-back';profileRetry.textContent='Bilgileri Yeniden Yükle';profileRetry.hidden=true;$('#profile-status').after(profileRetry);}
let saveFeedback=$('#profile-save-message');if(!saveFeedback){saveFeedback=document.createElement('p');saveFeedback.id='profile-save-message';saveFeedback.className='profile-result';saveFeedback.setAttribute('role','status');saveFeedback.setAttribute('aria-live','polite');profileSubmit.after(saveFeedback);}
function saveMessage(copy,error=false){status('#profile-status',copy,error);saveFeedback.textContent=copy;saveFeedback.classList.toggle('is-error',error);}
function profileRequest(run,milliseconds){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Profil isteği zaman aşımına uğradı.'));},milliseconds);});
 return Promise.race([Promise.resolve().then(()=>run(controller.signal)),timeout]).finally(()=>clearTimeout(timer));
}
function formIssues(){
 const labels={'p-country':'Ülke','p-name':'Adı Soyadı','p-phone':'Telefon Numarası','p-id':'T.C. Kimlik No','p-province':'İl','p-district':'İlçe','p-village':'Köy / Mahalle','p-region':'Bölge / Eyalet','p-city':'Şehir / İlçe','p-locality':'Yerleşim / Adres','p-kvkk':'KVKK bilgilendirmesi','signup-email':'E-posta adresi','signup-password':'Şifre','signup-password-confirm':'Şifre tekrarı'};
 return [...profileForm.elements].filter(field=>field.willValidate&&!field.validity.valid).map(field=>({field,label:labels[field.id]||'Profil alanı'}));
}
function showIssues(issues){
 const names=[...new Set(issues.map(issue=>issue.label))];saveMessage('Kaydetmek için şu alanları kontrol et: '+names.join(', ')+'. Telefon 05 ile başlayan 11 rakam, T.C. kimlik numarası 11 rakam olmalı; KVKK bilgilendirme kutusunu da işaretle.',true);
 for(const {field}of issues)field.setAttribute('aria-invalid','true');
 const first=issues[0]?.field;if(first){const target=first.closest('.profile-field,.profile-consent')||first;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});first.focus({preventScroll:true});}
}
profileForm.addEventListener('input',event=>event.target.removeAttribute('aria-invalid'));
let session=null,client=null,mode='login',admin=null,registering=false,profileReady=false,profileLoad=0,storedProfileLoaded=false,smsEdited=false;
function status(id,copy,error=false){const p=$(id);p.textContent=copy;p.classList.toggle('is-error',error);}
function reset(select,prompt){select.replaceChildren(new Option(prompt,''));select.disabled=true;}
function fill(select,prompt,rows){reset(select,prompt);rows.forEach(r=>select.add(new Option(r.name,r.id)));select.disabled=!rows.length;}
const province=$('#p-province'),district=$('#p-district'),village=$('#p-village');
const internationalAddress=addressForm('p',{province,district,village},I.accountId?I.country:(I.lang==='en'?'':'TR'));
const currencySelect=$('#p-currency');currencySelect.value=I.currency;currencySelect.disabled=!!I.accountId;if(!I.accountId)currencySelect.querySelector('option[value=EUR]')?.remove();currencySelect.addEventListener('change',()=>I.setCurrency(currencySelect.value));
province.addEventListener('change',()=>{fill(district,__avt("İlçe seçin"),admin?.districts?.[province.value]||[]);reset(village,__avt("Önce ilçe seçin"));});
district.addEventListener('change',()=>fill(village,__avt("Köy / mahalle seçin"),(admin?.settlements?.[district.value]||[]).map(name=>({id:name,name}))));
let locationsPending=null;
function loadLocations(){
 if(admin)return Promise.resolve(admin);if(locationsPending)return locationsPending;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 locationsPending=fetch('assets/administrative-units.json?v=2',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Adres listesi yüklenemedi');return r.json();}).then(data=>{admin=data;fill(province,'İl seçin',data.provinces);return data;}).catch(()=>{reset(province,'Yer listesi yüklenemedi');return null;}).finally(()=>{clearTimeout(timeout);locationsPending=null;});
 return locationsPending;
}
loadLocations();
function destination(){
 const next=new URLSearchParams(location.search).get('next');
 if(next){const url=new URL(next,location.href);if(url.origin===location.origin&&['/tarla-bilgileri.html','/uretim-kayitlari.html','/tarla-detay.html','/index.html','/yonetici.html','/alisveris-stok.html','/stok.html','/sezon-sonu-tahmini.html','/hasat-satis.html'].includes(url.pathname))return url.pathname+url.search+url.hash;}
 return 'index.html';
}
function setMode(next){
 personalFields.disabled=false;$('#profile-submit').disabled=false;profileRetry.hidden=true;
 mode=next;auth.hidden=next!=='login';profile.hidden=next!=='signup';credentials.hidden=next!=='signup';credentials.disabled=next!=='signup';$('#profile-edit-details').open=true;
 $('#auth-signout').hidden=!session;$('#auth-back').hidden=next!=='signup';$('#auth-modes').hidden=false;
 $('#profile-title').textContent=__avt("Çiftçi Profilini Oluştur");$('#profile-account-phone').textContent=__avt("Kişisel bilgilerini ekle, e-posta hesabını oluştur.");
 $('#profile-submit').innerHTML=__avt("Hesabı oluştur ve profilini kaydet <span>→</span>");
 document.querySelectorAll('[data-auth-mode]').forEach(b=>{const active=b.dataset.authMode===next;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
 status('#auth-status','');status('#profile-status','');
}
const phoneInput=$('#p-phone');
function localPhone(value){if(internationalAddress.select.value!=='TR')return value||'';let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('90')&&digits.length===12)digits='0'+digits.slice(2);return digits;}
function phoneRegion(){const tr=internationalAddress.select.value==='TR';phoneInput.removeAttribute('data-i18n-title');phoneInput.removeAttribute('data-i18n-placeholder');phoneInput.inputMode=tr?'numeric':'tel';phoneInput.maxLength=tr?11:16;phoneInput.minLength=tr?11:9;phoneInput.pattern=tr?'05[0-9]{9}':'[+][1-9][0-9]{7,14}';phoneInput.placeholder=tr?__avt("05xxxxxxxxx"):'+4915123456789';phoneInput.title=tr?t('05 ile başlayan 11 rakam girin'):t('Telefonunu ülke koduyla gir. Örnek: +4915123456789.');phoneInput.nextElementSibling.textContent=tr?t('05 ile başlayan 11 rakam. İletişim ve isteğe bağlı SMS bildirimleri için.'):t('Telefonunu ülke koduyla gir. Örnek: +4915123456789.');$('#p-id').closest('.profile-field').hidden=!tr;$('#p-id').required=tr;[province,district,village].forEach(el=>el.required=tr);['p-region','p-city','p-locality'].forEach(id=>$('#'+id).required=!tr);}
internationalAddress.select.addEventListener('change',phoneRegion);phoneRegion();
phoneInput.addEventListener('input',()=>{phoneInput.value=internationalAddress.select.value==='TR'?phoneInput.value.replace(/\D/g,'').slice(0,11):phoneInput.value.replace(/[^+0-9]/g,'').slice(0,16);});
function normalizedPhone(){const value=phoneInput.value.trim();if(internationalAddress.select.value!=='TR')return value||null;return value?(/^05[0-9]{9}$/.test(value)?'+90'+value.slice(1):value):null;}
function record(){const r={user_id:session?.user.id,full_name:$('#p-name').value.trim()||null,identity_number:$('#p-id').value.trim()||null,phone:normalizedPhone(),sms_consent:$('#p-sms').checked,...internationalAddress.value(),kvkk_notice_acknowledged:$('#p-kvkk').checked,kvkk_notice_acknowledged_at:$('#p-kvkk').checked?new Date().toISOString():null,updated_at:new Date().toISOString()};if(session&&!storedProfileLoaded&&!smsEdited)delete r.sms_consent;return r;}
function completeProfile(r){
 if(!r||String(r.full_name||'').trim().length<2||['phone','country','province','district','village'].some(key=>!String(r[key]||'').trim())||!r.kvkk_notice_acknowledged)return false;
 if(r.country==='TR')return /^[0-9]{11}$/.test(r.identity_number||'')&&/^(?:05[0-9]{9}|[+]905[0-9]{9})$/.test(r.phone);
 return /^[+][1-9][0-9]{7,14}$/.test(r.phone);
}
function profileValues(row,s){
 const meta=s.user.user_metadata||{},signup=meta.agroverix_profile&&typeof meta.agroverix_profile==='object'?meta.agroverix_profile:{};
 const values={...signup,...(row||{}),country:row?.country||signup.country||'TR'};
 const recovered=[];
 for(const key of ['full_name','identity_number','phone','province','district','village']){
  if(String(values[key]??'').trim())continue;
  const value=signup[key]||(key==='full_name'?meta.full_name:null)||(key==='phone'?s.user.phone:null);
  if(typeof value==='string'&&value.trim()){values[key]=value.trim();recovered.push(key);}
 }
 return {values,recovered};
}
function personalValues(values){
 internationalAddress.load(values);phoneRegion();
 $('#p-name').value=values.full_name||'';$('#p-phone').value=localPhone(values.phone||'');$('#p-id').value=values.identity_number||'';
 $('#p-sms').checked=values.sms_consent===true;$('#p-kvkk').checked=values.kvkk_notice_acknowledged===true;
}
function savedOption(select,value){
 if(!value){select.value='';return;}
 const raw=String(value),option=[...select.options].find(o=>o.value===raw)||[...select.options].find(o=>o.textContent.trim().toLocaleLowerCase('tr-TR')===raw.trim().toLocaleLowerCase('tr-TR'));
 if(!option)select.add(new Option(raw,raw));select.value=option?.value||raw;
}
function addressValues(values){
 if((values.country||'TR')==='TR'){
  savedOption(province,values.province);province.dispatchEvent(new Event('change'));
  savedOption(district,values.district);district.dispatchEvent(new Event('change'));
  savedOption(village,values.village);
 }
 internationalAddress.update();phoneRegion();
}
async function show(s){
 const preserveDraft=session?.user.id===s?.user.id&&profileForm.dataset.intlDirty==='true';
 const load=++profileLoad;session=s;profileReady=false;storedProfileLoaded=false;if(!preserveDraft)smsEdited=false;
 if(!s){setMode('login');return;}
 const editing=new URLSearchParams(location.search).get('profile')==='edit';
 auth.hidden=true;profile.hidden=false;credentials.hidden=true;credentials.disabled=true;
 $('#auth-modes').hidden=true;$('#auth-back').hidden=true;$('#auth-signout').hidden=false;$('#profile-edit-details').open=true;
 $('#profile-title').textContent='Profil Bilgileri';$('#profile-account-phone').textContent=s.user.email||'';$('#profile-submit').innerHTML='Profil Bilgilerini Kaydet <span>→</span>';
 $('#profile-submit').disabled=true;personalFields.disabled=true;profileRetry.hidden=true;
 status('#profile-status','Profil bilgilerin yükleniyor…');
 try{
 const result=await profileRequest(signal=>client.from('farmer_profiles').select('*').eq('user_id',s.user.id).maybeSingle().abortSignal(signal),10000);
 if(load!==profileLoad)return;
 if(result.error)throw result.error;storedProfileLoaded=true;
 const {values,recovered}=profileValues(result.data,s);
 if(!editing&&completeProfile(result.data)){location.replace(destination());return;}
 if(!preserveDraft)personalValues(values);
 await loadLocations();if(load!==profileLoad)return;
 if(!preserveDraft)addressValues(values);profileReady=true;personalFields.disabled=false;$('#profile-submit').disabled=false;profileRetry.hidden=!!admin;
 if(!admin)status('#profile-status','Adres listesi yüklenemedi. Kayıtlı bilgilerin gösteriliyor; Bilgileri Yeniden Yükle düğmesiyle tekrar deneyebilirsin.',true);
 else if(!completeProfile(values))status('#profile-status','Profilindeki zorunlu bilgileri tamamlayıp kaydet. Daha önce kaydedilmemiş alanlar boş görünür.');
 else if(recovered.length||!result.data)status('#profile-status','Kayıt sırasında verdiğin bilgiler getirildi. Kontrol edip profilini kaydet.');
 else status('#profile-status','Kayıtlı profil bilgilerin yüklendi.');
 }catch(error){
  if(load!==profileLoad)return;
  saveMessage('Kayıtlı profil yüklenemedi. Yazdığın bilgiler formda korunur; zorunlu alanları tamamlayıp kaydedebilir veya Bilgileri Yeniden Yükle düğmesini kullanabilirsin.',true);profileRetry.hidden=false;
 }finally{
  if(load===profileLoad&&session?.user.id===s.user.id){personalFields.disabled=false;profileSubmit.disabled=false;profileReady=true;}
 }
}
$('#p-sms').addEventListener('change',()=>{smsEdited=true;});
profileRetry.addEventListener('click',()=>{if(session)show(session);});

document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));$('#auth-back').addEventListener('click',()=>setMode('login'));
$('#auth-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client){status('#auth-status',__avt("Hesap servisi bağlanamadı."),true);return;}
 $('#auth-submit').disabled=true;status('#auth-status',__avt("Giriş yapılıyor…"));const {data,error}=await client.auth.signInWithPassword({email:$('#auth-email').value.trim().toLowerCase(),password:$('#auth-password').value});$('#auth-submit').disabled=false;
 if(error||!data.session){status('#auth-status',__avt("E-posta adresini ve şifreni kontrol et; e-posta onayını tamamladığından emin ol."),true);return;}await show(data.session);
});
$('#farmer-profile-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client){status('#profile-status',__avt("Hesap servisi bağlanamadı."),true);return;}
 if(session&&!profileReady){saveMessage('Profil yüklemesi henüz sürüyor. Birkaç saniye sonra tekrar dene.',true);return;}
 const issues=formIssues();if(issues.length){showIssues(issues);return;}
 const r=record();if(!completeProfile(r)){saveMessage('Kaydetmek için ad soyad, telefon, ülke, il, ilçe ve köy/mahalle bilgilerini tamamla. Türkiye için 11 haneli T.C. kimlik numarası ve KVKK bilgilendirme kutusu da zorunludur.',true);return;}if(!r.country){status('#profile-status',t('Ülke seçimini tamamla.'),true);return;}
 if(r.country==='TR'&&!/^\d{11}$/.test(r.identity_number)){status('#profile-status',__avt("Kimlik numarasını 11 hane gir."),true);return;}
 if(phoneInput.value&&!(r.country==='TR'?/^05[0-9]{9}$/:/^\+[1-9][0-9]{7,14}$/).test(phoneInput.value)){status('#profile-status',r.country==='TR'?__avt("Telefon numaranı 05 ile başlayan 11 rakam olarak gir."):t('Telefon numarasını + ülke kodu ve 8–15 rakamla gir.'),true);return;}
 if(r.sms_consent&&(!r.phone||!r.full_name)){status('#profile-status',__avt("SMS izni için ad soyad ve telefon numarası gerekli."),true);return;}
 if((r.full_name||r.phone||r.identity_number||r.province||r.district||r.village)&&!r.kvkk_notice_acknowledged){status('#profile-status',__avt("Kişisel bilgilerini kaydetmek için KVKK bilgilendirme kutusunu tamamla."),true);return;}
 if(session){
  
  const saveLoad=profileLoad,owner=session.user.id;$('#profile-submit').disabled=true;saveMessage('Profil bilgilerin kaydediliyor…');try{const {data,error}=await profileRequest(signal=>client.from('farmer_profiles').upsert(r,{onConflict:'user_id'}).select('*').single().abortSignal(signal),20000);if(saveLoad!==profileLoad||session?.user.id!==owner)return;if(error)throw error;personalValues(data);addressValues(data);delete profileForm.dataset.intlDirty;storedProfileLoaded=true;smsEdited=false;saveMessage('Profil bilgilerin kaydedildi. Sayfayı yeniden açtığında bu bilgiler gösterilir.');}catch(error){if(saveLoad===profileLoad&&session?.user.id===owner)saveMessage(error?.code==='42501'?'Oturum kayda izin vermedi. Yazdığın bilgileri koruyarak yeniden giriş yapıp tekrar dene.':'Kaydın tamamlandığı doğrulanamadı. Yazdığın bilgiler formda korunuyor; bağlantını kontrol edip tekrar Kaydet düğmesine bas.',true);}finally{if(saveLoad===profileLoad&&session?.user.id===owner)$('#profile-submit').disabled=false;}return;
 }
 if(mode!=='signup')return;if($('#signup-password').value!==$('#signup-password-confirm').value){status('#profile-status',__avt("Şifreler eşleşmiyor."),true);return;}
 registering=true;$('#profile-submit').disabled=true;status('#profile-status',__avt("Hesap oluşturuluyor…"));const redirect=new URL('ciftci-bilgi.html',location.href);redirect.searchParams.set('next',destination());
 const {data,error}=await client.auth.signUp({email:$('#signup-email').value.trim().toLowerCase(),password:$('#signup-password').value,options:{emailRedirectTo:redirect.href,data:{agroverix_profile:{...r,currency:currencySelect.value}}}});
 registering=false;$('#profile-submit').disabled=false;if(error){status('#profile-status',error.message||__avt("Hesap oluşturulamadı."),true);return;}
 if(!data.session){status('#profile-status',__avt("Onay bağlantısı e-posta adresine gönderildi. E-postanı onayladıktan sonra giriş yap. Girdiğin profil bilgileri hesabına kaydedildi; girişten sonra Profil Bilgileri bölümünde görebilirsin."));return;}
 session=data.session;location.assign(destination());
});
// Custom validation always reaches the save handler and gives a visible explanation.
profileForm.noValidate=true;
$('#auth-signout').addEventListener('click',async()=>{await client.auth.signOut();session=null;setMode('login');});
if(cfg.url&&cfg.publishableKey){client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));const {data}=await client.auth.getSession();await show(data.session);client.auth.onAuthStateChange((event,s)=>{if(registering)return;if((event==='SIGNED_IN'||event==='SIGNED_OUT')&&session?.user.id!==s?.user.id)setTimeout(()=>show(s),0);});}
else{setMode('login');status('#auth-status',__avt("Hesap servisi bağlanamadı."),true);}
