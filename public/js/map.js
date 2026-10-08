/**
 * FoodCycle AI - Real-Time Leaflet & Geospatial Tracking Engine
 * Features: Multi-tile layers (Street, Dark, Satellite), Animated Rescue Vehicle,
 * Emergency Radar Pulse, Live HUD Telemetry, and Category Filter Controls.
 */

let mapInstance = null;
let tileLayers = {};
let activeTileKey = 'dark';

let markersLayer = null;
let radarLayer = null;
let routeLayer = null;
let vehicleMarker = null;
let vehicleAnimationTimer = null;

// Telemetry State
let currentMission = {
  active: false,
  foodId: null,
  routeCoords: [],
  currentStep: 0,
  distanceKm: 0,
  donorName: '',
  recipientName: '',
  title: ''
};

function initRescueMap() {
  if (mapInstance) return;

  const mapContainer = document.getElementById('rescue-map');
  if (!mapContainer) return;

  const defaultCenter = [13.0600, 80.2200]; // Chennai urban zone

  mapInstance = L.map('rescue-map', {
    center: defaultCenter,
    zoom: 12,
    zoomControl: false // Custom placed controls
  });

  // High-Resolution & Google Maps Tile Layers
  tileLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    maxZoom: 19
  });

  tileLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  });

  tileLayers.street = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    maxZoom: 19
  });

  tileLayers.google_streets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps Platform',
    maxZoom: 20
  });

  tileLayers.google_hybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps Imagery',
    maxZoom: 20
  });

  tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Satellite Tile Server',
    maxZoom: 18
  });

  tileLayers.dark.addTo(mapInstance);

  // Zoom control top right
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);

  radarLayer = L.layerGroup().addTo(mapInstance);
  routeLayer = L.layerGroup().addTo(mapInstance);
  markersLayer = L.layerGroup().addTo(mapInstance);

  setupMapControls();

  // Ensure map tiles settle properly
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 250);

  window.addEventListener('resize', () => {
    if (mapInstance) mapInstance.invalidateSize();
  });
}

// Map UI Controls (Google Maps layer switchers, filters, city jumps, reset)
function setupMapControls() {
  const mapContainer = document.getElementById('rescue-map');
  if (!mapContainer || document.getElementById('custom-map-hud')) return;

  // Create floating HUD on map
  const hud = document.createElement('div');
  hud.id = 'custom-map-hud';
  hud.className = 'map-floating-hud';
  hud.innerHTML = `
    <div class="hud-topbar">
      <div class="hud-layer-switchers">
        <button class="hud-btn active" id="btn-layer-dark" onclick="switchMapLayer('dark')"><i class="fa-solid fa-moon"></i> Dark</button>
        <button class="hud-btn" id="btn-layer-osm" onclick="switchMapLayer('osm')"><i class="fa-solid fa-map-marked-alt"></i> OSM</button>
        <button class="hud-btn" id="btn-layer-google_streets" onclick="switchMapLayer('google_streets')"><i class="fa-brands fa-google text-primary"></i> Google Streets</button>
        <button class="hud-btn" id="btn-layer-google_hybrid" onclick="switchMapLayer('google_hybrid')"><i class="fa-solid fa-earth-americas text-warning"></i> Google Hybrid</button>
        <button class="hud-btn" id="btn-layer-sat" onclick="switchMapLayer('satellite')"><i class="fa-solid fa-satellite"></i> Satellite</button>
      </div>
      <div class="hud-actions d-flex gap-1">
        <button class="hud-btn" onclick="locateUserGps()" title="Locate My GPS Position"><i class="fa-solid fa-crosshairs"></i> My GPS</button>
        <button class="hud-btn" onclick="switchMapCity('vizag')" title="Switch to Visakhapatnam [17.6868, 83.2185]"><i class="fa-solid fa-location-dot text-danger"></i> Vizag</button>
        <button class="hud-btn" onclick="switchMapCity('chennai')" title="Switch to Chennai [13.0600, 80.2200]">Chennai</button>
        <button class="hud-btn" onclick="resetMapCamera()" title="Reset Center View"><i class="fa-solid fa-rotate-left"></i></button>
      </div>
    </div>

    <!-- Live Telemetry Banner (Visible during active mission) -->
    <div id="mission-telemetry-box" class="telemetry-box" style="display: none;">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <div class="d-flex align-items-center gap-2">
          <span class="telemetry-live-dot"></span>
          <strong style="color: #ef4444; font-size: 12px; letter-spacing: 0.5px;">LIVE DISPATCH TRACKING</strong>
        </div>
        <span id="tel-speed" class="badge badge-warning">28 km/h</span>
      </div>
      <div id="tel-mission-title" style="font-size: 13px; font-weight: 700; color: #fff;">Surplus Food Transport</div>
      <div class="telemetry-route-labels">
        <span id="tel-from"><i class="fa-solid fa-store"></i> Donor</span>
        <i class="fa-solid fa-arrow-right" style="color: #94a3b8; font-size: 10px;"></i>
        <span id="tel-to"><i class="fa-solid fa-heart"></i> Orphanage</span>
      </div>
      <div class="telemetry-progress-track">
        <div id="tel-progress-bar" class="telemetry-progress-fill" style="width: 15%;"></div>
      </div>
      <div class="d-flex justify-content-between align-items-center mt-1" style="font-size: 11px; color: #94a3b8;">
        <span id="tel-distance">Remaining: 3.8 km</span>
        <span id="tel-eta">ETA: 9 mins</span>
      </div>
    </div>
  `;
  mapContainer.appendChild(hud);
}

// Switch between 100% Free Base Layers (No API key needed)
window.switchMapLayer = function(layerKey) {
  if (!mapInstance || !tileLayers[layerKey]) return;

  // Remove existing base layers
  Object.values(tileLayers).forEach(layer => {
    if (layer && mapInstance.hasLayer(layer)) {
      mapInstance.removeLayer(layer);
    }
  });

  tileLayers[layerKey].addTo(mapInstance);
  activeTileKey = layerKey;

  document.querySelectorAll('.hud-layer-switchers .hud-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-layer-${layerKey === 'satellite' ? 'sat' : layerKey}`)?.classList.add('active');

  const names = {
    dark: 'CartoDB Dark Matter',
    osm: 'OpenStreetMap Global',
    street: 'CartoDB Voyager Clean Streets',
    google_streets: 'Google Maps Roadmap',
    google_hybrid: 'Google Maps Hybrid Satellite',
    satellite: 'High-Res Satellite Imagery'
  };
  if (typeof showToast === 'function') {
    showToast(`🗺️ Switched to ${names[layerKey] || layerKey}`, 'info');
  }
};

// Google Maps Platform 1-Click Driving Navigation
window.openInGoogleMaps = function(lat1, lng1, lat2, lng2) {
  let url;
  if (lat2 !== undefined && lng2 !== undefined) {
    url = `https://www.google.com/maps/dir/?api=1&origin=${lat1},${lng1}&destination=${lat2},${lng2}&travelmode=driving`;
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${lat1},${lng1}`;
  }
  window.open(url, '_blank');
  if (typeof showToast === 'function') {
    showToast('🚗 Opening Google Maps Driving Directions...', 'info');
  }
};

// Google Maps 360° Street View Panorama
window.openStreetView = function(lat, lng) {
  const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  window.open(url, '_blank');
  if (typeof showToast === 'function') {
    showToast('👁️ Opening Google Street View 360° Panorama...', 'info');
  }
};

// 1-Click Browser GPS Geolocation
window.locateUserGps = function() {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') showToast('Geolocation is not supported by your browser.', 'error');
    return;
  }

  showToast('🛰️ Fetching your live GPS location...', 'info');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      mapInstance.setView([latitude, longitude], 14);

      const userIcon = createCustomIcon('donor', 'fa-solid fa-user-location');
      L.marker([latitude, longitude], { icon: userIcon })
        .bindPopup('<div class="map-popup-card"><h4>📍 Your Live Location</h4><p>Emergency rescue radius centered here.</p></div>')
        .addTo(markersLayer)
        .openPopup();

      showToast(`📍 Found your location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'success');
    },
    err => {
      showToast('Could not access GPS. Please allow location permissions in browser.', 'warning');
    },
    { timeout: 8000 }
  );
};

// Switch between cities (including Visakhapatnam [17.6868, 83.2185]!)
window.switchMapCity = function(city) {
  if (!mapInstance) return;

  if (city === 'vizag') {
    const vizagCenter = [17.6868, 83.2185];
    mapInstance.setView(vizagCenter, 13);

    // Render Visakhapatnam sample rescue points if not already present
    renderVizagRescueNodes();
    if (typeof showToast === 'function') {
      showToast('📍 Map centered on Visakhapatnam [17.6868, 83.2185]', 'success');
    }
  } else {
    mapInstance.setView([13.0600, 80.2200], 12);
    if (typeof showToast === 'function') {
      showToast('📍 Map centered on Chennai urban network', 'info');
    }
  }
};

// Render Visakhapatnam rescue nodes
function renderVizagRescueNodes() {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  radarLayer.clearLayers();

  const vizagDonor = {
    title: '60 Servings Veg Pulao & Dal Tadka',
    donorName: 'Grand Beach Bay Banquet',
    donorAddress: 'RK Beach Rd, Visakhapatnam',
    lat: 17.7120,
    lng: 83.3180,
    quantity: 60,
    unit: 'servings',
    storageTemp: 29
  };

  const vizagOrphanage = {
    name: 'Prema Samajam Care & Shelter',
    address: 'Dabagardens, Visakhapatnam',
    lat: 17.7155,
    lng: 83.2980,
    type: 'orphanage',
    capacity: 75,
    contact: '+91 891 256 7890'
  };

  const vizagBiogas = {
    name: 'GVMC Clean Energy Bio-Digester Hub',
    address: 'Kapuluppada Waste Processing Park, Visakhapatnam',
    lat: 17.8200,
    lng: 83.3600,
    type: 'biogas_plant',
    dailyCapacityKg: 5000
  };

  // Add markers
  const donorIcon = createCustomIcon('donor', 'fa-solid fa-bell');
  const ngoIcon = createCustomIcon('ngo', 'fa-solid fa-house-chimney');
  const plantIcon = createCustomIcon('plant', 'fa-solid fa-seedling');

  L.marker([vizagDonor.lat, vizagDonor.lng], { icon: donorIcon })
    .bindPopup(`<div class="map-popup-card"><span class="badge badge-sos mb-1">VIZAG SOS ACTIVE</span><h4>${vizagDonor.title}</h4><p>${vizagDonor.donorName}</p></div>`)
    .addTo(markersLayer);

  L.marker([vizagOrphanage.lat, vizagOrphanage.lng], { icon: ngoIcon })
    .bindPopup(`<div class="map-popup-card"><span class="badge badge-success mb-1">ORPHANAGE</span><h4>${vizagOrphanage.name}</h4><p>${vizagOrphanage.address}</p></div>`)
    .addTo(markersLayer);

  L.marker([vizagBiogas.lat, vizagBiogas.lng], { icon: plantIcon })
    .bindPopup(`<div class="map-popup-card"><span class="badge badge-warning mb-1">BIOGAS HUB</span><h4>${vizagBiogas.name}</h4><p>${vizagBiogas.address}</p></div>`)
    .addTo(markersLayer);

  // Radar circle around Vizag donor
  L.circle([vizagDonor.lat, vizagDonor.lng], {
    radius: 3000,
    color: '#ef4444',
    fillColor: '#ef4444',
    fillOpacity: 0.1,
    weight: 1,
    dashArray: '4, 4'
  }).addTo(radarLayer);

  // Draw smooth sample rescue route across Vizag
  const vizagRoute = [
    [vizagDonor.lat, vizagDonor.lng],
    [17.7135, 83.3100],
    [17.7142, 83.3040],
    [vizagOrphanage.lat, vizagOrphanage.lng]
  ];

  routeLayer.clearLayers();
  L.polyline(vizagRoute, { color: '#ef4444', weight: 8, opacity: 0.4 }).addTo(routeLayer);
  L.polyline(vizagRoute, { color: '#dc2626', weight: 4, dashArray: '6, 6' }).addTo(routeLayer);

  // Setup mission and start vehicle
  currentMission = {
    active: true,
    routeCoords: vizagRoute,
    currentStep: 0,
    distanceKm: 2.8,
    estimatedMinutes: 8,
    donorName: vizagDonor.donorName,
    recipientName: vizagOrphanage.name,
    title: vizagDonor.title
  };
  updateTelemetryHUD();
  startAnimatedVehicle();
}


window.resetMapCamera = function() {
  if (!mapInstance) return;
  mapInstance.setView([13.0600, 80.2200], 12);
};

// Custom DivIcon marker generator
function createCustomIcon(type, iconClass, label = '') {
  let bgColor = '#3b82f6';
  let pulseBorder = '';
  if (type === 'ngo') bgColor = '#10b981';
  if (type === 'plant') bgColor = '#059669';
  if (type === 'donor') {
    bgColor = '#ef4444';
    pulseBorder = 'animation: map-pulse-ring 2s infinite;';
  }
  if (type === 'van') bgColor = '#f59e0b';

  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      background: ${bgColor};
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      border: 2px solid #ffffff;
      position: relative;
      ${pulseBorder}
    ">
      <i class="${iconClass}"></i>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

// Render all donors, NGOs, and recycling hubs on map
function renderMapLocations(foodList = [], orgList = [], filterType = 'all') {
  if (!mapInstance) initRescueMap();
  markersLayer.clearLayers();
  radarLayer.clearLayers();

  // Render NGOs & Shelters
  if (filterType === 'all' || filterType === 'ngo') {
    orgList.filter(o => o.type !== 'biogas_plant' && o.type !== 'compost_plant').forEach(org => {
      const icon = createCustomIcon('ngo', 'fa-solid fa-house-chimney');
      const popupHtml = `
        <div class="map-popup-card">
          <span class="badge badge-success mb-1">${org.type.replace('_', ' ').toUpperCase()}</span>
          <h4>${org.name}</h4>
          <p class="text-muted"><i class="fa-solid fa-location-dot"></i> ${org.address}</p>
          <div class="popup-meta">
            <span>Capacity: <strong>${org.capacity || 50} residents</strong></span>
            <span>Phone: <strong>${org.contact}</strong></span>
          </div>
          <div class="d-flex gap-1 mt-2">
            <button onclick="window.openInGoogleMaps(${org.lat}, ${org.lng})" class="btn btn-sm btn-outline flex-1" title="Open in Google Maps">
              <i class="fa-brands fa-google text-primary"></i> G-Maps
            </button>
            <button onclick="window.openStreetView(${org.lat}, ${org.lng})" class="btn btn-sm btn-outline flex-1" title="View in Google Street View">
              <i class="fa-solid fa-street-view text-warning"></i> 360° View
            </button>
          </div>
        </div>
      `;

      L.marker([org.lat, org.lng], { icon })
        .bindPopup(popupHtml)
        .addTo(markersLayer);
    });
  }

  // Render Biogas / Compost Hubs
  if (filterType === 'all' || filterType === 'plant') {
    orgList.filter(o => o.type === 'biogas_plant' || o.type === 'compost_plant').forEach(plant => {
      const icon = createCustomIcon('plant', 'fa-solid fa-seedling');
      const popupHtml = `
        <div class="map-popup-card">
          <span class="badge badge-warning mb-1">ORGANIC RECYCLING HUB</span>
          <h4>${plant.name}</h4>
          <p class="text-muted"><i class="fa-solid fa-location-dot"></i> ${plant.address}</p>
          <div class="popup-meta">
            <span>Daily Capacity: <strong>${plant.dailyCapacityKg} kg/day</strong></span>
            <span>Technology: <strong>Anaerobic Digestion</strong></span>
          </div>
          <div class="d-flex gap-1 mt-2">
            <button onclick="window.openInGoogleMaps(${plant.lat}, ${plant.lng})" class="btn btn-sm btn-outline flex-1" title="Open in Google Maps">
              <i class="fa-brands fa-google text-primary"></i> G-Maps
            </button>
            <button onclick="window.openStreetView(${plant.lat}, ${plant.lng})" class="btn btn-sm btn-outline flex-1" title="View in Google Street View">
              <i class="fa-solid fa-street-view text-warning"></i> 360° View
            </button>
          </div>
        </div>
      `;

      L.marker([plant.lat, plant.lng], { icon })
        .bindPopup(popupHtml)
        .addTo(markersLayer);
    });
  }

  // Render Active SOS Donors (with radar circle zone)
  if (filterType === 'all' || filterType === 'donor') {
    foodList.filter(f => f.status === 'sos_donation').forEach(item => {
      const icon = createCustomIcon('donor', 'fa-solid fa-bell');
      const coords = [item.lat || 13.0505, item.lng || 80.2115];

      // Radar radius circle showing 3km emergency rescue zone
      L.circle(coords, {
        radius: 2500,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '4, 4'
      }).addTo(radarLayer);

      const popupHtml = `
        <div class="map-popup-card">
          <span class="badge badge-sos mb-1">SOS ACTIVE &bull; FREE DONATION</span>
          <h4>${item.title}</h4>
          <p class="text-muted"><i class="fa-solid fa-building"></i> ${item.donorName}</p>
          <p class="text-muted"><i class="fa-solid fa-location-dot"></i> ${item.donorAddress}</p>
          <div class="popup-meta">
            <span>Quantity: <strong>${item.quantity} ${item.unit}</strong></span>
            <span>Safe Temp: <strong>${item.storageTemp}°C</strong></span>
          </div>
          <div class="d-flex gap-1 mt-2">
            <button onclick="window.focusSosRoute('${item.id}')" class="btn btn-sm btn-danger flex-1">
              <i class="fa-solid fa-route"></i> Track Van
            </button>
            <button onclick="window.openInGoogleMaps(${coords[0]}, ${coords[1]})" class="btn btn-sm btn-outline flex-1" title="Open in Google Maps">
              <i class="fa-brands fa-google text-primary"></i> G-Maps
            </button>
            <button onclick="window.openStreetView(${coords[0]}, ${coords[1]})" class="btn btn-sm btn-outline" title="Street View">
              <i class="fa-solid fa-street-view text-warning"></i>
            </button>
          </div>
        </div>
      `;

      L.marker(coords, { icon })
        .bindPopup(popupHtml)
        .addTo(markersLayer);
    });
  }
}

// Draw route polyline between donor and recipient & start live vehicle tracking
async function drawRouteOnMap(foodId, autoStartVehicle = true) {
  if (!mapInstance) initRescueMap();
  routeLayer.clearLayers();
  if (vehicleMarker) {
    mapInstance.removeLayer(vehicleMarker);
    vehicleMarker = null;
  }
  if (vehicleAnimationTimer) {
    clearInterval(vehicleAnimationTimer);
    vehicleAnimationTimer = null;
  }

  try {
    const res = await fetch(`/api/sos/route/${foodId}`);
    const data = await res.json();
    if (!data.success) return;

    const { donor, recipient, distanceKm, estimatedMinutes, routePolyline, title } = data;

    // Outer glow line
    L.polyline(routePolyline, {
      color: '#ef4444',
      weight: 10,
      opacity: 0.3,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(routeLayer);

    // Inner animated road dashed line
    L.polyline(routePolyline, {
      color: '#dc2626',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.95
    }).addTo(routeLayer);

    // Update ETA badge
    const badge = document.getElementById('route-eta-badge');
    if (badge) {
      badge.style.display = 'inline-flex';
      badge.innerHTML = `<i class="fa-solid fa-route"></i> ${distanceKm} km &bull; ETA ~${estimatedMinutes} mins`;
    }

    // Set mission state
    currentMission = {
      active: true,
      foodId,
      routeCoords: routePolyline,
      currentStep: 0,
      distanceKm,
      estimatedMinutes,
      donorName: donor.name,
      recipientName: recipient.name,
      title: title || 'Food Rescue Shipment'
    };

    updateTelemetryHUD();

    // Zoom map smoothly to bounds
    const bounds = L.latLngBounds(routePolyline);
    mapInstance.fitBounds(bounds, { padding: [60, 60] });

    if (autoStartVehicle) {
      startAnimatedVehicle();
    }

  } catch (err) {
    console.error('Failed to draw route:', err);
  }
}

// Update the floating telemetry box on map
function updateTelemetryHUD() {
  const box = document.getElementById('mission-telemetry-box');
  if (!box) return;

  if (!currentMission.active) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  document.getElementById('tel-mission-title').textContent = currentMission.title;
  document.getElementById('tel-from').innerHTML = `<i class="fa-solid fa-store"></i> ${currentMission.donorName}`;
  document.getElementById('tel-to').innerHTML = `<i class="fa-solid fa-heart"></i> ${currentMission.recipientName}`;
  document.getElementById('tel-distance').textContent = `Remaining: ${currentMission.distanceKm} km`;
  document.getElementById('tel-eta').textContent = `ETA: ${currentMission.estimatedMinutes} mins`;
}

// Smooth Real-Time Rescue Van Animation along the polyline waypoints
function startAnimatedVehicle() {
  if (!currentMission.routeCoords || currentMission.routeCoords.length === 0) return;

  const points = currentMission.routeCoords;
  currentMission.currentStep = 0;

  // Van marker
  const vanIcon = createCustomIcon('van', 'fa-solid fa-truck-fast');
  vehicleMarker = L.marker(points[0], { icon: vanIcon, zIndexOffset: 1000 }).addTo(mapInstance);

  vehicleMarker.bindPopup(`
    <div style="font-size: 12px; font-weight: 700; color: #0f172a;">
      <i class="fa-solid fa-truck-fast text-warning"></i> Rescue Van #FC-2026
      <div style="font-size: 11px; font-weight: normal; color: #64748b; margin-top: 2px;">
        En Route: Live Dispatch Active
      </div>
    </div>
  `);

  const totalPoints = points.length;

  vehicleAnimationTimer = setInterval(() => {
    currentMission.currentStep++;

    if (currentMission.currentStep >= totalPoints) {
      // Arrived at destination!
      clearInterval(vehicleAnimationTimer);
      vehicleAnimationTimer = null;

      document.getElementById('tel-progress-bar').style.width = '100%';
      document.getElementById('tel-distance').textContent = 'Arrived at Destination';
      document.getElementById('tel-eta').textContent = 'Delivered!';
      document.getElementById('tel-speed').textContent = 'Arrived';
      document.getElementById('tel-speed').className = 'badge badge-success';

      vehicleMarker.openPopup();

      if (typeof showToast === 'function') {
        showToast(`🚚 Delivery Complete! Food safely delivered to ${currentMission.recipientName}.`, 'success');
      }
      return;
    }

    const currentCoord = points[currentMission.currentStep];
    vehicleMarker.setLatLng(currentCoord);

    // Update progress
    const pct = Math.round((currentMission.currentStep / (totalPoints - 1)) * 100);
    const remainingKm = Math.max(0.1, (currentMission.distanceKm * (1 - pct / 100))).toFixed(1);
    const remainingMin = Math.max(1, Math.round(currentMission.estimatedMinutes * (1 - pct / 100)));

    const progressBar = document.getElementById('tel-progress-bar');
    if (progressBar) progressBar.style.width = `${pct}%`;

    const distEl = document.getElementById('tel-distance');
    if (distEl) distEl.textContent = `Remaining: ${remainingKm} km`;

    const etaEl = document.getElementById('tel-eta');
    if (etaEl) etaEl.textContent = `ETA: ${remainingMin} mins`;

  }, 1200); // Step every 1.2s for smooth visible vehicle movement
}
