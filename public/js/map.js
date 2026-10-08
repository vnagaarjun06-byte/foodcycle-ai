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

  // Tile Layers
  tileLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    maxZoom: 19
  });

  tileLayers.street = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CartoDB',
    maxZoom: 19
  });

  tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
    maxZoom: 18
  });

  tileLayers.dark.addTo(mapInstance);

  // Zoom control top right
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);

  // Layers setup
  radarLayer = L.layerGroup().addTo(mapInstance);
  routeLayer = L.layerGroup().addTo(mapInstance);
  markersLayer = L.layerGroup().addTo(mapInstance);

  setupMapControls();
}

// Map UI Controls (Layer switchers, filters, reset)
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
        <button class="hud-btn" id="btn-layer-street" onclick="switchMapLayer('street')"><i class="fa-solid fa-map"></i> Street</button>
        <button class="hud-btn" id="btn-layer-sat" onclick="switchMapLayer('satellite')"><i class="fa-solid fa-satellite"></i> Satellite</button>
      </div>
      <div class="hud-actions">
        <button class="hud-btn" onclick="resetMapCamera()" title="Reset Center View"><i class="fa-solid fa-crosshairs"></i> Center</button>
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

// Switch between Dark, Street, Satellite base layers
window.switchMapLayer = function(layerKey) {
  if (!mapInstance || !tileLayers[layerKey]) return;

  Object.values(tileLayers).forEach(layer => mapInstance.removeLayer(layer));
  tileLayers[layerKey].addTo(mapInstance);
  activeTileKey = layerKey;

  document.querySelectorAll('.hud-layer-switchers .hud-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-layer-${layerKey === 'satellite' ? 'sat' : layerKey}`)?.classList.add('active');
};

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
          <div class="mt-2">
            <button onclick="window.focusSosRoute('${item.id}')" class="btn btn-sm btn-danger w-100">
              <i class="fa-solid fa-route"></i> Track Rescue Route
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
