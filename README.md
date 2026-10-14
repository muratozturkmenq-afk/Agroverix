# Tarla Nabzı (konsept site)

Çift yönlü tarım verisi platformu için konsept site: çiftçiye ücretsiz tarla defteri ve kilo maliyeti, tarım firmalarına bölgesel içgörü. Tüm rakamlar örnek veridir, marka adı çalışma adıdır.

## Çalıştırma

```bash
cd ~/Vibe-Projects/Tarla-Nabzi && python3 -m http.server 4317 --bind 127.0.0.1
```

Sonra http://localhost:4317 adresini aç. Claude Code bu klasörden başlatılırsa `.claude/launch.json` içindeki `tarla-nabzi` ayarıyla da açılır.

## Dosyalar

- `index.html`: sayfa
- `assets/styles.css`: stil ve ölçülü hareket sistemi
- `assets/images/`: fotoğraf gerçekliğinde hero, zararlı ve saha iletişimi görselleri
- `assets/main.js`: etkileşimler (hikâye, sezon simülatörü, harita, veri geçişleri)
- `assets/field3d.js`: önceki Three.js tarla sahnesi (arşiv; güncel sayfada yüklenmiyor)
- `v1.html`: ilk sade sürüm (arşiv)

Kaynak: aile toplantısı, Fireflies kaydı 01M4N8436BR9P7MNKD6HBWPXVP (1:11 ile 1:23 arası).
