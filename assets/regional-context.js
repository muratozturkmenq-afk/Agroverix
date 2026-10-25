import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
const I=window.AgroIntl,cfg=window.AGROVERIX_SUPABASE||{};
export const client=cfg.url&&cfg.publishableKey?(window.AGROVERIX_CLIENT||(window.AGROVERIX_CLIENT=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}))):null;
let activeId=null,initialised=false,switching=false;
function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Hesap bağlantısı zaman aşımına uğradı.')),10000);})]).finally(()=>clearTimeout(timer));}
async function accountRow(table,columns,id){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{return await client.from(table).select(columns).eq('user_id',id).maybeSingle().abortSignal(controller.signal);}finally{clearTimeout(timer);}}
export const ready=(async()=>{
 if(!client){initialised=true;return;}
 const {data,error}=await deadline(client.auth.getSession());if(error)throw error;
 const session=data.session;activeId=session?.user.id||null;initialised=true;
 if(!session)return;
 const settings=await accountRow('farmer_account_settings','currency',activeId);
 if(settings.error||!settings.data||!['TRY','EUR'].includes(settings.data.currency))throw new Error('Hesap para birimi yüklenemedi. Lütfen sayfayı yenile.');
 I.accountId=activeId;I.setCurrency(settings.data.currency);
 // The country is only needed on profile and field address forms.
 if(document.querySelector('#p-country,#f-country')){const profile=await accountRow('farmer_profiles','country',activeId);I.country=profile.data?.country||'TR';}
 I.mount();
})();
if(client)client.auth.onAuthStateChange((event,session)=>{
 // Initial session restoration may emit SIGNED_IN before getSession finishes.
 // It must never trigger a reload. Only a later change of account can do so.
 if(!initialised||switching||!['SIGNED_IN','SIGNED_OUT'].includes(event))return;
 const nextId=session?.user.id||null;if(nextId===activeId)return;
 switching=true;activeId=nextId;document.documentElement.dataset.accountSwitching='true';
 setTimeout(()=>location.reload(),0);
});
export const t=s=>I.t(s),locale=()=>I.locale,areaDisplay=n=>I.area(n),areaStored=n=>I.areaStored(n),perAreaDisplay=n=>I.perArea(n),perAreaStored=n=>I.perAreaStored(n),currency=()=>I.currency;
