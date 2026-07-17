const TourModel = require('../models/tourModel');
const ExcelJS = require('exceljs');
const Mailer = require('../utils/mailer');
const Whatsapp = require('../utils/whatsapp');

// =========================================================================
// 1. MODÜL: Talep Takip Sayfası (CRM)
// =========================================================================
exports.getTourDemands = async (req, res) => {
    try {
        const [demands, agencies] = await Promise.all([
            TourModel.getAllDemands(),
            TourModel.getAgenciesOrderByName()
        ]);
        res.render('tour-demands', { demands, agencies, page_path: '/tour-demands' });
    } catch (error) {
        console.error('Talep Takip Sayfası Yüklenirken Hata:', error);
        res.status(500).send('Talep takip sayfası yüklenirken bir hata oluştu.');
    }
};

exports.addDemand = async (req, res) => {
    try {
        const { demand_name, agency_id, first_contact_date, offer_date, offered_price, currency } = req.body;
        await TourModel.insertDemand({ demand_name, agency_id, first_contact_date, offer_date, offered_price, currency });
        res.redirect('/tour-demands');
    } catch (error) {
        console.error('Talep kaydedilirken hata:', error);
        res.status(500).send('Talep kaydedilirken bir hata oluştu.');
    }
};

exports.updateDemandStatus = async (req, res) => {
    try {
        const demandId = req.params.id;
        const { status, rejection_reason } = req.body;
        await TourModel.updateDemandStatus(demandId, status, rejection_reason);

        if (status === 'IN_PROGRESS') {
            // Bildirim gönderimi başarısız olsa bile durum güncellemesi zaten kaydedildi.
            // Kullanıcı akışını mail/whatsapp hatasıyla bozmamak için ayrı try/catch içinde tutuyoruz.
            try {
                const demand = await TourModel.getDemandWithAgencyById(demandId);
                if (demand) {
                    await Mailer.sendDemandInProgressEmail(demand);
                    await Whatsapp.sendDemandInProgressWhatsapp(demand);
                }
            } catch (notifyError) {
                console.error('Talep bildirimi (mail/whatsapp) gönderilirken hata:', notifyError);
            }
        }

        res.redirect('/tour-demands');
    } catch (error) {
        console.error('Talep güncellenirken hata:', error);
        res.status(500).send('Talep güncellenirken bir hata oluştu.');
    }
};

// =========================================================================
// 2. MODÜL: Aktif Turlar & Finans Kokpiti (Ana Sayfa)
// =========================================================================
exports.getDashboard = async (req, res) => {
    try {
        const selectedYear = req.query.year || null;
        const selectedMonth = req.query.month || null;

        const [tourRows, agencies, guides, cities] = await Promise.all([
            TourModel.getDashboardTours(selectedYear, selectedMonth),
            TourModel.getAgenciesOrderByName(),
            TourModel.getGuidesOrderByName(),
            TourModel.getCitiesOrderByName()
        ]);

        const operations = tourRows.map(row => ({
            ...row,
            operation_name: row.tour_name,
            cities: TourModel.parseJsonField(row.cities_json)
        }));

        res.render('index', {
            operations, agencies, guides, cities,
            selectedYear: selectedYear || '',
            selectedMonth: selectedMonth || '',
            guideConflict: req.query.guideConflict || null,
            page_path: '/'
        });
    } catch (error) {
        console.error('Kokpit Yükleme Hatası:', error);
        res.status(500).send('Kokpit yüklenirken bir hata oluştu.');
    }
};

// =========================================================================
// TAKVİM GÖRÜNÜMÜ
// =========================================================================

// Turları birbirinden ayırt etmek için dönen bir renk paleti
const CALENDAR_COLOR_PALETTE = [
    '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
    '#0d9488', '#c026d3'
];

exports.getCalendarView = async (req, res) => {
    try {
        const tours = await TourModel.getAllToursForCalendar();

        // FullCalendar'da "end" tarihi hariç (exclusive) sayılır, yani turun
        // bitiş gününü de takvimde göstermek için end_date'e 1 gün ekliyoruz.
        const events = tours.map((t, index) => {
            const start = t.start_date ? new Date(t.start_date) : null;
            const end = t.end_date ? new Date(t.end_date) : null;
            const exclusiveEnd = end ? new Date(end.getTime() + 24 * 60 * 60 * 1000) : null;
            const color = CALENDAR_COLOR_PALETTE[index % CALENDAR_COLOR_PALETTE.length];

            return {
                id: t.id,
                title: t.tour_name + (t.agency_name ? ` — ${t.agency_name}` : ''),
                start: start ? start.toISOString().split('T')[0] : null,
                end: exclusiveEnd ? exclusiveEnd.toISOString().split('T')[0] : null,
                url: `/tour-operation/${t.id}`,
                backgroundColor: color,
                borderColor: color,
                textColor: '#ffffff'
            };
        });

        res.render('calendar', { events, page_path: '/calendar' });
    } catch (error) {
        console.error('Takvim sayfası yüklenirken hata:', error);
        res.status(500).send('Takvim sayfası yüklenirken bir hata oluştu.');
    }
};

// AJAX: "Yeni Tur Oluştur" modalı form gönderilmeden önce rehber çakışmasını
// kontrol eder. Modal açık kalsın, alanlar kaybolmasın diye sayfa yenilemeden
// buradan kontrol ediliyor.
exports.checkGuideConflict = async (req, res) => {
    try {
        const { guide_id, start_date, end_date, exclude_tour_id } = req.query;
        if (!guide_id || !start_date || !end_date) {
            return res.json({ conflict: false });
        }
        const result = await TourModel.checkGuideConflictForApi(guide_id, start_date, end_date, exclude_tour_id || null);
        res.json(result);
    } catch (error) {
        console.error('Rehber çakışma kontrolü hatası:', error);
        res.status(500).json({ conflict: false });
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

        await TourModel.createTourWithCities(
            { tour_name, start_date, end_date, year, month, agency_id, main_guide_id, transport_status, payment_received, payment_paid },
            Array.isArray(city_ids) ? city_ids : (city_ids ? [city_ids] : [])
        );

        res.redirect(`/?year=${year}&month=${month}`);
    } catch (error) {
        if (error.code === 'GUIDE_CONFLICT') {
            return res.redirect(`/?guideConflict=${encodeURIComponent(error.message)}`);
        }
        console.error('Tur kaydedilirken hata:', error);
        res.status(500).send('Tur kaydedilirken bir hata oluştu.');
    }
};

// =========================================================================
// 3. MODÜL: Tekil Tur İç Operasyon Sayfası
// =========================================================================
exports.getTourOperation = async (req, res) => {
    try {
        const tourId = req.params.id;

        const tourRows = await TourModel.getTourById(tourId);
        if (tourRows.length === 0) return res.status(404).send('Tur bulunamadı!');

        const [managedCities, allCities, generalGuides, localGuides] = await Promise.all([
            TourModel.getTourOperationsByTourId(tourId),
            TourModel.getCitiesOrderByName(),
            TourModel.getGeneralGuides(),
            TourModel.getLocalGuides()
        ]);

        res.render('tour-operation', {
            tour: tourRows[0],
            managedCities,
            allCities,
            generalGuides,
            localGuides,
            guideConflict: req.query.guideConflict || null,
            page_path: `/tour-operation/${tourId}`
        });
    } catch (error) {
        console.error('Operasyon sayfası yüklenirken hata:', error);
        res.status(500).send('Operasyon sayfası yüklenirken bir hata oluştu.');
    }
};

exports.updateTourStatus = async (req, res) => {
    try {
        const tourId = req.params.id;
        const { transport_status, payment_received, payment_paid } = req.body;
        await TourModel.updateTourStatus(tourId, transport_status, payment_received, payment_paid);
        res.redirect(`/tour-operation/${tourId}`);
    } catch (error) {
        console.error('Tur güncellenirken hata:', error);
        res.status(500).send('Tur güncellenirken bir hata oluştu.');
    }
};

exports.exportDemandsExcel = async (req, res) => {
    try {
        const demands = await TourModel.getAllDemands();

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
        console.error('Excel raporu üretilirken hata:', error);
        res.status(500).send('Excel raporu üretilirken bir hata oluştu.');
    }
};

exports.addCityToTour = async (req, res) => {
    try {
        const tourId = req.params.id;
        const { city_id, general_guide_id, local_guide_id } = req.body;
        await TourModel.addCityToTour(tourId, city_id, general_guide_id, local_guide_id);
        res.redirect(`/tour-operation/${tourId}`);
    } catch (error) {
        if (error.code === 'GUIDE_CONFLICT') {
            return res.redirect(`/tour-operation/${req.params.id}?guideConflict=${encodeURIComponent(error.message)}`);
        }
        console.error('Şehir ekleme hatası:', error);
        res.status(500).send('Şehir ekleme işlemi başarısız oldu.');
    }
};

// Otel: TEKİL seçim (şehirde tek otelde kalınıyor)
// Restoran: ÇOKLU seçim, HER RESTORANIN KENDİ DURUMU
// Formdan "restaurants_data" adında bir JSON string geliyor: [{id, status}, ...]
// (bkz. public/js/quick-add.js -> buildRestaurantsPayload)
exports.updateCityOperation = async (req, res) => {
    try {
        const {
            operation_id, hotel_id, hotel_status,
            general_guide_id, general_guide_status,
            local_guide_id, local_guide_status,
            clear_local_guide,
            restaurants_data
        } = req.body;

        let restaurants = [];
        try {
            restaurants = restaurants_data ? JSON.parse(restaurants_data) : [];
        } catch (parseErr) {
            return res.status(400).send('Restoran verisi hatalı biçimlendirilmiş.');
        }

        const tourId = await TourModel.updateCityOperationFull({
            operation_id, hotel_id: hotel_id || null, hotel_status,
            general_guide_id, general_guide_status,
            local_guide_id, local_guide_status,
            clear_local_guide: clear_local_guide === '1',
            restaurants
        });

        res.redirect(`/tour-operation/${tourId}`);
    } catch (error) {
        if (error.code === 'GUIDE_CONFLICT') {
            const redirectTo = error.tourId ? `/tour-operation/${error.tourId}` : '/';
            return res.redirect(`${redirectTo}?guideConflict=${encodeURIComponent(error.message)}`);
        }
        console.error('Operasyon güncelleme hatası:', error);
        res.status(500).send('Operasyon güncellenirken bir hata oluştu: ' + error.message);
    }
};

exports.getHotelsByCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const hotels = await TourModel.getHotelsByCityId(cityId);
        res.json(hotels);
    } catch (error) {
        res.status(500).json({ error: 'Oteller yüklenemedi.' });
    }
};

exports.getRestaurantsByCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const restaurants = await TourModel.getRestaurantsByCityId(cityId);
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ error: 'Restoranlar yüklenemedi.' });
    }
};

exports.quickAddHotel = async (req, res) => {
    try {
        const { hotel_name, city_id } = req.body;
        const id = await TourModel.quickAddHotel(hotel_name, city_id);
        res.json({ id, hotel_name });
    } catch (error) {
        res.status(500).json({ error: 'Otel eklenemedi.' });
    }
};

exports.quickAddRestaurant = async (req, res) => {
    try {
        const { restaurant_name, city_id } = req.body;
        const id = await TourModel.quickAddRestaurant(restaurant_name, city_id);
        res.json({ id, restaurant_name });
    } catch (error) {
        res.status(500).json({ error: 'Restoran eklenemedi.' });
    }
};