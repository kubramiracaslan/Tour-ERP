// models/tourModel.js
const pool = require('../db');

// =========================================================================
// Yardımcı: cities_json / restaurants_json içindeki JSON string'i parse et
// =========================================================================
function parseJsonField(value) {
    if (!value) return [];
    return typeof value === 'string' ? JSON.parse(value) : value;
}
exports.parseJsonField = parseJsonField;

// =========================================================================
// 1. MODÜL: Talep Takip (CRM) Sorguları
// =========================================================================
exports.getAllDemands = async () => {
    const query = `
        SELECT td.*, a.agency_name, a.phone, a.email 
        FROM tour_demands td
        LEFT JOIN agencies a ON td.agency_id = a.id
        ORDER BY td.first_contact_date DESC
    `;
    const [rows] = await pool.execute(query);
    return rows;
};

exports.getAgenciesOrderByName = async () => {
    const [rows] = await pool.execute('SELECT id, agency_name FROM agencies ORDER BY agency_name ASC');
    return rows;
};

exports.insertDemand = async (demandData) => {
    const { demand_name, agency_id, first_contact_date, offer_date, offered_price, currency } = demandData;
    const query = `
        INSERT INTO tour_demands (demand_name, agency_id, first_contact_date, offer_date, offered_price, currency, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `;
    return pool.execute(query, [
        demand_name, agency_id || null, first_contact_date || null,
        offer_date || null, offered_price || null, currency || 'EUR'
    ]);
};

exports.updateDemandStatus = async (id, status, rejection_reason) => {
    return pool.execute('UPDATE tour_demands SET status = ?, rejection_reason = ? WHERE id = ?', [
        status, status === 'REJECTED' ? rejection_reason : null, id
    ]);
};

// Mail/WhatsApp bildirimi göndermek için acente iletişim bilgileriyle birlikte tek talep çeker
exports.getDemandWithAgencyById = async (id) => {
    const [rows] = await pool.execute(`
        SELECT td.*, a.agency_name, a.phone, a.email
        FROM tour_demands td
        LEFT JOIN agencies a ON td.agency_id = a.id
        WHERE td.id = ?
    `, [id]);
    return rows[0] || null;
};

// =========================================================================
// 2. MODÜL: Aktif Turlar & Finans Kokpiti Sorguları
// =========================================================================
exports.getDashboardTours = async (year, month) => {
    let tourQuery = `
        SELECT t.*, a.agency_name, g.guide_name,
        (SELECT COUNT(om.id) FROM operation_management om WHERE om.tour_id = t.id) as city_count,
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'operation_id', om.id,
                    'city_name', c.city_name,
                    'hotel_name', h.hotel_name,
                    'hotel_status', om.hotel_status,
                    'general_guide_status', om.general_guide_status,
                    'local_guide_status', om.local_guide_status,
                    'local_guide_name', lg.guide_name,
                    'general_guide_name', gg.guide_name,
                    'restaurants', (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT('restaurant_name', r.restaurant_name, 'status', orst.status)
                        )
                        FROM operation_restaurants orst
                        JOIN restaurants r ON orst.restaurant_id = r.id
                        WHERE orst.operation_management_id = om.id
                    )
                )
            )
            FROM operation_management om
            JOIN cities c ON om.city_id = c.id
            LEFT JOIN hotels h ON om.hotel_id = h.id
            LEFT JOIN guides lg ON om.local_guide_id = lg.id
            LEFT JOIN guides gg ON om.general_guide_id = gg.id
            WHERE om.tour_id = t.id
        ) as cities_json
        FROM tours t
        LEFT JOIN agencies a ON t.agency_id = a.id
        LEFT JOIN guides g ON t.main_guide_id = g.id
    `;

    const queryParams = [];
    if (year && month) {
        tourQuery += ` WHERE t.year = ? AND t.month = ? `;
        queryParams.push(year, month);
    }
    tourQuery += ` ORDER BY t.start_date ASC `;

    const [rows] = await pool.execute(tourQuery, queryParams);
    return rows;
};

exports.getGuidesOrderByName = async () => {
    const [rows] = await pool.execute('SELECT id, guide_name FROM guides ORDER BY guide_name ASC');
    return rows;
};

exports.getCitiesOrderByName = async () => {
    const [rows] = await pool.execute('SELECT id, city_name FROM cities ORDER BY city_name ASC');
    return rows;
};

// Takvim sayfası için hafif bir sorgu: sadece tarih, isim ve acente bilgisi
exports.getAllToursForCalendar = async () => {
    const [rows] = await pool.execute(`
        SELECT t.id, t.tour_name, t.start_date, t.end_date, a.agency_name
        FROM tours t
        LEFT JOIN agencies a ON t.agency_id = a.id
        ORDER BY t.start_date ASC
    `);
    return rows;
};

// Tur ekleme + şehir operasyonlarını TEK TRANSACTION içinde yapar.
// Öncesinde bu iki adım ayrı ayrı çalışıyordu; ikinci adım patlarsa
// elimizde "şehirsiz tur" kalıyordu. Artık ya hepsi kaydolur ya hiçbiri.
exports.createTourWithCities = async (tourData, cityIds) => {
    const {
        tour_name, start_date, end_date, year, month,
        agency_id, main_guide_id, transport_status, payment_received, payment_paid
    } = tourData;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [tourResult] = await conn.execute(
            `INSERT INTO tours (tour_name, start_date, end_date, year, month, agency_id, main_guide_id, transport_status, payment_received, payment_paid) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tour_name, start_date, end_date, year, month, agency_id || null, main_guide_id || null, transport_status, payment_received, payment_paid]
        );
        const newTourId = tourResult.insertId;

        if (Array.isArray(cityIds) && cityIds.length > 0) {
            const insertOpQuery = `
                INSERT INTO operation_management 
                (tour_id, city_id, general_guide_id, general_guide_status, local_guide_status, hotel_status) 
                VALUES (?, ?, ?, 'PENDING', 'PENDING', 'PENDING')
            `;
            for (const cityId of cityIds) {
                await conn.execute(insertOpQuery, [newTourId, cityId, main_guide_id || null]);
            }
        }

        await conn.commit();
        return newTourId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// =========================================================================
// 3. MODÜL: Tekil Tur İç Operasyon Sorguları
// =========================================================================
exports.getTourById = async (id) => {
    const [rows] = await pool.execute(`
        SELECT t.*, a.agency_name, g.guide_name FROM tours t
        LEFT JOIN agencies a ON t.agency_id = a.id
        LEFT JOIN guides g ON t.main_guide_id = g.id
        WHERE t.id = ?
    `, [id]);
    return rows;
};

// Otel artık tekil FK (h.hotel_name doğrudan JOIN),
// restoranlar ayrı bir alt sorgu ile "her biri kendi durumuyla" geliyor.
exports.getTourOperationsByTourId = async (tourId) => {
    const [rows] = await pool.execute(`
        SELECT om.*, c.city_name,
               h.hotel_name,
               lg.guide_name as local_guide_name,
               gg.guide_name as general_guide_name,
               (
                   SELECT JSON_ARRAYAGG(
                       JSON_OBJECT(
                           'restaurant_id', r.id,
                           'restaurant_name', r.restaurant_name,
                           'status', orst.status
                       )
                   )
                   FROM operation_restaurants orst
                   JOIN restaurants r ON orst.restaurant_id = r.id
                   WHERE orst.operation_management_id = om.id
               ) as restaurants_json
        FROM operation_management om
        JOIN cities c ON om.city_id = c.id
        LEFT JOIN hotels h ON om.hotel_id = h.id
        LEFT JOIN guides lg ON om.local_guide_id = lg.id
        LEFT JOIN guides gg ON om.general_guide_id = gg.id
        WHERE om.tour_id = ?
    `, [tourId]);

    return rows.map(row => ({
        ...row,
        restaurants: parseJsonField(row.restaurants_json)
    }));
};

exports.getGeneralGuides = async () => {
    const [rows] = await pool.execute('SELECT id, guide_name FROM guides WHERE guide_type = "GENERAL" ORDER BY guide_name ASC');
    return rows;
};

exports.getLocalGuides = async () => {
    const [rows] = await pool.execute('SELECT id, guide_name FROM guides WHERE guide_type = "LOCAL" ORDER BY guide_name ASC');
    return rows;
};

exports.updateTourStatus = async (id, transport_status, payment_received, payment_paid) => {
    return pool.execute(`
        UPDATE tours SET transport_status = ?, payment_received = ?, payment_paid = ? WHERE id = ?
    `, [transport_status, payment_received, payment_paid, id]);
};

exports.addCityToTour = async (tourId, city_id, general_guide_id, local_guide_id) => {
    const query = `
        INSERT INTO operation_management 
        (tour_id, city_id, general_guide_id, general_guide_status, local_guide_id, local_guide_status, hotel_status) 
        VALUES (?, ?, ?, 'PENDING', ?, 'PENDING', 'PENDING')
    `;
    return pool.execute(query, [tourId, city_id, general_guide_id || null, local_guide_id || null]);
};

exports.getOperationStepById = async (operation_id) => {
    const [rows] = await pool.execute('SELECT * FROM operation_management WHERE id = ?', [operation_id]);
    return rows;
};

// Şehir operasyon güncellemesi artık TEK TRANSACTION:
//   - operation_management satırı (otel tekil, rehberler) güncellenir
//   - operation_restaurants tablosu senkronize edilir (ekle/sil/durum güncelle)
//   - main_guide_id gerekiyorsa tours tablosuna yansıtılır
// restaurants parametresi: [{ id, status }, ...]
exports.updateCityOperationFull = async ({
    operation_id, hotel_id, hotel_status,
    general_guide_id, general_guide_status,
    local_guide_id, local_guide_status,
    clear_local_guide,
    restaurants
}) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [currentRows] = await conn.execute(
            'SELECT * FROM operation_management WHERE id = ? FOR UPDATE',
            [operation_id]
        );
        if (currentRows.length === 0) {
            throw new Error('Operasyon adımı bulunamadı.');
        }
        const current = currentRows[0];

        const finalGeneralGuideId = (general_guide_id && general_guide_id.trim() !== '') ? general_guide_id : current.general_guide_id;
        const finalGeneralGuideStatus = general_guide_status !== undefined ? general_guide_status : current.general_guide_status;

        // clear_local_guide true ise kullanıcı "bu şehirde yerel rehber yok" diyor demektir,
        // önceki değeri korumak yerine bilerek null'a çekiyoruz.
        let finalLocalGuideId;
        let finalLocalGuideStatus;
        if (clear_local_guide) {
            finalLocalGuideId = null;
            finalLocalGuideStatus = 'PENDING';
        } else {
            finalLocalGuideId = (local_guide_id && local_guide_id.trim() !== '') ? local_guide_id : current.local_guide_id;
            finalLocalGuideStatus = local_guide_status !== undefined ? local_guide_status : current.local_guide_status;
        }

        await conn.execute(
            `UPDATE operation_management SET 
                hotel_id = ?, hotel_status = ?, 
                general_guide_id = ?, general_guide_status = ?, 
                local_guide_id = ?, local_guide_status = ? 
             WHERE id = ?`,
            [hotel_id || null, hotel_status, finalGeneralGuideId, finalGeneralGuideStatus, finalLocalGuideId, finalLocalGuideStatus, operation_id]
        );

        await syncOperationRestaurants(conn, operation_id, restaurants || []);

        if (finalGeneralGuideId) {
            await conn.execute('UPDATE tours SET main_guide_id = ? WHERE id = ?', [finalGeneralGuideId, current.tour_id]);
        }

        await conn.commit();
        return current.tour_id;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// restaurants: [{ id, status }]
// - Listede olmayan eski restoranları siler
// - Yeni olanları ekler, mevcut olanların durumunu günceller
async function syncOperationRestaurants(conn, operationId, restaurants) {
    const ids = restaurants.map(r => Number(r.id)).filter(Boolean);

    if (ids.length === 0) {
        await conn.execute('DELETE FROM operation_restaurants WHERE operation_management_id = ?', [operationId]);
        return;
    }

    const placeholders = ids.map(() => '?').join(',');
    await conn.execute(
        `DELETE FROM operation_restaurants WHERE operation_management_id = ? AND restaurant_id NOT IN (${placeholders})`,
        [operationId, ...ids]
    );

    for (const r of restaurants) {
        await conn.execute(
            `INSERT INTO operation_restaurants (operation_management_id, restaurant_id, status) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [operationId, r.id, r.status || 'PENDING']
        );
    }
}
exports.syncOperationRestaurants = syncOperationRestaurants;

exports.updateTourMainGuide = async (main_guide_id, tour_id) => {
    return pool.execute('UPDATE tours SET main_guide_id = ? WHERE id = ?', [main_guide_id, tour_id]);
};

// AJAX ve Hızlı Ekleme API Sorguları
exports.getHotelsByCityId = async (cityId) => {
    const [rows] = await pool.execute('SELECT id, hotel_name FROM hotels WHERE city_id = ? ORDER BY hotel_name ASC', [cityId]);
    return rows;
};

exports.getRestaurantsByCityId = async (cityId) => {
    const [rows] = await pool.execute('SELECT id, restaurant_name FROM restaurants WHERE city_id = ? ORDER BY restaurant_name ASC', [cityId]);
    return rows;
};

exports.quickAddHotel = async (hotel_name, city_id) => {
    const [result] = await pool.execute('INSERT INTO hotels (hotel_name, city_id) VALUES (?, ?)', [hotel_name, city_id]);
    return result.insertId;
};

exports.quickAddRestaurant = async (restaurant_name, city_id) => {
    const [result] = await pool.execute('INSERT INTO restaurants (restaurant_name, city_id) VALUES (?, ?)', [restaurant_name, city_id]);
    return result.insertId;
};