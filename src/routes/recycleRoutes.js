const express = require('express');
const router = express.Router();
const store = require('../data/store');

// Get all items in organic waste & compost recycling ledger
router.get('/ledger', (req, res) => {
  const items = store.getAllFood().filter(f => f.status === 'organic_recycling' || f.status === 'recycled_completed');
  const orgs = store.getOrganizations();
  const plants = orgs.filter(o => o.type === 'biogas_plant' || o.type === 'compost_plant');

  res.json({
    success: true,
    count: items.length,
    data: items,
    processingHubs: plants
  });
});

// Confirm dispatch/processing at biogas / compost facility
router.post('/process', (req, res) => {
  const { foodId, facilityId, treatmentType } = req.body;
  if (!foodId) {
    return res.status(400).json({ success: false, error: 'foodId is required' });
  }

  const food = store.getFoodById(foodId);
  if (!food) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  const plant = facilityId ? store.getOrgById(facilityId) : null;
  const facilityName = plant ? plant.name : (food.recyclingFacilityName || 'GreenEarth Biogas & Fertilizer Hub');

  const updated = store.updateFood(foodId, {
    status: 'recycled_completed',
    processedAt: new Date().toISOString(),
    recyclingFacilityName: facilityName,
    recyclingType: treatmentType || food.recyclingType || 'Biogas Methane Digester'
  });

  store.logAction('ORGANIC_RECYCLED', `Batch '${food.title}' processed at ${facilityName}. Diverted ${food.quantity} ${food.unit} from landfill into renewable energy & compost.`);

  res.json({
    success: true,
    message: 'Organic waste converted to renewable biogas & nutrient compost!',
    data: updated
  });
});

module.exports = router;
