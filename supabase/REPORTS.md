# AgroVerix Excel raporları

Tüm Üyeleri Excel İndir düğmesi yöneticiye açık bütün üyeleri ve sezonları kapsar; ekrandaki filtrelerden bağımsızdır. Seçili Kapsamı Excel İndir mevcut çiftçi, sezon ve bitki seçimini kullanır. Yönetici ekranı ilk açılışta tüm üyelerin kayıtlarını ve üye bazında tarla/uygulama/masraf sayılarını yükler. Tüm kapsam seçiliyken sezonsuz tarlalar da ham tarla sayfasında korunur.

Masraf Girişleri sayfasında çiftçi, yönetici için üye kodu, para birimi, tarih, masraf cinsi, ürün/içerik, marka/firma, bayi, alınan miktar, alış birimi, ambalaj, dönüştürülmüş stok miktarı, birim fiyat, toplam, ödenen, kalan borç ve açıklama bulunur. Ürün ve Gider Özeti, Masraf Ödemeleri ve Bayi ve Borç Özeti ayrı sayfalardır. Uygulama Kayıtları tarlada harcanan miktar ve maliyetleri içerir; stok ürünü ile ürün/marka eşleştirilir.

Satın alma ve ödeme kayıtları ortak hesap stoklarına aittir. Tarla veya sezon raporu alındığında bu sayfalar seçilen hesapların bütün tarihli kayıtlarını gösterir; satın alma tutarları tarla maliyetine ikinci kez eklenmez. Stok kullanım miktarı tüm alımlar eksi güncel bakiye üzerinden hesaplanır; seçili tarla filtresi kalan stokla tutarsız bir kullanım toplamı oluşturmaz. Borçlar bayi adı aynı olsa bile hesap ve para birimi bazında ayrı kalır.

Üye raporu her tabloyu oturum sahibinin user_id değeriyle ve mevcut RLS kurallarıyla okur. Yönetici sorgusu mevcut is_agroverix_admin yetkisini kontrol eder; normal üyelerin erişimi genişletilmez. Üye kodu normal çiftçi raporuna eklenmez.

Kurulum: 20261108-admin-expense-reports.sql geçişini uygulayın, ardından eşleşen istemci dosyalarını yayınlayın. Yeni RPC kapsamları inventory_items, inventory_purchases, inventory_payments'tir. Eski kapsamlar korunur.

Kontrol: node --test tests/reports.test.mjs
Canlı salt okunur/rollback denetimi: supabase/tests/admin-expense-reports.sql
Testler gerçek üye, masraf veya mesaj oluşturmaz.
