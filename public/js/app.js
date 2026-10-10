/**
 * FoodCycle AI - Main Application Client Controller
 */

// State
let appState = {
  allFood: [],
  sosAlerts: [],
  marketDeals: [],
  receipts: [],
  stats: {},
  activeRouteFoodId: null
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  loadAllData();
  
  // Set default datetime inputs
  const now = new Date();
  const prepInput = document.getElementById('food-prepared-at');
  if (prepInput) {
    prepInput.value = new Date(now.getTime() - 2 * 3600 * 1000).toISOString().slice(0, 16);
  }

  // Periodic refresh every 15s
  setInterval(loadAllData, 15000);

  // Real-time second-by-second countdown updater for live vision
  setInterval(updateLiveCountdowns, 1000);

  // Hook Live Vision Walkthrough button
  document.getElementById('btn-run-live-vision')?.addEventListener('click', runLiveRescueVisionWalkthrough);
});

// Helper for switching tabs programmatically or from UI
window.switchTab = function(tabPaneId) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.dataset.tab === tabPaneId) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(p => {
    if (p.id === tabPaneId) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Highlight step bar
  const stepMap = {
    'tab-donor': 1,
    'tab-market': 2,
    'tab-ngo': 3,
    'tab-recycle': 4,
    'tab-tax': 5
  };
  highlightProcessStep(stepMap[tabPaneId] || 1);

  // Invalidate Leaflet map size and redraw Google Charts
  if (tabPaneId === 'tab-ngo' || tabPaneId === 'tab-overview') {
    setTimeout(() => {
      if (typeof mapInstance !== 'undefined' && mapInstance) {
        mapInstance.invalidateSize();
      } else if (typeof initRescueMap === 'function') {
        initRescueMap();
      }
      if (tabPaneId === 'tab-overview' && typeof drawGoogleCharts === 'function') {
        drawGoogleCharts();
      }
    }, 150);
  }
};

function setWorkflowGuidance(message, badgeText = 'System Operational', badgeClass = 'badge-success') {
  const msgEl = document.getElementById('wf-guidance-msg');
  const badgeEl = document.getElementById('workflow-status-badge');
  if (msgEl) msgEl.innerHTML = message;
  if (badgeEl) {
    badgeEl.className = `badge ${badgeClass}`;
    badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(badgeText)}`;
  }
}

function highlightProcessStep(stepNum) {
  // Update both the old and new stepper elements
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`wf-step-${i}`);
    if (stepEl) {
      stepEl.classList.remove('active-step', 'completed-step');
      if (i === stepNum) {
        stepEl.classList.add('active-step');
      } else if (i < stepNum) {
        stepEl.classList.add('completed-step');
      }
    }
  }

  document.querySelectorAll('.process-steps-track .p-step').forEach((el, idx) => {
    if (idx + 1 === stepNum) {
      el.classList.add('active-step');
    } else {
      el.classList.remove('active-step');
    }
  });
}

// Audio Feedback Chimes using Web Audio API
function playChime(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'sos') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'delivery') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'rescue') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch(e) {}
}

// Setup tab navigation
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');

      // If switching to NGO map tab, invalidate Leaflet map size so it renders properly
      if (tab.dataset.tab === 'tab-ngo') {
        setTimeout(() => {
          if (typeof mapInstance !== 'undefined' && mapInstance) {
            mapInstance.invalidateSize();
          } else {
            initRescueMap();
          }
        }, 150);
      }
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Food Log Form Submit
  const donorForm = document.getElementById('donor-food-form');
  if (donorForm) {
    donorForm.addEventListener('submit', handleDonorSubmit);
  }

  // AI Prediction Button
  const btnPredict = document.getElementById('btn-predict-ai');
  if (btnPredict) {
    btnPredict.addEventListener('click', handleAiPredict);
  }

  // Refresh Logs Button
  const btnRefreshLogs = document.getElementById('refresh-logs-btn');
  if (btnRefreshLogs) {
    btnRefreshLogs.addEventListener('click', loadStatsAndLogs);
  }

}

// Master data loader
async function loadAllData() {
  await Promise.all([
    loadStatsAndLogs(),
    loadFoodInventory(),
    loadMarketDeals(),
    loadSosAlerts(),
    loadRecyclingLedger(),
    loadTaxReceipts()
  ]);
}

// Load System Impact Stats & Activity Logs
async function loadStatsAndLogs() {
  try {
    const res = await fetch('/api/receipts/stats/summary');
    const json = await res.json();
    if (!json.success) return;

    const { stats, recentLogs } = json.data;
    appState.stats = stats;

    // Update Counter Badges
    document.getElementById('stat-co2').innerHTML = `${stats.totalCo2SavedKg} <small>kg</small>`;
    document.getElementById('stat-meals').innerHTML = `${stats.totalRescuedMeals} <small>meals</small>`;
    document.getElementById('stat-biogas').innerHTML = `${stats.totalBiogasM3} <small>m³</small>`;
    document.getElementById('stat-receipts').textContent = stats.totalReceiptsCount;

    document.getElementById('badge-market-count').textContent = stats.dynamicStoreCount;
    document.getElementById('badge-sos-count').textContent = stats.sosUrgentCount;

    // Render Logs
    const logStream = document.getElementById('audit-log-stream');
    if (logStream) {
      if (recentLogs.length === 0) {
        logStream.innerHTML = '<div class="text-muted p-3">No activity logs recorded yet.</div>';
      } else {
        logStream.innerHTML = recentLogs.map(l => {
          let typeClass = '';
          if (l.type.includes('SOS')) typeClass = 'LOG_SOS';
          if (l.type.includes('DISCOUNT')) typeClass = 'LOG_DISCOUNT';
          const timeStr = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="log-item ${typeClass}">
              <span>${escapeHtml(l.message)}</span>
              <span class="log-time">${timeStr}</span>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Load Food Inventory for Donor Tab
async function loadFoodInventory() {
  try {
    const res = await fetch('/api/food');
    const json = await res.json();
    if (!json.success) return;

    appState.allFood = json.data;
    const list = document.getElementById('donor-inventory-list');
    const countBadge = document.getElementById('donor-list-count');
    if (countBadge) countBadge.textContent = `${json.data.length} Items`;

    if (list) {
      if (!json.data || json.data.length === 0) {
        list.innerHTML = '<div class="text-muted p-4 text-center">No inventory logged yet. Use the form on the left to add items!</div>';
      } else {
        list.innerHTML = json.data.map(item => {
          let badgeHtml = '<span class="badge badge-info">Logged</span>';
          let actionBtn = '';

          if (item.status === 'dynamic_discount') {
            badgeHtml = `<span class="badge badge-discount">${item.discountTier || 20}% OFF</span>`;
            actionBtn = `<button class="btn btn-sm btn-warning" onclick="switchTab('tab-market')"><i class="fa-solid fa-tags"></i> View in Store</button>`;
          } else if (item.status === 'sos_donation') {
            badgeHtml = '<span class="badge badge-sos">Urgent SOS (&le;5h)</span>';
            actionBtn = `<button class="btn btn-sm btn-danger" onclick="switchTab('tab-ngo'); focusSosRoute('${item.id}')"><i class="fa-solid fa-truck-fast"></i> Track Route</button>`;
          } else if (item.status === 'organic_recycling') {
            badgeHtml = '<span class="badge badge-warning">Biogas Ledger</span>';
            actionBtn = `<button class="btn btn-sm btn-success" onclick="switchTab('tab-recycle')"><i class="fa-solid fa-seedling"></i> Biogas Hub</button>`;
          } else if (item.status === 'claimed_donation') {
            badgeHtml = '<span class="badge badge-success">Delivered & Rescued</span>';
            actionBtn = `<button class="btn btn-sm btn-outline" onclick="switchTab('tab-tax')"><i class="fa-solid fa-receipt"></i> 80G Receipt</button>`;
          }

          return `
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-bottom: 8px; transition: border-color 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 8px;">
                <strong style="font-size: 13px; color: #fff;">${escapeHtml(item.title)}</strong>
                ${badgeHtml}
              </div>
              <div style="font-size: 11px; color: #94a3b8; display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                <span><i class="fa-solid fa-store text-primary"></i> ${escapeHtml(item.donorName)}</span>
                <span><i class="fa-solid fa-box text-warning"></i> ${item.quantity} ${item.unit}</span>
                <span><i class="fa-solid fa-indian-rupee-sign text-success"></i> ₹${item.estimatedValue}</span>
                <span><i class="fa-solid fa-temperature-half text-danger"></i> ${item.storageTemp}°C</span>
              </div>
              ${actionBtn ? `<div style="display: flex; justify-content: flex-end; margin-top: 4px;">${actionBtn}</div>` : ''}
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load food inventory:', err);
  }
}

// Load Dynamic Discount Deals (Stage 1)
async function loadMarketDeals() {
  try {
    const res = await fetch('/api/market/deals');
    const json = await res.json();
    if (!json.success) return;

    appState.marketDeals = json.data;
    const container = document.getElementById('market-deals-container');
    if (!container) return;

    if (json.data.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #1e293b; border-radius: 12px; border: 1px dashed #475569;">
          <i class="fa-solid fa-basket-shopping" style="font-size: 32px; color: #64748b; margin-bottom: 12px;"></i>
          <h3 style="font-size: 18px;">No Discounted Items at this Moment</h3>
          <p style="color: #94a3b8; font-size: 13px;">Perishable inventory is automatically listed here with up to 70% dynamic clearance markdowns to sell before waste.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = json.data.map(deal => {
      return `
        <div class="deal-card">
          <div class="deal-card-header">
            <div>
              <div class="deal-donor"><i class="fa-solid fa-store"></i> ${escapeHtml(deal.donorName)}</div>
              <div style="font-size: 11px; color: #64748b;">${escapeHtml(deal.donorAddress)}</div>
            </div>
            <div class="discount-tag">${deal.discountTier}% OFF</div>
          </div>
          <div class="deal-card-body">
            <h4 class="deal-title">${escapeHtml(deal.title)}</h4>
            <div class="price-row">
              <span class="price-current">₹${deal.currentPrice}</span>
              <span class="price-original">₹${deal.originalPrice}</span>
              <span style="font-size: 12px; color: #10b981; font-weight: 700;">Save ₹${deal.savingsAmount}</span>
            </div>
            <div class="deal-meta">
              <span class="live-countdown" data-expiry="${deal.expiryDate}"><i class="fa-regular fa-clock"></i> ${deal.remainingDays} days left</span>
              <span><i class="fa-solid fa-leaf"></i> Diversion: ${deal.co2SavedKg}kg CO2e</span>
            </div>
            <button class="btn btn-warning w-100" onclick="handleBuyDeal('${deal.id}')">
              <i class="fa-solid fa-bag-shopping"></i> Rescue & Purchase at ₹${deal.currentPrice}
            </button>
          </div>
        </div>
      `;
    }).join('');

    updateLiveCountdowns();

  } catch (err) {
    console.error('Failed to load market deals:', err);
  }
}

// Load SOS Alerts & Update Leaflet Map (Stage 2)
async function loadSosAlerts() {
  try {
    const res = await fetch('/api/sos/alerts');
    const json = await res.json();
    if (!json.success) return;

    appState.sosAlerts = json.data;
    const feed = document.getElementById('sos-alerts-list');
    if (!feed) return;

    if (json.data.length === 0) {
      feed.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          <i class="fa-solid fa-shield-halved" style="font-size: 32px; color: #10b981; margin-bottom: 12px;"></i>
          <h4>All Surplus Cleared</h4>
          <p style="font-size: 12px;">No active urgent SOS requests pending right now.</p>
        </div>
      `;
    } else {
      feed.innerHTML = json.data.map(item => {
        const closestNgo = item.closestNgo;
        const distStr = closestNgo ? `${closestNgo.distanceKm} km away` : 'Optimizing route...';
        const targetName = closestNgo ? closestNgo.name : 'Nearest Shelter';
        const isActiveRoute = appState.activeRouteFoodId === item.id;

        return `
          <div class="sos-item ${isActiveRoute ? 'active-route' : ''}" id="sos-card-${item.id}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 800; background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 4px;">
                URGENT &bull; 0 PRICE
              </span>
              <span style="font-size: 11px; color: #f87171; font-weight: 600;">
                <i class="fa-solid fa-clock"></i> ${calculateRemainingHours(item.expiryDate)}h Remaining
              </span>
            </div>
            <h4 class="sos-title">${escapeHtml(item.title)}</h4>
            <div class="sos-meta">
              <span><i class="fa-solid fa-location-dot"></i> Donor: ${escapeHtml(item.donorName)} (${escapeHtml(item.donorAddress)})</span>
              <span><i class="fa-solid fa-bowl-food"></i> Volume: <strong>${item.quantity} ${item.unit}</strong> (₹${item.estimatedValue} value)</span>
            </div>
            <div class="sos-target">
              <div style="font-size: 11px; color: #94a3b8;">Priority Matched Recipient:</div>
              <strong style="font-size: 13px; color: #10b981;"><i class="fa-solid fa-heart"></i> ${escapeHtml(targetName)}</strong>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">Distance: ${distStr}</div>
            </div>
            <div class="sos-actions">
              <button class="btn btn-secondary btn-sm" onclick="focusSosRoute('${item.id}')">
                <i class="fa-solid fa-route"></i> Map Route
              </button>
              <button class="btn btn-danger btn-sm" onclick="handleClaimSos('${item.id}', '${closestNgo ? closestNgo.id : ''}')">
                <i class="fa-solid fa-truck-arrow-right"></i> Accept & Dispatch Pickup
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Refresh Map Markers
    const orgRes = await fetch('/api/food'); // triggers map refresh with latest store
    renderMapLocations(appState.allFood, [
      { id: 'ngo-1', name: 'Karunai Illam Orphanage', type: 'orphanage', contact: '+91 98765 43210', address: 'Anna Nagar, Chennai', lat: 13.0850, lng: 80.2100 },
      { id: 'ngo-2', name: 'Anbalayam Senior Care Home', type: 'old_age_home', contact: '+91 98412 11223', address: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 },
      { id: 'ngo-3', name: 'Sneha Shelter for Homeless', type: 'shelter', contact: '+91 94440 98765', address: 'Vadapalani, Chennai', lat: 13.0524, lng: 80.2088 },
      { id: 'plant-1', name: 'GreenEarth Biogas & Fertilizer Hub', type: 'biogas_plant', contact: '+91 91234 56789', address: 'Ambattur Industrial Estate', lat: 13.1143, lng: 80.1548 },
      { id: 'plant-2', name: 'EcoBio Compost Solutions', type: 'compost_plant', contact: '+91 99887 76655', address: 'Guindy Industrial Area', lat: 13.0067, lng: 80.2025 }
    ]);

    // Automatically draw the first active SOS route if none selected
    if (!appState.activeRouteFoodId && json.data.length > 0) {
      focusSosRoute(json.data[0].id);
    }

    // Populate Partner Shelters Registry in Tab 4
    const sheltersContainer = document.getElementById('shelters-list-display');
    if (sheltersContainer) {
      const sampleShelters = [
        { name: 'Karunai Illam Orphanage', address: 'Anna Nagar, Chennai', capacity: 65, contact: '+91 98765 43210' },
        { name: 'Anbalayam Senior Care Home', address: 'T. Nagar, Chennai', capacity: 45, contact: '+91 98412 11223' },
        { name: 'Sneha Shelter for Homeless', address: 'Vadapalani, Chennai', capacity: 80, contact: '+91 94440 98765' },
        { name: 'Prema Samajam Care & Shelter', address: 'Dabagardens, Visakhapatnam', capacity: 75, contact: '+91 891 256 7890' }
      ];
      sheltersContainer.innerHTML = sampleShelters.map(s => `
        <div class="p-3 bg-dark-card border-card rounded">
          <div class="d-flex justify-content-between">
            <strong>${escapeHtml(s.name)}</strong>
            <span class="badge badge-success">Verified Partner</span>
          </div>
          <div class="text-muted mt-1" style="font-size: 12px;">${escapeHtml(s.address)} &bull; Capacity: ${s.capacity} beds &bull; Phone: ${s.contact}</div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('Failed to load SOS alerts:', err);
  }
}

// Load Organic Waste & Biogas Ledger (Stage 3)
async function loadRecyclingLedger() {
  try {
    const res = await fetch('/api/recycle/ledger');
    const json = await res.json();
    if (!json.success) return;

    const list = document.getElementById('recycle-ledger-list');
    const badge = document.getElementById('recycle-batches-count');
    if (badge) badge.textContent = `${json.data.length} Batches`;

    if (list) {
      if (json.data.length === 0) {
        list.innerHTML = '<div class="text-muted p-4 text-center">No expired food batches in the recycling ledger.</div>';
      } else {
        list.innerHTML = json.data.map(batch => {
          const isCompleted = batch.status === 'recycled_completed';
          return `
            <div class="recycle-item">
              <div class="recycle-header">
                <div>
                  <strong style="font-size: 14px;">${escapeHtml(batch.title)}</strong>
                  <div style="font-size: 11px; color: #94a3b8;">Donor: ${escapeHtml(batch.donorName)}</div>
                </div>
                <span class="badge ${isCompleted ? 'badge-success' : 'badge-warning'}">
                  ${isCompleted ? 'Converted & Certified' : 'Pending Digester'}
                </span>
              </div>
              <div style="font-size: 12px; margin-top: 6px; color: #cbd5e1;">
                <i class="fa-solid fa-industry"></i> Facility: <strong>${escapeHtml(batch.recyclingFacilityName || 'GreenEarth Biogas Hub')}</strong>
              </div>
              <div class="recycle-stats">
                <span><i class="fa-solid fa-fire text-warning"></i> Biogas: <strong>${batch.biogasYieldM3 || (batch.quantity * 0.25).toFixed(1)} m³</strong></span>
                <span><i class="fa-solid fa-seedling text-success"></i> Bio-Compost: <strong>${batch.compostYieldKg || (batch.quantity * 0.45).toFixed(1)} kg</strong></span>
                <span><i class="fa-solid fa-shield text-primary"></i> Diverted: <strong>${batch.co2SavedKg} kg CO2e</strong></span>
              </div>
              ${!isCompleted ? `
                <div style="margin-top: 10px;">
                  <button class="btn btn-sm btn-outline" onclick="handleProcessRecycle('${batch.id}')">
                    <i class="fa-solid fa-circle-check"></i> Certify Biogas Digestion
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    // Render Hubs
    const hubsContainer = document.getElementById('recycling-hubs-list');
    if (hubsContainer && json.processingHubs) {
      hubsContainer.innerHTML = json.processingHubs.map(h => `
        <div class="hub-card">
          <div style="display: flex; justify-content: space-between;">
            <strong style="font-size: 13px;">${escapeHtml(h.name)}</strong>
            <span class="badge badge-success">Active Digester</span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${escapeHtml(h.address)} &bull; ${h.contact}</div>
          <div style="font-size: 11px; color: #10b981; margin-top: 4px;">Daily Capacity: ${h.dailyCapacityKg} kg/day</div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('Failed to load recycling ledger:', err);
  }
}

// Load 80G Tax Receipts
async function loadTaxReceipts() {
  try {
    const res = await fetch('/api/receipts');
    const json = await res.json();
    if (!json.success) return;

    appState.receipts = json.data;
    const list = document.getElementById('tax-receipts-list');
    const badge = document.getElementById('receipts-count-badge');
    if (badge) badge.textContent = `${json.data.length} Receipts`;

    if (list) {
      if (json.data.length === 0) {
        list.innerHTML = '<div class="text-muted p-4 text-center">No 80G tax exemption receipts generated yet.</div>';
      } else {
        list.innerHTML = json.data.map((r, idx) => `
          <div class="receipt-item ${idx === 0 ? 'selected' : ''}" onclick="selectReceipt('${r.receiptId}')">
            <div>
              <div style="font-size: 11px; color: #10b981; font-weight: 700;">${r.receiptId}</div>
              <strong style="font-size: 13px;">${escapeHtml(r.donorName)}</strong>
              <div style="font-size: 11px; color: #94a3b8;">${escapeHtml(r.foodItem)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: 800; color: #fff;">₹${r.taxDeductionValue}</div>
              <span class="badge badge-success">80G Eligible</span>
            </div>
          </div>
        `).join('');
      }
    }

    if (json.data.length > 0) {
      renderReceiptCertificate(json.data[0]);
    }

  } catch (err) {
    console.error('Failed to load tax receipts:', err);
  }
}

// Select & Render a Specific 80G Tax Receipt Preview
function selectReceipt(receiptId) {
  const receipt = appState.receipts.find(r => r.receiptId === receiptId);
  if (!receipt) return;
  renderReceiptCertificate(receipt);

  document.querySelectorAll('.receipt-item').forEach(el => el.classList.remove('selected'));
  event?.currentTarget?.classList.add('selected');
}

function renderReceiptCertificate(receipt) {
  const container = document.getElementById('receipt-preview-content');
  if (!container) return;

  container.innerHTML = `
    <div class="cert-header">
      <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 1px;">GOVERNMENT OF INDIA &bull; INCOME TAX ACT, 1961</div>
      <div class="cert-title">Form 10BE / 80G Food Rescue Tax Exemption Certificate</div>
      <div style="font-size: 12px; color: #475569;">FoodCycle AI National Rescue Network &bull; Registration # CIT(E)/80G/2026/A1098</div>
    </div>

    <div class="cert-grid">
      <div class="cert-field">
        <strong>Certificate / Receipt Number</strong>
        <span>${escapeHtml(receipt.receiptId)}</span>
      </div>
      <div class="cert-field">
        <strong>Date of Donation</strong>
        <span>${receipt.date}</span>
      </div>
      <div class="cert-field">
        <strong>Donor Entity (Corporate / Marriage Hall)</strong>
        <span>${escapeHtml(receipt.donorName)}</span>
      </div>
      <div class="cert-field">
        <strong>Donor GSTIN / PAN</strong>
        <span>${escapeHtml(receipt.donorGst || '33AABCT9988D1Z9')}</span>
      </div>
      <div class="cert-field">
        <strong>Beneficiary Organization (NGO / Orphanage)</strong>
        <span>${escapeHtml(receipt.recipientName)}</span>
      </div>
      <div class="cert-field">
        <strong>Rescued Food Commodities</strong>
        <span>${escapeHtml(receipt.foodItem)} (${receipt.quantity})</span>
      </div>
      <div class="cert-field">
        <strong>Assessed Fair Market Valuation</strong>
        <span style="font-size: 16px; font-weight: 800; color: #047857;">₹${receipt.taxDeductionValue} INR</span>
      </div>
      <div class="cert-field">
        <strong>ESG Carbon Offset Diverted</strong>
        <span style="color: #047857; font-weight: 700;">${receipt.co2OffsetKg} kg CO2e Diverted</span>
      </div>
    </div>

    <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 11px; color: #475569; line-height: 1.4;">
      <strong>Statutory Declaration:</strong> Certified that the above institution is registered under Section 80G(5) of the Income Tax Act, 1961. The value of food surplus rescued has been distributed directly to underprivileged residents free of cost. This qualifies for 50% / 100% deduction under applicable tax provisions.
    </div>

    <div class="cert-seal">
      <div class="seal-badge">
        <i class="fa-solid fa-stamp"></i> VERIFIED &bull; 80G
      </div>
      <div style="text-align: right; font-size: 11px; color: #475569;">
        <div>Digitally Authorized by:</div>
        <div style="font-weight: 700; margin-top: 2px;">National Food Rescue Compliance Officer</div>
        <div style="font-family: monospace; font-size: 10px; color: #94a3b8;">SHA-256: 8fbc9102...bca092</div>
      </div>
    </div>
  `;
}

// AI Shelf-Life Predictor handler
async function handleAiPredict() {
  const category = document.getElementById('food-category').value;
  const foodType = document.getElementById('food-type').value;
  const storageTemp = document.getElementById('food-temp').value;
  const preparedAt = document.getElementById('food-prepared-at').value;

  try {
    const res = await fetch('/api/food/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, foodType, storageTemp, preparedAt })
    });
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;
    const panel = document.getElementById('ai-prediction-panel');
    const body = document.getElementById('ai-prediction-body');

    panel.style.display = 'block';
    body.innerHTML = `
      <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px;">
        <div>Estimated Safe Shelf Life: <strong style="color: #10b981; font-size: 15px;">${data.shelfLifeHours} hours</strong></div>
        <div>Predicted Expiry Timestamp: <strong>${new Date(data.predictedExpiryDate).toLocaleString()}</strong></div>
        <div style="font-size: 12px; color: #f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> ${data.tempWarning}</div>
        <div>Recommended Entry Stage: <span class="badge badge-info">${data.recommendedStage.toUpperCase()}</span></div>
      </div>
    `;

    // Populate the expiry field automatically
    const expiryInput = document.getElementById('food-expiry');
    if (expiryInput) {
      expiryInput.value = new Date(data.predictedExpiryDate).toISOString().slice(0, 16);
    }

    showToast('AI shelf-life estimated successfully!', 'success');
  } catch (err) {
    showToast('Failed to run AI prediction', 'error');
  }
}

// Handle Donor Food Form Submit
async function handleDonorSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('food-title').value;
  const donorName = document.getElementById('food-donor-name').value;
  const donorType = document.getElementById('food-donor-type').value;
  const category = document.getElementById('food-category').value;
  const foodType = document.getElementById('food-type').value;
  const quantity = document.getElementById('food-quantity').value;
  const unit = document.getElementById('food-unit').value;
  const estimatedValue = document.getElementById('food-value').value;
  const storageTemp = document.getElementById('food-temp').value;
  const donorAddress = document.getElementById('food-address').value;
  const donorGst = document.getElementById('food-gst').value;
  const preparedAt = document.getElementById('food-prepared-at').value;
  const expiryDate = document.getElementById('food-expiry').value;

  try {
    const res = await fetch('/api/food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        donorName,
        donorType,
        category,
        foodType,
        quantity,
        unit,
        estimatedValue,
        storageTemp,
        donorAddress,
        donorGst,
        preparedAt,
        expiryDate
      })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Food listing logged successfully! Stage: ${json.data.status}`, 'success');
      document.getElementById('donor-food-form').reset();
      loadAllData();
    } else {
      showToast(json.error || 'Failed to submit food listing', 'error');
    }
  } catch (err) {
    showToast('Network error while logging food', 'error');
  }
}

// Consumer purchases dynamic discount deal
window.handleBuyDeal = async function(foodId) {
  try {
    const res = await fetch('/api/market/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId, buyerName: 'Citizen Rescuer' })
    });
    const json = await res.json();
    if (json.success) {
      playChime('rescue');
      showToast('Food rescued! Payment confirmed and waste avoided.', 'success');
      loadAllData();
    } else {
      showToast(json.error || 'Failed to claim deal', 'error');
    }
  } catch (err) {
    showToast('Error purchasing deal', 'error');
  }
};

// NGO claims SOS Donation & generates 80G Receipt
window.handleClaimSos = async function(foodId, recipientId) {
  try {
    const res = await fetch('/api/sos/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId, recipientId, notes: 'Pickup vehicle dispatched immediately.' })
    });
    const json = await res.json();
    if (json.success) {
      playChime('delivery');
      showToast(`Donation claimed! 80G Receipt #${json.taxReceipt.receiptId} generated! Vehicle dispatched!`, 'success');
      // Switch focus to map and animate van!
      focusSosRoute(foodId);
      loadAllData();
    } else {
      showToast(json.error || 'Failed to claim donation', 'error');
    }
  } catch (err) {
    showToast('Error claiming SOS donation', 'error');
  }
};

// Map route focus
window.focusSosRoute = function(foodId) {
  appState.activeRouteFoodId = foodId;
  document.querySelectorAll('.sos-item').forEach(el => el.classList.remove('active-route'));
  document.getElementById(`sos-card-${foodId}`)?.classList.add('active-route');
  if (typeof switchTab === 'function') {
    switchTab('tab-overview');
  }
  document.getElementById('rescue-map')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (typeof drawRouteOnMap === 'function') {
    drawRouteOnMap(foodId, true);
  }
};

// Certify Biogas Digestion
window.handleProcessRecycle = async function(foodId) {
  try {
    const res = await fetch('/api/recycle/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Certified! Organic waste converted to clean biogas.', 'success');
      loadAllData();
    }
  } catch (err) {
    showToast('Error certifying recycling', 'error');
  }
};

// Simulator Triggers
async function triggerSimulator(hours) {
  try {
    const res = await fetch('/api/receipts/simulate/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hoursToAdvance: hours })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'info');
      document.getElementById('simulator-modal').style.display = 'none';
      loadAllData();
    }
  } catch (err) {
    showToast('Error triggering simulation', 'error');
  }
}

async function resetSimulation() {
  try {
    const res = await fetch('/api/receipts/simulate/reset', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      document.getElementById('simulator-modal').style.display = 'none';
      loadAllData();
    }
  } catch (err) {
    showToast('Error resetting simulation', 'error');
  }
}

// Live Second-by-Second Countdown Updater for Dynamic Store deals
function updateLiveCountdowns() {
  const elements = document.querySelectorAll('.live-countdown');
  const now = Date.now();

  elements.forEach(el => {
    const expiry = new Date(el.dataset.expiry).getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      el.innerHTML = '<span class="text-danger font-weight-bold">Expired (Compost Stage)</span>';
      return;
    }

    const days = Math.floor(diff / (86400 * 1000));
    const hours = Math.floor((diff % (86400 * 1000)) / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    const secs = Math.floor((diff % (60 * 1000)) / 1000);

    el.innerHTML = `<i class="fa-regular fa-clock text-warning"></i> <strong>${days}d ${hours}h ${mins}m ${secs}s</strong>`;
  });
}

// Map Node Filter chips
window.filterMapNodes = function(filterType) {
  document.querySelectorAll('.hud-layer-switchers .hud-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`filter-${filterType}`)?.classList.add('active');

  const defaultOrgs = [
    { id: 'ngo-1', name: 'Karunai Illam Orphanage', type: 'orphanage', contact: '+91 98765 43210', address: 'Anna Nagar, Chennai', lat: 13.0850, lng: 80.2100 },
    { id: 'ngo-2', name: 'Anbalayam Senior Care Home', type: 'old_age_home', contact: '+91 98412 11223', address: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 },
    { id: 'ngo-3', name: 'Sneha Shelter for Homeless', type: 'shelter', contact: '+91 94440 98765', address: 'Vadapalani, Chennai', lat: 13.0524, lng: 80.2088 },
    { id: 'plant-1', name: 'GreenEarth Biogas & Fertilizer Hub', type: 'biogas_plant', contact: '+91 91234 56789', address: 'Ambattur Industrial Estate', lat: 13.1143, lng: 80.1548 },
    { id: 'plant-2', name: 'EcoBio Compost Solutions', type: 'compost_plant', contact: '+91 99887 76655', address: 'Guindy Industrial Area', lat: 13.0067, lng: 80.2025 }
  ];

  renderMapLocations(appState.allFood, defaultOrgs, filterType);
};

// Live Operational Rescue Vehicle Dispatch
window.dispatchRescueVehicle = function() {
  if (appState.sosAlerts && appState.sosAlerts.length > 0) {
    const alert = appState.sosAlerts[0];
    focusSosRoute(alert.id);
    playChime('sos');
    showToast('🚐 Real-time GPS Rescue Vehicle dispatched along priority route!', 'info');
  } else if (appState.allFood && appState.allFood.length > 0) {
    focusSosRoute(appState.allFood[0].id);
    playChime('sos');
    showToast('🚐 Active GPS Rescue Vehicle tracking along route!', 'info');
  } else {
    showToast('All food batches are currently secure or rescued!', 'success');
  }
};

// 1-Click Donor Form Profile Preset Loader
window.fillDonorPreset = async function(type) {
  const now = new Date();
  const prepTime = new Date(now.getTime() - 2 * 3600 * 1000).toISOString().slice(0, 16);

  if (type === 'biryani') {
    document.getElementById('food-title').value = '100 kg Royal Hyderabadi Dum Biryani & Gravy';
    document.getElementById('food-donor-name').value = 'Grand Palace Marriage & Convention Hall';
    document.getElementById('food-donor-type').value = 'marriage_hall';
    document.getElementById('food-category').value = 'fresh_cooked';
    document.getElementById('food-type').value = 'non_veg';
    document.getElementById('food-quantity').value = 100;
    document.getElementById('food-unit').value = 'kg';
    document.getElementById('food-value').value = 18000;
    document.getElementById('food-temp').value = 32;
    document.getElementById('food-address').value = 'Grand Palace Banquet, Siripuram, Visakhapatnam';
    document.getElementById('food-gst').value = '37AABCG9988D1Z4';
    document.getElementById('food-prepared-at').value = prepTime;
  } else if (type === 'bakery') {
    document.getElementById('food-title').value = '25 kg Fresh Artisan Whole Wheat Loaves & Croissants';
    document.getElementById('food-donor-name').value = 'French Crust Patisserie';
    document.getElementById('food-donor-type').value = 'bakery';
    document.getElementById('food-category').value = 'bakery';
    document.getElementById('food-type').value = 'veg';
    document.getElementById('food-quantity').value = 25;
    document.getElementById('food-unit').value = 'kg';
    document.getElementById('food-value').value = 4500;
    document.getElementById('food-temp').value = 24;
    document.getElementById('food-address').value = 'French Crust, MVP Colony, Visakhapatnam';
    document.getElementById('food-gst').value = '37AAACB1122K1Z9';
    document.getElementById('food-prepared-at').value = prepTime;
  } else if (type === 'dairy') {
    document.getElementById('food-title').value = '40 Litres Organic Pasteurized Milk & Cottage Cheese';
    document.getElementById('food-donor-name').value = 'Sri Krishna Dairy & Chilling Center';
    document.getElementById('food-donor-type').value = 'supermarket';
    document.getElementById('food-category').value = 'packaged';
    document.getElementById('food-type').value = 'dairy';
    document.getElementById('food-quantity').value = 40;
    document.getElementById('food-unit').value = 'units';
    document.getElementById('food-value').value = 3200;
    document.getElementById('food-temp').value = 36;
    document.getElementById('food-address').value = 'Gajuwaka Main Road, Visakhapatnam';
    document.getElementById('food-gst').value = '37BBCDE4455P1Z2';
    document.getElementById('food-prepared-at').value = prepTime;
  }

  showToast(`⚡ Preset loaded for ${type.toUpperCase()}. Running Arrhenius AI prediction...`, 'info');
  await handleAiPredict();
  highlightProcessStep(2);
  setWorkflowGuidance(
    `Preset loaded! Arrhenius AI calculated microbial shelf-life. Click "Submit & Log Food Listing" to publish into the lifecycle!`,
    'Step 2: AI Analyzed',
    'badge-warning'
  );
};

// 1-Click Interactive Workflow Scenario Triggers
window.triggerWorkflowScenario = async function(scenario) {
  if (scenario === 'sos') {
    showToast('🚀 Running Scenario A: Wedding Hall Surplus to Emergency Shelter...', 'info');
    switchTab('tab-donor');
    highlightProcessStep(1);
    setWorkflowGuidance(
      'Step 1: Logging 100 kg wedding surplus biryani from Grand Palace Banquet...',
      'Step 1: Logging',
      'badge-info'
    );
    await fillDonorPreset('biryani');
    await sleep(1500);

    // Auto submit to backend
    const submitBtn = document.getElementById('btn-submit-food');
    if (submitBtn) {
      document.getElementById('donor-food-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    await sleep(1800);

    // Switch to Overview Map
    switchTab('tab-overview');
    highlightProcessStep(4);
    playChime('sos');
    setWorkflowGuidance(
      '🚨 Critical spoilage threshold hit (<5h remaining)! Emergency SOS alert auto-matched to Karunai Illam Orphanage (2.4 km). Live vehicle en route!',
      'Step 4: SOS Dispatched',
      'badge-sos'
    );
    showToast('🚨 SOS Window Hit (<5h)! Auto-matched to Karunai Illam Orphanage (2.4 km)!', 'error');

    // Run GPS vehicle on map
    if (appState.allFood && appState.allFood.length > 0) {
      focusSosRoute(appState.allFood[0].id);
    } else {
      focusSosRoute('food-001');
    }
    await sleep(4000);

    // Switch to Tax tab & show Form 10BE
    switchTab('tab-tax');
    highlightProcessStep(5);
    playChime('delivery');
    setWorkflowGuidance(
      '🎉 Rescued & Delivered! 100 kg food served. Automated Income Tax Form 10BE / Section 80G Certificate issued to Grand Palace Banquet!',
      'Step 5: 80G Generated',
      'badge-success'
    );
    showToast('📜 Delivery Confirmed! Automated 80G Tax Exemption Certificate Form 10BE generated.', 'success');
    if (appState.receipts && appState.receipts.length > 0) {
      selectReceipt(appState.receipts[0].receiptId);
    }
  } else if (scenario === 'market') {
    showToast('🚀 Running Scenario B: Bakery Surplus Dynamic Clearance...', 'info');
    switchTab('tab-donor');
    highlightProcessStep(1);
    await fillDonorPreset('bakery');
    await sleep(1500);

    switchTab('tab-market');
    highlightProcessStep(3);
    playChime('rescue');
    setWorkflowGuidance(
      '🏷️ Safe window active. Dynamic discount automatically markdown by 70% to sell before waste!',
      'Step 3: Dynamic 70% OFF',
      'badge-warning'
    );
    showToast('🏷️ Dynamic Clearance Active: Whole Wheat Croissants discounted by 70% to prevent waste!', 'warning');
  } else if (scenario === 'biogas') {
    showToast('🚀 Running Scenario C: Spoiled Food Biomethanation...', 'info');
    switchTab('tab-donor');
    highlightProcessStep(1);
    await fillDonorPreset('dairy');
    await sleep(1500);

    switchTab('tab-recycle');
    highlightProcessStep(4);
    playChime('rescue');
    setWorkflowGuidance(
      '🌱 Arrhenius AI detected thermal abuse (>35°C). Food is unsafe for humans. Diverted to Anaerobic Digester for clean Biogas energy!',
      'Biogas Diverted',
      'badge-success'
    );
    showToast('🌱 Spoilage Threshold Exceeded! Batch routed to GreenEarth Biogas Hub to generate clean methane energy.', 'success');
  }
};

// End-to-End Real-Time Rescue Vision Walkthrough Demo
window.runLiveRescueVisionWalkthrough = async function() {
  showToast('🚀 Launching Master End-to-End Food Rescue Pitch Demo!', 'info');
  
  // Step 1: Donor Stage
  switchTab('tab-donor');
  highlightProcessStep(1);
  setWorkflowGuidance(
    'Step 1 of 5: Donor logs 100 kg wedding surplus biryani at ambient heat (32°C)...',
    'Step 1: Intake',
    'badge-info'
  );
  showToast('📦 Step 1: Donor logs surplus biryani & ambient temperature...', 'info');
  await fillDonorPreset('biryani');
  await sleep(2200);

  // Step 2: Arrhenius AI Prediction
  highlightProcessStep(2);
  playChime('rescue');
  setWorkflowGuidance(
    'Step 2 of 5: Arrhenius Microbial Kinetics calculates remaining safe shelf-life: 4.8 hours (High Spoilage Risk)...',
    'Step 2: AI Spoilage',
    'badge-warning'
  );
  showToast('🧪 Step 2: Arrhenius AI calculates spoilage rate k = A * exp(-Ea/RT)...', 'warning');
  await sleep(2200);

  // Step 3: Dynamic Market Stage
  switchTab('tab-market');
  highlightProcessStep(3);
  playChime('rescue');
  setWorkflowGuidance(
    'Step 3 of 5: Perishable inventory enters Dynamic Clearance Store with automated 20% → 50% → 70% price markdowns...',
    'Step 3: Clearance',
    'badge-warning'
  );
  showToast('🏷️ Step 3: Dynamic discount progressively drops 20% → 50% → 70%!', 'warning');
  await sleep(2400);

  // Step 4: Urgent SOS Stage & GPS Map
  switchTab('tab-overview');
  highlightProcessStep(4);
  playChime('sos');
  setWorkflowGuidance(
    'Step 4 of 5: Urgency window (<5h) hit! Smart SOS triggers priority routing to Karunai Illam Orphanage. GPS delivery van moving!',
    'Step 4: Live GPS Van',
    'badge-sos'
  );
  showToast('🚨 Step 4: Urgency window (<5h) hit! Smart SOS triggers priority routing to Orphanage!', 'error');
  await sleep(800);

  if (appState.sosAlerts && appState.sosAlerts.length > 0) {
    focusSosRoute(appState.sosAlerts[0].id);
  } else {
    focusSosRoute('food-001');
  }
  await sleep(4000);

  // Step 5: Tax Exemption Certificate & ESG
  switchTab('tab-tax');
  highlightProcessStep(5);
  playChime('delivery');
  setWorkflowGuidance(
    '🎉 Step 5 of 5: 100 kg food served! Section 80G / Form 10BE Government Tax Exemption Certificate generated for donor!',
    'Step 5: Form 10BE',
    'badge-success'
  );
  showToast('📜 Step 5: Food delivered! Automated Section 80G Tax Exemption Certificate generated!', 'success');
  
  if (appState.receipts && appState.receipts.length > 0) {
    selectReceipt(appState.receipts[0].receiptId);
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Core Utility Helpers
function calculateRemainingHours(expiryDate) {
  if (!expiryDate) return 0;
  const diffMs = new Date(expiryDate).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / (3600 * 1000)));
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-triangle-exclamation';
  if (type === 'warning') icon = 'fa-clock';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4500);
}

// Demo Batches for Interactive Workflow Cockpit
const DEMO_BATCHES = {
  'food-001': {
    id: 'food-001',
    title: '50 Servings Royal Veg Biryani & Paneer Gravy',
    donor: 'Grand Palace Marriage Hall • Vadapalani',
    originalPrice: 4500,
    currentPrice: 0,
    stage: 'Stage 3: Urgent SOS window (<5h)',
    stageTag: '0 Price SOS',
    tempText: '32°C (High Spoilage Risk)',
    shelterText: 'Karunai Illam Orphanage (2.4 km)',
    coords: [13.0505, 80.2115]
  },
  'food-002': {
    id: 'food-002',
    title: 'Assorted Whole Wheat Bread & Butter Croissants (15 Packs)',
    donor: 'FreshBake Artisan Patisserie • Anna Nagar',
    originalPrice: 1800,
    currentPrice: 900,
    stage: 'Stage 2: Dynamic Discount 50% OFF',
    stageTag: '50% OFF Deal',
    tempText: '24°C (Safe Ambient Range)',
    shelterText: 'Anbalayam Senior Care (3.1 km)',
    coords: [13.0827, 80.2160]
  },
  'food-003': {
    id: 'food-003',
    title: 'Organic Milk Cartons & Greek Yogurt Cups (25 Units)',
    donor: 'SuperDaily Mart • T. Nagar',
    originalPrice: 1250,
    currentPrice: 1000,
    stage: 'Stage 2: Dynamic Discount 20% OFF',
    stageTag: '20% OFF Deal',
    tempText: '4°C (Cold Chain Intact)',
    shelterText: 'Sneha Shelter (1.8 km)',
    coords: [13.0405, 80.2337]
  }
};

let selectedBatchId = 'food-001';

window.selectDemoBatch = function(batchId) {
  const b = DEMO_BATCHES[batchId];
  if (!b) return;

  selectedBatchId = batchId;

  // Update pills styling
  document.querySelectorAll('.batch-selector-pills .btn').forEach(btn => btn.classList.remove('active-pill'));
  if (batchId === 'food-001') document.getElementById('pill-batch-1')?.classList.add('active-pill');
  if (batchId === 'food-002') document.getElementById('pill-batch-2')?.classList.add('active-pill');
  if (batchId === 'food-003') document.getElementById('pill-batch-3')?.classList.add('active-pill');

  // Update batch card
  const stagePill = document.getElementById('active-batch-stage-pill');
  if (stagePill) stagePill.textContent = b.stage;

  document.getElementById('batch-card-title').textContent = b.title;
  document.getElementById('batch-card-donor').innerHTML = `<i class="fa-solid fa-store"></i> ${b.donor}`;
  document.getElementById('batch-card-price').innerHTML = `₹${b.currentPrice} <small style="font-size: 11px; text-decoration: line-through; color: #64748b;">₹${b.originalPrice}</small>`;
  document.getElementById('batch-card-tag').textContent = b.stageTag;
  document.getElementById('batch-card-temp').textContent = b.tempText;
  document.getElementById('batch-card-shelter').textContent = b.shelterText;

  // Center map on this item's location
  if (typeof mapInstance !== 'undefined' && mapInstance && b.coords) {
    mapInstance.setView(b.coords, 13);
  }

  showToast(`Tracking: ${b.title}`, 'info');
};

window.stepCheckShelfLife = function() {
  const b = DEMO_BATCHES[selectedBatchId];
  playChime('rescue');
  showToast(`🔍 AI Shelf Life Check: Ambient temp ${b.tempText}. Safety degradation window calculated!`, 'info');
  document.getElementById('stage-card-1')?.classList.add('active');
  setTimeout(() => document.getElementById('stage-card-1')?.classList.remove('active'), 2500);
};

window.stepDynamicPriceDrop = function() {
  const b = DEMO_BATCHES[selectedBatchId];
  playChime('rescue');
  b.currentPrice = Math.round(b.originalPrice * 0.3); // 70% off
  b.stage = 'Stage 2: 70% Price Reduction';
  b.stageTag = '70% OFF';

  document.getElementById('batch-card-price').innerHTML = `₹${b.currentPrice} <small style="font-size: 11px; text-decoration: line-through; color: #64748b;">₹${b.originalPrice}</small>`;
  document.getElementById('batch-card-tag').textContent = '70% OFF';
  document.getElementById('active-batch-stage-pill').textContent = 'Stage 2: 70% OFF';

  showToast(`🏷️ Dynamic Offer Applied: Price dropped by 70% to ₹${b.currentPrice} to sell before waste!`, 'warning');
};

window.stepTriggerSosAndVan = function() {
  const b = DEMO_BATCHES[selectedBatchId];
  playChime('sos');
  b.currentPrice = 0;
  b.stage = 'Stage 3: SOS Alert Active (<5h)';
  b.stageTag = '0 Price SOS';

  document.getElementById('batch-card-price').innerHTML = `₹0 <small style="font-size: 11px; text-decoration: line-through; color: #64748b;">₹${b.originalPrice}</small>`;
  document.getElementById('batch-card-tag').textContent = '0 Price SOS';
  document.getElementById('active-batch-stage-pill').textContent = 'Stage 3: Emergency SOS';

  showToast('🚨 Urgency Window Hit! SOS alert broadcasted to nearby orphanages!', 'error');

  // Trigger map route & van animation
  focusSosRoute(selectedBatchId);
};

window.stepRecycleAndReceipt = function() {
  playChime('delivery');
  showToast('📜 Delivery Confirmed! Automated 80G Tax Exemption Certificate Form 10BE generated.', 'success');
  switchTab('tab-tax');
  if (appState.receipts && appState.receipts.length > 0) {
    selectReceipt(appState.receipts[0].receiptId);
  }
};

window.updateEnergyCalc = function(wasteKg) {
  const val = Number(wasteKg);
  document.getElementById('calc-waste-label').textContent = `${val} kg`;
  document.getElementById('calc-biogas-val').innerHTML = `${(val * 0.25).toFixed(1)} <small>m³</small>`;
  document.getElementById('calc-power-val').innerHTML = `${(val * 0.50).toFixed(1)} <small>kWh</small>`;
  document.getElementById('calc-compost-val').innerHTML = `${(val * 0.45).toFixed(1)} <small>kg</small>`;
  document.getElementById('calc-co2-val').innerHTML = `${(val * 2.50).toFixed(1)} <small>kg CO2e</small>`;
};

/* ====================================================
   GOOGLE CHARTS API INTEGRATION
   ==================================================== */
let googleChartsLoaded = false;

function initGoogleCharts() {
  if (typeof google !== 'undefined' && google.charts) {
    google.charts.load('current', { packages: ['corechart', 'gauge'] });
    google.charts.setOnLoadCallback(() => {
      googleChartsLoaded = true;
      drawGoogleCharts();
    });
  }
}

window.drawGoogleCharts = function() {
  if (!googleChartsLoaded || typeof google === 'undefined' || !google.visualization) return;

  // 1. Google Donut Chart: Food Diversion Streams
  const pieContainer = document.getElementById('gchart-pie');
  if (pieContainer) {
    const pieData = google.visualization.arrayToDataTable([
      ['Stream', 'Quantity (kg)'],
      ['Cooked Meals Rescued', 240],
      ['Bakery 70% Clearance', 110],
      ['Dairy Chilled Salvage', 75],
      ['Biogas Clean Energy', 95]
    ]);

    const pieOptions = {
      pieHole: 0.55,
      backgroundColor: 'transparent',
      legend: { position: 'bottom', textStyle: { color: '#94a3b8', fontSize: 11 } },
      chartArea: { width: '90%', height: '75%' },
      colors: ['#10b981', '#f59e0b', '#38bdf8', '#a855f7'],
      pieSliceBorderColor: 'transparent',
      pieSliceTextStyle: { color: '#ffffff', fontSize: 11, bold: true }
    };

    const pieChart = new google.visualization.PieChart(pieContainer);
    pieChart.draw(pieData, pieOptions);
  }

  // 2. Google Column Chart: Weekly Methane & CO2e Abated
  const colContainer = document.getElementById('gchart-column');
  if (colContainer) {
    const colData = google.visualization.arrayToDataTable([
      ['Day', 'CO2e Diverted (kg)', 'Biogas (m³)'],
      ['Mon', 140, 35],
      ['Tue', 220, 55],
      ['Wed', 190, 48],
      ['Thu', 310, 78],
      ['Fri', 420, 105],
      ['Sat', 540, 135],
      ['Sun', 610, 152]
    ]);

    const colOptions = {
      backgroundColor: 'transparent',
      legend: { position: 'top', textStyle: { color: '#94a3b8', fontSize: 11 } },
      chartArea: { width: '85%', height: '70%' },
      colors: ['#3b82f6', '#10b981'],
      hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
      vAxis: {
        textStyle: { color: '#64748b', fontSize: 11 },
        gridlines: { color: 'rgba(255,255,255,0.06)' },
        baselineColor: 'rgba(255,255,255,0.1)'
      }
    };

    const colChart = new google.visualization.ColumnChart(colContainer);
    colChart.draw(colData, colOptions);
  }

  // 3. Google Speedometer Gauge: Network Rescue & Spoilage Prevention Index
  const gaugeContainer = document.getElementById('gchart-gauge');
  if (gaugeContainer) {
    const gaugeData = google.visualization.arrayToDataTable([
      ['Label', 'Value'],
      ['Rescue %', 96]
    ]);

    const gaugeOptions = {
      width: 170,
      height: 170,
      redFrom: 0, redTo: 60,
      yellowFrom: 60, yellowTo: 85,
      greenFrom: 85, greenTo: 100,
      minorTicks: 5,
      max: 100
    };

    const gaugeChart = new google.visualization.Gauge(gaugeContainer);
    gaugeChart.draw(gaugeData, gaugeOptions);
  }
};

window.addEventListener('resize', () => {
  if (googleChartsLoaded) {
    drawGoogleCharts();
  }
});

// Initialize charts on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoogleCharts);
} else {
  initGoogleCharts();
}

/* ====================================================
   GOOGLE GEMINI AI RESCUE COPILOT
   ==================================================== */
let geminiOpen = false;

window.toggleGeminiCopilot = function() {
  const drawer = document.getElementById('gemini-copilot-drawer');
  if (!drawer) return;

  geminiOpen = !geminiOpen;
  drawer.style.display = geminiOpen ? 'flex' : 'none';

  if (geminiOpen) {
    playChime('rescue');
    document.getElementById('gemini-input')?.focus();
  }
};

window.askGeminiPrompt = function(promptText) {
  const input = document.getElementById('gemini-input');
  if (input) {
    input.value = promptText;
    sendGeminiMessage();
  }
};

window.sendGeminiMessage = async function() {
  const input = document.getElementById('gemini-input');
  const feed = document.getElementById('gemini-chat-feed');
  if (!input || !feed) return;

  const userText = input.value.trim();
  if (!userText) return;

  input.value = '';

  // Append user bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'gemini-msg gemini-msg-user';
  userMsg.innerHTML = `<div class="gemini-msg-bubble">${escapeHtml(userText)}</div>`;
  feed.appendChild(userMsg);
  feed.scrollTop = feed.scrollHeight;

  // Append loading bubble
  const typingMsg = document.createElement('div');
  typingMsg.className = 'gemini-msg gemini-msg-ai';
  typingMsg.innerHTML = `<div class="gemini-msg-bubble text-muted"><span class="gemini-sparkle">✦</span> Gemini is synthesizing food science & logistics...</div>`;
  feed.appendChild(typingMsg);
  feed.scrollTop = feed.scrollHeight;

  try {
    const res = await fetch('/api/gemini/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userText,
        context: {
          activeBatchesCount: (appState.foodItems || []).length,
          selectedBatch: typeof selectedBatchId !== 'undefined' ? selectedBatchId : 'food-001'
        }
      })
    });

    const data = await res.json();
    typingMsg.remove();

    const aiMsg = document.createElement('div');
    aiMsg.className = 'gemini-msg gemini-msg-ai';

    let formatted = (data.reply || 'No response')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/### (.*?)(<br\/>|$)/g, '<h4 style="color: #38bdf8; margin: 4px 0;">$1</h4>');

    aiMsg.innerHTML = `<div class="gemini-msg-bubble">${formatted}</div>`;
    feed.appendChild(aiMsg);
    feed.scrollTop = feed.scrollHeight;

    playChime('rescue');
  } catch (err) {
    typingMsg.remove();
    const errorMsg = document.createElement('div');
    errorMsg.className = 'gemini-msg gemini-msg-ai';
    errorMsg.innerHTML = `<div class="gemini-msg-bubble text-danger">⚠️ Connection error: ${err.message}</div>`;
    feed.appendChild(errorMsg);
  }
};

/* ====================================================
   PWA SERVICE WORKER REGISTRATION (GOOGLE APP STANDARDS)
   ==================================================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('✅ FoodCycle AI Service Worker registered (PWA enabled):', reg.scope);
    }).catch(err => {
      console.log('Service Worker registration skipped:', err.message);
    });
  });
}

/* ====================================================
   SUPABASE POSTGRESQL DATABASE MODAL & CONTROLS
   ==================================================== */
window.openSupabaseModal = async function() {
  const modal = document.getElementById('supabase-modal');
  if (modal) {
    modal.style.display = 'flex';
    await checkSupabaseStatus();
  }
};

window.closeSupabaseModal = function() {
  const modal = document.getElementById('supabase-modal');
  if (modal) modal.style.display = 'none';
};

window.checkSupabaseStatus = async function() {
  try {
    const res = await fetch('/api/db/status');
    const json = await res.json();
    if (!json.success) return;

    const { provider, connected, configured, details } = json.data;
    
    // Update Header Badge
    const badgeText = document.getElementById('supabase-badge-text');
    const badgeBtn = document.getElementById('btn-supabase-status');
    if (badgeText) {
      badgeText.textContent = connected ? 'Supabase Connected' : 'Supabase Ready';
    }
    if (badgeBtn) {
      if (connected) {
        badgeBtn.style.color = '#10b981';
        badgeBtn.style.borderColor = 'rgba(16, 185, 129, 0.6)';
        badgeBtn.style.background = 'rgba(16, 185, 129, 0.12)';
      } else {
        badgeBtn.style.color = '#3ecf8e';
        badgeBtn.style.borderColor = 'rgba(62, 207, 142, 0.4)';
      }
    }

    // Update Modal Fields
    const modalBadge = document.getElementById('supabase-modal-badge');
    const modalEndpoint = document.getElementById('supabase-modal-endpoint');
    const modalDetails = document.getElementById('supabase-modal-details');

    if (modalBadge) {
      modalBadge.textContent = connected ? 'Live Cloud Connected' : 'Supabase Adapter Ready';
      modalBadge.style.background = connected ? '#10b981' : '#f59e0b';
    }
    if (modalEndpoint) {
      modalEndpoint.textContent = details.url || provider;
    }
    if (modalDetails) {
      modalDetails.innerHTML = details.message || 'PostgreSQL schema verified and ready for cloud sync.';
    }

  } catch (err) {
    console.error('Failed to fetch DB status:', err);
  }
};

window.testSupabaseConnection = async function() {
  showToast('Testing Supabase PostgreSQL ping...', 'info');
  try {
    const res = await fetch('/api/db/test', { method: 'POST' });
    const json = await res.json();
    const data = json.data;
    if (data.connected) {
      playChime('delivery');
      showToast('✅ Supabase PostgreSQL connection verified successfully!', 'success');
    } else {
      showToast(data.message || 'Supabase credentials not yet provided in .env', 'warning');
    }
    await checkSupabaseStatus();
  } catch (err) {
    showToast('Failed to ping Supabase: ' + err.message, 'error');
  }
};

window.syncSupabaseData = async function() {
  showToast('Initiating cloud sync to Supabase PostgreSQL...', 'info');
  try {
    const res = await fetch('/api/db/sync', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      playChime('delivery');
      showToast('🎉 Local food batches and organizations synced to Supabase!', 'success');
    } else {
      showToast(json.message || json.error || 'Configure SUPABASE_URL in .env to sync', 'warning');
    }
  } catch (err) {
    showToast('Sync failed: ' + err.message, 'error');
  }
};

// Auto check DB status on load
setTimeout(checkSupabaseStatus, 1000);

