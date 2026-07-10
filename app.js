require('dotenv').config();
const express = require('express');
const path = require('path');

const tourRoutes = require('./routes/tourRoutes');
const managementRoutes = require('./routes/managementRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View Engine Ayarlari
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static('public'));
// Modül Dağitimlari
app.use('/', tourRoutes);
app.use('/', managementRoutes);

// Server Başlat
app.listen(PORT, () => {
    console.log(`Kurumsal ERP Sunucusu Hazir: http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------
// WHATSAPP---UNUTMA
// Yeni şirket hattı gelene kadar bu blok hiç çalışmasın diye .env'deki
// WHATSAPP_ENABLED bayrağının arkasına aldım. Hat gelip QR'ı taratacağım
// gün .env'de WHATSAPP_ENABLED=true yapmam yeterli, kodda başka hiçbir
// değişiklik gerekmiyor.
// ---------------------------------------------------------------------
global.whatsappClient = null;
global.whatsappReady = false;

if (process.env.WHATSAPP_ENABLED === 'true') {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');

    const whatsappClient = new Client({
        authStrategy: new LocalAuth(), // Oturum bilgilerini kaydeder, her seferinde QR kod okutmazsin
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Sunucu uyumluluğu için
        }
    });

    // Terminale QR Kod Basma Etkinliği
    whatsappClient.on('qr', (qr) => {
        console.log('WhatsApp Bağlantisi İçin QR Kodu Telefonunuzdan Taratin:');
        qrcode.generate(qr, { small: true });
    });

    // Bağlanti Başarili Olduğunda
    whatsappClient.on('ready', () => {
        console.log('WhatsApp Web Bağlantisi Başariyla Sağlandi, Mesaj Gönderimine Hazir!');
        global.whatsappReady = true;
    });

    // Bağlantı koparsa bayrağı geri düşür
    whatsappClient.on('disconnected', () => {
        console.warn('WhatsApp Web bağlantısı koptu.');
        global.whatsappReady = false;
    });

    // WhatsApp'i Başlat
    whatsappClient.initialize();

    // Diğer controller/util dosyalarından bu istemciye erişebilmek için global değişkene atıldı
    global.whatsappClient = whatsappClient;
} else {
    console.log('[WhatsApp] WHATSAPP_ENABLED=false, entegrasyon devre dışı (hat bekleniyor).');
}