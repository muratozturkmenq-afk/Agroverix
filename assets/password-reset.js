import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
const $=s=>document.querySelector(s),cfg=window.AGROVERIX_SUPABASE||{},fragment=new URLSearchParams(location.hash.slice(1));
const requesting=$('#reset-request'),changing=$('#reset-change'),requestForm=$('#reset-request-form'),changeForm=$('#reset-change-form'),send=$('#reset-send'),save=$('#reset-save'),notice=$('#reset-status');
let client=null,recoveryOwner=null,verified=false,busy=false,cooldown=0;
const message=(copy,error=false)=>{notice.textContent=copy;notice.classList.toggle('is-error',error);};
function requestView(copy='',error=false){verified=false;recoveryOwner=null;changeForm.reset();requesting.hidden=false;changing.hidden=true;save.disabled=true;if(copy)message(copy,error);}
function failure(error){
 if(['over_email_send_rate_limit','over_request_rate_limit'].includes(error?.code)||error?.status===429)return 'Kısa sürede çok fazla bağlantı istendi. Biraz bekleyip tekrar dene.';
 if(error?.code==='email_address_invalid')return 'Geçerli bir e-posta adresi gir.';
 return 'Bağlantı gönderilemedi. İnternet bağlantını kontrol edip tekrar dene.';
}
requestForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!client||busy||cooldown||!requestForm.reportValidity())return;
 busy=true;send.disabled=true;message('Şifre sıfırlama bağlantısı isteniyor…');
 try{
  // This exact same-origin callback is allowlisted in Supabase Auth.
  const redirectTo=new URL('sifre-sifirla.html',location.href).href;
  const {error}=await client.auth.resetPasswordForEmail($('#reset-email').value.trim().toLowerCase(),{redirectTo});
  if(error)throw error;
  message('Bu e-posta adresiyle bir üyelik varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu ve gereksiz posta klasörünü kontrol et. Bağlantıyı açıp yeni şifreni belirle.');
  send.textContent='Bir dakika sonra tekrar gönderebilirsin';
  cooldown=setTimeout(()=>{cooldown=0;send.disabled=false;send.textContent='Bağlantıyı Tekrar Gönder';},60000);
 }catch(error){message(failure(error),true);}finally{busy=false;if(!cooldown)send.disabled=false;}
});
changeForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!client||busy||!changeForm.reportValidity())return;
 if(!verified||!recoveryOwner){requestView('Şifreni yenilemek için e-postandaki bağlantıyı aç veya yeni bir bağlantı iste.',true);return;}
 const password=$('#reset-password').value,confirm=$('#reset-password-confirm').value,owner=recoveryOwner;
 if(password.length<8){message('Yeni şifren en az 8 karakter olmalı.',true);return;}
 if(password!==confirm){message('Şifreler eşleşmiyor. İki alana da aynı şifreyi yaz.',true);$('#reset-password-confirm').focus();return;}
 busy=true;save.disabled=true;message('Yeni şifren kaydediliyor…');
 try{
  const checked=await client.auth.getUser();
  if(checked.error||checked.data?.user?.id!==owner||recoveryOwner!==owner){requestView('Şifre sıfırlama bağlantısının süresi dolmuş. Yeni bir bağlantı iste.',true);return;}
  const {data,error}=await client.auth.updateUser({password});
  if(error){
   const copy=error.code==='same_password'?'Yeni şifren önceki şifrenden farklı olmalı.':error.code==='weak_password'?'Bu şifre yeterince güçlü değil. Daha uzun, harf ve rakam içeren bir şifre belirle.':['session_not_found','refresh_token_not_found','refresh_token_already_used'].includes(error.code)?'Bağlantının süresi dolmuş. Yeni bir şifre sıfırlama bağlantısı iste.':'Şifren güncellenemedi. Bağlantını kontrol edip tekrar dene.';
   message(copy,true);return;
  }
  if(data?.user?.id!==owner)throw new Error('recovery-user-mismatch');
  verified=false;recoveryOwner=null;changeForm.reset();changing.hidden=true;$('#reset-success').hidden=false;
  message('Şifren güncellendi. Yeni şifrenle hesabına giriş yapabilirsin.');
  // Revoke the recovery session and other refresh sessions after a successful reset.
  try{await client.auth.signOut({scope:'global'});}catch{/* The new password has already been saved. */}
 }catch{message('Şifre değişikliği doğrulanamadı. Yeni şifrenle giriş yapmayı dene; gerekirse yeni bağlantı iste.',true);}
 finally{busy=false;save.disabled=!verified;}
});
$('#reset-new-link').addEventListener('click',()=>requestView('Yeni bağlantı için üyelikte kullandığın e-posta adresini gir.'));
const hasRecovery=fragment.get('type')==='recovery';
if(hasRecovery){requesting.hidden=true;message('Şifre sıfırlama bağlantın doğrulanıyor…');}
if(!cfg.url||!cfg.publishableKey){send.disabled=true;message('Hesap servisine bağlanılamadı. Lütfen daha sonra tekrar dene.',true);}
else{
 // A separate, in-memory auth client cannot mistake an existing login session
 // for proof of password recovery. No recovery credentials are written to storage.
 client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:true,flowType:'implicit',storageKey:'agroverix-password-reset'}});
 const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session?.user.id)recoveryOwner=session.user.id;
  else if(recoveryOwner&&(event==='SIGNED_OUT'||session?.user.id!==recoveryOwner))requestView('Oturum sona erdi. Yeni bir şifre sıfırlama bağlantısı iste.',true);
 });
 try{
  const {data,error}=await client.auth.getSession();
  // Only Supabase's verified recovery event can enable the new-password form.
  if(hasRecovery&&!error&&recoveryOwner&&data.session?.user.id===recoveryOwner){
   const result=await client.auth.getUser();
   if(result.error||result.data?.user?.id!==recoveryOwner)throw new Error('invalid-recovery');
   verified=true;requesting.hidden=true;changing.hidden=false;save.disabled=false;message('Bağlantın doğrulandı. Yeni şifreni iki alana da yaz.');
  }else if(hasRecovery||fragment.has('error'))requestView('Bağlantının süresi dolmuş veya bağlantı daha önce kullanılmış. Yeni bir şifre sıfırlama bağlantısı iste.',true);
 }catch{requestView('Bağlantı doğrulanamadı. İnternet bağlantını kontrol et veya yeni bir şifre sıfırlama bağlantısı iste.',true);}
 finally{if(location.hash)history.replaceState(null,'',location.pathname+location.search);}
 window.addEventListener('pagehide',()=>{clearTimeout(cooldown);subscription.unsubscribe();});
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}
