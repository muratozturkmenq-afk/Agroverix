# AgroVerix yönetici bildirimleri

Alıcı ve herkese açık iletişim adresi: agroverixinfo@gmail.com.
Yönetici yetkisi mevcut kullanıcı kimliğine bağlıdır; e-posta değişikliği yeni yetki oluşturmaz.

## Son bağlantı adımı

Gmail hesabında iki adımlı doğrulamayı etkinleştirip bir uygulama şifresi oluşturun.
Supabase projesinde Edge Functions → Secrets alanında `SMTP_PASSWORD` isimli gizli değere bu uygulama şifresini kendiniz girip kaydedin. Şifreyi sohbete veya kaynak koduna yazmayın.
Varsayılan gönderici agroverixinfo@gmail.com, sunucu smtp.gmail.com, TLS portu 465'tir.
Gmail politikası uygulama şifresine izin vermiyorsa başka bir SMTP hizmeti bağlanmalıdır.

## Kurulum ve davranış

1. `20261031-admin-notifications.sql` geçişini PostgreSQL yönetici bağlantısıyla çalıştırın.
2. `functions/admin-notify/index.ts` dosyasını `admin-notify` Edge Function olarak yayınlayın. JWT doğrulaması açık kalmalıdır.
3. Özel notification_settings tablosundaki gateway_key alanına projenin eski herkese açık anon JWT anahtarını girin. service_role anahtarını buraya koymayın. Ayrı rastgele worker_key veritabanında oluşturulur ve istemciye verilmez.
4. SMTP_PASSWORD gizli değerini yukarıdaki yöntemle kaydedin.

Yeni üyelik ve başarılı giriş olayları sunucuda sıraya alınır. Beş dakikada bir en fazla üç bildirim işlenir. İlk kurulum kontrol bildirimi de sıraya eklenir. SMTP bağlantısı yokken olaylar tüketilmez. Bağlantı sorunlarında sınırlı yeniden deneme yapılır; başarısız olaylar korunur.

E-postalar olay türü, zaman ve yönetici sayfası bağlantısı içerir; çiftçilerin kimlik, telefon, tarla veya mali kayıtları gönderilmez. Alıcı HTTP isteğinden alınmaz. Yönetici panelindeki durum düğmesi yalnızca durumu okur.

Kaynak olay anahtarı tekrar kuyruğa girişi önler; işleme kiraları eşzamanlı çalışmaları sınırlar. SMTP kabulü sonrası veritabanı onayı kaybolursa nadiren aynı e-posta tekrar gönderilebilir; sabit Message-ID kullanılır. Bu sistem teslimat için mutlak tek-sefer garantisi vermez.

## Kontrol

Yönetici alanında Yönetici Bildirimleri bölümünden gönderim durumunu ve bekleyen/gönderilen sayılarını kontrol edin. Giriş yapmamış kullanıcılar veya normal üyeler bu durum bilgilerine erişemez.
Gerçek SMTP teslimatı ancak uygulama şifresi bağlandıktan sonra doğrulanabilir. Yerel worker.test.mjs testleri sahte SMTP ile çalışır; gerçek e-posta göndermez.
