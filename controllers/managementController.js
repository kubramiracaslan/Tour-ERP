const db = require('../db');

// GET: Render Definition Page
exports.getManagementPage = async (req, res) => {
    try {
        const [countries] = await db.execute('SELECT * FROM countries ORDER BY country_name ASC');
        res.render('management', { countries , page_path: '/management'});
    } catch (error) {
        res.status(500).send('Error loading management page: ' + error.message);
    }
};

// POST: Save Country
exports.addCountry = async (req, res) => {
    try {
        const { country_name } = req.body;
        await db.execute('INSERT INTO countries (country_name) VALUES (?)', [country_name]);
        res.redirect('/management');
    } catch (error) {
        res.status(500).send('Error saving country: ' + error.message);
    }
};

// POST: Save City
exports.addCity = async (req, res) => {
    try {
        const { city_name, country_id } = req.body;
        await db.execute('INSERT INTO cities (city_name, country_id) VALUES (?, ?)', [city_name, country_id]);
        res.redirect('/management');
    } catch (error) {
        res.status(500).send('Error saving city: ' + error.message);
    }
};

// POST: Save Agency
exports.addAgency = async (req, res) => {
    try {
        const agencyName = req.body.agency_name || req.body.agencyName;
        const phone = req.body.phone;
        const email = req.body.email;

        if (!agencyName || agencyName.trim() === "") {
            return res.send('<script>alert("Lütfen geçerli bir acente adı giriniz!"); window.history.back();</script>');
        }

        // Sorguyu yeni kolonlara göre güncelledik
        const query = 'INSERT INTO agencies (agency_name, phone, email) VALUES (?, ?, ?)';
        await db.execute(query, [
            agencyName.trim(), 
            phone ? phone.trim() : null, 
            email ? email.trim() : null
        ]);

        res.redirect('/tour-demands');
    } catch (error) {
        console.error("Acente kaydetme hatası:", error);
        res.status(500).send('Error saving agency: ' + error.message);
    }
};

// POST: Save Guide
exports.addGuide = async (req, res) => {
    try {
        const { guide_name, phone, guide_type } = req.body;
        await db.execute('INSERT INTO guides (guide_name, phone, guide_type) VALUES (?, ?, ?)', [guide_name, phone, guide_type]);
        res.redirect('/management');
    } catch (error) {
        res.status(500).send('Error saving guide: ' + error.message);
    }
};

