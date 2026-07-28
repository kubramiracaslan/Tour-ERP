// routes/tourRoutes.js
const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController');
const { requireAdmin } = require('../middleware/authMiddleware');

// 1. CRM / Talep Rotaları
router.get('/tour-demands', tourController.getTourDemands);
router.post('/add-demand', tourController.addDemand);
router.post('/update-demand-status/:id', tourController.updateDemandStatus);
router.post('/update-demand/:id', requireAdmin, tourController.updateDemand); // Sadece yönetici düzenleyebilir
router.get('/export-demands-excel', tourController.exportDemandsExcel); // Excel Buton Rotaları

// 2. Kokpit / Ana Sayfa Rotaları
router.get('/', tourController.getDashboard);
router.post('/add-tour', tourController.addTour);

// 3. Detay / Operasyon Rotaları
router.get('/tour-operation/:id', tourController.getTourOperation);
router.post('/update-tour-status/:id', tourController.updateTourStatus);

// 1. Tura Şehir Ekleme Rotası (Sağ paneldeki form için)
router.post('/add-city-to-tour/:id', tourController.addCityToTour);

// 2. Şehir Operasyon Adımlarını Güncelleme Rotası (Düzenleme Modalı için)
router.post('/update-city-operation', tourController.updateCityOperation);

// 3. AJAX/Fetch İçin Dinamik Veri Rotaları (Şehre göre otel/restoran getiren API)
router.get('/api/cities/:cityId/hotels', tourController.getHotelsByCity);
router.get('/api/cities/:cityId/restaurants', tourController.getRestaurantsByCity);

router.get('/calendar', tourController.getCalendarView);
router.get('/api/guide-conflict', tourController.checkGuideConflict);

// 4. Hızlı Ekleme Modalları İçin API Rotaları (Sayfa yenilenmeden veritabanına yazan API)
router.post('/api/quick-add/hotel', tourController.quickAddHotel);
router.post('/api/quick-add/restaurant', tourController.quickAddRestaurant);

//Excel aktarımı için 
router.get('/export-tours-excel', tourController.exportToursExcel);

module.exports = router;