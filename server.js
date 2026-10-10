require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { runLifecycleScan } = require('./src/engine/lifecycleEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/food', require('./src/routes/foodRoutes'));
app.use('/api/sos', require('./src/routes/sosRoutes'));
app.use('/api/market', require('./src/routes/marketRoutes'));
app.use('/api/recycle', require('./src/routes/recycleRoutes'));
app.use('/api/receipts', require('./src/routes/receiptRoutes'));
app.use('/api/gemini', require('./src/routes/geminiRoutes'));
app.use('/api/db', require('./src/routes/dbRoutes'));

// Health check endpoint for Render monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'FoodCycle AI - Smart Expiry Rescue Network'
  });
});

// Periodic Expiry & Lifecycle Engine Worker (runs every 30 seconds)
setInterval(() => {
  try {
    const updated = runLifecycleScan();
    if (updated > 0) {
      console.log(`[Lifecycle Engine] Auto-transitioned ${updated} item(s) across lifecycle stages.`);
    }
  } catch (err) {
    console.error('[Lifecycle Engine Error]:', err.message);
  }
}, 30000);

// Root fallback to frontend SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 FoodCycle AI is running live on port ${PORT}`);
  console.log(`🌍 Local Access: http://localhost:${PORT}`);
  console.log(`🌱 Production Ready for Render Deployment`);
  console.log('====================================================');
});
