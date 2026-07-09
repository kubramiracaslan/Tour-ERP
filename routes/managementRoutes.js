const express = require('express');
const router = express.Router();
const managementController = require('../controllers/managementController');

router.get('/management', managementController.getManagementPage);
router.post('/add-country', managementController.addCountry);
router.post('/add-city', managementController.addCity);
router.post('/add-agency', managementController.addAgency);
router.post('/add-guide', managementController.addGuide);

module.exports = router;