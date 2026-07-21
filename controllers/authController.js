const bcrypt = require('bcryptjs');
const db = require('../db');

exports.showLoginPage = (req, res) => {
    // Zaten giriş yapmışsa tekrar login ekranı göstermeye gerek yok
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', { error: req.query.error || null });
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.redirect('/login?error=missing');
        }

        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username.trim()]);
        const user = rows[0];

        if (!user) {
            return res.redirect('/login?error=invalid');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.redirect('/login?error=invalid');
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.fullName = user.full_name;

        res.redirect('/');
    } catch (error) {
        console.error('Giriş yapılırken hata:', error);
        res.redirect('/login?error=server');
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};