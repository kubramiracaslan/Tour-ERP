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

// View Engine Ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static('public'));
// Modül Dağıtımları
app.use('/', tourRoutes);
app.use('/', managementRoutes);

// Server Başlat
app.listen(PORT, () => {
    console.log(`🚀 Kurumsal ERP Sunucusu Hazır: http://localhost:${PORT}`);
});