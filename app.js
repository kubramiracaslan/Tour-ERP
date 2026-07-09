require('dotenv').config();
const express = require('express');
const path = require('path');

const tourRoutes = require('./routes/tourRoutes');
const managementRoutes = require('./routes/managementRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const whatsappClient = new Client({
    authStrategy: new LocalAuth(), // Oturum bilgilerini kaydeder, her seferinde QR kod okutmazsin
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Sunucu uyumluluğu için
    }
});

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

// WHATSAPP
// Terminale QR Kod Basma Etkinliği
whatsappClient.on('qr', (qr) => {
    console.log('WhatsApp Bağlantisi İçin QR Kodu Telefonunuzdan Taratin:');
    qrcode.generate(qr, { small: true });
});

// Bağlanti Başarili Olduğunda
whatsappClient.on('ready', () => {
    console.log('WhatsApp Web Bağlantisi Başariyla Sağlandi, Mesaj Gönderimine Hazir!');
});

// WhatsApp'i Başlat
whatsappClient.initialize();

// Diğer controller dosyalarindan bu istemciye erişebilmek için global değişkene atildi
global.whatsappClient = whatsappClient;
