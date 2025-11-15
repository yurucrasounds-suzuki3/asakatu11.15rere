(() => {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('zipcode');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');
  const prefEl = document.getElementById('pref');
  const cityEl = document.getElementById('city');
  const townEl = document.getElementById('town');
  const fullEl = document.getElementById('fullAddress');

  // init leaflet map
  const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([35.681236, 139.767125], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  let marker = null;

  function setStatus(msg, type='info'){
    statusEl.textContent = msg || '';
    statusEl.style.color = type === 'error' ? 'var(--danger)' : 'var(--muted)';
  }

  function normalizeZip(zip){
    if(!zip) return '';
    const z = zip.replace(/[^0-9]/g,'');
    return z.slice(0,7);
  }

  async function fetchAddress(zip){
    const url = `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${encodeURIComponent(zip)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if(!res.ok) throw new Error('zipcloud APIの呼び出しに失敗しました');
    const data = await res.json();
    if(data.status !== 200) throw new Error(data.message || '該当する住所が見つかりませんでした');
    if(!data.results || !data.results.length) throw new Error('該当する住所が見つかりませんでした');
    const r = data.results[0];
    return {
      pref: r.address1,
      city: r.address2,
      town: r.address3,
      full: `${r.address1}${r.address2}${r.address3}`
    };
  }

  async function geocode(address){
    const q = `${address} 日本`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if(!res.ok) throw new Error('ジオコーディングに失敗しました');
    const items = await res.json();
    if(!items || !items.length) throw new Error('座標が見つかりませんでした');
    const { lat, lon, display_name } = items[0];
    return { lat: parseFloat(lat), lng: parseFloat(lon), label: display_name };
  }

  function updateMap({ lat, lng }, label){
    if(marker){
      marker.setLatLng([lat, lng]);
    }else{
      marker = L.marker([lat, lng]).addTo(map);
    }
    marker.bindPopup(label || '検索地点');
    map.setView([lat, lng], 16, { animate: true });
    marker.openPopup();
  }

  async function handleSearch(e){
    e.preventDefault();
    const zip = normalizeZip(input.value);
    if(zip.length !== 7){
      setStatus('郵便番号は7桁で入力してください', 'error');
      input.focus();
      return;
    }

    try{
      setStatus('検索中...');
      form.querySelector('button').disabled = true;

      const addr = await fetchAddress(zip);
      prefEl.textContent = addr.pref;
      cityEl.textContent = addr.city;
      townEl.textContent = addr.town;
      fullEl.textContent = addr.full;
      resultEl.classList.remove('hidden');

      setStatus('地図を検索しています...');
      try{
        const pos = await geocode(addr.full);
        updateMap(pos, addr.full);
        setStatus('');
      }catch(geoErr){
        // fallback: prefecture + city only
        try{
          const pos2 = await geocode(`${addr.pref}${addr.city}`);
          updateMap(pos2, `${addr.pref}${addr.city}`);
          setStatus('町域の座標が見つからなかったため、市区町村までで表示しました');
        }catch(geoErr2){
          setStatus('座標が見つかりませんでした', 'error');
        }
      }
    }catch(err){
      setStatus(err.message || '検索に失敗しました', 'error');
      resultEl.classList.add('hidden');
    }finally{
      form.querySelector('button').disabled = false;
    }
  }

  form.addEventListener('submit', handleSearch);

  // 例として初期表示に東京駅周辺
  updateMap({ lat: 35.681236, lng: 139.767125 }, '東京駅');
})();
