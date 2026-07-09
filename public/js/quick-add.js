document.addEventListener('DOMContentLoaded', () => {
    const editModal = new bootstrap.Modal(document.getElementById('editCityModal'));
    const quickHotelModal = new bootstrap.Modal(document.getElementById('quickHotelModal'));
    const quickRestaurantModal = new bootstrap.Modal(document.getElementById('quickRestaurantModal'));

    let currentCityId = null;

    // "Güncelle" butonlarının dinlenmesi
    document.querySelectorAll('.edit-city-ops-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const btn = e.currentTarget;

            const opId = btn.getAttribute('data-id');
            const cityName = btn.getAttribute('data-name');
            const cityId = btn.getAttribute('data-cityid');
            const hotelStatus = btn.getAttribute('data-hotelstatus');
            const restaurantStatus = btn.getAttribute('data-restaurantstatus');

            const generalGuideId = btn.getAttribute('data-generalguideid');
            const generalGuideStatus = btn.getAttribute('data-generalguidestatus');
            const localGuideId = btn.getAttribute('data-localguideid');
            const guideStatus = btn.getAttribute('data-guide');

            const savedHotelIds = btn.getAttribute('data-hotelids') ? btn.getAttribute('data-hotelids').split(',') : [];
            const savedRestaurantIds = btn.getAttribute('data-restaurantids') ? btn.getAttribute('data-restaurantids').split(',') : [];

            currentCityId = cityId;

            document.getElementById('modal-city-title').textContent = cityName;
            document.getElementById('modal_op_id').value = opId;

            // Elementlerin durumlarını eşitle
            document.getElementById('modal-hotel-status').value = hotelStatus;
            document.getElementById('modal-restaurant-status').value = restaurantStatus;

            document.getElementById('modal-general-guide').value = generalGuideId || "";
            document.getElementById('modal-local-guide').value = localGuideId || "";

            // Rehber durumlarını eşitle
            const generalGuideStatusElem = document.getElementById('modal-general-guide-status');
            if (generalGuideStatusElem) generalGuideStatusElem.value = generalGuideStatus || "PENDING";
            
            const localGuideStatusElem = document.getElementById('modal-guide');
            if (localGuideStatusElem) localGuideStatusElem.value = guideStatus || "PENDING";

            await loadHotels(cityId, savedHotelIds);
            await loadRestaurants(cityId, savedRestaurantIds);

            editModal.show();
        });
    });

    // Otelleri Seçenek Olarak Yükleyen Fonksiyon
    async function loadHotels(cityId, savedIds) {
        const hotelSelect = document.getElementById('modal-hotel');
        hotelSelect.innerHTML = '<option value="">-- Yükleniyor... --</option>';
        try {
            const res = await fetch(`/api/cities/${cityId}/hotels`);
            const hotels = await res.json();
            hotelSelect.innerHTML = ''; 
            hotels.forEach(h => {
                const isSelected = savedIds.includes(h.id.toString()) ? 'selected' : '';
                hotelSelect.innerHTML += `<option value="${h.id}" ${isSelected}>${h.hotel_name}</option>`;
            });
        } catch (err) {
            console.error('Oteller yüklenirken hata:', err);
            hotelSelect.innerHTML = '<option value="">-- Yüklenemedi --</option>';
        }
    }

    // Restoranları Seçenek Olarak Yükleyen Fonksiyon
    async function loadRestaurants(cityId, savedIds) {
        const restaurantSelect = document.getElementById('modal-restaurant');
        restaurantSelect.innerHTML = '<option value="">-- Yükleniyor... --</option>';
        try {
            const res = await fetch(`/api/cities/${cityId}/restaurants`);
            const restaurants = await res.json();
            restaurantSelect.innerHTML = ''; 
            restaurants.forEach(r => {
                const isSelected = savedIds.includes(r.id.toString()) ? 'selected' : '';
                restaurantSelect.innerHTML += `<option value="${r.id}" ${isSelected}>${r.restaurant_name}</option>`;
            });
        } catch (err) {
            console.error('Restoranlar yüklenirken hata:', err);
            restaurantSelect.innerHTML = '<option value="">-- Yüklenemedi --</option>';
        }
    }

    // Hızlı Ekleme Buton Tetikleyicileri
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

    // Hızlı Otel AJAX Form Post
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

    // Hızlı Restoran AJAX Form Post
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

                const restaurantSelect = document.getElementById('modal-restaurant');
                const option = new Option(newRestaurant.restaurant_name, newRestaurant.id, true, true);
                restaurantSelect.add(option);

                quickRestaurantModal.hide();
            } catch (err) {
                alert('Restoran eklenirken hata oluştu.');
            }
        });
    }
});

