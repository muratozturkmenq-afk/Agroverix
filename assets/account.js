import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{};
const auth=$('#auth-card'),profile=$('#profile-card'),credentials=$('#signup-credentials');
let session=null,client=null,mode='login',admin=null,registering=false;
function status(id,copy,error=false){const p=$(id);p.textContent=copy;p.classList.toggle('is-error',error);}
function reset(select,prompt){select.replaceChildren(new Option(prompt,''));select.disabled=true;}
function fill(select,prompt,rows){reset(select,prompt);rows.forEach(r=>select.add(new Option(r.name,r.id)));select.disabled=!rows.length;}
const province=$('#p-province'),district=$('#p-district'),village=$('#p-village');
province.addEventListener('change',()=>{fill(district,'İlçe seçin',admin?.districts?.[province.value]||[]);reset(village,'Önce ilçe seçin');});
district.addEventListener('change',()=>fill(village,'Köy / mahalle seçin',(admin?.settlements?.[district.value]||[]).map(name=>({id:name,name}))));
const locations=fetch('assets/administrative-units.json?v=2').then(r=>r.json()).then(data=>{admin=data;fill(province,'İl seçin',data.provinces);}).catch(()=>reset(province,'Yer listesi yüklenemedi'));
function destination(){
 const next=new URLSearchParams(location.search).get('next');
 if(next){const url=new URL(next,location.href);if(url.origin===location.origin&&['/tarla-bilgileri.html','/uretim-kayitlari.html','/tarla-detay.html','/index.html','/yonetici.html','/alisveris-stok.html','/stok.html','/sezon-sonu-tahmini.html','/hasat-satis.html'].includes(url.pathname))return url.pathname+url.search+url.hash;}
 return 'index.html';
}
function setMode(next){
 mode=next;auth.hidden=next!=='login';profile.hidden=next!=='signup';credentials.hidden=next!=='signup';credentials.disabled=next!=='signup';$('#profile-edit-details').open=true;
 $('#auth-signout').hidden=!session;$('#auth-back').hidden=next!=='signup';$('#auth-modes').hidden=false;
 $('#profile-title').textContent='Çiftçi Profilini Oluştur';$('#profile-account-phone').textContent='Kişisel bilgilerini ekle, e-posta hesabını oluştur.';
 $('#profile-submit').innerHTML='Hesabı oluştur ve profilini kaydet <span>→</span>';
 document.querySelectorAll('[data-auth-mode]').forEach(b=>{const active=b.dataset.authMode===next;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
 status('#auth-status','');status('#profile-status','');
}
const phoneInput=$('#p-phone');
function localPhone(value){let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('90')&&digits.length===12)digits='0'+digits.slice(2);return digits;}
phoneInput.addEventListener('input',()=>{phoneInput.value=phoneInput.value.replace(/\D/g,'').slice(0,11);});
function normalizedPhone(){const value=phoneInput.value.trim();return value?(/^05[0-9]{9}$/.test(value)?'+90'+value.slice(1):value):null;}
function record(){return {user_id:session?.user.id,full_name:$('#p-name').value.trim()||null,identity_number:$('#p-id').value.trim()||null,phone:normalizedPhone(),sms_consent:$('#p-sms').checked,province:province.value||null,district:district.value||null,village:village.value||null,kvkk_notice_acknowledged:$('#p-kvkk').checked,kvkk_notice_acknowledged_at:$('#p-kvkk').checked?new Date().toISOString():null,updated_at:new Date().toISOString()};}
async function show(s){
 session=s;if(!s){setMode('login');return;}
 if(new URLSearchParams(location.search).get('profile')!=='edit'){location.replace(destination());return;}
 auth.hidden=true;profile.hidden=false;credentials.hidden=true;credentials.disabled=true;$('#auth-modes').hidden=true;$('#auth-back').hidden=true;$('#auth-signout').hidden=false;$('#profile-edit-details').open=true;$('#profile-title').textContent='Profil Bilgileri';$('#profile-account-phone').textContent=s.user.email||'';$('#profile-submit').innerHTML='Profil Bilgilerini Kaydet <span>→</span>';
 await locations;status('#profile-status','Profil bilgilerin yükleniyor…');const {data,error}=await client.from('farmer_profiles').select('*').eq('user_id',s.user.id).maybeSingle();if(error){status('#profile-status','Profil yüklenemedi.',true);return;}if(!data){status('#profile-status','Bu hesapta henüz kaydedilmiş profil bilgisi yok. Bilgilerini bir kez girip Profil Bilgilerini Kaydet düğmesine bas.');return;}status('#profile-status','Kayıtlı profil bilgilerin yüklendi.');
 $('#p-phone').value=localPhone(data.phone||s.user.phone||'');$('#p-sms').checked=!!data.sms_consent;$('#p-name').value=data.full_name||'';$('#p-id').value=data.identity_number||'';$('#p-kvkk').checked=!!data.kvkk_notice_acknowledged;province.value=data.province||'';province.dispatchEvent(new Event('change'));district.value=data.district||'';district.dispatchEvent(new Event('change'));village.value=data.village||'';
}
document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));$('#auth-back').addEventListener('click',()=>setMode('login'));
$('#auth-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client){status('#auth-status','Hesap servisi bağlanamadı.',true);return;}
 $('#auth-submit').disabled=true;status('#auth-status','Giriş yapılıyor…');const {data,error}=await client.auth.signInWithPassword({email:$('#auth-email').value.trim().toLowerCase(),password:$('#auth-password').value});$('#auth-submit').disabled=false;
 if(error||!data.session){status('#auth-status','E-posta adresini ve şifreni kontrol et; e-posta onayını tamamladığından emin ol.',true);return;}location.assign(destination());
});
$('#farmer-profile-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client){status('#profile-status','Hesap servisi bağlanamadı.',true);return;}
 const r=record();
 if(r.identity_number&&!/^\d{11}$/.test(r.identity_number)){status('#profile-status','Kimlik numarasını 11 hane gir veya alanı boş bırak.',true);return;}
 if(phoneInput.value&&!/^05[0-9]{9}$/.test(phoneInput.value)){status('#profile-status','Telefon numaranı 05 ile başlayan 11 rakam olarak gir.',true);return;}
 if(r.sms_consent&&(!r.phone||!r.full_name)){status('#profile-status','SMS izni için ad soyad ve telefon numarası gerekli.',true);return;}
 if((r.full_name||r.phone||r.identity_number||r.province||r.district||r.village)&&!r.kvkk_notice_acknowledged){status('#profile-status','Kişisel bilgilerini kaydetmek için KVKK bilgilendirme kutusunu tamamla.',true);return;}
 if(session){
  
  $('#profile-submit').disabled=true;const {error}=await client.from('farmer_profiles').upsert(r,{onConflict:'user_id'});$('#profile-submit').disabled=false;if(error){status('#profile-status','Profil kaydedilemedi; bilgilerini kontrol et.',true);return;}location.assign('index.html');return;
 }
 if(mode!=='signup')return;if($('#signup-password').value!==$('#signup-password-confirm').value){status('#profile-status','Şifreler eşleşmiyor.',true);return;}
 registering=true;$('#profile-submit').disabled=true;status('#profile-status','Hesap oluşturuluyor…');const redirect=new URL('ciftci-bilgi.html',location.href);redirect.searchParams.set('next',destination());
 const {data,error}=await client.auth.signUp({email:$('#signup-email').value.trim().toLowerCase(),password:$('#signup-password').value,options:{emailRedirectTo:redirect.href,data:{agroverix_profile:r}}});
 registering=false;$('#profile-submit').disabled=false;if(error){status('#profile-status',error.message||'Hesap oluşturulamadı.',true);return;}
 if(!data.session){status('#profile-status','Onay bağlantısı e-posta adresine gönderildi. E-postanı onayladıktan sonra giriş yap. Girdiğin profil bilgileri hesabına kaydedildi; girişten sonra Profil Bilgileri bölümünde görebilirsin.');return;}
 session=data.session;location.assign(destination());
});
$('#auth-signout').addEventListener('click',async()=>{await client.auth.signOut();session=null;setMode('login');});
if(cfg.url&&cfg.publishableKey){client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await client.auth.getSession();await show(data.session);client.auth.onAuthStateChange((event,s)=>{if(registering)return;if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>show(s),0);});}
else{setMode('login');status('#auth-status','Hesap servisi bağlanamadı.',true);}
