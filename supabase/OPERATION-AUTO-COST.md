# Tarla kullanımından otomatik maliyet

Kurulum sırası: stok tabloları → `20261020-operation-auto-cost.sql`. Eski işlem tutarları topluca değiştirilmez. Yeni kolonlar `cost_source` (başlangıçta manual) ve `inventory_unit_cost` (boş) eklenir.

Masraf Girişi'nde stok ürünü seçilmiş yeni malzeme işlemlerinde otomatik hesap başlangıçta açıktır. Marka ürünün stok bilgisinden doldurulur. Çiftçi kullanılan tarla toplam miktarını girer; toplam TL ve tarla alanına bölünmüş dekara maliyet hesaplanır. Makine/işçilik ve stok seçilmemiş işlemlerde tutar elle girilir. Otomatik hesabı kapatarak stok bağlantısını koruyup tutarı elle belirtmek mümkündür.

## Fiyat kuralı

İşlem tarihine kadar aynı stok ürünü için kaydedilmiş alışverişlerin toplam bedeli / temel birimdeki toplam miktarı = ağırlıklı ortalama birim alış fiyatı. Kullanım miktarı temel birime çevrilir, bu birim fiyatla çarpılır ve kuruşa yuvarlanır. Torba/şişe içeriği satın alırken normalize edilir; uygulamada kg/L veya uyumlu birimle kullanım girilir.

Bu yöntem bütün uygun alımların ağırlıklı ortalamasıdır; FIFO veya elde kalan stokun hareketli ortalaması değildir. Stok bakiyesi mevcut toplam miktarla kontrol edilir; fiyat seçimi işlem tarihiyle sınırlandırılır. İşlem tarihine kadar alım yoksa otomatik tutar üretilemez; alışveriş eklemek, tarihi kontrol etmek veya tutarı elle girmek gerekir. Fiyat sıfır olan gerçek alımlar sıfır maliyet üretir.

## Kayıt ve düzeltme

Otomatik birim fiyat işlemde saklanır. Aynı ürün/tarih için miktar düzenlendiğinde saklanan fiyat kullanılır. Sonraki alışverişler eski işlem maliyetlerini kendiliğinden değiştirmez. Ürün veya tarih değiştirilirse fiyat yeniden hesaplanır. Hesabı kapatıp elle tutar kaydedilirse fiyat bilgisi temizlenir. Eski, elle tutar girilmiş kayıt açıldığında otomatik hesap kapalı kalır; çiftçi seçerse yeni hesap kullanılır.

Sunucu `inventory_operation_cost` BEFORE tetikleyicisinde toplamı yeniden hesaplar; istemci birim fiyatı göndermez. Tetikleyici `inventory_operation_stock` öncesinde çalışır; eski ve yeni stok satırları aynı sırada kilitlenir. Maliyet ve stok düşümü aynı işlem içinde kaydedilir. Alışveriş değiştirilirse fiyatı henüz kaydedilmemiş yeni işlem formu yenilemede yeni hesap gösterir; kaydedilmiş tutarlar kendi fiyatlarını kullanır. Ödeme kayıtları ürünün alış bedelini değiştirmez.

`agroverix_operation_costing_ready()` yalnızca özelliğin kurulu olduğunu bildirir, kayıt veya fiyat verisi döndürmez. Hizmet hazır değilse manuel giriş devam eder. Daha önce otomatik hesaplanmış kayıt, servis yüklenmeden düzenlenemez. Hesap sahibine özel RLS ve mevcut yönetici yetkileri korunur.
