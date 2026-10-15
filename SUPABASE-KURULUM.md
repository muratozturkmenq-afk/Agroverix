# Agroverix deneme e-posta üyeliği kurulumu

Bu dosya, gerçek kullanıcı kayıtlarını açmadan önce gerekli yönetici kurulumunu anlatır. Supabase proje bağlantısı ve tablo kurulumu tamamlanmadan sayfa hesap oluşturmaz veya profil kaydetmez.

## 1. Supabase projesi

1. Supabase hesabında yeni bir proje oluştur. Veritabanı bölgesi ve kişisel verilerin yurt dışına aktarımı konusunu veri koruma danışmanınla değerlendirmeden gerçek çiftçi verisi girme.
2. **SQL Editor** bölümünde `supabase/setup.sql` dosyasının tamamını çalıştır. Bu şema çiftçi hesabı için profil tablosu ve aynı çiftçiye ait birden fazla tarla kaydı tablosunu kurar. Önceki şemayı kullandıysan güncel dosyanın tamamını yeniden çalıştır.
3. **Authentication → Providers → Email** bölümünde e-posta ve şifreyle girişi açık tut; **Confirm email** ayarı açık kalsın. Deneme boyunca Phone sağlayıcısını kullanmıyoruz.
4. **Authentication → URL Configuration** içinde Site URL olarak `https://agroverix.com` ayarla ve Redirect URLs listesine `https://agroverix.com/ciftci-bilgi.html` ekle. E-posta onay bağlantısı çiftçi giriş sayfasına döner.
5. **Authentication → Rate Limits / CAPTCHA** ayarlarını gözden geçir.

Denemede çiftçi e-posta adresi ve kendi şifresiyle hesap açar. Supabase onay bağlantısını bu e-postaya yollar. Bağlantıya tıklayınca çiftçi giriş sayfasına döner ve e-posta/şifreyle oturum açabilir. Bu geçici deneme akışında telefon girişi ve SMS kullanılmaz.

## 2. Tarayıcı bağlantı bilgileri

Supabase **Project Settings → API** sayfasından Project URL ve publishable key değerlerini al. Repodaki `assets/supabase-config.js` dosyasına şu alanları gir:

- `url`: Project URL
- `publishableKey`: Publishable key (veya eski projelerde anon key)

Bu anahtar tarayıcıda görünür; bu normaldir. **Secret/service_role key'i bu dosyaya, GitHub'a veya tarayıcıya kesinlikle koyma.** Veritabanı erişimini `setup.sql` içindeki Row Level Security kuralları sınırlar.

## 3. Açmadan önce

- Bir hesap oluşturup giriş yapmayı ve iki ayrı hesapla birbirinin verilerine erişilemediğini kontrol et.
- Supabase'in varsayılan e-posta gönderimi yalnızca proje organizasyonundaki ekip üyelerinin e-posta adreslerine ulaşır ve şu anda saatte 2 iletiyle sınırlıdır. Başka bir adrese test yapmak için e-posta adresini Supabase organizasyonuna ekip üyesi olarak ekle veya özel SMTP kur. [Supabase SMTP rehberi](https://supabase.com/docs/guides/auth/auth-smtp).
- Kimlik numarası ve tarla konumunun saklanma amacı, aydınlatma metni, açık rıza, veri saklama/silme süresi ve yurt dışı aktarım şartlarını hukuk danışmanıyla netleştir. Hukuki gereklilikler kesinleşmeden gerçek çiftçi verisi toplama.
- Bu e-posta akışı yalnızca test içindir. Üretimde tercih edilen telefon/şifre ve SMS doğrulama akışına dönmeden önce Supabase Phone ayarları ve SMS sağlayıcısı ayrıca yapılandırılmalıdır.

Çiftçi kayıt ekranı yalnızca kişisel profil ve e-posta/şifre bilgilerini alır. Ürün, dekar alanı ve tarla konumu, hesap açıldıktan sonra “Tarlalarım” bölümünde her tarla için ayrı kaydedilir.

Çiftçi profilindeki il, ilçe ve köy/mahalle alanları açılır listelerdir. Tarla kayıtlarında aynı listeler her tarla için ayrıca doldurulur. KVKK kutusu analiz izni vermez; tam aydınlatma metni ve veri sorumlusu bilgileri tamamlanmadan gerçek veri toplamaya başlanmamalıdır.

Bu rehber hukuki uygunluk onayı değildir.
# Tarla ve sezon güncellemesi (15 Ekim 2026)

Mevcut kurulumda `supabase/20261015-farm-seasons.sql` dosyasını SQL Editor'de çalıştırın. Bu geçiş, mevcut kayıtları silmeden masraflara sezon yılı ekler ve kullanıcıya özel `farmer_seasons` tablosunu kurar. Yeni kurulumlarda önce `supabase/setup.sql` ve `supabase/field-total-cost.sql`, sonra bu geçiş çalıştırılır.

Her tarla/sezon için ürün, alan, mülkiyet, toplam kira, tahmini verim/fiyat ve gerçek verim/fiyat ayrı saklanır. Eski masraflar işlem tarihinin yılına bağlanır. Yeni bir sezon açıldığında önceki yılın bilgileri korunur. Eski kayıtlarda mülkiyet varsayılanı mülktür; kiralık tarlanın kira bedeli tarla düzenleme ekranından girilmelidir.

Hesaplar: toplam maliyet = masraflar + kira; dekara maliyet = toplam maliyet / alan; kg maliyeti = toplam maliyet / (verim kg/da × alan); gelir = verim × alan × kg satış fiyatı; kâr/zarar = gelir − toplam maliyet; kâr/zarar yüzdesi = kâr/zarar / toplam maliyet × 100. Eksik eski masraf veya sıfır bölen olduğunda yanıltıcı sıfır gösterilmez. Tahminler ve gerçek hasat sonuçları ayrı gösterilir.

