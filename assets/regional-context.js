import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';
const I=window.AgroIntl,cfg=window.AGROVERIX_SUPABASE||{};
export const client=cfg.url&&cfg.publishableKey?(window.AGROVERIX_CLIENT||(window.AGROVERIX_CLIENT=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}))):null;
let activeId=null;
export const ready=(async()=>{
 if(!client)return;
 const {data,error}=await client.auth.getSession();if(error)throw error;
 const session=data.session;if(!session)return;activeId=session.user.id;
 const [settings,profile]=await Promise.all([client.from('farmer_account_settings').select('currency').eq('user_id',activeId).single(),client.from('farmer_profiles').select('country').eq('user_id',activeId).maybeSingle()]);
 if(settings.error||!settings.data||!['TRY','EUR'].includes(settings.data.currency)){throw new Error(I.t('Hesap para birimi yüklenemedi. Lütfen sayfayı yenile.'));}
 I.accountId=activeId;I.country=profile.data?.country||'TR';I.setCurrency(settings.data.currency);
 if(document.readyState!=='loading'){document.querySelector('.regional-controls')?.remove();I.mount();}
})();
if(client)client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&activeId!==(session?.user.id||null)){document.documentElement.dataset.accountSwitching='true';setTimeout(()=>location.reload(),0);}});
export const t=s=>I.t(s),locale=()=>I.locale,areaDisplay=n=>I.area(n),areaStored=n=>I.areaStored(n),perAreaDisplay=n=>I.perArea(n),perAreaStored=n=>I.perAreaStored(n),currency=()=>I.currency;
