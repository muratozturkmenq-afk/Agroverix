# AGENTS.md · Tarla Nabzı sitesi

Bu dosya, bu projede çalışan yapay zekâ kod asistanları (ChatGPT Codex vb.) içindir. Her işe başlamadan önce oku ve kurallara uy.

## Proje ne?

Tarla Nabzı, çift yönlü bir tarım verisi platformunun tanıtım sitesidir:

- **Çiftçi tarafı (ücretsiz):** Çiftçi tarlasını (konum, gerçek dekar, ürün, tahmini verim) ve sezon boyunca yaptığı her işlemi (sürüm, ekim, gübre, sulama, ilaçlama, hasat) kaydeder. Her kayıttan sonra 1 kg ürünün kendisine maliyetini görür. Hasatta gerçek verimi girer, sezon raporu ve öneri alır.
- **Firma tarafı (ücretli):** Aynı kayıtlar, çiftçinin açık rızasıyla ve anonim, toplu hâlde, ilaç, tohum ve gübre firmalarına bölgesel içgörü, rapor, hedefli kampanya ve danışmanlık olarak sunulur. Klasik anket şirketlerine (ilçe başına yaklaşık 20 kişiyle konuşan, ~8.000 euroluk anketler) alternatiftir.

Site sahibi teknik biri değildir. Değişiklikleri sade Türkçeyle anlat.

## Teknik yapı

- Saf statik site. **Build adımı, npm, framework yok.** Böyle kalmalı; açıkça istenmedikçe React, Next.js, Tailwind, paket yöneticisi vb. ekleme.
- Vercel'de "Other" ayarıyla, kök klasörden yayınlanır. `index.html` kökte kalmalı.
- Dosyalar:
  - `index.html`: tüm bölümlerin HTML'i (telefon ve panel ekranları, formlar)
  - `assets/styles.css`: tüm stiller; renk ve yazı tipi değişkenleri en üstte `:root` içinde
  - `assets/images/`: fotoğraflar (açılış tarla fotoğrafı, zararlı kartları, "Bayi camından tarlaya" kartları). Yeni fotoğraf eklerken genişliği en fazla ~1700 px, JPG kalitesi ~80 tut; `width`, `height` ve Türkçe `alt` metni yaz.
  - `assets/main.js`: tüm etkileşimler ve örnek veriler
  - `assets/administrative-units.json`: il, ilçe ve köy/mahalle seçimi için yerel veri listesi (Ekim 2025 kaynak verisi).
  - `assets/field3d.js`: eski Three.js 3D tarla sahnesi; **arşiv, sayfada yüklenmiyor.** Açıkça istenmedikçe geri bağlama.
- Dış kütüphaneler CDN'den, sabit sürümle yüklenir: GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.13. Sürümleri sabit tut, `latest` kullanma.
- Yazı tipleri Google Fonts: Archivo (başlık), Instrument Sans (metin), Martian Mono (rakam/etiket).

## Nerede ne var (main.js)

- `heroCards`: açılış fotoğrafının üstündeki yüzen canlı kartlar
- `ticker`: iki yönlü kayan veri bandı (`data` ve `ins` dizileri)
- `story`: kaydırınca 4 adım ilerleyen telefon + firma paneli bölümü (`texts` dizisi)
- `season`: sezon simülatörü; işlemler `OPS` dizisinde (gün, ad, TL/da maliyet)
- `insight`: Türkiye haritası ve firma paneli; bölge verileri `R` nesnesinde (Ege, Çukurova, GAP, Trakya), il koordinatları `prov` dizilerinde
- `survey`: anket ile gerçek veri karşılaştırma animasyonu
- `reach`, `kvkk`, `wheat`: ulaşım kartları, veri yolculuğu animasyonu ve en alttaki buğday tarlası

## Kurallar

1. Sitedeki tüm metinler Türkçe. Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) doğru kullan.
2. Sayfadaki rakamlar **örnek veridir** ve sayfada "Örnek veri" olarak işaretlidir. Gerçek veri gelene kadar bu işaretleri kaldırma. Gerçek firma, kişi veya ürün markası uydurma.
3. Tasarım dilini koru: koyu toprak tonları, buğday sarısı (`--gold`), veri mavisi (`--blue`), açık bölümlerde pamuk beyazı. Yeni renk gerekiyorsa `:root` içine değişken olarak ekle.
4. Her değişiklikten sonra kontrol et: masaüstü genişliği ve telefon genişliği (375 px) bozulmamalı, sayfa yana kaymamalı, tarayıcı konsolunda hata olmamalı.
5. Animasyonlar `prefers-reduced-motion` ayarına saygı göstermeli; yeni animasyon eklerken bunu koru.
6. Formlar şu an hiçbir yere veri göndermiyor. Gerçek form isteği gelirse önce hangi servisin (ör. Formspree, Vercel üzerinde basit bir fonksiyon) kullanılacağını sor; şifre, API anahtarı, token gibi gizli bilgileri **asla koda yazma**.
7. Kişisel veri (çiftçi adı, telefon) siteye örnek olarak bile gerçek kişiden konmaz. KVKK metinleri hukuki kontrol gerektirir; metni değiştirirsen PR açıklamasında belirt.
8. Küçük ve odaklı değişiklik yap. İstenmeyen bölümleri yeniden yazma.

## Pull request (PR) açıklaması

Site sahibi PR'ları okuyup onaylayacak. Açıklamayı teknik olmayan Türkçeyle yaz:

- **Ne değişti:** 1-3 madde, sade dille
- **Nereden bakılır:** sayfanın hangi bölümü
- **Dikkat:** varsa onay gerektiren konu (metin, rakam, hukuki ifade)

Commit mesajları kısa ve Türkçe olsun (ör. "Harita: İç Anadolu bölgesi eklendi").
