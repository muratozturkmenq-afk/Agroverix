# AgroVerix yönetici bildirimleri — Resend

Alıcı ve herkese açık iletişim adresi: agroverixinfo@gmail.com.
Yönetici yetkisi mevcut kullanıcı kimliğine bağlıdır; e-posta değişikliği yeni yetki oluşturmaz.

## Son bağlantı adımı

1. Resend hesabını agroverixinfo@gmail.com adresiyle açın ve hesabın e-posta doğrulamasını tamamlayın. Gmail şifresi veya Gmail uygulama şifresi gerekmez.
2. Resend → API Keys bölümünden yalnızca gönderim yetkili (Sending access) bir anahtar oluşturun. Anahtarı sohbete veya kaynak koduna yazmayın.
3. Supabase → Edge Functions → Secrets alanında RESEND_API_KEY adlı gizli değere bu anahtarı kendiniz girip kaydedin.
4. Bağlantı kaydedildiğinde sunucu kontrol çağrısını çalıştırıp sonucu doğrulayın. agroverix-admin-notifications zamanlayıcısı duraklatılmışsa başarılı gönderimden sonra yeniden açın. Duraklama sırasında bekleyen bildirimler korunur.

Deneme göndericisi AgroVerix <onboarding@resend.dev> olarak ayarlıdır. Resend bu göndericiden yalnızca Resend hesabınızın kendi adresine deneme gönderimine izin verir; hesabı agroverixinfo@gmail.com ile açın. Başka bir adresle açılmış Resend hesabında bu kısıtlama kalkmaz.
Canlı kullanımda agroverix.com altında bir gönderim alt alanını Resend'de DNS kayıtlarıyla doğrulayın; sonra EMAIL_FROM gizli ayarına o alan adındaki gönderici adresini girin. Örnek: AgroVerix <bildirim@send.agroverix.com>. DNS doğrulanmadan bu örneği kullanmayın.

Resend'in 31 Ekim 2026 itibarıyla Free planı günde 100, ayda 3.000 e-posta içeriyor. Ücretli plan veya kota aşım ödemesi açılmadı. Her giriş bir bildirim oluşturduğu için kullanım büyüdüğünde kotalar izlenmelidir.
Önceki SMTP_PASSWORD değeri bu gönderici tarafından okunmaz.

## Kurulum ve davranış

1. Önce 20261031-admin-notifications.sql, ardından 20261031-signup-notice-profile.sql geçişlerini PostgreSQL yönetici bağlantısıyla çalıştırın.
2. functions/admin-notify/index.ts dosyasını admin-notify Edge Function olarak yayınlayın. JWT doğrulaması açık kalmalıdır.
3. Özel notification_settings tablosundaki gateway_key alanında projenin eski herkese açık anon JWT anahtarı kullanılır; service_role anahtarını buraya koymayın. Ayrı rastgele worker_key veritabanında oluşturulur ve istemciye verilmez.
4. Yukarıdaki Resend bağlantısını tamamlayın.

Yeni üyelik ve başarılı giriş olayları sunucuda sıraya alınır. Zamanlayıcı açıkken beş dakikada bir en fazla üç bildirim işlenir. Resend bağlantısı yokken olaylar tüketilmez. Bağlantı sorunlarında sınırlı yeniden deneme yapılır; başarısız olaylar korunur.
E-postalar olay türü, zaman ve yönetici sayfası bağlantısı içerir. Yalnızca ilk yeni üyelik bildiriminde, kullanıcının talebiyle Adı Soyadı, İl ve İlçe de yer alır. Bu üç alan farmer_profiles kaydından okunur; Türkiye il/ilçe kodları sitenin mevcut yer listesiyle adlara çevrilir. Alanlar eksikse üyelik bildirimi tüketilmeden bekler. İlk gönderim için hazırlanan üç alan özel kuyrukta sabitlenir; yeniden denemeler aynı içeriği kullanır. Kullanıcı başına yalnızca bir signup kaydı tutulur; sonraki profil düzenlemeleri yeni üyelik bildirimi oluşturmaz. Normal giriş bildirimlerinde bu bilgiler tekrarlanmaz. Kimlik numarası, telefon, e-posta, köy/adres, tarla ve mali kayıtlar gönderilmez. Alıcı HTTP isteğinden alınmaz. Yönetici panelindeki durum düğmesi yalnızca durumu okur.
Resend API'sinden başarılı HTTP yanıtı ve e-posta işlem kimliği alınmadan olay gönderilmiş sayılmaz. API kabulü, gelen kutusuna teslim edildiğinin kesin kanıtı değildir; teslimat ayrıca Resend panelinden veya alıcı gelen kutusundan kontrol edilmelidir.
Resend'in olay kimliği tabanlı Idempotency-Key koruması 24 saat geçerlidir. Çok daha sonra tekrarlanan, sonucu belirsiz bir gönderim için mutlak tek-sefer garantisi yoktur. Zaman aşımı 10 saniye; yanıt gövdeleri, anahtarlar ve ayrıntılı sağlayıcı hataları kaydedilmez.

## Kontrol

Yönetici alanındaki Yönetici Bildirimleri bölümünde bağlantı ve bekleyen/gönderilen sayıları görünür. Anonim kullanıcılar ve normal üyeler bu durum bilgilerine erişemez.
Yerel denetim: node --test supabase/tests/admin-notify.test.mjs
Testler gerçek sağlayıcıya bağlantı kurmaz veya e-posta göndermez. Veritabanı denetimi için supabase/tests/signup-notice-profile.sql dosyası kullanılabilir; bütün test kayıtları transaction rollback ile geri alınır.
Gerçek teslimat yalnızca Resend hesabı ve RESEND_API_KEY bağlandıktan sonra doğrulanabilir.

Resmi kaynaklar:
- https://resend.com/docs/send-with-supabase-edge-functions
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/errors
- https://resend.com/pricing
