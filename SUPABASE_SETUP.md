# Supabase Kurulum Rehberi

## 1. Supabase Projesi Oluşturma

1. [Supabase](https://supabase.com) sitesine gidin
2. "Start your project" butonuna tıklayın
3. GitHub ile giriş yapın
4. Yeni bir proje oluşturun
5. Proje adı: `keyco` (veya istediğiniz bir isim)
6. Database password seçin (güçlü bir şifre)
7. Region seçin (en yakın bölgeyi seçin)

## 2. Database Migration

1. Supabase Dashboard'a gidin
2. Sol menüden **SQL Editor**'ı seçin
3. **New Query** butonuna tıklayın
4. `supabase-migration.sql` dosyasının içeriğini kopyalayıp yapıştırın
5. **Run** butonuna tıklayın
6. Tüm tablolar oluşturulacak

**Tabloları kontrol etmek için:**
Supabase SQL Editor'da şu sorguyu çalıştırın (sadece SQL kodunu kopyalayın, ```sql işaretlerini kopyalamayın):

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

Bu sorgu tüm oluşturulan tabloları listeler.

## 3. API Keys Alma

1. Supabase Dashboard'da sol menüden **Settings** > **API**'ye gidin
2. Şu bilgileri kopyalayın:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (gizli tutun!)

## 4. Environment Variables Ayarlama

Vercel'de veya local'de `.env` dosyası oluşturun:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Other configs...
JWT_SECRET=dev_secret_change_me
PORT=5500
```

## 5. Vercel'de Environment Variables

1. Vercel Dashboard'a gidin
2. Projenizi seçin
3. **Settings** > **Environment Variables**'a gidin
4. Şu değişkenleri ekleyin:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - Diğer gerekli değişkenler

## 6. Paketleri Yükleme

```bash
npm install
```

## 7. Test Etme

```bash
npm start
```

Artık Supabase kullanıyor olmalısınız! 🎉

## Notlar

- **Service Role Key**: Sadece backend'de kullanın, asla frontend'e göndermeyin!
- **Anon Key**: Frontend'de kullanılabilir (Row Level Security ile korunur)
- **Row Level Security**: İsterseniz Supabase Dashboard'dan RLS politikaları ekleyebilirsiniz

