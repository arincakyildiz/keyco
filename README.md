# Keyco - Oyun Kodu ve Hesap E-ticaret Sitesi

Modern ve kullanıcı dostu arayüzü ile oyun kodları ve hesapları satın alabileceğiniz e-ticaret platformu.

## 🎮 Özellikler

- **Steam Kategorileri**: Steam oyunları için özel kategoriler ve filtreleme
- **Gelişmiş Filtreleme**: Oyun türü, fiyat aralığı ve platform bazında filtreleme
- **Admin Paneli**: Ürün yönetimi ve sistem ayarları
- **Güvenli Ödeme**: İyzico entegrasyonu ile güvenli ödeme işlemleri
- **Kullanıcı Yönetimi**: Kayıt, giriş ve profil yönetimi
- **E-posta Doğrulama**: SMTP ile e-posta doğrulama sistemi

## 🚀 Kurulum

1. Projeyi klonlayın:
```bash
git clone https://github.com/arincakyildiz/keyco.git
cd keyco
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyasını oluşturun ve gerekli değişkenleri ekleyin:
```bash
cp .env.example .env
```

4. Sunucuyu başlatın:
```bash
npm start
```

## 📋 Gereksinimler

- Node.js 14+
- SQLite3
- SMTP e-posta servisi

## 🛠️ Teknolojiler

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Ödeme**: İyzico API
- **E-posta**: Nodemailer
- **Güvenlik**: Helmet, Rate Limiting, JWT

## 📁 Proje Yapısı

```
keyco/
├── server.js          # Ana sunucu dosyası
├── db.js             # Veritabanı bağlantısı
├── admin.js          # Admin panel API'leri
├── script.js         # Frontend JavaScript
├── styles.css        # CSS stilleri
├── index.html        # Ana sayfa
├── admin.html        # Admin paneli
├── verify.html       # E-posta doğrulama
├── reset.html        # Şifre sıfırlama
└── package.json      # Proje bağımlılıkları
```

## 🔧 Yapılandırma

`.env` dosyasında aşağıdaki değişkenleri ayarlayın:

```env
PORT=3000
DB_PATH=./data.sqlite
JWT_SECRET=your_jwt_secret
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
IYZICO_API_KEY=your_iyzico_api_key
IYZICO_SECRET_KEY=your_iyzico_secret_key
```

## 📝 Lisans

Bu proje ISC lisansı altında lisanslanmıştır.

## 👨‍💻 Geliştirici

[Arınç Akyıldız](https://github.com/arincakyildiz)

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın
