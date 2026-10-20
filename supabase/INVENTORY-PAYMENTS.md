# Ödeme ve Borç Takibi

`20261020-inventory-payments.sql` mevcut stok kurulumundan sonra çalıştırılır. Eski alışverişler için ödeme tahmini yapılmaz; başlangıçta kayıtlı ödeme sıfırdır. Çiftçi geçmiş ödemelerini kendi tarihleriyle ekler.

Her alışverişe birden fazla ödeme bağlanır. Bedel − kayıtlı ödemeler = kalan borç. Tedarikçi hesapları kırpılmış, Türkçe küçük harfe çevrilmiş tedarikçi adıyla gruplanır. Aynı tedarikçi için tutarlı ad kullanılması gerekir.

Yeni alışverişte isteğe bağlı ilk ödeme tek işlemde alışverişle kaydedilir. Bir aşama başarısız olursa tamamı geri alınır. İstek kimliği ağ hatası sonrası aynı alışverişin tekrar oluşturulmasını engeller. Sonraki ödemeler kendi UUID'siyle kaydedilir; tekrar denemede aynı kayıt güncellenir.

Ödeme ekleme, düzenleme ve silme, sunucuda kullanıcı sahibini kontrol eden sınırlı fonksiyonlarla yapılır. Ödeme tablosuna doğrudan yazma yetkisi verilmez. Ödenen toplam, alışveriş satırı kilitlenerek güncellenir. Eşzamanlı işlemler kalan borcu aşamaz; bedel kayıtlı ödemelerin altına indirilemez. Ödeme kaydı olan alışveriş silinmez; önce ödemeler kontrol edilir. Ödeme silinirse borç artar, tutarı düzeltilirse fark yansır.

Ödeme tarihi alışveriş tarihinden önce olabilir (ön ödeme). Tarihler zorunludur. Tutarlar kuruş cinsinden hesaplanır, ekranda Türkçe binlik ve ondalık ayırıcı kullanılır. Ödemeler stok miktarına ve tarla maliyetine ayrıca eklenmez; borç hesabını etkiler. Sayfa hem alışveriş hem ödeme tarihini gösterir.

Yeni kayıtlar sadece hesap sahibine açıktır; yönetici alanına yeni veri erişimi eklenmedi. Realtime, odak yenileme ve 30 saniyelik görünür sayfa yenilemesi ödeme kayıtlarını da kapsar. Ödeme servisi yüklenemezse stok ekranı çalışır, ödeme girişleri kapatılır ve açık bir mesaj gösterilir.
