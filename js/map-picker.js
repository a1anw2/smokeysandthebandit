// ============================================================
// MAP PICKER — Leaflet-based location selection UI
// 3-step flow: 1) Pick area  2) Pick START  3) Pick FINISH
// ============================================================
class MapPicker {
  constructor() {
    this.map = null;
    this.container = null;
    this.radiusCircle = null;
    this.confirmBtn = null;
    this.cancelBtn = null;
    this.instructionEl = null;
    this.searchInput = null;
    this.onSelect = null;
    this.selectedLat = null;
    this.selectedLng = null;
    this.startMarker = null;
    this.finishMarker = null;
    this.startLatLng = null;
    this.finishLatLng = null;
    this.step = 0; // 0=pick area, 1=pick start, 2=pick finish
    this._leafletLoaded = false;
  }

  show(onLocationSelected) {
    this.onSelect = onLocationSelected;
    this.step = 0;
    this.startLatLng = null;
    this.finishLatLng = null;
    this.startMarker = null;
    this.finishMarker = null;
    this._createContainer();
    this._loadLeaflet().then(() => this._initMap());
  }

  hide() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    // Remove elements appended to document.body (outside map container)
    if (this.instructionEl && this.instructionEl.parentNode) {
      this.instructionEl.parentNode.removeChild(this.instructionEl);
    }
    if (this._searchWrapper && this._searchWrapper.parentNode) {
      this._searchWrapper.parentNode.removeChild(this._searchWrapper);
    }
    if (this._citiesBar && this._citiesBar.parentNode) {
      this._citiesBar.parentNode.removeChild(this._citiesBar);
    }
    if (this.cancelBtn && this.cancelBtn.parentNode) {
      this.cancelBtn.parentNode.removeChild(this.cancelBtn);
    }
    if (this.confirmBtn && this.confirmBtn.parentNode) {
      this.confirmBtn.parentNode.removeChild(this.confirmBtn);
    }
    const rb = document.getElementById('map-reset-btn');
    if (rb) rb.parentNode.removeChild(rb);
    this.container = null;
    this.radiusCircle = null;
    this.confirmBtn = null;
    this.cancelBtn = null;
    this.instructionEl = null;
    this.searchInput = null;
    this._searchWrapper = null;
    this._citiesBar = null;
    this.startMarker = null;
    this.finishMarker = null;
  }

  _createContainer() {
    // Remove any existing container
    const old = document.getElementById('map-container');
    if (old) old.parentNode.removeChild(old);

    // Fill the entire browser window for maximum map area
    this.container = document.createElement('div');
    this.container.id = 'map-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 10;
      border-radius: 0;
    `;
    document.body.appendChild(this.container);

    // Instruction overlay
    this.instructionEl = document.createElement('div');
    this.instructionEl.style.cssText = `
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 1001; background: rgba(0,0,0,0.85); color: #FFD700;
      padding: 10px 24px; border-radius: 6px; font-family: monospace;
      font-size: 14px; pointer-events: none; white-space: nowrap;
    `;
    this.instructionEl.textContent = 'Step 1: Click to select your race area';
    document.body.appendChild(this.instructionEl);

    // Search box wrapper (top center, outside map container to avoid Leaflet capturing clicks)
    this._searchWrapper = document.createElement('div');
    this._searchWrapper.style.cssText = `
      position: fixed; top: 48px; left: 50%; transform: translateX(-50%);
      z-index: 1001; display: flex; gap: 4px;
    `;
    document.body.appendChild(this._searchWrapper);

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search location...';
    this.searchInput.style.cssText = `
      width: 260px; padding: 8px 12px; border: 2px solid #FFD700;
      border-radius: 4px; background: rgba(0,0,0,0.8); color: #FFF;
      font-family: monospace; font-size: 13px; outline: none;
    `;
    this.searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation(); // prevent game input
      if (e.key === 'Enter') this._doSearch();
    });
    this._searchWrapper.appendChild(this.searchInput);

    // Search button
    const searchBtn = document.createElement('button');
    searchBtn.textContent = 'GO';
    searchBtn.style.cssText = `
      padding: 8px 14px; background: #FFD700; color: #111; border: none;
      font-family: monospace; font-size: 13px; font-weight: bold;
      cursor: pointer; border-radius: 4px;
    `;
    searchBtn.addEventListener('click', () => this._doSearch());
    this._searchWrapper.appendChild(searchBtn);

    // Quick-link cities bar
    this._citiesBar = document.createElement('div');
    this._citiesBar.style.cssText = `
      position: fixed; top: 86px; left: 50%; transform: translateX(-50%);
      z-index: 1001; display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
    `;
    const cities = [
      { name: 'Richmond', lat: 37.5407, lng: -77.4360, zoom: 12 },
      { name: 'Chicago', lat: 41.8781, lng: -87.6298, zoom: 12 },
      { name: 'New York', lat: 40.7580, lng: -73.9855, zoom: 12 },
      { name: 'London', lat: 51.5074, lng: -0.1278, zoom: 12 },
      { name: 'Edinburgh', lat: 55.9533, lng: -3.1883, zoom: 12 },
      { name: 'Paris', lat: 48.8566, lng: 2.3522, zoom: 12 },
    ];
    for (const city of cities) {
      const btn = document.createElement('button');
      btn.textContent = city.name;
      btn.style.cssText = `
        background: rgba(0,0,0,0.7); color: #90CAF9; border: 1px solid #90CAF9;
        padding: 5px 12px; font-family: monospace; font-size: 12px;
        cursor: pointer; border-radius: 4px; font-weight: bold;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.background = '#90CAF9'; btn.style.color = '#111'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0,0,0,0.7)'; btn.style.color = '#90CAF9'; });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Only pan the map — user still needs to click the map to select area
        if (this.map) this.map.setView([city.lat, city.lng], city.zoom);
      });
      this._citiesBar.appendChild(btn);
    }
    document.body.appendChild(this._citiesBar);

    // Cancel button
    this.cancelBtn = document.createElement('button');
    this.cancelBtn.textContent = 'CANCEL';
    this.cancelBtn.style.cssText = `
      position: fixed; top: 12px; right: 12px; z-index: 1001;
      background: #444; color: #FFF; border: none; padding: 8px 18px;
      font-family: monospace; font-size: 13px; font-weight: bold;
      cursor: pointer; border-radius: 4px;
    `;
    this.cancelBtn.addEventListener('click', () => {
      this.hide();
      if (this.onCancel) this.onCancel();
    });
    document.body.appendChild(this.cancelBtn);
  }

  async _doSearch() {
    const query = this.searchInput.value.trim();
    if (!query) return;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'CannonballRun/1.0' }
      });
      const results = await resp.json();
      if (results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        this.map.setView([lat, lng], 14);
      } else {
        this.instructionEl.textContent = 'Location not found. Try again.';
        this.instructionEl.style.color = '#F44336';
        setTimeout(() => {
          this.instructionEl.style.color = '#FFD700';
          this._updateInstruction();
        }, 2000);
      }
    } catch (e) {
      console.warn('Search failed:', e);
    }
  }

  _loadLeaflet() {
    if (this._leafletLoaded || window.L) {
      this._leafletLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Load CSS
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);

      // Load JS
      const js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = () => {
        this._leafletLoaded = true;
        resolve();
      };
      js.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.head.appendChild(js);
    });
  }

  _initMap() {
    // Default: Richmond, VA
    this.map = L.map(this.container, {
      zoomControl: true
    }).setView([37.5407, -77.4360], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);

    // Click handler — different behavior per step
    this.map.on('click', (e) => this._onMapClick(e));
  }

  _onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (this.step === 0) {
      // Step 1: Pick race area center
      this.selectedLat = lat;
      this.selectedLng = lng;

      // Show radius circle
      if (this.radiusCircle) this.map.removeLayer(this.radiusCircle);
      this.radiusCircle = L.circle([lat, lng], {
        radius: OSM_FETCH_RADIUS,
        color: '#FFD700',
        fillColor: '#FFD700',
        fillOpacity: 0.08,
        weight: 2
      }).addTo(this.map);

      // Advance to step 1
      this.step = 1;
      this._updateInstruction();
      this._removeConfirmButton();

    } else if (this.step === 1) {
      // Step 2: Pick START point — must be within radius
      if (!this._isWithinRadius(lat, lng)) {
        this._flashError('Start must be within the yellow circle!');
        return;
      }

      this.startLatLng = { lat, lng };
      if (this.startMarker) this.map.removeLayer(this.startMarker);
      this.startMarker = L.circleMarker([lat, lng], {
        radius: 10, color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 0.9, weight: 3
      }).addTo(this.map).bindTooltip('START', {
        permanent: true, direction: 'top', className: 'start-tooltip',
        offset: [0, -12]
      });

      // Advance to step 2
      this.step = 2;
      this._updateInstruction();

    } else if (this.step === 2) {
      // Step 3: Pick FINISH point — must be within radius
      if (!this._isWithinRadius(lat, lng)) {
        this._flashError('Finish must be within the yellow circle!');
        return;
      }

      this.finishLatLng = { lat, lng };
      if (this.finishMarker) this.map.removeLayer(this.finishMarker);
      this.finishMarker = L.circleMarker([lat, lng], {
        radius: 10, color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.9, weight: 3
      }).addTo(this.map).bindTooltip('FINISH', {
        permanent: true, direction: 'top', className: 'finish-tooltip',
        offset: [0, -12]
      });

      this._updateInstruction();
      this._showConfirmButton();
    }
  }

  _isWithinRadius(lat, lng) {
    if (!this.selectedLat || !this.selectedLng) return false;
    const R = 6371000;
    const dLat = (lat - this.selectedLat) * Math.PI / 180;
    const dLon = (lng - this.selectedLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.selectedLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d <= OSM_FETCH_RADIUS;
  }

  _flashError(msg) {
    this.instructionEl.textContent = msg;
    this.instructionEl.style.color = '#F44336';
    setTimeout(() => {
      this.instructionEl.style.color = '#FFD700';
      this._updateInstruction();
    }, 2000);
  }

  _updateInstruction() {
    if (this.step === 0) {
      this.instructionEl.textContent = 'Step 1: Click to select your race area';
    } else if (this.step === 1) {
      this.instructionEl.textContent = 'Step 2: Click to place START point';
      this.instructionEl.style.color = '#4CAF50';
    } else if (this.step === 2) {
      if (this.finishLatLng) {
        this.instructionEl.textContent = 'Ready to race!';
        this.instructionEl.style.color = '#FFD700';
      } else {
        this.instructionEl.textContent = 'Step 3: Click to place FINISH point';
        this.instructionEl.style.color = '#FFD700';
      }
    }
  }

  _removeConfirmButton() {
    if (this.confirmBtn && this.confirmBtn.parentNode) {
      this.confirmBtn.parentNode.removeChild(this.confirmBtn);
      this.confirmBtn = null;
    }
  }

  _showConfirmButton() {
    this._removeConfirmButton();

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'RESET';
    resetBtn.id = 'map-reset-btn';
    resetBtn.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateX(-100px);
      z-index: 1001; background: #666; color: #FFF; border: none;
      padding: 14px 28px; font-family: monospace; font-size: 16px;
      font-weight: bold; cursor: pointer; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;
    resetBtn.addEventListener('click', () => {
      this._resetSelection();
    });
    document.body.appendChild(resetBtn);

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.textContent = 'RACE!';
    this.confirmBtn.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateX(60px);
      z-index: 1001; background: #FFD700; color: #111; border: none;
      padding: 14px 36px; font-family: monospace; font-size: 18px;
      font-weight: bold; cursor: pointer; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;
    this.confirmBtn.addEventListener('click', () => {
      const lat = this.selectedLat;
      const lng = this.selectedLng;
      const startLL = this.startLatLng;
      const finishLL = this.finishLatLng;
      this.hide();
      // Also remove reset button
      const rb = document.getElementById('map-reset-btn');
      if (rb) rb.parentNode.removeChild(rb);
      if (this.onSelect) this.onSelect(lat, lng, startLL, finishLL);
    });
    document.body.appendChild(this.confirmBtn);
  }

  _resetSelection() {
    // Remove markers and circle
    if (this.startMarker) { this.map.removeLayer(this.startMarker); this.startMarker = null; }
    if (this.finishMarker) { this.map.removeLayer(this.finishMarker); this.finishMarker = null; }
    if (this.radiusCircle) { this.map.removeLayer(this.radiusCircle); this.radiusCircle = null; }
    this.startLatLng = null;
    this.finishLatLng = null;
    this.selectedLat = null;
    this.selectedLng = null;
    this.step = 0;
    this._removeConfirmButton();
    const rb = document.getElementById('map-reset-btn');
    if (rb) rb.parentNode.removeChild(rb);
    this.instructionEl.style.color = '#FFD700';
    this._updateInstruction();
  }
}
