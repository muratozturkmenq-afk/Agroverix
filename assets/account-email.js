// Login email changes use Supabase's confirmation flow, independently of contact details.
export function accountEmailChange(client,onUser,requestTimeout=20000){
 const section=document.querySelector('#account-email-section'),form=document.querySelector('#account-email-form');
 if(!section||!form)return {show(){}};
 const input=document.querySelector('#account-email-new'),button=document.querySelector('#account-email-submit'),current=document.querySelector('#account-email-current'),pendingNote=document.querySelector('#account-email-pending'),result=document.querySelector('#account-email-status');
 let user=null,revision=0,busy=false;
 function message(copy,error=false){result.textContent=copy;result.classList.toggle('is-error',error);}
 function show(next){
  const replaced=user?.id&&user.id===next?.id&&user.email&&next.email&&user.email.toLowerCase()!==next.email.toLowerCase();
  if(user?.id!==next?.id){revision++;busy=false;form.reset();message('');}
  user=next||null;section.hidden=!user;button.disabled=!user||busy;
  current.textContent=user?.email||'—';
  const pending=user?.new_email&&user.new_email.toLowerCase()!==String(user.email||'').toLowerCase()?user.new_email:'';
  pendingNote.textContent=pending?'Onay bekleyen yeni adres: '+pending:'';pendingNote.hidden=!pending;
  if(replaced){form.reset();message('Giriş e-posta adresin güncellendi. Sonraki girişinde bu adresi kullanabilirsin.');}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!user||busy)return;
  input.value=input.value.trim().toLowerCase();
  if(!input.checkValidity()){message('Geçerli bir yeni e-posta adresi gir.',true);input.reportValidity();return;}
  const email=input.value;
  if(email===String(user.email||'').toLowerCase()){message('Bu adres zaten giriş e-posta adresin.',true);return;}
  const owner=user.id,requestRevision=revision;busy=true;button.disabled=true;message('E-posta değişikliği isteniyor…');
  let timer;
  try{
   const redirect=new URL('ciftci-bilgi.html',location.href);redirect.searchParams.set('profile','edit');
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),requestTimeout);});
   const response=await Promise.race([client.auth.updateUser({email},{emailRedirectTo:redirect.href}),timeout]);
   if(revision!==requestRevision||user?.id!==owner)return;
   if(response.error)throw response.error;
   if(response.data?.user?.id!==owner)throw new Error('unconfirmed-response');
   show(response.data.user);onUser(response.data.user);form.reset();
   message(response.data.user.email?.toLowerCase()===email?'Giriş e-posta adresin güncellendi. Sonraki girişinde bu adresi kullanabilirsin.':'Onay bağlantısı gönderildi. Yeni e-posta adresine ve gerekirse mevcut adresine gelen bağlantıları açarak değişikliği tamamla. Onay tamamlanana kadar mevcut giriş adresin geçerlidir.');
  }catch(error){
   if(revision!==requestRevision||user?.id!==owner)return;
   const messages={email_exists:'Bu adres başka bir üyelikte kullanılıyor. Farklı bir adres gir.',email_address_invalid:'E-posta adresini kontrol et.',over_email_send_rate_limit:'Kısa sürede çok fazla e-posta istendi. Bir süre sonra tekrar dene.',over_request_rate_limit:'Kısa sürede çok fazla istek yapıldı. Bir süre sonra tekrar dene.',reauthentication_needed:'Yeniden giriş yaptıktan sonra e-posta değişikliğini tekrar dene.'};
   message(messages[error?.code]||'Değişiklik isteğinin tamamlandığı doğrulanamadı. Gelen kutularını kontrol et; gerekirse daha sonra tekrar dene.',true);
  }finally{
   clearTimeout(timer);if(revision===requestRevision&&user?.id===owner){busy=false;button.disabled=false;}
  }
 });
 form.noValidate=true;show(null);return {show};
}
