import {createClient} from 'npm:@supabase/supabase-js@2.117.1';

const json=(value,status=200)=>Response.json(value,{status});
const site='https://agroverix.com/yonetici.html';
const subjects={signup:'AgroVerix · Yeni üye kaydı',login:'AgroVerix · Üye girişi',system_test:'AgroVerix · Bildirim bağlantısı hazır'};

Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const worker=req.headers.get('X-AgroVerix-Worker')||'';
 if(!/^[a-f0-9]{64}$/.test(worker))return json({error:'unauthorized'},401);
 const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!supabaseUrl||!serviceKey)return json({error:'server_configuration'},503);
 const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const apiKey=(Deno.env.get('RESEND_API_KEY')||'').trim();
 // This RPC validates the private worker key before any queue row is read or mail sent.
 const access=await db.rpc('agroverix_notification_transport',{p_worker_key:worker,p_ready:apiKey?null:false,p_error:apiKey?null:'RESEND_API_KEY_MISSING'});
 if(access.error)return json({error:'unauthorized'},403);
 if(!apiKey)return json({ready:false,reason:'email_service_not_connected'},503);
 const {data:events,error}=await db.rpc('agroverix_notification_claim',{p_worker_key:worker,p_limit:3});
 if(error)return json({error:'queue_unavailable'},503);
 // The shared testing sender can send only to the Resend account owner's address.
 // Use a verified sending domain via EMAIL_FROM before sending to other recipients.
 const from=(Deno.env.get('EMAIL_FROM')||'AgroVerix <onboarding@resend.dev>').trim();
 let sent=0,failed=0;
 for(const event of events||[]){
  if(sent+failed)await new Promise(resolve=>setTimeout(resolve,600));
  try{
   const subject=subjects[event.kind];if(!subject)throw new Error('UNKNOWN_EVENT');
   const when=new Intl.DateTimeFormat('tr-TR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(event.occurred_at));
   const detail=event.kind==='signup'?'AgroVerix üzerinde yeni bir üyelik oluşturuldu.':event.kind==='login'?'AgroVerix üzerinde bir üye girişi gerçekleşti.':'AgroVerix yönetici bildirimleri için e-posta bağlantısı çalışıyor.';
   // Fixed recipient comes only from the protected queue, never from the HTTP request.
   // Notifications do not contain identity numbers, phones, passwords or farm records.
   const response=await fetch('https://api.resend.com/emails',{method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'agroverix-notice/'+event.id},
    body:JSON.stringify({from,to:[event.recipient],subject,reply_to:'agroverixinfo@gmail.com',
     text:detail+'\n\nTarih: '+when+'\n\nYönetici alanı: '+site+'\n\nBu otomatik bir AgroVerix bildirimidir.'}),
    signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Object.assign(new Error('Email provider rejected request'),{code:'RESEND_HTTP_'+response.status});
   const receipt=await response.json();
   if(typeof receipt?.id!=='string'||!receipt.id)throw Object.assign(new Error('Missing provider acknowledgement'),{code:'RESEND_INVALID_RESPONSE'});
   const result=await db.rpc('agroverix_notification_finish',{p_worker_key:worker,p_id:event.id,p_lease_id:event.lease_id,p_sent:true});
   if(result.error||result.data!==true)return json({error:'delivery_acknowledgement_pending'},503);
   sent++;
  }catch(error){
   failed++;const code=/^RESEND_(HTTP_\d{3}|INVALID_RESPONSE)$/.test(error?.code||'')?error.code:'RESEND_REQUEST_FAILED';
   await db.rpc('agroverix_notification_finish',{p_worker_key:worker,p_id:event.id,p_lease_id:event.lease_id,p_sent:false,p_error:code});
   await db.rpc('agroverix_notification_transport',{p_worker_key:worker,p_ready:false,p_error:code});
  }
 }
 return json({sent,failed});
});
