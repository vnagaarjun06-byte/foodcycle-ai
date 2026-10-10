const express = require('express');
const router = express.Router();
const store = require('../data/store');
const dbService = require('../data/dbService');
const { predictExpiry, evaluateStage } = require('../engine/expiryPredictor');
const { evaluateLifecycleState } = require('../engine/lifecycleEngine');

// List all food items
router.get('/', async (req, res) => {
  const { status, category } = req.query;
  let items = await dbService.getAllFood();

  if (status) {
    items = items.filter(i => i.status === status);
  }
  if (category) {
    items = items.filter(i => i.category === category);
  }

  res.json({ success: true, count: items.length, data: items });
});

// Get single food item
router.get('/:id', async (req, res) => {
  const item = await dbService.getFoodById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Food item not found' });
  }
  res.json({ success: true, data: item });
});

// Predict shelf life based on inputs
router.post('/predict', (req, res) => {
  const { category, foodType, storageTemp, preparedAt } = req.body;
  const prediction = predictExpiry({ category, foodType, storageTemp, preparedAt });
  res.json({ success: true, data: prediction });
});

// Log new food item
router.post('/', async (req, res) => {
  const {
    donorName,
    donorType,
    donorPhone,
    donorAddress,
    donorGst,
    lat,
    lng,
    title,
    category,
    foodType,
    quantity,
    unit,
    estimatedValue,
    preparedAt,
    expiryDate,
    storageTemp
  } = req.body;

  if (!title || !donorName) {
    return res.status(400).json({ success: false, error: 'Title and donor name are required' });
  }

  // Calculate or verify expiry
  let finalExpiry = expiryDate;
  if (!finalExpiry) {
    const prediction = predictExpiry({ category, foodType, storageTemp, preparedAt });
    finalExpiry = prediction.predictedExpiryDate;
  }

  const initialPrice = Number(estimatedValue) || 1000;
  const initialQty = Number(quantity) || 10;

  const rawItem = {
    donorName: donorName || 'Partner Donor',
    donorType: donorType || 'canteen',
    donorPhone: donorPhone || '+91 98000 00000',
    donorAddress: donorAddress || 'Central City, Chennai',
    donorGst: donorGst || '33AABCT9999Z1Z1',
    lat: Number(lat) || 13.0500,
    lng: Number(lng) || 80.2100,
    title,
    category: category || 'fresh_cooked',
    foodType: foodType || 'veg',
    quantity: initialQty,
    unit: unit || 'servings',
    estimatedValue: initialPrice,
    originalPrice: initialPrice,
    currentPrice: initialPrice,
    discountTier: 0,
    preparedAt: preparedAt || new Date().toISOString(),
    expiryDate: finalExpiry,
    storageTemp: Number(storageTemp) || 28,
    co2SavedKg: Math.round(initialQty * 2.5),
    status: 'logged'
  };

  // Evaluate initial lifecycle stage immediately
  const updates = evaluateLifecycleState(rawItem, store.getOrganizations());
  const finalItemData = updates ? { ...rawItem, ...updates } : rawItem;

  const created = await dbService.addFood(finalItemData);
  res.status(201).json({ success: true, data: created });
});

// Delete food item
router.delete('/:id', (req, res) => {
  const deleted = store.deleteFood(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }
  res.json({ success: true, message: 'Item deleted' });
});

module.exports = router;
