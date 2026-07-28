const express = require('express');
const router = express.Router();
const managementController = require('../controllers/managementController');
const { requireAdmin } = require('../middleware/authMiddleware');

router.get('/management', requireAdmin, managementController.getManagementPage);
router.post('/add-country', requireAdmin, managementController.addCountry);
router.post('/add-city', requireAdmin, managementController.addCity);
// NOT: /add-agency bilerek requireAdmin'siz bırakıldı - Talep Takip sayfasındaki
// hızlı "Acente Ekle" modalı da bu endpoint'i kullanıyor ve personelin o modalı
// kullanabilmesi gerekiyor. Sadece Temel Tanımlamalar SAYFASI yönetici-özel.
router.post('/add-agency', managementController.addAgency);
router.post('/update-agency/:id', requireAdmin, managementController.updateAgency);
router.post('/add-guide', requireAdmin, managementController.addGuide);

router.get('/users', requireAdmin, managementController.getUsersPage);
router.post('/add-user', requireAdmin, managementController.addUser);
router.post('/update-user/:id', requireAdmin, managementController.updateUser);
router.post('/delete-user/:id', requireAdmin, managementController.deleteUser);

module.exports = router;