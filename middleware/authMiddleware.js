exports.requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.redirect('/login');
};

// Sadece 'admin' rolündeki kullanıcıların geçebileceği kontrol noktası.
// requireAuth'tan sonra kullandım çünkü (önce giriş yapmış mı, sonra admin mi diye bakar).
exports.requireAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    return res.status(403).send('Bu işlem için yönetici yetkisi gerekiyor.');
};