/**
 * Expiry Predictor Rules Engine
 * Calculates recommended shelf life, dynamic expiry windows,
 * and safety thresholds based on food type, storage temperature, and preparation time.
 */

// Food type baseline shelf life in hours under standard conditions
const SHELF_LIFE_MATRIX = {
  fresh_cooked_veg: { baseHours: 8, optimalTemp: 4, dangerTempThreshold: 25 },
  fresh_cooked_nonveg: { baseHours: 5, optimalTemp: 4, dangerTempThreshold: 25 },
  bakery_bread: { baseHours: 96, optimalTemp: 22, dangerTempThreshold: 30 }, // 4 days
  bakery_cream: { baseHours: 24, optimalTemp: 4, dangerTempThreshold: 20 },
  packaged_dairy: { baseHours: 168, optimalTemp: 4, dangerTempThreshold: 15 }, // 7 days
  packaged_dry: { baseHours: 720, optimalTemp: 25, dangerTempThreshold: 35 }, // 30 days
  raw_produce: { baseHours: 120, optimalTemp: 10, dangerTempThreshold: 28 }, // 5 days
};

function predictExpiry({ category, foodType, storageTemp, preparedAt }) {
  const prepTime = preparedAt ? new Date(preparedAt).getTime() : Date.now();
  const temp = Number(storageTemp) || 28; // Default room temp in India ~ 28°C

  let lookupKey = 'fresh_cooked_veg';
  if (category === 'bakery') {
    lookupKey = foodType === 'cream' ? 'bakery_cream' : 'bakery_bread';
  } else if (category === 'packaged') {
    lookupKey = foodType === 'dairy' ? 'packaged_dairy' : 'packaged_dry';
  } else if (category === 'fresh_cooked') {
    lookupKey = foodType === 'non_veg' ? 'fresh_cooked_nonveg' : 'fresh_cooked_veg';
  } else {
    lookupKey = 'raw_produce';
  }

  const profile = SHELF_LIFE_MATRIX[lookupKey] || SHELF_LIFE_MATRIX.fresh_cooked_veg;
  let adjustedHours = profile.baseHours;

  // Temperature degradation factor (Arrhenius approximation for food safety)
  if (temp > profile.dangerTempThreshold) {
    const delta = temp - profile.dangerTempThreshold;
    const penaltyRatio = Math.min(0.65, delta * 0.04); // Up to 65% shelf life reduction in high heat
    adjustedHours = adjustedHours * (1 - penaltyRatio);
  } else if (temp <= profile.optimalTemp) {
    adjustedHours = adjustedHours * 1.5; // Cold chain preserves up to 50% longer
  }

  const predictedExpiryMs = prepTime + adjustedHours * 3600 * 1000;
  const predictedExpiryDate = new Date(predictedExpiryMs);

  return {
    predictedExpiryDate: predictedExpiryDate.toISOString(),
    shelfLifeHours: Math.round(adjustedHours),
    tempWarning: temp > profile.dangerTempThreshold ? `Storage at ${temp}°C accelerates spoilage.` : 'Storage temperature within safe parameters.',
    recommendedStage: evaluateStage(predictedExpiryMs, category)
  };
}

function evaluateStage(expiryMs, category) {
  const now = Date.now();
  const diffHours = (expiryMs - now) / (3600 * 1000);

  if (diffHours <= 0) {
    return 'organic_recycling'; // Expired -> Recycling Ledger
  }

  // Fresh cooked food uses hour-based urgency (e.g. within 5 hours -> SOS)
  // Packaged/bakery uses days/hours
  if (category === 'fresh_cooked' && diffHours <= 5) {
    return 'sos_donation';
  }

  if (diffHours <= 120) { // <= 5 days
    return 'sos_donation';
  }

  if (diffHours <= 216) { // <= 9 days
    return 'dynamic_discount';
  }

  return 'logged';
}

module.exports = {
  predictExpiry,
  evaluateStage,
  SHELF_LIFE_MATRIX
};
