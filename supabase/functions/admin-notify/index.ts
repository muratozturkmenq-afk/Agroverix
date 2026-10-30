import {createClient} from 'npm:@supabase/supabase-js@2.117.1';
import nodemailer from 'npm:nodemailer@10.3.1';

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
 const password=Deno.env.get('SMTP_PASSWORD');
 // This RPC validates the private worker key before any queue row is read or mail sent.
 const access=await db.rpc('agroverix_notification_transport',{p_worker_key:worker,p_ready:password?null:false,p_error:password?null:'SMTP_PASSWORD_MISSING'});
 if(access.error)return json({error:'unauthorized'},403);
 if(!password)return json({ready:false,reason:'email_service_not_connected'},503);
 const {data:events,error}=await db.rpc('agroverix_notification_claim',{p_worker_key:worker,p_limit:3});
 if(error)return json({error:'queue_unavailable'},503);
 const smtpUser=Deno.env.get('SMTP_USERNAME')||'agroverixinfo@gmail.com';
 const transport=nodemailer.createTransport({host:Deno.env.get('SMTP_HOSTNAME')||'smtp.gmail.com',port:Number(Deno.env.get('SMTP_PORT')||465),secure:true,
 auth:{user:smtpUser,pass:password},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,logger:false,debug:false});
 let sent=0,failed=0;
 for(const event of events||[]){
  try{
   const subject=subjects[event.kind];if(!subject)throw new Error('UNKNOWN_EVENT');
   const when=new Intl.DateTimeFormat('tr-TR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(event.occurred_at));
   const detail=event.kind==='signup'?'AgroVerix üzerinde yeni bir üyelik oluşturuldu.':event.kind==='login'?'AgroVerix üzerinde bir üye girişi gerçekleşti.':'AgroVerix yönetici bildirimleri için e-posta bağlantısı çalışıyor.';
   // Fixed recipient comes only from the protected queue, never from the HTTP request.
   // Notifications do not contain identity numbers, phones, passwords or farm records.
   await transport.sendMail({from:{name:'AgroVerix',address:smtpUser},to:event.recipient,subject,
    text:detail+'\n\nTarih: '+when+'\n\nYönetici alanı: '+site+'\n\nBu otomatik bir AgroVerix bildirimidir.',
    messageId:'<agroverix-'+event.id+'@agroverix.com>'});
   const result=await db.rpc('agroverix_notification_finish',{p_worker_key:worker,p_id:event.id,p_lease_id:event.lease_id,p_sent:true});
   if(result.error||result.data!==true){transport.close();return json({error:'delivery_acknowledgement_pending'},503);}
   sent++;
  }catch(error){
   failed++;const code=String(error?.code||'SMTP_DELIVERY_FAILED').replace(/[^A-Z0-9_]/gi,'').slice(0,80);
   await db.rpc('agroverix_notification_finish',{p_worker_key:worker,p_id:event.id,p_lease_id:event.lease_id,p_sent:false,p_error:code});
   await db.rpc('agroverix_notification_transport',{p_worker_key:worker,p_ready:false,p_error:code});
  }
 }
 transport.close();return json({sent,failed});
});
