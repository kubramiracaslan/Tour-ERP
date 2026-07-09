// models/tourModel.js
const db = require('../db');

// 1. MODÜL: Talep Takip (CRM) Sorguları
exports.getAllDemands = async () => {
    const query = `
        SELECT td.*, a.agency_name, a.phone, a.email 
        FROM tour_demands td
        LEFT JOIN agencies a ON td.agency_id = a.id
        ORDER BY td.first_contact_date DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

exports.getAgenciesOrderByName = async () => {
    const [rows] = await db.execute('SELECT id, agency_name FROM agencies ORDER BY agency_name ASC');
    return rows;
};

exports.insertDemand = async (demandData) => {
    const { demand_name, agency_id, first_contact_date, offer_date, offered_price, currency } = demandData;
    const query = `
        INSERT INTO tour_demands (demand_name, agency_id, first_contact_date, offer_date, offered_price, currency, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `;
    return db.execute(query, [
        demand_name, agency_id || null, first_contact_date || null, 
        offer_date || null, offered_price || null, currency || 'EUR'
    ]);
};

exports.updateDemandStatus = async (id, status, rejection_reason) => {
    return db.execute('UPDATE tour_demands SET status = ?, rejection_reason = ? WHERE id = ?', [
        status, status === 'REJECTED' ? rejection_reason : null, id
    ]);
};

// 2. MODÜL: Aktif Turlar & Finans Kokpiti Sorguları
exports.getDashboardTours = async (year, month) => {
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
    if (year && month) {
        tourQuery += ` WHERE t.year = ? AND t.month = ? `;
        queryParams.push(year, month);
    }
    tourQuery += ` ORDER BY t.start_date ASC `;

    const [rows] = await db.execute(tourQuery, queryParams);
    return rows;
};

exports.getGuidesOrderByName = async () => {
    const [rows] = await db.execute('SELECT id, guide_name FROM guides ORDER BY guide_name ASC');
    return rows;
};

exports.getCitiesOrderByName = async () => {
    const [rows] = await db.execute('SELECT id, city_name FROM cities ORDER BY city_name ASC');
    return rows;
};

exports.insertTour = async (tourData) => {
    const { tour_name, start_date, end_date, year, month, agency_id, main_guide_id, transport_status, payment_received, payment_paid } = tourData;
    const query = `
        INSERT INTO tours (tour_name, start_date, end_date, year, month, agency_id, main_guide_id, transport_status, payment_received, payment_paid) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        tour_name, start_date, end_date, year, month, agency_id || null, main_guide_id || null, transport_status, payment_received, payment_paid
    ]);
    return result;
};

exports.insertTourCityOperation = async (tourId, cityId, mainGuideId) => {
    const query = `
        INSERT INTO operation_management 
        (tour_id, city_id, general_guide_id, general_guide_status, local_guide_status, hotel_status, restaurant_status) 
        VALUES (?, ?, ?, 'PENDING', 'PENDING', 'PENDING', 'PENDING')
    `;
    return db.execute(query, [tourId, cityId, mainGuideId || null]);
};

// 3. MODÜL: Tekil Tur İç Operasyon Sorguları
exports.getTourById = async (id) => {
    const [rows] = await db.execute(`
        SELECT t.*, a.agency_name, g.guide_name FROM tours t
        LEFT JOIN agencies a ON t.agency_id = a.id
        LEFT JOIN guides g ON t.main_guide_id = g.id
        WHERE t.id = ?
    `, [id]);
    return rows;
};

exports.getTourOperationsByTourId = async (tourId) => {
    const [rows] = await db.execute(`
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
    return rows;
};

exports.getGeneralGuides = async () => {
    const [rows] = await db.execute('SELECT id, guide_name FROM guides WHERE guide_type = "GENERAL" ORDER BY guide_name ASC');
    return rows;
};

exports.getLocalGuides = async () => {
    const [rows] = await db.execute('SELECT id, guide_name FROM guides WHERE guide_type = "LOCAL" ORDER BY guide_name ASC');
    return rows;
};

exports.updateTourStatus = async (id, transport_status, payment_received, payment_paid) => {
    return db.execute(`
        UPDATE tours SET transport_status = ?, payment_received = ?, payment_paid = ? WHERE id = ?
    `, [transport_status, payment_received, payment_paid, id]);
};

exports.addCityToTour = async (tourId, city_id, general_guide_id, local_guide_id) => {
    const query = `
        INSERT INTO operation_management 
        (tour_id, city_id, general_guide_id, general_guide_status, local_guide_id, local_guide_status, hotel_status, restaurant_status) 
        VALUES (?, ?, ?, 'PENDING', ?, 'PENDING', 'PENDING', 'PENDING')
    `;
    return db.execute(query, [tourId, city_id, general_guide_id || null, local_guide_id || null]);
};

exports.getOperationStepById = async (operation_id) => {
    const [rows] = await db.execute('SELECT * FROM operation_management WHERE id = ?', [operation_id]);
    return rows;
};

exports.updateCityOperationStep = async (updateData) => {
    const { 
            hotelIdStr, hotel_status, restaurantIdStr, restaurant_status, 
            general_guide_id, general_guide_status, local_guide_id, local_guide_status, // <-- Değişken isimleri düzeltildi
            operation_id 
        } = updateData;
    
        return db.execute(
            `UPDATE operation_management SET 
                hotel_id = ?, hotel_status = ?, restaurant_id = ?, restaurant_status = ?, 
                general_guide_id = ?, general_guide_status = ?, local_guide_id = ?, local_guide_status = ? 
             WHERE id = ?`,
            [hotelIdStr, hotel_status, restaurantIdStr, restaurant_status, general_guide_id, general_guide_status, local_guide_id, local_guide_status, operation_id]
        );
};

exports.updateTourMainGuide = async (main_guide_id, tour_id) => {
    return db.execute(`UPDATE tours SET main_guide_id = ? WHERE id = ?`, [main_guide_id, tour_id]);
};

// AJAX ve Hızlı Ekleme API Sorguları
exports.getHotelsByCityId = async (cityId) => {
    const [rows] = await db.execute('SELECT id, hotel_name FROM hotels WHERE city_id = ? ORDER BY hotel_name ASC', [cityId]);
    return rows;
};

exports.getRestaurantsByCityId = async (cityId) => {
    const [rows] = await db.execute('SELECT id, restaurant_name FROM restaurants WHERE city_id = ? ORDER BY restaurant_name ASC', [cityId]);
    return rows;
};

exports.quickAddHotel = async (hotel_name, city_id) => {
    const [result] = await db.execute('INSERT INTO hotels (hotel_name, city_id) VALUES (?, ?)', [hotel_name, city_id]);
    return result.insertId;
};

exports.quickAddRestaurant = async (restaurant_name, city_id) => {
    const [result] = await db.execute('INSERT INTO restaurants (restaurant_name, city_id) VALUES (?, ?)', [restaurant_name, city_id]);
    return result.insertId;
};
