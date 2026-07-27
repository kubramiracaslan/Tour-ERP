require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

const tourRoutes = require('./routes/tourRoutes');
const managementRoutes = require('./routes/managementRoutes');
const authRoutes = require('./routes/authRoutes');
const { requireAuth } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Oturum yönetimi
app.use(session({
    secret: process.env.SESSION_SECRET || 'lutfen-env-dosyasinda-bunu-degistir',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8, // 8 saat
        // secure: true, // HTTPS'e geçince (canlıda) bu satırı aç
    }
}));

// Her view'da kullanılabilsin diye giriş yapan kullanıcının adını ve rolünü global olarak enjekte ediyoruz
app.use((req, res, next) => {
    res.locals.currentUser = req.session ? (req.session.fullName || req.session.username || req.session.email) : null;
    res.locals.currentUserRole = req.session ? req.session.role : null;
    next();
});

// View Engine Ayarlari
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static('public'));

// Login/Logout - HERKESE AÇIK (koruma öncesi tanımlanmalı)
app.use('/', authRoutes);

// Bu satırdan sonraki HER ŞEY giriş yapmayı gerektirir
app.use(requireAuth);

// Modül Dağitimlari
app.use('/', tourRoutes);
app.use('/', managementRoutes);

// Server Başlat
app.listen(PORT, () => {
    console.log(`Kurumsal ERP Sunucusu Hazir: http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------
// WHATSAPP
// Yeni şirket hattı gelene kadar bu blok hiç çalışmasın diye .env'deki
// WHATSAPP_ENABLED bayrağının arkasına aldık. Hat gelip QR'ı taratacağın
// gün .env'de WHATSAPP_ENABLED=true yapman yeterli, kodda başka hiçbir
// değişiklik gerekmiyor.
// ---------------------------------------------------------------------
global.whatsappClient = null;
global.whatsappReady = false;

if (process.env.WHATSAPP_ENABLED === 'true') {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');

    const whatsappClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    whatsappClient.on('qr', (qr) => {
        console.log('WhatsApp Bağlantisi İçin QR Kodu Telefonunuzdan Taratin:');
        qrcode.generate(qr, { small: true });
    });

    whatsappClient.on('ready', () => {
        console.log('WhatsApp Web Bağlantisi Başariyla Sağlandi, Mesaj Gönderimine Hazir!');
        global.whatsappReady = true;
    });

    whatsappClient.on('disconnected', () => {
        console.warn('WhatsApp Web bağlantısı koptu.');
        global.whatsappReady = false;
    });

    whatsappClient.initialize();
    global.whatsappClient = whatsappClient;
} else {
    console.log('[WhatsApp] WHATSAPP_ENABLED=false, entegrasyon devre dışı (hat bekleniyor).');
}