const express = require('express');
const router = express.Router();
const store = require('../data/store');
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
router.post('/claim', (req, res) => {
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
  const updated = store.updateFood(foodId, {
    status: 'claimed_donation',
    claimedAt: new Date().toISOString(),
    matchedRecipientName: recipientName,
    dispatchNotes: notes || 'NGO vehicle dispatched for pickup.'
  });

  // Automatically generate 80G Tax-Benefit Receipt
  const receipt = store.generateReceipt(food, recipientName);

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

  // Intermediate simulated waypoint for smooth visual route polyline
  const midLat = (donorCoord[0] + recipientCoord[0]) / 2 + 0.003;
  const midLng = (donorCoord[1] + recipientCoord[1]) / 2 - 0.002;

  res.json({
    success: true,
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
    estimatedMinutes: Math.round(distanceKm * 4.2), // Average city speed ~ 15-20 km/h
    routePolyline: [
      donorCoord,
      [midLat, midLng],
      recipientCoord
    ]
  });
});

module.exports = router;
