// Kullanım (proje kök dizininde):
//   node scripts/createUser.js <kullanici_adi> <email> <parola> "[Ad Soyad]" [admin|staff]
//
// Örnek:
//   node scripts/createUser.js kubra kubra@incidmcturizm.com "GucluBirSifre123" "Kübra Aslan" admin

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

async function createUser() {
    const [, , username, email, password, fullName, role] = process.argv;

    if (!username || !email || !password) {
        console.log('Kullanım: node scripts/createUser.js <kullanici_adi> <email> <parola> "[Ad Soyad]" [admin|staff]');
        process.exit(1);
    }

    const userRole = role === 'admin' ? 'admin' : 'staff';
    const passwordHash = await bcrypt.hash(password, 10);

    await db.execute(
        'INSERT INTO users (email, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [email, username, passwordHash, fullName || username, userRole]
    );

    console.log(`✅ Kullanıcı oluşturuldu: ${username} (${email}) - rol: ${userRole}`);
    process.exit(0);
}

createUser().catch(err => {
    console.error('❌ Kullanıcı oluşturulurken hata:', err.message);
    process.exit(1);
});