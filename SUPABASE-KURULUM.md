# Agroverix telefonla üyelik kurulumu

Bu dosya, gerçek kullanıcı kayıtlarını açmadan önce gerekli yönetici kurulumunu anlatır. Supabase proje bağlantısı ve tablo kurulumu tamamlanmadan sayfa hesap oluşturmaz veya profil kaydetmez.

## 1. Supabase projesi

1. Supabase hesabında yeni bir proje oluştur. Veritabanı bölgesi ve kişisel verilerin yurt dışına aktarımı konusunu veri koruma danışmanınla değerlendirmeden gerçek çiftçi verisi girme.
2. **SQL Editor** bölümünde `supabase/setup.sql` dosyasının tamamını çalıştır. Bu şema çiftçi hesabı için profil tablosu ve aynı çiftçiye ait birden fazla tarla kaydı tablosunu kurar. Önceki şemayı kullandıysan güncel dosyanın tamamını yeniden çalıştır.
3. **Authentication → Providers → Phone** bölümünde telefon girişini aç. Kayıt sırasında SMS istenmemesi için **phone confirmation / SMS confirmation** ayarını kapat.
4. **Authentication → URL Configuration** içinde Site URL olarak `https://agroverix.com` ekle.
5. **Authentication → Rate Limits / CAPTCHA** ayarlarını gözden geçir.

Bu ayarla çiftçi önce profil bilgilerini, ardından telefon numarası ve kendi şifresini girer. Telefon numarası kullanıcı adı olarak kullanılır. SMS sağlayıcısı kayıt için gerekli değildir. Telefon numarası SMS ile doğrulanmadığından yazım hatası veya başkasının numarasını kullanma riski bulunur.

## 2. Tarayıcı bağlantı bilgileri

Supabase **Project Settings → API** sayfasından Project URL ve publishable key değerlerini al. Repodaki `assets/supabase-config.js` dosyasına şu alanları gir:

- `url`: Project URL
- `publishableKey`: Publishable key (veya eski projelerde anon key)

Bu anahtar tarayıcıda görünür; bu normaldir. **Secret/service_role key'i bu dosyaya, GitHub'a veya tarayıcıya kesinlikle koyma.** Veritabanı erişimini `setup.sql` içindeki Row Level Security kuralları sınırlar.

## 3. Açmadan önce

- Bir hesap oluşturup giriş yapmayı ve iki ayrı hesapla birbirinin verilerine erişilemediğini kontrol et.
- SMS onayı kapalı olduğunda şifre sıfırlama SMS'i gönderilemez; kullanıcı şifresini unutursa kendi başına sıfırlayamaz. Şifreni güvenli sakla uyarısı bu nedenle kayıt ve giriş ekranlarında gösterilir.
- Kimlik numarası ve tarla konumunun saklanma amacı, aydınlatma metni, açık rıza, veri saklama/silme süresi ve yurt dışı aktarım şartlarını hukuk danışmanıyla netleştir. Hukuki gereklilikler kesinleşmeden gerçek çiftçi verisi toplama.
- Telefon numarası doğrulanmadığı için kullanıcı hesabının sahibini doğrulamaz; hesap kurtarma ve numara sahipliği doğrulaması daha sonra ayrıca kurulmalıdır.

Çiftçi kayıt ekranı yalnızca kişisel profil ve telefon/şifre bilgilerini alır. Ürün, dekar alanı ve tarla konumu, hesap açıldıktan sonra “Tarlalarım” bölümünde her tarla için ayrı kaydedilir.\n\nBu rehber hukuki uygunluk onayı değildir.
