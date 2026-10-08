const express = require('express');
const router = express.Router();
const store = require('../data/store');

// List items on dynamic discount (20% -> 50% -> 70%)
router.get('/deals', (req, res) => {
  const items = store.getAllFood().filter(f => f.status === 'dynamic_discount');
  
  // Calculate remaining countdown
  const enriched = items.map(item => {
    const diffMs = new Date(item.expiryDate).getTime() - Date.now();
    const remainingHours = Math.max(0, Math.round(diffMs / (3600 * 1000)));
    const remainingDays = (remainingHours / 24).toFixed(1);
    const savingsAmount = (item.originalPrice || item.estimatedValue) - item.currentPrice;

    return {
      ...item,
      remainingHours,
      remainingDays,
      savingsAmount
    };
  });

  res.json({ success: true, count: enriched.length, data: enriched });
});

// Consumer purchases / claims discounted food
router.post('/purchase', (req, res) => {
  const { foodId, buyerName, buyerPhone } = req.body;
  if (!foodId) {
    return res.status(400).json({ success: false, error: 'foodId is required' });
  }

  const food = store.getFoodById(foodId);
  if (!food) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  const updated = store.updateFood(foodId, {
    status: 'purchased_discount',
    buyerName: buyerName || 'Eco-Conscious Citizen',
    buyerPhone: buyerPhone || 'Hidden',
    purchasedAt: new Date().toISOString()
  });

  store.logAction('DISCOUNT_PURCHASE', `${buyerName || 'Citizen'} rescued '${food.title}' at ${food.discountTier}% discount (₹${food.currentPrice}). Prevented waste.`);

  res.json({
    success: true,
    message: 'Food rescued successfully! You saved money and prevented food waste.',
    data: updated
  });
});

module.exports = router;
