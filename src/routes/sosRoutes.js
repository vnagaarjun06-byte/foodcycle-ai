const express = require('express');
const router = express.Router();
const store = require('../data/store');
const dbService = require('../data/dbService');
const { calculateDistanceKm } = require('../engine/lifecycleEngine');

// List active SOS donation alerts
router.get('/alerts', (req, res) => {
  const items = store.getAllFood().filter(f => f.status === 'sos_donation');
  const orgs = store.getOrganizations();

  // Enrich with nearest orphanage/shelter distance if not already set
  const enriched = items.map(item => {
    const lat = item.lat || 13.0500;
    const lng = item.lng || 80.2100;
    
    // Sort all NGOs by distance for this donor
    const nearbyNgos = orgs
      .filter(o => o.type === 'orphanage' || o.type === 'old_age_home' || o.type === 'shelter')
      .map(o => ({
        ...o,
        distanceKm: calculateDistanceKm(lat, lng, o.lat, o.lng)
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      ...item,
      closestNgo: nearbyNgos[0] || null,
      allNearbyNgos: nearbyNgos
    };
  });

  res.json({ success: true, count: enriched.length, data: enriched });
});

// NGO claims/accepts donation
router.post('/claim', async (req, res) => {
  const { foodId, recipientId, notes } = req.body;
  if (!foodId) {
    return res.status(400).json({ success: false, error: 'foodId is required' });
  }

  const food = store.getFoodById(foodId);
  if (!food) {
    return res.status(404).json({ success: false, error: 'Food item not found' });
  }

  const recipient = recipientId ? store.getOrgById(recipientId) : null;
  const recipientName = recipient ? recipient.name : (food.matchedRecipientName || 'Karunai Illam Orphanage');

  // Update food status
  const updated = await dbService.updateFood(foodId, {
    status: 'claimed_donation',
    claimedAt: new Date().toISOString(),
    matchedRecipientName: recipientName,
    dispatchNotes: notes || 'NGO vehicle dispatched for pickup.'
  });

  // Automatically generate 80G Tax-Benefit Receipt
  const receipt = await dbService.generateReceipt(food, recipientName);

  store.logAction('SOS_CLAIMED', `${recipientName} claimed ${food.quantity} ${food.unit} of '${food.title}'. 80G Receipt #${receipt.receiptId} generated.`);

  res.json({
    success: true,
    message: 'Donation accepted and vehicle dispatched!',
    data: updated,
    taxReceipt: receipt
  });
});

// Route coordinates for Leaflet mapping between Donor and NGO
router.get('/route/:foodId', (req, res) => {
  const food = store.getFoodById(req.params.foodId);
  if (!food) {
    return res.status(404).json({ success: false, error: 'Food item not found' });
  }

  const orgs = store.getOrganizations();
  const recipient = food.matchedRecipientId 
    ? store.getOrgById(food.matchedRecipientId)
    : orgs.find(o => o.type === 'orphanage' || o.type === 'old_age_home');

  const donorCoord = [food.lat || 13.0505, food.lng || 80.2115];
  const recipientCoord = recipient ? [recipient.lat, recipient.lng] : [13.0850, 80.2100];
  const distanceKm = calculateDistanceKm(donorCoord[0], donorCoord[1], recipientCoord[0], recipientCoord[1]);

  // Generate realistic smooth intermediate waypoints for animated GPS navigation
  const numSteps = 8;
  const polyline = [];
  polyline.push(donorCoord);
  for (let i = 1; i < numSteps; i++) {
    const fraction = i / numSteps;
    const lat = donorCoord[0] + (recipientCoord[0] - donorCoord[0]) * fraction;
    const lng = donorCoord[1] + (recipientCoord[1] - donorCoord[1]) * fraction;
    // Slight realistic sinusoidal curve reflecting urban road grids
    const offsetLat = Math.sin(fraction * Math.PI) * 0.0035;
    const offsetLng = Math.sin(fraction * Math.PI) * -0.0025;
    polyline.push([Number((lat + offsetLat).toFixed(5)), Number((lng + offsetLng).toFixed(5))]);
  }
  polyline.push(recipientCoord);

  res.json({
    success: true,
    foodId: food.id,
    status: food.status,
    title: food.title,
    quantity: `${food.quantity} ${food.unit}`,
    donor: {
      name: food.donorName,
      address: food.donorAddress,
      coords: donorCoord
    },
    recipient: {
      name: recipient ? recipient.name : 'Matched Shelter',
      address: recipient ? recipient.address : 'Nearby Shelter',
      coords: recipientCoord
    },
    distanceKm,
    estimatedMinutes: Math.max(5, Math.round(distanceKm * 3.8)),
    routePolyline: polyline
  });
});

module.exports = router;
