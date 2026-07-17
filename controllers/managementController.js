const ManagementModel = require('../models/managementModel');

// GET: Render Definition Page
exports.getManagementPage = async (req, res) => {
    try {
        const countries = await ManagementModel.getAllCountries();
        res.render('management', {
            countries,
            page_path: '/management',
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Tanımlamalar sayfası yüklenirken hata:', error);
        res.status(500).send('Tanımlamalar sayfası yüklenirken bir hata oluştu.');
    }
};

// POST: Save Country
exports.addCountry = async (req, res) => {
    try {
        const { country_name } = req.body;
        if (!country_name || country_name.trim() === '') {
            return res.redirect('/management?error=invalid_country_name');
        }
        await ManagementModel.insertCountry(country_name.trim());
        res.redirect('/management');
    } catch (error) {
        console.error('Ülke kaydetme hatası:', error);
        res.status(500).send('Ülke kaydedilirken bir hata oluştu.');
    }
};

// POST: Save City
exports.addCity = async (req, res) => {
    try {
        const { city_name, country_id } = req.body;
        if (!city_name || city_name.trim() === '' || !country_id) {
            return res.redirect('/management?error=invalid_city');
        }
        await ManagementModel.insertCity(city_name.trim(), country_id);
        res.redirect('/management');
    } catch (error) {
        console.error('Şehir kaydetme hatası:', error);
        res.status(500).send('Şehir kaydedilirken bir hata oluştu.');
    }
};

// POST: Save Agency
exports.addAgency = async (req, res) => {
    try {
        // Not: Form alan isimlerini standartlaştırdık -> her yerde snake_case (agency_name)
        const { agency_name, phone, email } = req.body;

        if (!agency_name || agency_name.trim() === '') {
            return res.redirect('/tour-demands?error=invalid_agency_name');
        }

        await ManagementModel.insertAgency({
            agency_name: agency_name.trim(),
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null
        });

        res.redirect('/tour-demands');
    } catch (error) {
        console.error('Acente kaydetme hatası:', error);
        res.status(500).send('Acente kaydedilirken bir hata oluştu.');
    }
};

// POST: Save Guide
exports.addGuide = async (req, res) => {
    try {
        const { guide_name, phone, guide_type } = req.body;
        if (!guide_name || guide_name.trim() === '') {
            return res.redirect('/management?error=invalid_guide_name');
        }
        await ManagementModel.insertGuide({ guide_name: guide_name.trim(), phone, guide_type });
        res.redirect('/management');
    } catch (error) {
        console.error('Rehber kaydetme hatası:', error);
        res.status(500).send('Rehber kaydedilirken bir hata oluştu.');
    }
};