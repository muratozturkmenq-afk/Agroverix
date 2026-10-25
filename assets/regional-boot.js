import {ready} from './regional-context.js?v=stable-tr-v1';
ready.catch(()=>{const I=window.AgroIntl,p=document.createElement('p');p.className='international-error';p.textContent=I.t('Hesap para birimi yüklenemedi. Lütfen sayfayı yenile.');document.querySelector('main')?.prepend(p);document.querySelectorAll('form button[type=submit]').forEach(b=>b.disabled=true);});
