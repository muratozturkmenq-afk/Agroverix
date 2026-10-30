import {ready,client} from './regional-context.js?v=stable-tr-v1';
await ready;
const panel=document.querySelector('#admin-notifications');
if(panel&&client){
 const {data}=await client.auth.getSession();
 if(data.session){
  const access=await client.rpc('is_agroverix_admin');
  if(!access.error&&access.data===true){
   panel.hidden=false;
   const refresh=async()=>{
    const button=document.querySelector('#admin-notifications-refresh');button.disabled=true;
    try{
     const {data,error}=await client.rpc('agroverix_admin_notification_status');if(error)throw error;
     document.querySelector('#notification-recipient').textContent=data.recipient;
     document.querySelector('#notification-state').textContent=data.transport_ready?'Bağlı':data.last_error&&data.last_error!=='SMTP_PASSWORD_MISSING'?'Bağlantı kontrol edilmeli':'E-posta bağlantısı bekleniyor';
     document.querySelector('#notification-pending').textContent=String(data.pending||0);
     document.querySelector('#notification-sent').textContent=String(data.sent||0);
     document.querySelector('#notification-help').textContent=data.transport_ready?'Yeni üyelik ve giriş bildirimleri bu adrese gönderilir.':'Bildirimler sırada saklanıyor. E-posta hesabının bağlantısı tamamlandığında gönderim başlayacak.';
     if(data.failed)document.querySelector('#notification-help').textContent+=' '+data.failed+' bildirim gönderilemedi; gönderim bağlantısını kontrol et.';
    }catch{document.querySelector('#notification-help').textContent='Bildirim durumu yüklenemedi. Biraz sonra Durumu Yenile düğmesiyle tekrar dene.';}
    finally{button.disabled=false;}
   };
   document.querySelector('#admin-notifications-refresh').addEventListener('click',refresh);await refresh();
  }
 }
}
