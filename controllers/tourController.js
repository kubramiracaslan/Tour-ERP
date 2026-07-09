const db = require('../db');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');

// =========================================================================
// 1. MODÜL: Talep Takip Sayfası (CRM)
// =========================================================================
exports.getTourDemands = async (req, res) => {
    try {
        const query = `
            SELECT td.*, a.agency_name, a.phone, a.email 
            FROM tour_demands td
            LEFT JOIN agencies a ON td.agency_id = a.id
            ORDER BY td.first_contact_date DESC
        `;
        const [demands] = await db.execute(query);
        const [agencies] = await db.execute('SELECT id, agency_name FROM agencies ORDER BY agency_name ASC');

        res.render('tour-demands', { demands, agencies, page_path: '/tour-demands'});
    } catch (error) {
        res.status(500).send('Talep Takip Sayfası Yüklenirken Hata: ' + error.message);
    }
};

exports.addDemand = async (req, res) => {
    try {
        const { demand_name, agency_id, first_contact_date, offer_date, offered_price, currency } = req.body;
        const query = `
            INSERT INTO tour_demands (demand_name, agency_id, first_contact_date, offer_date, offered_price, currency, status)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
        `;
        await db.execute(query, [
            demand_name, agency_id || null, first_contact_date || null, 
            offer_date || null, offered_price || null, currency || 'EUR'
        ]);
        res.redirect('/tour-demands');
    } catch (error) {
        res.status(500).send('Talep kaydedilirken hata oluştu: ' + error.message);
    }
};

exports.updateDemandStatus = async (req, res) => {
    try {
        const demandId = req.params.id;
        const { status, rejection_reason } = req.body;

        // 1. Veritabanında durum güncellemesini yap
        await db.execute('UPDATE tour_demands SET status = ?, rejection_reason = ? WHERE id = ?', [
            status, 
            status === 'REJECTED' ? rejection_reason : null, 
            demandId
        ]);

        // 2. Eğer yeni durum "IN_PROGRESS" (Talep Üzerinde Çalışılıyor) ise mail tetikle
        if (status === 'IN_PROGRESS') {
            // Talebi getiren acentenin e-posta bilgisini ve talep adını çek
            const [demandRows] = await db.execute(`
                SELECT td.demand_name, a.agency_name, a.email 
                FROM tour_demands td
                LEFT JOIN agencies a ON td.agency_id = a.id
                WHERE td.id = ?
            `, [demandId]);

            const demandInfo = demandRows[0];

            // Acentenin e-postası sistemde tanımlıysa mail gönderimini başlat
            if (demandInfo && demandInfo.email && demandInfo.email.trim() !== "" && demandInfo.email !== '-') {
                
                // Mail sunucusu (SMTP) yapılandırması (.env dosyasından okur)
                const transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST,
                    port: parseInt(process.env.EMAIL_PORT) || 587,
                    secure: false, // 587 portu için false, 465 için true olmalı
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    },
                    tls: {
                        rejectUnauthorized: false // Şirket sertifikalarında hata oluşmasını engeller
                    }
                });

                // Kurumsal e-posta içeriği (HTML formatında)
                const mailOptions = {
                    from: `"Operasyon Takip Sistemi" <${process.env.EMAIL_USER}>`,
                    to: demandInfo.email,
                    subject: `Talep Bilgilendirmesi: ${demandInfo.demand_name}`,
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #0369a1; border-bottom: 2px solid #0369a1; padding-bottom: 10px;">Sayın ${demandInfo.agency_name} Yetkilisi,</h2>
                            <p style="font-size: 16px; line-height: 1.6;">
                                 İletmiş olduğunuz <strong>"${demandInfo.demand_name}"</strong> isimli tur / organizasyon talebiniz operasyon ekibimiz tarafından incelenmeye alınmış olup, 
                                <span style="color: #0369a1; font-weight: bold;">üzerinde çalışılmaya başlanmıştır.</span>
                            </p>
                            <p style="font-size: 15px; line-height: 1.6; background-color: #f0f9ff; padding: 12px; border-left: 4px solid #0369a1; border-radius: 4px;">
                                En kısa sürede detaylı program ve fiyat teklifimiz tarafınıza ulaştırılacaktır.
                            </p>
                            <p style="font-size: 14px; margin-top: 30px; color: #777; border-top: 1px solid #eeeeee; padding-top: 10px;">
                                İyi çalışmalar dileriz,<br>
                                <strong>İnci DMC Turizm</strong>
                            </p>
                        </div>
                    `
                };

                // E-postayı arka planda gönder (Kullanıcıyı bekletmemek için asenkron olarak yürüt)
                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.error("Acenteye bilgilendirme maili gönderilirken hata oluştu:", err);
                    } else {
                        console.log(`✉️ Acenteye bilgilendirme maili başarıyla gönderildi: ${demandInfo.email}`);
                    }
                });
            } else {
                console.log(`⚠️ Talep No ${demandId} için geçerli bir acente e-postası bulunamadığından mail gönderilmedi.`);
            }
        }

        // İşlem tamamlanınca sayfayı yenile
        res.redirect('/tour-demands');
    } catch (error) {
        res.status(500).send('Talep güncellenirken hata oluştu: ' + error.message);
    }
};

// =========================================================================
// 2. MODÜL: Aktif Turlar & Finans Kokpiti (Ana Sayfa)
// =========================================================================
exports.getDashboard = async (req, res) => {
    try {
        const selectedYear = req.query.year || null;
        const selectedMonth = req.query.month || null;

        let tourQuery = `
            SELECT t.*, a.agency_name, g.guide_name,
            (SELECT COUNT(om.id) FROM operation_management om WHERE om.tour_id = t.id) as city_count,
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'city_name', c.city_name,
                        'hotel_status', om.hotel_status,
                        'restaurant_status', om.restaurant_status,
                        'general_guide_status', om.general_guide_status,
                        'local_guide_status', om.local_guide_status,
                        'local_guide_name', lg.guide_name,
                        'general_guide_name', gg.guide_name,
                        'hotel_names', (SELECT GROUP_CONCAT(hotel_name SEPARATOR ', ') FROM hotels WHERE FIND_IN_SET(id, om.hotel_id)),
                        'restaurant_names', (SELECT GROUP_CONCAT(restaurant_name SEPARATOR ', ') FROM restaurants WHERE FIND_IN_SET(id, om.restaurant_id))
                    )
                )
                FROM operation_management om
                JOIN cities c ON om.city_id = c.id
                LEFT JOIN guides lg ON om.local_guide_id = lg.id
                LEFT JOIN guides gg ON om.general_guide_id = gg.id
                WHERE om.tour_id = t.id
            ) as cities_json
            FROM tours t
            LEFT JOIN agencies a ON t.agency_id = a.id
            LEFT JOIN guides g ON t.main_guide_id = g.id
        `;

        const queryParams = [];
        if (selectedYear && selectedMonth) {
            tourQuery += ` WHERE t.year = ? AND t.month = ? `;
            queryParams.push(selectedYear, selectedMonth);
        }
        tourQuery += ` ORDER BY t.start_date ASC `;

        const [tourRows] = await db.execute(tourQuery, queryParams);
        const [agencies] = await db.execute('SELECT id, agency_name FROM agencies ORDER BY agency_name ASC');
        const [guides] = await db.execute('SELECT id, guide_name FROM guides ORDER BY guide_name ASC');
        const [cities] = await db.execute('SELECT id, city_name FROM cities ORDER BY city_name ASC');

        const operations = tourRows.map(row => ({
            ...row,
            operation_name: row.tour_name,
            cities: row.cities_json ? (typeof row.cities_json === 'string' ? JSON.parse(row.cities_json) : row.cities_json) : []
        }));

        res.render('index', { operations, agencies, guides, cities, selectedYear: selectedYear || '', selectedMonth: selectedMonth || '', page_path: '/' });
    } catch (error) {
        res.status(500).send('Kokpit Yükleme Hatası: ' + error.message);
    }
};

exports.addTour = async (req, res) => {
    try {
        const { 
            tour_name, start_date, end_date, agency_id, 
            main_guide_id, transport_status, payment_received, 
            payment_paid, city_ids 
        } = req.body;

        const dateObj = new Date(start_date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;

        const insertQuery = `
            INSERT INTO tours (tour_name, start_date, end_date, year, month, agency_id, main_guide_id, transport_status, payment_received, payment_paid) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [tourResult] = await db.execute(insertQuery, [
            tour_name, start_date, end_date, year, month, agency_id || null, main_guide_id || null, transport_status, payment_received, payment_paid
        ]);
        
        const newTourId = tourResult.insertId;

        if (city_ids && Array.isArray(city_ids) && city_ids.length > 0) {
            const insertOpQuery = `
                INSERT INTO operation_management 
                (tour_id, city_id, general_guide_id, general_guide_status, local_guide_status, hotel_status, restaurant_status) 
                VALUES (?, ?, ?, 'PENDING', 'PENDING', 'PENDING', 'PENDING')
            `;
            for (const cityId of city_ids) {
                await db.execute(insertOpQuery, [newTourId, cityId, main_guide_id || null]);
            }
        }
        
        res.redirect(`/?year=${year}&month=${month}`);
    } catch (error) {
        res.status(500).send('Tur Kaydedilirken Hata Oluştu: ' + error.message);
    }
};

// =========================================================================
// 3. MODÜL: Tekil Tur İç Operasyon Sayfası
// =========================================================================
exports.getTourOperation = async (req, res) => {
    try {
        const tourId = req.params.id;

        const [tourRows] = await db.execute(`
            SELECT t.*, a.agency_name, g.guide_name FROM tours t
            LEFT JOIN agencies a ON t.agency_id = a.id
            LEFT JOIN guides g ON t.main_guide_id = g.id
            WHERE t.id = ?
        `, [tourId]);

        if (tourRows.length === 0) return res.status(404).send('Tur bulunamadı!');

        const [managementRows] = await db.execute(`
            SELECT om.*, c.city_name, 
                    lg.guide_name as local_guide_name,
                    gg.guide_name as general_guide_name,
                    (SELECT GROUP_CONCAT(hotel_name SEPARATOR ', ') FROM hotels WHERE FIND_IN_SET(id, om.hotel_id)) as hotel_names,
                    (SELECT GROUP_CONCAT(restaurant_name SEPARATOR ', ') FROM restaurants WHERE FIND_IN_SET(id, om.restaurant_id)) as restaurant_names
            FROM operation_management om
            JOIN cities c ON om.city_id = c.id
            LEFT JOIN guides lg ON om.local_guide_id = lg.id
            LEFT JOIN guides gg ON om.general_guide_id = gg.id
            WHERE om.tour_id = ?
        `, [tourId]);

        const [allCities] = await db.execute('SELECT id, city_name FROM cities ORDER BY city_name ASC');
        const [generalGuides] = await db.execute('SELECT id, guide_name FROM guides WHERE guide_type = "GENERAL" ORDER BY guide_name ASC');
        const [localGuides] = await db.execute('SELECT id, guide_name FROM guides WHERE guide_type = "LOCAL" ORDER BY guide_name ASC');

        res.render('tour-operation', { 
            tour: tourRows[0], 
            managedCities: managementRows, 
            allCities, 
            generalGuides, 
            localGuides,
            page_path: `/tour-operation/${tourId}`
        });
    } catch (error) {
        res.status(500).send('Operasyon sayfası yüklenirken hata: ' + error.message);
    }
};

exports.updateTourStatus = async (req, res) => {
    try {
        const tourId = req.params.id;
        const { transport_status, payment_received, payment_paid } = req.body;

        await db.execute(`
            UPDATE tours SET transport_status = ?, payment_received = ?, payment_paid = ? WHERE id = ?
        `, [transport_status, payment_received, payment_paid, tourId]);

        res.redirect(`/tour-operation/${tourId}`);
    } catch (error) {
        res.status(500).send('Tur güncellenirken hata oluştu: ' + error.message);
    }
};

exports.exportDemandsExcel = async (req, res) => {
    try {
        const query = `
            SELECT td.id, td.demand_name, td.status, td.offer_date, td.first_contact_date, td.rejection_reason, a.agency_name, a.phone, a.email 
            FROM tour_demands td
            LEFT JOIN agencies a ON td.agency_id = a.id
            ORDER BY td.first_contact_date DESC
        `;
        const [demands] = await db.execute(query);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Talep Takip Listesi');

        worksheet.columns = [
            { header: 'Talep No', key: 'id', width: 10 },
            { header: 'Tur / Talep Adı', key: 'demand_name', width: 30 },
            { header: 'Acente Adı', key: 'agency_name', width: 25 },
            { header: 'Acente Tel', key: 'phone', width: 20 },
            { header: 'Acente E-posta', key: 'email', width: 25 },
            { header: 'İlk Temas Tarihi', key: 'first_contact_date', width: 18 },
            { header: 'Teklif Tarihi', key: 'offer_date', width: 18 },
            { header: 'Durum', key: 'status', width: 15 },
            { header: 'Red Nedeni', key: 'rejection_reason', width: 30 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } };

        demands.forEach(d => {
            worksheet.addRow({
                id: d.id,
                demand_name: d.demand_name,
                agency_name: d.agency_name || 'Bilinmiyor',
                phone: d.phone || '-',
                email: d.email || '-',
                first_contact_date: d.first_contact_date ? d.first_contact_date.toISOString().split('T')[0] : '-',
                offer_date: d.offer_date ? d.offer_date.toISOString().split('T')[0] : '-',
                status: d.status === 'APPROVED' ? 'ONAYLANDI' : d.status === 'REJECTED' ? 'REDDEDİLDİ' : 'BEKLEMEDE',
                rejection_reason: d.rejection_reason || '-'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Talep_Takip_Raporu_' + new Date().toISOString().split('T')[0] + '.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).send('Excel raporu üretilirken hata oluştu: ' + error.message);
    }
};

exports.addCityToTour = async (req, res) => {
    try {
        const tourId = req.params.id;
        const { city_id, general_guide_id, local_guide_id } = req.body;

        const query = `
            INSERT INTO operation_management 
            (tour_id, city_id, general_guide_id, general_guide_status, local_guide_id, local_guide_status, hotel_status, restaurant_status) 
            VALUES (?, ?, ?, 'PENDING', ?, 'PENDING', 'PENDING', 'PENDING')
        `;

        await db.execute(query, [
            tourId, 
            city_id, 
            general_guide_id || null, 
            local_guide_id || null
        ]);

        res.redirect(`/tour-operation/${tourId}`);
    } catch (error) {
        console.error("Şehir ekleme hatası detay:", error);
        res.status(500).send("Şehir ekleme işlemi başarısız: " + error.message);
    }
};

exports.updateCityOperation = async (req, res) => {
    try {
        const { 
            operation_id, hotel_ids, hotel_status, restaurant_ids, restaurant_status,
            general_guide_id, general_guide_status, local_guide_id, local_guide_status 
        } = req.body;

        const hotelIdStr = Array.isArray(hotel_ids) ? hotel_ids.join(',') : (req.body.hotel_id || null);
        const restaurantIdStr = Array.isArray(restaurant_ids) ? restaurant_ids.join(',') : (req.body.restaurant_id || null);

        const [currentData] = await db.execute('SELECT * FROM operation_management WHERE id = ?', [operation_id]);
        if (currentData.length === 0) return res.status(404).send('Operasyon adımı bulunamadı.');
        
        const finalGeneralGuideId = (general_guide_id && general_guide_id.trim() !== "") ? general_guide_id : currentData[0].general_guide_id;
        const finalGeneralGuideStatus = general_guide_status !== undefined ? general_guide_status : currentData[0].general_guide_status;
        const finalLocalGuideId = (local_guide_id && local_guide_id.trim() !== "") ? local_guide_id : currentData[0].local_guide_id;
        const finalLocalGuideStatus = local_guide_status !== undefined ? local_guide_status : currentData[0].local_guide_status;

        await db.execute(
            `UPDATE operation_management SET 
                hotel_id = ?, hotel_status = ?, restaurant_id = ?, restaurant_status = ?, 
                general_guide_id = ?, general_guide_status = ?, local_guide_id = ?, local_guide_status = ? 
             WHERE id = ?`,
            [hotelIdStr, hotel_status, restaurantIdStr, restaurant_status, finalGeneralGuideId, finalGeneralGuideStatus, finalLocalGuideId, finalLocalGuideStatus, operation_id]
        );

        if (finalGeneralGuideId) {
            await db.execute(`UPDATE tours SET main_guide_id = ? WHERE id = ?`, [finalGeneralGuideId, currentData[0].tour_id]);
        }

        res.redirect(`/tour-operation/${currentData[0].tour_id}`);
    } catch (error) {
        res.status(500).send("Operasyon güncelleme başarısız: " + error.message);
    }
};

exports.getHotelsByCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const [hotels] = await db.execute('SELECT id, hotel_name FROM hotels WHERE city_id = ? ORDER BY hotel_name ASC', [cityId]);
        res.json(hotels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRestaurantsByCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const [restaurants] = await db.execute('SELECT id, restaurant_name FROM restaurants WHERE city_id = ? ORDER BY restaurant_name ASC', [cityId]);
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.quickAddHotel = async (req, res) => {
    try {
        const { hotel_name, city_id } = req.body;
        const [result] = await db.execute('INSERT INTO hotels (hotel_name, city_id) VALUES (?, ?)', [hotel_name, city_id]);
        res.json({ id: result.insertId, hotel_name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.quickAddRestaurant = async (req, res) => {
    try {
        const { restaurant_name, city_id } = req.body;
        const [result] = await db.execute('INSERT INTO restaurants (restaurant_name, city_id) VALUES (?, ?)', [restaurant_name, city_id]);
        res.json({ id: result.insertId, restaurant_name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

