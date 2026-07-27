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

// GET: Kullanıcı Yönetimi sayfası (route tarafında requireAdmin ile korunuyor)
exports.getUsersPage = async (req, res) => {
    try {
        const users = await ManagementModel.getAllUsers();
        res.render('users', {
            users,
            page_path: '/users',
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Kullanıcılar sayfası yüklenirken hata:', error);
        res.status(500).send('Kullanıcılar sayfası yüklenirken bir hata oluştu.');
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
        // redirect_to: formun hangi sayfadan gönderildiğini belirtir (management ya da tour-demands)
        // Yoksa (eski bir form/istek gelirse) güvenli varsayılan olarak tour-demands'e döner.
        const { agency_name, phone, email, redirect_to } = req.body;
        const returnTo = redirect_to || '/tour-demands';

        if (!agency_name || agency_name.trim() === '') {
            return res.redirect(`${returnTo}?error=invalid_agency_name`);
        }

        await ManagementModel.insertAgency({
            agency_name: agency_name.trim(),
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null
        });

        res.redirect(returnTo);
    } catch (error) {
        console.error('Acente kaydetme hatası:', error);
        res.status(500).send('Acente kaydedilirken bir hata oluştu.');
    }
};

// POST: Save Guide
exports.addGuide = async (req, res) => {
    try {
        const { guide_name, phone, email, guide_type } = req.body;
        if (!guide_name || guide_name.trim() === '') {
            return res.redirect('/management?error=invalid_guide_name');
        }
        await ManagementModel.insertGuide({
            guide_name: guide_name.trim(),
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null,
            guide_type
        });
        res.redirect('/management');
    } catch (error) {
        console.error('Rehber kaydetme hatası:', error);
        res.status(500).send('Rehber kaydedilirken bir hata oluştu.');
    }
};

// POST: Save User (SADECE YÖNETİCİ) - route tarafında requireAdmin ile ayrıca korunuyor
exports.addUser = async (req, res) => {
    try {
        const { email, username, password, full_name, role } = req.body;

        if (!email || email.trim() === '' || !username || username.trim() === '' || !password || password.trim() === '') {
            return res.redirect('/users?error=invalid_user');
        }
        if (password.trim().length < 6) {
            return res.redirect('/users?error=weak_password');
        }

        await ManagementModel.insertUser({
            email: email.trim(),
            username: username.trim(),
            password: password.trim(),
            full_name: full_name ? full_name.trim() : username.trim(),
            role
        });

        res.redirect('/users');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.redirect('/users?error=duplicate_username');
        }
        console.error('Kullanıcı eklenirken hata:', error);
        res.status(500).send('Kullanıcı eklenirken bir hata oluştu.');
    }
};