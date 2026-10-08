/**
 * FoodCycle AI - Leaflet Map & Geospatial Routing Controller
 */

let mapInstance = null;
let markersLayer = null;
let routeLayer = null;

function initRescueMap() {
  if (mapInstance) return;

  const mapContainer = document.getElementById('rescue-map');
  if (!mapContainer) return;

  // Default center: Chennai urban area (matching seed data)
  const defaultCenter = [13.0600, 80.2200];

  mapInstance = L.map('rescue-map', {
    center: defaultCenter,
    zoom: 12,
    zoomControl: true
  });

  // OpenStreetMap dark / elegant tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance);

  markersLayer = L.layerGroup().addTo(mapInstance);
  routeLayer = L.layerGroup().addTo(mapInstance);
}

// Custom DivIcon marker generator
function createCustomIcon(type, iconClass) {
  let bgColor = '#3b82f6';
  if (type === 'ngo') bgColor = '#ef4444';
  if (type === 'plant') bgColor = '#10b981';

  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      background: ${bgColor};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      border: 2px solid #fff;
    "><i class="${iconClass}"></i></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

// Render all donors, NGOs, and recycling hubs on map
function renderMapLocations(foodList, orgList) {
  if (!mapInstance) initRescueMap();
  markersLayer.clearLayers();

  // Render NGOs & Shelters
  orgList.forEach(org => {
    const isPlant = org.type === 'biogas_plant' || org.type === 'compost_plant';
    const icon = isPlant 
      ? createCustomIcon('plant', 'fa-solid fa-seedling')
      : createCustomIcon('ngo', 'fa-solid fa-house-chimney');

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
        <h4 style="margin: 0 0 4px 0; color: #0f172a; font-weight: 700;">${org.name}</h4>
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px;">${org.address}</p>
        <span style="display: inline-block; font-size: 11px; padding: 2px 6px; background: #e2e8f0; border-radius: 4px; font-weight: 600;">
          ${org.type.replace('_', ' ').toUpperCase()}
        </span>
        <div style="margin-top: 6px; font-size: 11px; color: #0f172a;">Contact: <strong>${org.contact}</strong></div>
      </div>
    `;

    L.marker([org.lat, org.lng], { icon })
      .bindPopup(popupHtml)
      .addTo(markersLayer);
  });

  // Render Active SOS Donors
  foodList.filter(f => f.status === 'sos_donation').forEach(item => {
    const icon = createCustomIcon('donor', 'fa-solid fa-bell');
    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; min-width: 200px;">
        <span style="background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">SOS ACTIVE</span>
        <h4 style="margin: 6px 0 2px 0; color: #0f172a; font-weight: 700;">${item.title}</h4>
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px;">Donor: ${item.donorName}</p>
        <p style="margin: 0 0 8px 0; font-size: 11px;">Qty: <strong>${item.quantity} ${item.unit}</strong></p>
        <button onclick="window.focusSosRoute('${item.id}')" style="background: #0f172a; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">
          View Route Line
        </button>
      </div>
    `;

    L.marker([item.lat || 13.0505, item.lng || 80.2115], { icon })
      .bindPopup(popupHtml)
      .addTo(markersLayer);
  });
}

// Draw route polyline between donor and recipient
async function drawRouteOnMap(foodId) {
  if (!mapInstance) initRescueMap();
  routeLayer.clearLayers();

  try {
    const res = await fetch(`/api/sos/route/${foodId}`);
    const data = await res.json();
    if (!data.success) return;

    const { donor, recipient, distanceKm, estimatedMinutes, routePolyline } = data;

    // Draw route polyline with glowing border
    const routeGlow = L.polyline(routePolyline, {
      color: '#ef4444',
      weight: 8,
      opacity: 0.35,
      lineCap: 'round'
    }).addTo(routeLayer);

    const routeLine = L.polyline(routePolyline, {
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

    // Fit map bounds to encompass the route
    const bounds = L.latLngBounds(routePolyline);
    mapInstance.fitBounds(bounds, { padding: [50, 50] });

  } catch (err) {
    console.error('Failed to draw route:', err);
  }
}
