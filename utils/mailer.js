const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465, // 465 ise SSL/TLS, 587 ise STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Talep "Üzerinde Çalışılıyor" durumuna geçince acenteye bilgilendirme maili atar.
// demand: { id, demand_name, agency_name, email, ... } (bkz. TourModel.getDemandWithAgencyById)
exports.sendDemandInProgressEmail = async (demand) => {
    if (!demand.email) {
        console.warn(`[Mail] Talep #${demand.id} için acente e-postası bulunamadı, mail gönderilmedi.`);
        return;
    }

    const mailOptions = {
        from: `"Operasyon Takip Sistemi" <${process.env.EMAIL_USER}>`,
        to: demand.email,
        subject: `Talebiniz Üzerinde Çalışılıyor - ${demand.demand_name}`,
        html: `
            <p>Sayın ${demand.agency_name || 'Yetkili'},</p>
            <p><strong>${demand.demand_name}</strong> talebiniz üzerinde çalışmaya başladık.</p>
            <p>En kısa sürede size dönüş yapacağız.</p>
            <p>Saygılarımızla,<br>İnci DMC Turizm Operasyon Ekibi</p>
        `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Mail] Talep #${demand.id} için bilgilendirme maili gönderildi -> ${demand.email}`);
};