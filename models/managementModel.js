const db = require('../db');
const bcrypt = require('bcryptjs');

exports.getAllCountries = async () => {
    const [rows] = await db.execute('SELECT * FROM countries ORDER BY country_name ASC');
    return rows;
};

exports.insertCountry = async (country_name) => {
    const [result] = await db.execute(
        'INSERT INTO countries (country_name) VALUES (?)',
        [country_name]
    );
    return result.insertId;
};

exports.insertCity = async (city_name, country_id) => {
    const [result] = await db.execute(
        'INSERT INTO cities (city_name, country_id) VALUES (?, ?)',
        [city_name, country_id]
    );
    return result.insertId;
};

exports.insertAgency = async ({ agency_name, phone, email }) => {
    const [result] = await db.execute(
        'INSERT INTO agencies (agency_name, phone, email) VALUES (?, ?, ?)',
        [agency_name, phone || null, email || null]
    );
    return result.insertId;
};

exports.getAllAgencies = async () => {
    const [rows] = await db.execute(
        'SELECT id, agency_name, phone, email FROM agencies ORDER BY agency_name ASC'
    );
    return rows;
};

exports.updateAgency = async ({ id, agency_name, phone, email }) => {
    await db.execute(
        'UPDATE agencies SET agency_name = ?, phone = ?, email = ? WHERE id = ?',
        [agency_name, phone || null, email || null, id]
    );
};

exports.insertGuide = async ({ guide_name, phone, email, guide_type }) => {
    const [result] = await db.execute(
        'INSERT INTO guides (guide_name, phone, email, guide_type) VALUES (?, ?, ?, ?)',
        [guide_name, phone, email || null, guide_type]
    );
    return result.insertId;
};

// Sadece yönetici rolündeki kullanıcılar çağırabilir (kontrol controller'da yapılıyor)
exports.insertUser = async ({ email, username, password, full_name, role }) => {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
        'INSERT INTO users (email, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [email, username, passwordHash, full_name || username || email, role === 'admin' ? 'admin' : 'staff']
    );
    return result.insertId;
};

exports.getAllUsers = async () => {
    const [rows] = await db.execute(
        'SELECT id, email, username, full_name, role, created_at FROM users ORDER BY email ASC'
    );
    return rows;
};

exports.getUserById = async (id) => {
    const [rows] = await db.execute(
        'SELECT id, email, username, full_name, role FROM users WHERE id = ?',
        [id]
    );
    return rows[0] || null;
};

// password verilmişse (boş değilse) parolayı da günceller, verilmemişse eski parola korunur
exports.updateUser = async ({ id, email, username, full_name, role, password }) => {
    const safeRole = role === 'admin' ? 'admin' : 'staff';
    const safeFullName = full_name || username || email;

    if (password && password.trim() !== '') {
        const passwordHash = await bcrypt.hash(password, 10);
        await db.execute(
            'UPDATE users SET email = ?, username = ?, full_name = ?, role = ?, password_hash = ? WHERE id = ?',
            [email, username, safeFullName, safeRole, passwordHash, id]
        );
    } else {
        await db.execute(
            'UPDATE users SET email = ?, username = ?, full_name = ?, role = ? WHERE id = ?',
            [email, username, safeFullName, safeRole, id]
        );
    }
};

exports.deleteUser = async (id) => {
    await db.execute('DELETE FROM users WHERE id = ?', [id]);
};

exports.countAdmins = async () => {
    const [rows] = await db.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'");
    return rows[0].cnt;
};