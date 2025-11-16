document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('searchForm');
  const zipcodeInput = document.getElementById('zipcode');
  const searchBtn = document.getElementById('searchBtn');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');
  const prefEl = document.getElementById('pref');
  const cityEl = document.getElementById('city');
  const townEl = document.getElementById('town');
  const fullAddressEl = document.getElementById('fullAddress');
  const zipcodeResultEl = document.getElementById('zipcodeResult');

  // 住所から郵便番号検索の要素
  const addressForm = document.getElementById('addressForm');
  const addressInput = document.getElementById('addressInput');
  const suggestionsEl = document.getElementById('addressSuggestions');
  const addressStatusEl = document.getElementById('addressStatus');
  const addressResultEl = document.getElementById('addressResult');
  const zipcodeFromAddressEl = document.getElementById('zipcodeFromAddress');
  const prefFromAddressEl = document.getElementById('prefFromAddress');
  const cityFromAddressEl = document.getElementById('cityFromAddress');
  const townFromAddressEl = document.getElementById('townFromAddress');
  const fullAddressFromAddressEl = document.getElementById('fullAddressFromAddress');

  let selectedSuggestionIndex = -1;
  let suggestions = [];

  // サジェスチョン機能
  async function fetchAddressSuggestions(keyword) {
    if (keyword.length < 2) return [];
    
    try {
      const url = `https://geoapi.heartrails.com/api/json?method=suggest&matching=like&keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(url);
      
      if (!res.ok) return [];
      
      const data = await res.json();
      if (data.response && data.response.location) {
        return data.response.location.map(loc => ({
          text: `${loc.prefecture}${loc.city}${loc.town}`,
          pref: loc.prefecture,
          city: loc.city,
          town: loc.town,
          zipcode: loc.postal,
          lat: parseFloat(loc.y) || null,
          lon: parseFloat(loc.x) || null
        }));
      }
    } catch (error) {
      console.error('サジェスチョン取得エラー:', error);
    }
    return [];
  }

  function showSuggestions(suggestionList) {
    suggestions = suggestionList;
    selectedSuggestionIndex = -1;
    
    if (suggestions.length === 0) {
      suggestionsEl.classList.add('hidden');
      return;
    }
    
    suggestionsEl.innerHTML = suggestions.map((suggestion, index) => `
      <div class="suggestion-item" data-index="${index}">
        ${suggestion.text}
      </div>
    `).join('');
    
    suggestionsEl.classList.remove('hidden');
  }

  function hideSuggestions() {
    suggestionsEl.classList.add('hidden');
    suggestions = [];
    selectedSuggestionIndex = -1;
  }

  function selectSuggestion(index) {
    if (index < 0 || index >= suggestions.length) return;
    
    const suggestion = suggestions[index];
    addressInput.value = suggestion.text;
    hideSuggestions();
    
    // APIから取得した座標を直接使用
    if (suggestion.lat && suggestion.lon) {
      console.log('サジェスチョンの座標を使用:', {lat: suggestion.lat, lng: suggestion.lon});
      
      // 結果を直接表示
      zipcodeFromAddressEl.textContent = suggestion.zipcode || '';
      prefFromAddressEl.textContent = suggestion.pref || '';
      cityFromAddressEl.textContent = suggestion.city || '';
      townFromAddressEl.textContent = suggestion.town || '';
      fullAddressFromAddressEl.textContent = suggestion.text;
      addressResultEl.classList.remove('hidden');
      
      // 座標を更新
      updateMap({lat: suggestion.lat, lng: suggestion.lon}, suggestion.text);
      setAddressStatus('');
    } else {
      // 座標がない場合は通常の検索を実行
      setTimeout(() => {
        addressForm.dispatchEvent(new Event('submit'));
      }, 100);
    }
  }

  // イベントリスナー
  addressInput.addEventListener('input', async (e) => {
    const keyword = e.target.value.trim();
    if (keyword.length < 2) {
      hideSuggestions();
      return;
    }
    
    const suggestionList = await fetchAddressSuggestions(keyword);
    showSuggestions(suggestionList);
  });

  addressInput.addEventListener('keydown', (e) => {
    if (suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
        updateSuggestionSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        updateSuggestionSelection();
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(selectedSuggestionIndex);
        } else {
          addressForm.dispatchEvent(new Event('submit'));
        }
        break;
      case 'Escape':
        hideSuggestions();
        break;
    }
  });

  function updateSuggestionSelection() {
    const items = suggestionsEl.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      if (index === selectedSuggestionIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  suggestionsEl.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const index = parseInt(item.dataset.index);
      selectSuggestion(index);
    }
  });

  // 外部クリックでサジェスチョンを閉じる
  document.addEventListener('click', (e) => {
    if (!addressInput.contains(e.target) && !suggestionsEl.contains(e.target)) {
      hideSuggestions();
    }
  });

  // タブ切り替え機能
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  function switchTab(tabName) {
    // タブボタンの状態を更新
    tabButtons.forEach(button => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // タブコンテンツの表示を切り替え
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // タブ切り替え時にサジェスチョンを閉じる
    hideSuggestions();
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  });

  // 地図の初期化
  let map;
  let marker;

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
  }

  function updateMap(coords, address) {
    if (!map) {
      initMap();
    }

    if (marker) {
      map.removeLayer(marker);
    }

    marker = L.marker([coords.lat, coords.lng]).addTo(map);
    marker.bindPopup(address).openPopup();
    map.setView([coords.lat, coords.lng], 16);
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'error' : '';
  }

  function setAddressStatus(message, isError = false) {
    addressStatusEl.textContent = message;
    addressStatusEl.className = isError ? 'error' : '';
  }

  // 郵便番号検索API呼び出し
  async function searchAddress(zipcode) {
    const cleanZipcode = zipcode.replace(/[-\s]/g, '');
    
    if (!/^\d{7}$/.test(cleanZipcode)) {
      throw new Error('郵便番号は7桁の数字で入力してください');
    }

    // HeartRails Geo APIを使用（郵便番号から座標も取得）
    const url = `https://geoapi.heartrails.com/api/json?method=searchByPostal&postal=${cleanZipcode}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error('APIエラー: ネットワーク応答がありません');
    }
    
    const data = await res.json();
    
    if (!data.response || !data.response.location || data.response.location.length === 0) {
      throw new Error('郵便番号が見つかりませんでした');
    }
    
    const location = data.response.location[0];
    
    return {
      address1: location.prefecture,
      address2: location.city,
      address3: location.town,
      zipcode: location.postal,
      lat: parseFloat(location.y),
      lon: parseFloat(location.x)
    };
  }

  // 住所から郵便番号を検索
  async function fetchZipcodeByAddress(address) {
    try {
      // HeartRails Geo APIを使用
      const url = `https://geoapi.heartrails.com/api/json?method=searchByAddress&address=${encodeURIComponent(address)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('APIエラー: HeartRails Geo APIへのアクセスに失敗しました');
      }
      
      const data = await res.json();
      
      if (!data.response || !data.response.location || data.response.location.length === 0) {
        throw new Error('住所が見つかりませんでした');
      }
      
      const location = data.response.location[0];
      
      return {
        pref: location.prefecture,
        city: location.city,
        town: location.town,
        full: `${location.prefecture}${location.city}${location.town}`,
        zipcode: location.postal,
        lat: parseFloat(location.y),
        lon: parseFloat(location.x)
      };
      
    } catch (error) {
      console.error('住所検索エラー:', error);
      throw error;
    }
  }

  // フォーム送信処理
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const zipcode = zipcodeInput.value.trim();
    
    if (!zipcode) {
      setStatus('郵便番号を入力してください', true);
      zipcodeInput.focus();
      return;
    }
    
    try {
      setStatus('検索中...');
      searchBtn.disabled = true;
      
      const result = await searchAddress(zipcode);
      
      prefEl.textContent = result.address1;
      cityEl.textContent = result.address2;
      townEl.textContent = result.address3;
      fullAddressEl.textContent = `${result.address1}${result.address2}${result.address3}`;
      zipcodeResultEl.textContent = `${result.zipcode.slice(0,3)}-${result.zipcode.slice(3)}`;
      
      resultEl.classList.remove('hidden');
      setStatus('');
      
      // 地図を更新
      const address = `${result.address1}${result.address2}${result.address3}`;
      if (result.lat && result.lon) {
        // APIから取得した座標を直接使用
        updateMap({lat: result.lat, lng: result.lon}, address);
      } else {
        // 座標がない場合はジオコーディングを使用
        try {
          const coords = await geocode(address);
          updateMap(coords, address);
        } catch (geoErr) {
          console.error('地図の更新に失敗:', geoErr);
          setStatus('地図の座標取得に失敗しました', true);
        }
      }
      
    } catch (err) {
      setStatus(err.message || '検索に失敗しました', true);
      resultEl.classList.add('hidden');
    } finally {
      searchBtn.disabled = false;
    }
  });

  // 住所検索フォームの送信処理
  addressForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const address = addressInput.value.trim();
    
    if (!address) {
      setAddressStatus('住所を入力してください', true);
      addressInput.focus();
      return;
    }
    
    try {
      setAddressStatus('検索中...');
      
      const result = await fetchZipcodeByAddress(address);
      
      zipcodeFromAddressEl.textContent = result.zipcode;
      prefFromAddressEl.textContent = result.pref;
      cityFromAddressEl.textContent = result.city;
      townFromAddressEl.textContent = result.town;
      fullAddressFromAddressEl.textContent = result.full;
      addressResultEl.classList.remove('hidden');
      
      // 地図を更新
      if (result.lat && result.lon) {
        updateMap({lat: result.lat, lng: result.lon}, result.full);
      } else {
        try {
          const coords = await geocode(result.full);
          updateMap(coords, result.full);
        } catch (geoErr) {
          console.error('地図の更新に失敗:', geoErr);
          setAddressStatus('地図の座標取得に失敗しました', true);
        }
      }
      
      setAddressStatus('');
      
    } catch (err) {
      setAddressStatus(err.message || '検索に失敗しました', true);
      addressResultEl.classList.add('hidden');
    }
  });

  // ジオコーディング（住所→座標）
  async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AddressSearchApp/1.0'
      }
    });
    
    if (!res.ok) {
      throw new Error('ジオコーディングに失敗しました');
    }
    
    const data = await res.json();
    
    if (!data || data.length === 0) {
      throw new Error('座標が見つかりませんでした');
    }
    
    const location = data[0];
    return {
      lat: parseFloat(location.lat),
      lng: parseFloat(location.lon)
    };
  }

  // 初期化
  initMap();
});
