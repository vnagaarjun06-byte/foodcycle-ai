/**
 * Dynamic Food-Life Lifecycle Engine
 * Handles the 3 core stages:
 * Stage 1: Dynamic Discount Stage (9 Days Before Expiry)
 * Stage 2: Smart SOS Donation Stage (5 Days / 5 Hours Before Expiry)
 * Stage 3: Recycling & Composting Stage (Expired / Unsafe)
 */

const store = require('../data/store');

// Haversine distance calculator between two coordinates (km)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Find closest matching recipient organization (orphanage, shelter, old age home)
function findNearestRecipient(donorLat, donorLng, orgList) {
  const eligible = orgList.filter(o => o.type === 'orphanage' || o.type === 'old_age_home' || o.type === 'shelter');
  if (eligible.length === 0) return null;

  let closest = null;
  let minDistance = Infinity;

  eligible.forEach(org => {
    const dist = calculateDistanceKm(donorLat, donorLng, org.lat, org.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { ...org, distanceKm: dist };
    }
  });

  return closest;
}

// Find closest biogas / compost recycling hub
function findNearestRecyclingPlant(donorLat, donorLng, orgList) {
  const eligible = orgList.filter(o => o.type === 'biogas_plant' || o.type === 'compost_plant');
  if (eligible.length === 0) return null;

  let closest = null;
  let minDist = Infinity;

  eligible.forEach(plant => {
    const dist = calculateDistanceKm(donorLat, donorLng, plant.lat, plant.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = { ...plant, distanceKm: dist };
    }
  });

  return closest;
}

/**
 * Evaluates and transitions a food item through its lifecycle based on remaining time.
 * @param {Object} item 
 * @param {Array} orgs 
 * @returns {Object} updated fields
 */
function evaluateLifecycleState(item, orgs) {
  // If already claimed or purchased or already processed, retain status
  if (item.status === 'claimed_donation' || item.status === 'purchased_discount' || item.status === 'recycled_completed') {
    return null;
  }

  const now = Date.now();
  const expiry = new Date(item.expiryDate).getTime();
  const remainingHours = (expiry - now) / (3600 * 1000);
  const remainingDays = remainingHours / 24;

  const originalPrice = Number(item.originalPrice) || Number(item.estimatedValue) || 1000;
  const donorLat = item.lat || 13.0500;
  const donorLng = item.lng || 80.2100;

  // STAGE 3: EXPIRED OR UNSAFE -> ORGANIC WASTE & RECYCLING LEDGER
  if (remainingHours <= 0) {
    if (item.status !== 'organic_recycling') {
      const plant = findNearestRecyclingPlant(donorLat, donorLng, orgs);
      const qty = Number(item.quantity) || 10;
      const biogasYield = Number((qty * 0.25).toFixed(1)); // ~0.25 m3 biogas per kg organic waste
      const compostYield = Number((qty * 0.45).toFixed(1)); // ~0.45 kg compost per kg organic waste

      return {
        status: 'organic_recycling',
        currentPrice: 0,
        discountTier: 0,
        recyclingFacilityId: plant ? plant.id : 'plant-1',
        recyclingFacilityName: plant ? plant.name : 'GreenEarth Biogas & Fertilizer Hub',
        recyclingType: 'Anaerobic Biogas & Organic Compost Digester',
        biogasYieldM3: biogasYield,
        compostYieldKg: compostYield,
        transitionedAt: new Date().toISOString(),
        statusNote: 'Expired: Safely diverted to Biogas & Compost Recycling Ledger to prevent landfill methane emission.'
      };
    }
    return null;
  }

  // STAGE 2: SMART SOS DONATION STAGE (5 Days for packaged/bakery, OR <= 5 Hours for fresh cooked)
  const isUrgentCooked = item.category === 'fresh_cooked' && remainingHours <= 5;
  const isUrgentNearExpiry = remainingDays <= 5;

  if (isUrgentCooked || isUrgentNearExpiry) {
    if (item.status !== 'sos_donation') {
      const recipient = findNearestRecipient(donorLat, donorLng, orgs);
      return {
        status: 'sos_donation',
        currentPrice: 0,
        discountTier: 100, // Free emergency donation
        matchedRecipientId: recipient ? recipient.id : 'ngo-1',
        matchedRecipientName: recipient ? recipient.name : 'Karunai Illam Orphanage',
        matchedRecipientDistanceKm: recipient ? recipient.distanceKm : 2.4,
        transitionedAt: new Date().toISOString(),
        statusNote: `Urgency window reached (${Math.round(remainingHours)}h left). SOS alert triggered with priority map routing!`
      };
    }
    return null;
  }

  // STAGE 1: DYNAMIC DISCOUNT STAGE (Within 9 Days Before Expiry)
  if (remainingDays <= 9) {
    let tier = 20; // 20% default
    if (remainingDays <= 3) {
      tier = 70; // 70% off
    } else if (remainingDays <= 6) {
      tier = 50; // 50% off
    }

    const discountedPrice = Math.round(originalPrice * (1 - tier / 100));

    if (item.status !== 'dynamic_discount' || item.discountTier !== tier) {
      return {
        status: 'dynamic_discount',
        discountTier: tier,
        currentPrice: discountedPrice,
        transitionedAt: new Date().toISOString(),
        statusNote: `9-Day window: Dynamic discount automatically adjusted to ${tier}% OFF (${remainingDays.toFixed(1)} days left)`
      };
    }
    return null;
  }

  // STANDARD INVENTORY
  if (item.status !== 'logged') {
    return {
      status: 'logged',
      currentPrice: originalPrice,
      discountTier: 0
    };
  }

  return null;
}

/**
 * Runs a scan over all items in the store and updates lifecycle states
 */
function runLifecycleScan() {
  const items = store.getAllFood();
  const orgs = store.getOrganizations();
  let updatedCount = 0;

  items.forEach(item => {
    const updates = evaluateLifecycleState(item, orgs);
    if (updates) {
      store.updateFood(item.id, updates);
      updatedCount++;
    }
  });

  return updatedCount;
}

module.exports = {
  calculateDistanceKm,
  findNearestRecipient,
  findNearestRecyclingPlant,
  evaluateLifecycleState,
  runLifecycleScan
};
