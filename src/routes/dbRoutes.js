const express = require('express');
const router = express.Router();
const dbService = require('../data/dbService');
const { isConfigured, testConnection } = require('../data/supabaseClient');

// GET /api/db/status
router.get('/status', async (req, res) => {
  try {
    const status = await dbService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/sync
router.post('/sync', async (req, res) => {
  try {
    const result = await dbService.syncSeedToSupabase();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/test
router.post('/test', async (req, res) => {
  try {
    const conn = await testConnection();
    res.json({ success: true, data: conn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
