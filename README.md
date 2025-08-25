# 🎮 Keyco - Gaming Store

**Keyco**, oyun kodları, hediye kartları ve dijital ürünler satan modern bir e-ticaret platformudur. Anında teslimat, güvenli ödeme ve 7/24 destek ile oyunculara en iyi deneyimi sunar.

## ✨ Özellikler

- 🚀 **Anında Teslimat** - Satın alma sonrası kodlar anında iletiliyor
- 🔒 **Güvenli Ödeme** - SSL sertifikası ve güvenli ödeme sistemleri
- 📱 **Responsive Tasarım** - Tüm cihazlarda mükemmel görünüm
- 🌍 **Çok Dilli Destek** - Türkçe ve İngilizce dil desteği
- 🔐 **Kullanıcı Yönetimi** - Kayıt, giriş ve profil yönetimi
- 📧 **E-posta Doğrulama** - SMTP ile güvenli doğrulama
- 📊 **Admin Paneli** - Ürün ve kullanıcı yönetimi
- 🎯 **PWA Desteği** - Progressive Web App özellikleri

## 🎯 Desteklenen Oyunlar

### Valorant
- Valorant VP (Valorant Points)
- Rastgele VP Paketleri

### League of Legends
- LOL RP (Riot Points)
- Rastgele RP Paketleri

### Steam
- Steam Cüzdan Kodları
- Oyun Kodları
- Rastgele Oyun Kodları

## 🛠️ Teknolojiler

### Frontend
- **HTML5** - Modern semantic markup
- **CSS3** - Responsive design ve animasyonlar
- **JavaScript (ES6+)** - Modern JavaScript özellikleri
- **Font Awesome** - İkon kütüphanesi
- **PWA** - Progressive Web App desteği

### Backend
- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web framework
- **SQLite** - Hafif veritabanı
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Şifre hashleme
- **Nodemailer** - E-posta gönderimi
- **Swagger** - API dokümantasyonu

### Güvenlik
- **Helmet** - Güvenlik middleware'leri
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - DDoS koruması
- **Input Validation** - Veri doğrulama

## 🚀 Kurulum

### Gereksinimler
- Node.js (v16 veya üzeri)
- npm veya yarn

### Adımlar

1. **Repository'yi klonlayın**
```bash
git clone https://github.com/arincakyildiz/keyco.git
cd keyco
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Environment dosyasını oluşturun**
```bash
cp .env.example .env
```

4. **Environment değişkenlerini düzenleyin**
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./data.sqlite

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

5. **Uygulamayı başlatın**
```bash
npm start
```

6. **Tarayıcıda açın**
```
http://localhost:3000
```

## 📁 Proje Yapısı

```
keyco/
├── 📄 index.html          # Ana sayfa
├── 📄 admin.html          # Admin paneli
├── 📄 reset.html          # Şifre sıfırlama
├── 📄 verify.html         # E-posta doğrulama
├── 📄 script.js           # Frontend JavaScript
├── 📄 styles.css          # CSS stilleri
├── 📄 server.js           # Express server
├── 📄 db.js              # Veritabanı işlemleri
├── 📄 admin.js           # Admin panel JavaScript
├── 📄 sw.js              # Service Worker (PWA)
├── 📄 manifest.json      # PWA manifest
├── 📄 package.json       # NPM dependencies
└── 📄 .gitignore         # Git ignore dosyası
```

## 🔧 API Endpoints

### Kullanıcı İşlemleri
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Kullanıcı girişi
- `POST /api/auth/verify` - E-posta doğrulama
- `POST /api/auth/reset-password` - Şifre sıfırlama

### Ürün İşlemleri
- `GET /api/products` - Tüm ürünleri listele
- `GET /api/products/:id` - Ürün detayı
- `GET /api/products/category/:category` - Kategori bazlı ürünler

### Admin İşlemleri
- `GET /api/admin/products` - Admin ürün listesi
- `POST /api/admin/products` - Yeni ürün ekleme
- `PUT /api/admin/products/:id` - Ürün güncelleme
- `DELETE /api/admin/products/:id` - Ürün silme

## 🔐 Güvenlik

- **JWT Authentication** - Güvenli oturum yönetimi
- **Password Hashing** - bcrypt ile şifre koruması
- **Input Validation** - XSS ve injection koruması
- **Rate Limiting** - DDoS saldırılarına karşı koruma
- **CORS Protection** - Cross-origin güvenliği
- **Helmet Security** - Güvenlik header'ları

## 📱 PWA Özellikleri

- **Offline Çalışma** - Service Worker ile offline desteği
- **App-like Experience** - Native app benzeri deneyim
- **Push Notifications** - Bildirim desteği
- **Installable** - Ana ekrana eklenebilir

## 🌐 Tarayıcı Desteği

- ✅ Chrome (v60+)
- ✅ Firefox (v55+)
- ✅ Safari (v12+)
- ✅ Edge (v79+)

## 📊 Performans

- **Lazy Loading** - Görsel ve kaynak optimizasyonu
- **Minification** - CSS ve JS sıkıştırma
- **CDN** - Hızlı kaynak yükleme
- **Caching** - Service Worker ile önbellekleme

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje [ISC License](LICENSE) altında lisanslanmıştır.

## 📞 İletişim

- **GitHub**: [@arincakyildiz](https://github.com/arincakyildiz)
- **Proje**: [Keyco Repository](https://github.com/arincakyildiz/keyco)

## 🙏 Teşekkürler

Bu projeyi geliştirmemde yardımcı olan tüm açık kaynak topluluğuna teşekkürler!

---

⭐ **Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**
