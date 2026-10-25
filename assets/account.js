import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
import {ready as regionalReady,client as regionalClient} from './regional-context.js?v=stable-tr-v1';
await regionalReady;
const I=window.AgroIntl;
const __avt=s=>I.t(s);
import {addressForm} from './international-address.js?v=international-v1';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{};
const auth=$('#auth-card'),profile=$('#profile-card'),credentials=$('#signup-credentials');
let session=null,client=null,mode='login',admin=null,registering=false;
function status(id,copy,error=false){const p=$(id);p.textContent=copy;p.classList.toggle('is-error',error);}
function reset(select,prompt){select.replaceChildren(new Option(prompt,''));select.disabled=true;}
function fill(select,prompt,rows){reset(select,prompt);rows.forEach(r=>select.add(new Option(r.name,r.id)));select.disabled=!rows.length;}
const province=$('#p-province'),district=$('#p-district'),village=$('#p-village');
const internationalAddress=addressForm('p',{province,district,village},I.accountId?I.country:(I.lang==='en'?'':'TR'));
const currencySelect=$('#p-currency');currencySelect.value=I.currency;currencySelect.disabled=!!I.accountId;if(!I.accountId)currencySelect.querySelector('option[value=EUR]')?.remove();currencySelect.addEventListener('change',()=>I.setCurrency(currencySelect.value));
province.addEventListener('change',()=>{fill(district,__avt("İlçe seçin"),admin?.districts?.[province.value]||[]);reset(village,__avt("Önce ilçe seçin"));});
district.addEventListener('change',()=>fill(village,__avt("Köy / mahalle seçin"),(admin?.settlements?.[district.value]||[]).map(name=>({id:name,name}))));
const locations=fetch('assets/administrative-units.json?v=2').then(r=>r.json()).then(data=>{admin=data;fill(province,__avt("İl seçin"),data.provinces);}).catch(()=>reset(province,__avt("Yer listesi yüklenemedi")));
function destination(){
 const next=new URLSearchParams(location.search).get('next');
 if(next){const url=new URL(next,location.href);if(url.origin===location.origin&&['/tarla-bilgileri.html','/uretim-kayitlari.html','/tarla-detay.html','/index.html','/yonetici.html','/alisveris-stok.html','/stok.html','/sezon-sonu-tahmini.html','/hasat-satis.html'].includes(url.pathname))return url.pathname+url.search+url.hash;}
 return 'index.html';
}
function setMode(next){
 mode=next;auth.hidden=next!=='login';profile.hidden=next!=='signup';credentials.hidden=next!=='signup';credentials.disabled=next!=='signup';$('#profile-edit-details').open=true;
 $('#auth-signout').hidden=!session;$('#auth-back').hidden=next!=='signup';$('#auth-modes').hidden=false;
 $('#profile-title').textContent=__avt("Çiftçi Profilini Oluştur");$('#profile-account-phone').textContent=__avt("Kişisel bilgilerini ekle, e-posta hesabını oluştur.");
 $('#profile-submit').innerHTML=__avt("Hesabı oluştur ve profilini kaydet <span>→</span>");
 document.querySelectorAll('[data-auth-mode]').forEach(b=>{const active=b.dataset.authMode===next;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
 status('#auth-status','');status('#profile-status','');
}
const phoneInput=$('#p-phone');
function localPhone(value){if(internationalAddress.select.value!=='TR')return value||'';let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('90')&&digits.length===12)digits='0'+digits.slice(2);return digits;}
function phoneRegion(){const tr=internationalAddress.select.value==='TR';phoneInput.removeAttribute('data-i18n-title');phoneInput.removeAttribute('data-i18n-placeholder');phoneInput.inputMode=tr?'numeric':'tel';phoneInput.maxLength=tr?11:16;phoneInput.minLength=tr?11:9;phoneInput.pattern=tr?'05[0-9]{9}':'[+][1-9][0-9]{7,14}';phoneInput.placeholder=tr?__avt("05xxxxxxxxx"):'+4915123456789';phoneInput.title=tr?t('05 ile başlayan 11 rakam girin'):t('Telefonunu ülke koduyla gir. Örnek: +4915123456789.');phoneInput.nextElementSibling.textContent=tr?t('05 ile başlayan 11 rakam. İletişim ve isteğe bağlı SMS bildirimleri için.'):t('Telefonunu ülke koduyla gir. Örnek: +4915123456789.');$('#p-id').closest('.profile-field').hidden=!tr;}
internationalAddress.select.addEventListener('change',phoneRegion);phoneRegion();
phoneInput.addEventListener('input',()=>{phoneInput.value=internationalAddress.select.value==='TR'?phoneInput.value.replace(/\D/g,'').slice(0,11):phoneInput.value.replace(/[^+0-9]/g,'').slice(0,16);});
function normalizedPhone(){const value=phoneInput.value.trim();if(internationalAddress.select.value!=='TR')return value||null;return value?(/^05[0-9]{9}$/.test(value)?'+90'+value.slice(1):value):null;}
function record(){return {user_id:session?.user.id,full_name:$('#p-name').value.trim()||null,identity_number:$('#p-id').value.trim()||null,phone:normalizedPhone(),sms_consent:$('#p-sms').checked,...internationalAddress.value(),kvkk_notice_acknowledged:$('#p-kvkk').checked,kvkk_notice_acknowledged_at:$('#p-kvkk').checked?new Date().toISOString():null,updated_at:new Date().toISOString()};}
async function show(s){
 session=s;if(!s){setMode('login');return;}
 if(new URLSearchParams(location.search).get('profile')!=='edit'){location.replace(destination());return;}
 auth.hidden=true;profile.hidden=false;credentials.hidden=true;credentials.disabled=true;$('#auth-modes').hidden=true;$('#auth-back').hidden=true;$('#auth-signout').hidden=false;$('#profile-edit-details').open=true;$('#profile-title').textContent=__avt("Profil Bilgileri");$('#profile-account-phone').textContent=s.user.email||'';$('#profile-submit').innerHTML=__avt("Profil Bilgilerini Kaydet <span>→</span>");
 await locations;status('#profile-status',__avt("Profil bilgilerin yükleniyor…"));const {data,error}=await client.from('farmer_profiles').select('*').eq('user_id',s.user.id).maybeSingle();if(error){status('#profile-status',__avt("Profil yüklenemedi."),true);return;}if(!data){status('#profile-status',__avt("Bu hesapta henüz kaydedilmiş profil bilgisi yok. Bilgilerini bir kez girip Profil Bilgilerini Kaydet düğmesine bas."));return;}status('#profile-status',__avt("Kayıtlı profil bilgilerin yüklendi."));
 internationalAddress.load(data);phoneRegion();$('#p-phone').value=localPhone(data.phone||s.user.phone||'');$('#p-sms').checked=!!data.sms_consent;$('#p-name').value=data.full_name||'';$('#p-id').value=data.identity_number||'';$('#p-kvkk').checked=!!data.kvkk_notice_acknowledged;province.value=data.province||'';province.dispatchEvent(new Event('change'));district.value=data.district||'';district.dispatchEvent(new Event('change'));village.value=data.village||'';internationalAddress.update();phoneRegion();
}
document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));$('#auth-back').addEventListener('click',()=>setMode('login'));
$('#auth-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client){status('#auth-status',__avt("Hesap servisi bağlanamadı."),true);return;}
 $('#auth-submit').disabled=true;status('#auth-status',__avt("Giriş yapılıyor…"));const {data,error}=await client.auth.signInWithPassword({email:$('#auth-email').value.trim().toLowerCase(),password:$('#auth-password').value});$('#auth-submit').disabled=false;
 if(error||!data.session){status('#auth-status',__avt("E-posta adresini ve şifreni kontrol et; e-posta onayını tamamladığından emin ol."),true);return;}location.assign(destination());
});
$('#farmer-profile-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client){status('#profile-status',__avt("Hesap servisi bağlanamadı."),true);return;}
 const r=record();if(!r.country){status('#profile-status',t('Ülke seçimini tamamla.'),true);return;}
 if(r.identity_number&&!/^\d{11}$/.test(r.identity_number)){status('#profile-status',__avt("Kimlik numarasını 11 hane gir veya alanı boş bırak."),true);return;}
 if(phoneInput.value&&!(r.country==='TR'?/^05[0-9]{9}$/:/^\+[1-9][0-9]{7,14}$/).test(phoneInput.value)){status('#profile-status',r.country==='TR'?__avt("Telefon numaranı 05 ile başlayan 11 rakam olarak gir."):t('Telefon numarasını + ülke kodu ve 8–15 rakamla gir.'),true);return;}
 if(r.sms_consent&&(!r.phone||!r.full_name)){status('#profile-status',__avt("SMS izni için ad soyad ve telefon numarası gerekli."),true);return;}
 if((r.full_name||r.phone||r.identity_number||r.province||r.district||r.village)&&!r.kvkk_notice_acknowledged){status('#profile-status',__avt("Kişisel bilgilerini kaydetmek için KVKK bilgilendirme kutusunu tamamla."),true);return;}
 if(session){
  
  $('#profile-submit').disabled=true;const {error}=await client.from('farmer_profiles').upsert(r,{onConflict:'user_id'});$('#profile-submit').disabled=false;if(error){status('#profile-status',__avt("Profil kaydedilemedi; bilgilerini kontrol et."),true);return;}location.assign('index.html');return;
 }
 if(mode!=='signup')return;if($('#signup-password').value!==$('#signup-password-confirm').value){status('#profile-status',__avt("Şifreler eşleşmiyor."),true);return;}
 registering=true;$('#profile-submit').disabled=true;status('#profile-status',__avt("Hesap oluşturuluyor…"));const redirect=new URL('ciftci-bilgi.html',location.href);redirect.searchParams.set('next',destination());
 const {data,error}=await client.auth.signUp({email:$('#signup-email').value.trim().toLowerCase(),password:$('#signup-password').value,options:{emailRedirectTo:redirect.href,data:{agroverix_profile:{...r,currency:currencySelect.value}}}});
 registering=false;$('#profile-submit').disabled=false;if(error){status('#profile-status',error.message||__avt("Hesap oluşturulamadı."),true);return;}
 if(!data.session){status('#profile-status',__avt("Onay bağlantısı e-posta adresine gönderildi. E-postanı onayladıktan sonra giriş yap. Girdiğin profil bilgileri hesabına kaydedildi; girişten sonra Profil Bilgileri bölümünde görebilirsin."));return;}
 session=data.session;location.assign(destination());
});
$('#auth-signout').addEventListener('click',async()=>{await client.auth.signOut();session=null;setMode('login');});
if(cfg.url&&cfg.publishableKey){client=(regionalClient||createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));const {data}=await client.auth.getSession();await show(data.session);client.auth.onAuthStateChange((event,s)=>{if(registering)return;if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>show(s),0);});}
else{setMode('login');status('#auth-status',__avt("Hesap servisi bağlanamadı."),true);}
