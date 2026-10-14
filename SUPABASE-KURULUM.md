# Agroverix telefonla üyelik kurulumu

Bu dosya, gerçek kullanıcı kayıtlarını açmadan önce gerekli yönetici kurulumunu anlatır. Henüz Supabase proje bağlantısı ve SMS sağlayıcısı eklenmediği sürece sayfa hesap oluşturmaz ve veri kaydetmez.

## 1. Supabase projesi

1. Supabase hesabında yeni bir proje oluştur. Veritabanı bölgesi ve kişisel verilerin yurt dışına aktarımı konusunu veri koruma danışmanınla değerlendirmeden gerçek çiftçi verisi girme.
2. **SQL Editor** bölümünde `supabase/setup.sql` dosyasının tamamını çalıştır.
3. **Authentication → Providers → Phone** bölümünde telefon girişini aç ve telefon doğrulamasını etkinleştir.
4. **Authentication → URL Configuration** içinde Site URL olarak `https://agroverix.com` ekle.
5. **Authentication → Rate Limits / CAPTCHA** ayarlarını gözden geçir.

## 2. SMS sağlayıcısı

Supabase telefon doğrulama kodlarını iletmek için SMS sağlayıcısı ister. Supabase projesinde **Authentication → SMS Provider** bölümünden sağlayıcı hesabını bağla (ör. Twilio veya Vonage). SMS ücretleri sağlayıcıya ve ülkeye göre değişir. Test etmeden herkese açık kayıtları açma.

## 3. Tarayıcı bağlantı bilgileri

Supabase **Project Settings → API** sayfasından Project URL ve publishable key değerlerini al. Repodaki `assets/supabase-config.js` dosyasına şu alanları gir:

- `url`: Project URL
- `publishableKey`: Publishable key (veya eski projelerde anon key)

Bu anahtar tarayıcıda görünür; bu normaldir. **Secret/service_role key'i bu dosyaya, GitHub'a veya tarayıcıya kesinlikle koyma.** Veritabanı erişimini `setup.sql` içindeki Row Level Security kuralları sınırlar.

## 4. Açmadan önce

- Kayıt, giriş, SMS doğrulama, şifre yenileme ve iki farklı hesapla veri ayrımı denemelerini yap.
- Kimlik numarası ve tarla konumunun saklanma amacı, aydınlatma metni, açık rıza, veri saklama/silme süresi ve yurt dışı aktarım şartlarını hukuk danışmanıyla netleştir. Bu rehber hukuki uygunluk onayı değildir.
- Telefon numarası geri dönüşüm/SIM değişimi riski taşır; güçlü şifre ve hesap kurtarma akışını kullanıcı bilgilendirmesiyle sun.
