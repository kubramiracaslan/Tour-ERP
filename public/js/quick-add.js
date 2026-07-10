document.addEventListener('DOMContentLoaded', () => {
    const editModal = new bootstrap.Modal(document.getElementById('editCityModal'));
    const quickHotelModal = new bootstrap.Modal(document.getElementById('quickHotelModal'));
    const quickRestaurantModal = new bootstrap.Modal(document.getElementById('quickRestaurantModal'));

    let currentCityId = null;

    // Modal içinde tuttuğumuz "seçili restoranlar" listesi.
    // Her eleman: { id, name, status }
    let selectedRestaurants = [];

    // ---------------------------------------------------------------
    // "Güncelle" butonuna basınca modalı doldur
    // ---------------------------------------------------------------
    document.querySelectorAll('.edit-city-ops-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const btn = e.currentTarget;

            const opId = btn.getAttribute('data-id');
            const cityName = btn.getAttribute('data-name');
            const cityId = btn.getAttribute('data-cityid');
            const hotelId = btn.getAttribute('data-hotelid');
            const hotelStatus = btn.getAttribute('data-hotelstatus');

            const generalGuideId = btn.getAttribute('data-generalguideid');
            const generalGuideStatus = btn.getAttribute('data-generalguidestatus');
            const localGuideId = btn.getAttribute('data-localguideid');
            const guideStatus = btn.getAttribute('data-guide');

            // Bu şehrin operasyonuna daha önce eklenmiş restoranlar (id, name, status)
            let existingRestaurants = [];
            try {
                existingRestaurants = JSON.parse(btn.getAttribute('data-restaurants') || '[]');
            } catch (e) {
                existingRestaurants = [];
            }

            currentCityId = cityId;
            selectedRestaurants = existingRestaurants.map(r => ({
                id: String(r.restaurant_id ?? r.id),
                name: r.restaurant_name ?? r.name,
                status: r.status || 'PENDING'
            }));

            document.getElementById('modal-city-title').textContent = cityName;
            document.getElementById('modal_op_id').value = opId;

            document.getElementById('modal-hotel-status').value = hotelStatus || 'PENDING';
            document.getElementById('modal-general-guide').value = generalGuideId || '';
            document.getElementById('modal-local-guide').value = localGuideId || '';

            const generalGuideStatusElem = document.getElementById('modal-general-guide-status');
            if (generalGuideStatusElem) generalGuideStatusElem.value = generalGuideStatus || 'PENDING';

            const localGuideStatusElem = document.getElementById('modal-guide');
            if (localGuideStatusElem) localGuideStatusElem.value = guideStatus || 'PENDING';

            // Yerel rehber switch'i: bu şehre zaten bir yerel rehber atanmışsa açık başlasın,
            // atanmamışsa kapalı başlasın ve alan gizli kalsın.
            const localGuideToggle = document.getElementById('modal-toggle-local-guide');
            const localGuideWrapper = document.getElementById('modal-local-guide-wrapper');
            const clearLocalGuideInput = document.getElementById('modal-clear-local-guide');
            const hasLocalGuide = !!(localGuideId && localGuideId !== 'null' && localGuideId !== '');
            localGuideToggle.checked = hasLocalGuide;
            localGuideWrapper.classList.toggle('d-none', !hasLocalGuide);
            clearLocalGuideInput.value = hasLocalGuide ? '0' : '1';

            await loadHotels(cityId, hotelId);
            await loadRestaurantOptions(cityId);
            renderRestaurantList();

            editModal.show();
        });
    });

    // ---------------------------------------------------------------
    // Otel: TEKİL select. Kayıtlı otel varsa seçili gösterilir.
    // ---------------------------------------------------------------
    async function loadHotels(cityId, savedHotelId) {
        const hotelSelect = document.getElementById('modal-hotel');
        hotelSelect.innerHTML = '<option value="">-- Yükleniyor... --</option>';
        try {
            const res = await fetch(`/api/cities/${cityId}/hotels`);
            const hotels = await res.json();
            hotelSelect.innerHTML = '<option value="">-- Otel Seçin --</option>';
            hotels.forEach(h => {
                const isSelected = savedHotelId && String(h.id) === String(savedHotelId) ? 'selected' : '';
                hotelSelect.innerHTML += `<option value="${h.id}" ${isSelected}>${h.hotel_name}</option>`;
            });
        } catch (err) {
            console.error('Oteller yüklenirken hata:', err);
            hotelSelect.innerHTML = '<option value="">-- Yüklenemedi --</option>';
        }
    }

    // ---------------------------------------------------------------
    // Restoran: "eklenebilir" dropdown'u dolduran fonksiyon.
    // Bu dropdown'daki seçim doğrudan forma gitmiyor; "Ekle" butonuyla
    // aşağıdaki listeye taşınıyor.
    // ---------------------------------------------------------------
    async function loadRestaurantOptions(cityId) {
        const restaurantSelect = document.getElementById('restaurant-add-select');
        restaurantSelect.innerHTML = '<option value="">-- Yükleniyor... --</option>';
        try {
            const res = await fetch(`/api/cities/${cityId}/restaurants`);
            const restaurants = await res.json();
            restaurantSelect.innerHTML = '<option value="">-- Restoran Seçin --</option>';
            restaurants.forEach(r => {
                restaurantSelect.innerHTML += `<option value="${r.id}" data-name="${r.restaurant_name}">${r.restaurant_name}</option>`;
            });
        } catch (err) {
            console.error('Restoranlar yüklenirken hata:', err);
            restaurantSelect.innerHTML = '<option value="">-- Yüklenemedi --</option>';
        }
    }

    // Seçili restoran listesini ekrana çiz (her satır: isim + kendi durum select'i + kaldır butonu)
    function renderRestaurantList() {
        const container = document.getElementById('restaurant-list-container');
        if (!container) return;

        if (selectedRestaurants.length === 0) {
            container.innerHTML = '<p class="text-muted small fst-italic mb-0">Henüz restoran eklenmedi.</p>';
            return;
        }

        container.innerHTML = selectedRestaurants.map((r, index) => `
            <div class="d-flex align-items-center gap-2 mb-2 p-2 bg-white border rounded" data-restaurant-row="${index}">
                <span class="fw-semibold flex-grow-1">${r.name}</span>
                <select class="form-select form-select-sm restaurant-status-select" style="width: 150px;" data-index="${index}">
                    <option value="PENDING" ${r.status === 'PENDING' ? 'selected' : ''}>Tamamlanmadı</option>
                    <option value="DONE" ${r.status === 'DONE' ? 'selected' : ''}>Tamamlandı</option>
                </select>
                <button type="button" class="btn btn-sm btn-outline-danger restaurant-remove-btn" data-index="${index}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `).join('');

        // Durum değişimini state'e yaz
        container.querySelectorAll('.restaurant-status-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = Number(e.target.getAttribute('data-index'));
                selectedRestaurants[idx].status = e.target.value;
            });
        });

        // Kaldırma
        container.querySelectorAll('.restaurant-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = Number(e.currentTarget.getAttribute('data-index'));
                selectedRestaurants.splice(idx, 1);
                renderRestaurantList();
            });
        });
    }

    // "Ekle" butonu: dropdown'daki restoranı listeye taşı (aynı restoranı iki kez eklemeyi engelle)
    const btnAddRestaurant = document.getElementById('btn-add-restaurant-to-list');
    if (btnAddRestaurant) {
        btnAddRestaurant.addEventListener('click', () => {
            const select = document.getElementById('restaurant-add-select');
            const selectedOption = select.options[select.selectedIndex];
            const id = select.value;
            if (!id) return;

            const alreadyAdded = selectedRestaurants.some(r => String(r.id) === String(id));
            if (alreadyAdded) {
                alert('Bu restoran zaten listeye eklenmiş.');
                return;
            }

            selectedRestaurants.push({
                id,
                name: selectedOption.getAttribute('data-name'),
                status: 'PENDING'
            });
            select.value = '';
            renderRestaurantList();
        });
    }

    // Yerel rehber switch'i: açılıp kapanınca alanı göster/gizle ve clear_local_guide bayrağını güncelle
    const modalLocalGuideToggle = document.getElementById('modal-toggle-local-guide');
    if (modalLocalGuideToggle) {
        modalLocalGuideToggle.addEventListener('change', (e) => {
            const wrapper = document.getElementById('modal-local-guide-wrapper');
            const clearInput = document.getElementById('modal-clear-local-guide');
            const localSelect = document.getElementById('modal-local-guide');

            wrapper.classList.toggle('d-none', !e.target.checked);
            clearInput.value = e.target.checked ? '0' : '1';

            if (!e.target.checked) {
                localSelect.value = ''; // switch kapatılınca seçimi de temizle
            }
        });
    }

    // Form gönderilmeden hemen önce: seçili restoran listesini JSON'a çevirip hidden input'a yaz
    const editCityForm = document.getElementById('editCityForm');
    if (editCityForm) {
        editCityForm.addEventListener('submit', () => {
            document.getElementById('restaurants_data_input').value = JSON.stringify(selectedRestaurants);
        });
    }

    // ---------------------------------------------------------------
    // Hızlı Ekleme Buton Tetikleyicileri
    // ---------------------------------------------------------------
    const btnQuickHotel = document.getElementById('btn-quick-add-hotel');
    if (btnQuickHotel) {
        btnQuickHotel.addEventListener('click', () => {
            document.getElementById('quickHotelCityId').value = currentCityId;
            document.getElementById('quickHotelName').value = '';
            quickHotelModal.show();
        });
    }

    const btnQuickRestaurant = document.getElementById('btn-quick-add-restaurant');
    if (btnQuickRestaurant) {
        btnQuickRestaurant.addEventListener('click', () => {
            document.getElementById('quickRestaurantCityId').value = currentCityId;
            document.getElementById('quickRestaurantName').value = '';
            quickRestaurantModal.show();
        });
    }

    // Hızlı Otel AJAX Form Post -> tekil select'e ekleyip otomatik seç
    const formQuickHotel = document.getElementById('formQuickHotel');
    if (formQuickHotel) {
        formQuickHotel.addEventListener('submit', async (e) => {
            e.preventDefault();
            const hotel_name = document.getElementById('quickHotelName').value;
            const city_id = document.getElementById('quickHotelCityId').value;

            try {
                const res = await fetch('/api/quick-add/hotel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hotel_name, city_id })
                });
                const newHotel = await res.json();

                const hotelSelect = document.getElementById('modal-hotel');
                const option = new Option(newHotel.hotel_name, newHotel.id, true, true);
                hotelSelect.add(option);

                quickHotelModal.hide();
            } catch (err) {
                alert('Otel eklenirken hata oluştu.');
            }
        });
    }

    // Hızlı Restoran AJAX Form Post -> hem dropdown'a hem doğrudan seçili listeye ekle
    const formQuickRestaurant = document.getElementById('formQuickRestaurant');
    if (formQuickRestaurant) {
        formQuickRestaurant.addEventListener('submit', async (e) => {
            e.preventDefault();
            const restaurant_name = document.getElementById('quickRestaurantName').value;
            const city_id = document.getElementById('quickRestaurantCityId').value;

            try {
                const res = await fetch('/api/quick-add/restaurant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ restaurant_name, city_id })
                });
                const newRestaurant = await res.json();

                const restaurantSelect = document.getElementById('restaurant-add-select');
                const option = new Option(newRestaurant.restaurant_name, newRestaurant.id);
                option.setAttribute('data-name', newRestaurant.restaurant_name);
                restaurantSelect.add(option);

                // Kullanıcı zaten eklemek istediği için doğrudan listeye de düşürüyoruz
                selectedRestaurants.push({ id: String(newRestaurant.id), name: newRestaurant.restaurant_name, status: 'PENDING' });
                renderRestaurantList();

                quickRestaurantModal.hide();
            } catch (err) {
                alert('Restoran eklenirken hata oluştu.');
            }
        });
    }
});