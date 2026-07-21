require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');
 
async function createUser() {
    const [, , username, password, fullName] = process.argv;
 
    if (!username || !password) {
        console.log('Kullanım: node scripts/createUser.js <kullanici_adi> <parola> "[Ad Soyad]"');
        process.exit(1);
    }
 
    const passwordHash = await bcrypt.hash(password, 10);
 
    await db.execute(
        'INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)',
        [username, passwordHash, fullName || username]
    );
 
    console.log(`✅ Kullanıcı oluşturuldu: ${username}`);
    process.exit(0);
}
 
createUser().catch(err => {
    console.error('❌ Kullanıcı oluşturulurken hata:', err.message);
    process.exit(1);
});