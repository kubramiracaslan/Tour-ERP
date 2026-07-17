// Hat henüz aktif değil. .env'de WHATSAPP_ENABLED=false olduğu sürece bu
// fonksiyon sadece konsola log basar, hiçbir dış servise istek atmaz.
//
// Hat geldiğinde yapmam gerekenler:
//   1) .env dosyasına WHATSAPP_ENABLED=true eklenecek
//   2) Aşağıdaki SEÇENEK A (Twilio) ya da SEÇENEK B (Meta Cloud API)
//      bloklarından hangisini kullanacaksak yorum işareti
//   3) İlgili .env değişkenleri (TWILIO_* ya da META_*) doldurulacak

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

// demand: { id, demand_name, agency_name, phone, ... } (bkz. TourModel.getDemandWithAgencyById)
exports.sendDemandInProgressWhatsapp = async (demand) => {
    const messageBody = `Merhaba ${demand.agency_name || ''}, "${demand.demand_name}" talebiniz üzerinde çalışılmaya başlandı.`;

    if (!WHATSAPP_ENABLED) {
        console.log(`[WhatsApp] Hat henüz aktif değil (WHATSAPP_ENABLED=false). Gönderilecek mesaj: "${messageBody}"`);
        return;
    }

    if (!demand.phone) {
        console.warn(`[WhatsApp] Talep #${demand.id} için acente telefonu bulunamadı, mesaj gönderilmedi.`);
        return;
    }

    // -----------------------------------------------------------------
    // SEÇENEK A: Twilio WhatsApp API
    // Gerekli .env: TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
    // Kurulum: npm install twilio
    // -----------------------------------------------------------------
    // const twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilioClient.messages.create({
    //     from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    //     to: `whatsapp:${demand.phone}`,
    //     body: messageBody
    // });
    // console.log(`[WhatsApp/Twilio] Talep #${demand.id} için mesaj gönderildi -> ${demand.phone}`);
    // return;

    // -----------------------------------------------------------------
    // SEÇENEK B: WhatsApp Business Platform (Meta Cloud API)
    // Gerekli .env: META_PHONE_NUMBER_ID, META_WHATSAPP_TOKEN
    // Node 18+ ise fetch zaten global, ekstra paket gerekmez.
    // -----------------------------------------------------------------
    // const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
    //     method: 'POST',
    //     headers: {
    //         'Authorization': `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({
    //         messaging_product: 'whatsapp',
    //         to: demand.phone,
    //         type: 'text',
    //         text: { body: messageBody }
    //     })
    // });
    // if (!response.ok) {
    //     throw new Error(`Meta WhatsApp API hatası: ${response.status}`);
    // }
    // console.log(`[WhatsApp/Meta] Talep #${demand.id} için mesaj gönderildi -> ${demand.phone}`);
    // return;

    console.warn('[WhatsApp] WHATSAPP_ENABLED=true ama SEÇENEK A/B kodları henüz açılmamış. Yukarıdaki yorum satırlarını doldur.');
};