# Alışveriş ve Stok

Sayfa: `/alisveris-stok.html`. Kurulum: `20261020-inventory.sql` dosyasının tamamı, mevcut profil/tarla/sezon/masraf kurulumlarından sonra Supabase SQL Editor'de çalıştırılır. Dosya mevcut masraf verilerini değiştirmez ve tekrar çalıştırılabilir.

## Kullanım

1. Tedarikçi, ürün, marka, alınan miktar, birim ve alışveriş tutarı girilir. Torba/şişede tek ambalaj içeriği de zorunludur. Aynı ürün adı, marka ve temel birimde tekrar alışveriş aynı stoka eklenir.
2. Masraf Girişi sayfasında stok ürünü seçilir. Tarlada kullanılan toplam miktar kg, L, adet veya metreyle uyumlu birimde girilir. İşlem kaydedildiğinde stok düşer.
3. Kullanım miktarı düzenlenirse yalnızca fark uygulanır; kullanım silinirse miktar geri gelir. Alışveriş değişiklikleri de fark kadar işlenir. Kullanılmış miktardan daha az alışveriş bırakacak azaltma/silme reddedilir.
4. Önceki kayıtlar otomatik tahminle eşleştirilmez. Alışveriş ve Stok sayfasındaki eşleştirme listesinde çiftçi ürünü seçer. Eski dekara kullanım kayıtları önce Masraf Girişi'nde toplam miktar olarak düzeltilir. Birden fazla ürünü içeren eski kayıtlar çiftçi tarafından ayrı ayrı kaydedilmelidir.

## Hesaplar

- Torba/şişe: adet × bir ambalajın içeriği × birim dönüşümü.
- kg = g / 1.000 = ton × 1.000; L = ml / 1.000 = m³ × 1.000. Farklı boyutlar (kg/L gibi) birbirine çevrilmez.
- Kalan stok = alınan toplam miktar − bağlı tarla uygulamalarındaki toplam miktar.
- Birim fiyat girişi: seçilen alışveriş biriminin fiyatı × alınan adet/miktar = toplam tutar.
- Gösterilen ortalama alış fiyatı tüm kayıtlı alışverişlerin tutarı / miktarıdır; FIFO veya tarihsel hareketli ortalama değildir. Tarla gideri masraf formunda girilen tutardır; satın alma bedeli tarla maliyetine ayrıca eklenmez.
- Stok sezonlar arasında devreder; kullanım dökümünde sezon yılı görünür.

## Veri bütünlüğü

Yeni tabloların erişimi RLS ile sadece kayıt sahibine açıktır. Yönetici raporlarına yeni bir erişim eklenmemiştir. Bakiyeye doğrudan yazma yetkisi verilmez. Satın alma ve kullanım tetikleyicileri stok satırını kilitler; eşzamanlı istekler eksi stok oluşturamaz. Kullanım kaydındaki stok miktarı sunucuda yeniden hesaplanır. Stok bağlantısı aynı kullanıcıya ait ürünle sınırlandırılır. Ürünün temel birimi sonradan değiştirilemez.

Eşleştirilmemiş masraflar maliyet raporlarında kalır ancak stoktan düşmez; kullanıcıya ayrı listelenir. Kullanım açıklaması mevcut masraf kaydının `notes` alanıdır, boşsa yapılan işlem adı gösterilir. Realtime değişiklikleri yenileme başlatır; bağlantı kesilirse sayfa odağa geldiğinde ve görünürken 30 saniyede bir güncellenir. Form taslağı tarayıcı kalıcı deposuna yazılmaz.
