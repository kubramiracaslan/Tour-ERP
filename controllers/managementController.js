const ManagementModel = require('../models/managementModel');

// GET: Render Definition Page
exports.getManagementPage = async (req, res) => {
    try {
        const countries = await ManagementModel.getAllCountries();
        const agencies = await ManagementModel.getAllAgencies();
        res.render('management', {
            countries,
            agencies,
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

// POST: Update Agency (SADECE YÖNETİCİ - route'ta requireAdmin ile korunuyor)
exports.updateAgency = async (req, res) => {
    try {
        const agencyId = req.params.id;
        const { agency_name, phone, email } = req.body;

        if (!agency_name || agency_name.trim() === '') {
            return res.redirect('/management?error=invalid_agency_name');
        }

        await ManagementModel.updateAgency({
            id: agencyId,
            agency_name: agency_name.trim(),
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null
        });

        res.redirect('/management');
    } catch (error) {
        console.error('Acente güncellenirken hata:', error);
        res.status(500).send('Acente güncellenirken bir hata oluştu.');
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

// POST: Update User (SADECE YÖNETİCİ)
exports.updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { email, username, full_name, role, password } = req.body;

        if (!email || email.trim() === '' || !username || username.trim() === '') {
            return res.redirect('/users?error=invalid_user');
        }
        if (password && password.trim() !== '' && password.trim().length < 6) {
            return res.redirect('/users?error=weak_password');
        }

        // Son yöneticiyi personel rolüne düşürmeye çalışıyorsa engelle
        if (role !== 'admin') {
            const targetUser = await ManagementModel.getUserById(userId);
            if (targetUser && targetUser.role === 'admin') {
                const adminCount = await ManagementModel.countAdmins();
                if (adminCount <= 1) {
                    return res.redirect('/users?error=last_admin');
                }
            }
        }

        await ManagementModel.updateUser({
            id: userId,
            email: email.trim(),
            username: username.trim(),
            full_name: full_name ? full_name.trim() : username.trim(),
            role,
            password: password ? password.trim() : null
        });

        res.redirect('/users');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.redirect('/users?error=duplicate_username');
        }
        console.error('Kullanıcı güncellenirken hata:', error);
        res.status(500).send('Kullanıcı güncellenirken bir hata oluştu.');
    }
};

// POST: Delete User (SADECE YÖNETİCİ) - kendi hesabını silmesini ve son yöneticiyi silmesini engeller
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        if (req.session.userId && String(req.session.userId) === String(userId)) {
            return res.redirect('/users?error=cannot_delete_self');
        }

        const targetUser = await ManagementModel.getUserById(userId);
        if (targetUser && targetUser.role === 'admin') {
            const adminCount = await ManagementModel.countAdmins();
            if (adminCount <= 1) {
                return res.redirect('/users?error=last_admin');
            }
        }

        await ManagementModel.deleteUser(userId);
        res.redirect('/users');
    } catch (error) {
        console.error('Kullanıcı silinirken hata:', error);
        res.status(500).send('Kullanıcı silinirken bir hata oluştu.');
    }
};