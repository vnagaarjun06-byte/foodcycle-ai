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
});

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

  // Simulator Modal Controls
  const openSimBtn = document.getElementById('open-simulator-btn');
  const closeSimBtn = document.getElementById('close-simulator-btn');
  const simModal = document.getElementById('simulator-modal');

  if (openSimBtn) openSimBtn.addEventListener('click', () => simModal.style.display = 'flex');
  if (closeSimBtn) closeSimBtn.addEventListener('click', () => simModal.style.display = 'none');

  document.getElementById('sim-btn-24h')?.addEventListener('click', () => triggerSimulator(24));
  document.getElementById('sim-btn-sos')?.addEventListener('click', () => triggerSimulator(72)); // advances to urgent window
  document.getElementById('sim-btn-compost')?.addEventListener('click', () => triggerSimulator(240)); // advances past expiry
  document.getElementById('sim-btn-reset')?.addEventListener('click', resetSimulation);
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
      list.innerHTML = json.data.map(item => {
        let badgeHtml = '<span class="badge badge-info">Logged</span>';
        if (item.status === 'dynamic_discount') {
          badgeHtml = `<span class="badge badge-discount">${item.discountTier}% OFF</span>`;
        } else if (item.status === 'sos_donation') {
          badgeHtml = '<span class="badge badge-sos">SOS Triggered</span>';
        } else if (item.status === 'organic_recycling') {
          badgeHtml = '<span class="badge badge-warning">Compost Ledger</span>';
        } else if (item.status === 'claimed_donation') {
          badgeHtml = '<span class="badge badge-success">Rescued (Donated)</span>';
        }

        return `
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
              <strong style="font-size: 13px;">${escapeHtml(item.title)}</strong>
              ${badgeHtml}
            </div>
            <div style="font-size: 11px; color: #94a3b8; display: flex; gap: 12px;">
              <span>Donor: ${escapeHtml(item.donorName)}</span>
              <span>Qty: ${item.quantity} ${item.unit}</span>
              <span>Value: ₹${item.estimatedValue}</span>
            </div>
          </div>
        `;
      }).join('');
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
          <p style="color: #94a3b8; font-size: 13px;">Items automatically enter this store within 9 days of expiry. Advance time in the Simulator to trigger discounts!</p>
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
              <span><i class="fa-regular fa-clock"></i> ${deal.remainingDays} days left</span>
              <span><i class="fa-solid fa-leaf"></i> Diversion: ${deal.co2SavedKg}kg CO2e</span>
            </div>
            <button class="btn btn-warning w-100" onclick="handleBuyDeal('${deal.id}')">
              <i class="fa-solid fa-bag-shopping"></i> Rescue & Purchase at ₹${deal.currentPrice}
            </button>
          </div>
        </div>
      `;
    }).join('');

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
      showToast('Food rescued! Payment simulated & waste avoided.', 'success');
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
      showToast(`Donation claimed! 80G Receipt #${json.taxReceipt.receiptId} generated!`, 'success');
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
  drawRouteOnMap(foodId);
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

// Helpers
function calculateRemainingHours(expiryDate) {
  const diffMs = new Date(expiryDate).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / (3600 * 1000)));
}

function escapeHtml(str) {
  if (!str) return '';
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

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
