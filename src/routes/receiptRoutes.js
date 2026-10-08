const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { runLifecycleScan } = require('../engine/lifecycleEngine');

// List all 80G tax receipts
router.get('/', (req, res) => {
  const receipts = store.getAllReceipts();
  res.json({ success: true, count: receipts.length, data: receipts });
});

// Get single receipt details
router.get('/:id', (req, res) => {
  const receipt = store.getReceiptById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ success: false, error: 'Tax receipt not found' });
  }
  res.json({ success: true, data: receipt });
});

// Impact statistics & audit logs
router.get('/stats/summary', (req, res) => {
  const stats = store.getStats();
  const logs = store.getLogs();
  res.json({ success: true, data: { stats, recentLogs: logs.slice(0, 8) } });
});

// HACKATHON LIVE SIMULATOR: Fast-forward time on an item or all items
router.post('/simulate/advance', (req, res) => {
  const { foodId, hoursToAdvance = 24 } = req.body;
  const items = foodId ? [store.getFoodById(foodId)].filter(Boolean) : store.getAllFood();

  let affectedCount = 0;
  items.forEach(item => {
    // Only advance active non-final items
    if (item.status !== 'claimed_donation' && item.status !== 'recycled_completed' && item.status !== 'purchased_discount') {
      const currentExpiry = new Date(item.expiryDate).getTime();
      const newExpiry = new Date(currentExpiry - hoursToAdvance * 3600 * 1000).toISOString();
      store.updateFood(item.id, { expiryDate: newExpiry });
      affectedCount++;
    }
  });

  // Re-run lifecycle evaluation
  const transitioned = runLifecycleScan();
  store.logAction('SIMULATION_STEP', `Advanced clock by ${hoursToAdvance}h across ${affectedCount} items. ${transitioned} state transitions occurred.`);

  res.json({
    success: true,
    message: `Advanced simulation by ${hoursToAdvance} hours. ${transitioned} items transitioned to new lifecycle stages.`,
    stats: store.getStats(),
    items: store.getAllFood()
  });
});

// Reset demo to default seed state
router.post('/simulate/reset', (req, res) => {
  store.resetToSeed();
  store.logAction('SYSTEM_RESET', 'Database reset to initial hackathon pitch seed state.');
  res.json({
    success: true,
    message: 'System reset to pristine demo state.',
    stats: store.getStats()
  });
});

module.exports = router;
