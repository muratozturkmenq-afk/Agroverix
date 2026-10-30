// Profile edits keep the account ID; email changes use Auth's existing confirmation flow.
const normalize=value=>String(value||'').trim().toLowerCase();
function deadline(promise,milliseconds){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),milliseconds);})]).finally(()=>clearTimeout(timer));}
export function preferredProfileEmail(user){return user?.new_email||user?.email||'';}
export function emailConfirmationNotice(href){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 const message=url.searchParams.get('message')||hash.get('message')||'';
 if(message.includes('confirm link sent to the other email'))return 'İlk e-posta onayı tamamlandı. Değişikliğin bitmesi için diğer e-posta adresine gelen ikinci bağlantıyı da onayla.';
 if((url.searchParams.get('error_code')||hash.get('error_code'))==='otp_expired')return 'Onay bağlantısının süresi dolmuş veya bağlantı kullanılmış. İki adresteki en son onay e-postalarını kontrol et.';
 return '';
}
export function emailChangeError(error){
 const messages={email_exists:'Bu e-posta başka bir üyelikte kullanılıyor. Farklı bir adres gir.',email_address_invalid:'E-posta adresini kontrol et.',over_email_send_rate_limit:'Kısa sürede çok fazla e-posta istendi. Bir süre sonra tekrar dene.',over_request_rate_limit:'Kısa sürede çok fazla istek yapıldı. Bir süre sonra tekrar dene.',reauthentication_needed:'Yeniden giriş yaptıktan sonra tekrar kaydet.'};
 return messages[error?.code]||'E-posta değişikliği doğrulanamadı. Gelen kutularını kontrol et; gerekirse daha sonra tekrar Kaydet düğmesine bas.';
}
export async function freshAccountUser(client,owner,milliseconds=10000){
 const {data,error}=await deadline(client.auth.getUser(),milliseconds);
 if(error)throw error;if(data?.user?.id!==owner)throw new Error('owner-mismatch');return data.user;
}
export async function saveProfileAndEmail({client,user,record,email,saveProfile,isCurrent=()=>true,milliseconds=20000}){
 if(record.user_id!==user.id)throw new Error('owner-mismatch');
 const profile=await saveProfile(record);
 if(profile?.user_id!==user.id)throw new Error('owner-mismatch');
 if(!isCurrent())return {stale:true};
 const target=normalize(email),pending=normalize(user.new_email),current=normalize(user.email);
 // Saving another profile field must never restart an already pending email change.
 if(!target||target===current||target===pending)return {profile,user,emailState:pending&&pending!==current?'pending':'unchanged'};
 let account=user;
 try{
  // Re-read the authoritative pending address before sending another confirmation.
  // Cached sessions must not reset the user's already completed first approval.
  account=await freshAccountUser(client,user.id,Math.min(milliseconds,10000));
  if(!isCurrent())return {stale:true};
  const freshPending=normalize(account.new_email),freshEmail=normalize(account.email);
  if(target===freshPending||target===freshEmail)return {profile,user:account,emailState:freshPending&&freshPending!==freshEmail?'pending':'unchanged'};
  const redirect=new URL('ciftci-bilgi.html',location.href);redirect.searchParams.set('profile','edit');redirect.searchParams.set('email_change','1');
  const {data,error}=await deadline(client.auth.updateUser({email:target},{emailRedirectTo:redirect.href}),milliseconds);
  if(!isCurrent())return {stale:true};
  if(error)throw error;if(data?.user?.id!==user.id)throw new Error('owner-mismatch');
  return {profile,user:data.user,emailState:normalize(data.user.email)===target?'confirmed':'pending'};
 }catch(error){if(!isCurrent())return {stale:true};return {profile,user:account,emailState:'error',emailError:emailChangeError(error)};}
}
