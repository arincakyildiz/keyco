SMTP ayarlari icin proje kokunde .env dosyasi olusturun ve asagidaki degiskenleri doldurun:

SMTP_HOST=smtp.ornek.com
SMTP_PORT=587
SMTP_USER=ornek@ornek.com
SMTP_PASS=uygun_sifre
SMTP_FROM=Keyco <ornek@ornek.com>
SMTP_TO=destek@ornek.com

Notlar:
- 465 portu icin secure true olur (otomatik algilaniyor). 587/25 icin STARTTLS kullanilir.
- Gonderim basarisiz olursa API yine 200 dondurur ve server loguna uyarı yazar.

