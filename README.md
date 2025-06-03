<p align="center">
	<img src="https://api-assets.clashofclans.com/badges/200/BbOiJGTyOXe7oxCFiCYfg-oRyzXm8ZeN_rFjnjNn9HA.png" height="200" alt="dostluk klan rozeti" />
</p>

# 🤖 Clash of Clans Telegram Bot

Modern ve kapsamlı Clash of Clans Telegram botu. SQLite veritabanı ile yapılandırma yönetimi, kullanıcı doğrulama sistemi ve akıllı savaş bildirimleri.

## ✨ Özellikler

### 🔐 Güvenlik & Doğrulama

- **Kullanıcı Doğrulama Sistemi**: Telegram kullanıcılarını CoC hesapları ile eşleme
- **Çoklu Hesap Desteği**: Bir kullanıcı birden fazla köy eşleyebilir
- **Admin Yetkilendirme**: Gelişmiş admin panel sistemi
- **Yeni Üye Karşılama**: Otomatik hoş geldin mesajı ve doğrulama rehberi

### 📊 Klan Yönetimi

- **Klan Bilgileri**: Detaylı klan istatistikleri
- **Üye Listesi**: Sadece doğrulanmış hesapların görünmesi
- **Başkent Baskınları**: Sezon bazlı baskın raporları
- **Klan Sıralamaları**: Lokasyon bazlı sıralamalar

### ⚔️ Savaş Sistemi

- **Akıllı Bildirimler**: Savaş durumuna göre otomatik bildirimler
- **Bildirim Geçmişi**: Tekrar bildirim göndermeme sistemi
- **Savaş Analizi**: Detaylı savaş raporları
- **Saldırmayan Üyeler**: Saldırı yapmayan üye listesi
- **Savaş Ligi**: CWL bilgileri ve analizi

### 🏆 Sıralama & Ligler

- **Global Sıralamalar**: Oyuncu ve klan sıralamaları
- **Builder Base**: Ayrı BB sıralamaları
- **Legend Ligi**: Legend sezonu sıralamaları
- **Tüm Ligler**: Kapsamlı lig bilgileri

### 💾 Veritabanı & Konfigürasyon

- **SQLite Veritabanı**: Dosya tabanlı, kolay yedekleme
- **Env-Free**: .env dosyası gerektirmez
- **Kolay Kurulum**: İnteraktif setup sistemi
- **Runtime Konfigürasyon**: Çalışırken ayar değiştirme

## 🚀 Kurulum

### 1. Gereksinimleri Yükleyin

```bash
npm install
```

### 2. Bot Konfigürasyonu

```bash
npm run setup
```

Kurulum sırasında gerekli bilgiler:

- **Bot Token**: @BotFather'dan alacağınız token
- **CoC API Key**: [developer.clashofclans.com](https://developer.clashofclans.com) adresinden
- **Klan Tag**: Klanınızın etiketi (# ile birlikte)
- **Admin ID'leri**: Telegram kullanıcı ID'leri (virgülle ayırın)
- **Bildirim Chat ID**: (Opsiyonel) Savaş bildirimleri için grup ID'si

### 3. Botu Başlatın

```bash
npm start
```

## ⚙️ Konfigürasyon Yönetimi

### Mevcut Ayarları Görüntüleme

```bash
npm run setup:update
```

### Admin Panel ile Yönetim

Bot içerisinden `/admin` komutu ile:

- `/config_goster` - Mevcut ayarları göster
- `/config_duzenle` - Ayarları düzenle (yakında)

## 🔐 Kullanıcı Doğrulama Sistemi

### Yeni Üye Süreci

1. Kullanıcı gruba katılır
2. Bot otomatik hoş geldin mesajı gönderir
3. Kullanıcı `/dogrula` komutunu kullanır
4. Klandaki müsait hesaplar listelenir
5. Kullanıcı kendi hesabını seçer
6. Doğrulama tamamlanır

### Doğrulama Özelikleri

- ✅ Zaten eşlenmiş hesaplar görünmez
- ✅ Bir kullanıcı birden fazla hesap eşleyebilir
- ✅ Doğrulanmamış kullanıcılar komut kullanamaz
- ✅ Adminler doğrulama olmadan komut kullanabilir

## 📱 Bot Komutları

### 🏰 Klan Komutları

- `/klan` - Klan bilgileri
- `/uyeler` - Klan üyeleri (sadece doğrulanmış hesaplar gösterilmez)
- `/baskinlar` - Başkent baskın sezonları

### ⚔️ Savaş Komutları

- `/savas` - Mevcut savaş durumu
- `/savas_analiz` - Detaylı savaş analizi
- `/savas_saldirmayanlar` - Saldırı yapmayan üyeler
- `/savas_gecmis` - Savaş geçmişi
- `/savas_lig` - Savaş ligi bilgileri

### 👤 Oyuncu Komutları

- `/oyuncu [tag]` - Oyuncu bilgileri
- `#PLAYERTAG` - Mesaj olarak tag gönderme

### 🏆 Sıralama Komutları

- `/klan_siralamasi` - Klan sıralamaları
- `/oyuncu_siralamasi` - Oyuncu sıralamaları
- `/legend_siralamasi` - Legend sıralamaları
- `/basken_siralama` - Başkent sıralamaları

### 🔧 Admin Komutları

- `/admin` - Admin paneli
- `/bildirim_durum` - Bildirim sistemi durumu
- `/config_goster` - Konfigürasyon görüntüleme

### ❓ Yardım Komutları

- `/start` veya `/help` - Ana yardım
- `/yardim_klan` - Klan komutları yardımı
- `/yardim_savas` - Savaş komutları yardımı

## 🔔 Savaş Bildirimleri

### Bildirim Türleri

1. **Savaş Bulundu** - Eşleşme olduğunda
2. **Zaman Uyarıları** - 1 saat, 30 dk, 5 dk kala
3. **Savaş Başladı** - Saldırı başladığında
4. **Savaş Bitti** - Sonuç bildirimi

### Akıllı Özellikler

- ✅ Tekrar bildirim gönderilmez
- ✅ Bildirim geçmişi SQLite'da saklanır
- ✅ Farklı savaşlar ayrı takip edilir
- ✅ Manuel test bildirimi gönderebilme

## 📁 Dosya Yapısı

```
CoC_Bot/
├── src/
│   ├── callbacks/          # Komut işleyicileri
│   ├── services/           # Ana servisler
│   │   ├── database.js     # SQLite veritabanı
│   │   ├── clashApi.js     # CoC API client
│   │   ├── warNotifications.js # Savaş bildirimleri
│   │   └── verificationService.js # Doğrulama sistemi
│   ├── utils/              # Yardımcı fonksiyonlar
│   └── replies/            # Mesaj şablonları
├── bot.db                  # SQLite veritabanı (otomatik oluşur)
├── setup.js                # Kurulum scripti
├── index.js                # Ana uygulama
└── package.json
```

## 🔧 Gelişmiş Ayarlar

### Veritabanı Yedekleme

```bash
cp bot.db bot_backup_$(date +%Y%m%d).db
```

### Log Sistemi

- Tüm admin işlemleri loglanır
- Doğrulama süreçleri takip edilir
- Bildirim gönderimi kayıt altına alınır

### Güvenlik

- Admin yetki kontrolü
- Kullanıcı kimlik doğrulama
- API rate limiting
- Hata yakalama ve logla

## 🐛 Sorun Giderme

### Bot Başlamıyor

1. `npm run setup` ile konfigürasyonu kontrol edin
2. Bot token ve API key'lerin doğruluğunu kontrol edin
3. `bot.db` dosyasının yazma izni olduğunu kontrol edin

### Bildirimler Çalışmıyor

1. `/admin` komutu ile bildirim durumunu kontrol edin
2. Bildirim chat ID'sinin doğruluğunu kontrol edin
3. Botun gruba mesaj gönderme yetkisi olduğunu kontrol edin

### Doğrulama Problemi

1. Klan tag'inin doğru olduğunu kontrol edin
2. CoC API'nın erişilebilir olduğunu kontrol edin
3. Kullanıcının gruba katıldığından emin olun

## 📞 Destek

Sorun yaşarsanız:

1. GitHub Issues bölümünden yeni issue açın
2. Hata mesajlarını ve logları paylaşın
3. Bot versiyonu ve Node.js versiyonunu belirtin

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

---

**⚡ Hızlı Başlangıç:**

```bash
git clone <repo-url>
cd CoC_Bot
npm install
npm run setup
npm start
```

**🔥 Önemli:** İlk kurulumdan sonra admin olarak `/dogrula` komutunu kullanarak kendi hesabınızı eşlemeyi unutmayın!
