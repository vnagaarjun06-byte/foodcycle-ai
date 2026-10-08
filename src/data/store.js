/**
 * Data Store for FoodCycle AI
 * Provides in-memory storage with instant query and update operations.
 */

const { SEED_ORGANIZATIONS, SEED_FOOD_ITEMS } = require('./seedData');
const crypto = require('crypto');

class Store {
  constructor() {
    this.organizations = [...SEED_ORGANIZATIONS];
    this.foodItems = JSON.parse(JSON.stringify(SEED_FOOD_ITEMS));
    this.receipts = [];
    this.auditLogs = [];

    // Pre-generate initial receipts for pre-seeded claimed items
    this.initReceipts();
  }

  initReceipts() {
    this.receipts.push({
      receiptId: '80G-2026-0891',
      donorName: 'Grand Palace Marriage Hall',
      donorGst: '33AABCT1234Z1Z8',
      foodItem: 'Veg Biryani & Paneer Gravy (50 Servings)',
      recipientName: 'Karunai Illam Orphanage',
      quantity: '50 servings',
      estimatedValue: 4500,
      taxDeductionValue: 4500,
      exemptionSection: 'Section 80G(5) Income Tax Act, 1961',
      date: new Date().toISOString().split('T')[0],
      status: 'VERIFIED',
      co2OffsetKg: 125
    });
  }

  // --- Food Items ---
  getAllFood() {
    return this.foodItems;
  }

  getFoodById(id) {
    return this.foodItems.find(f => f.id === id);
  }

  addFood(item) {
    const newItem = {
      id: 'food-' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      status: item.status || 'logged',
      discountTier: item.discountTier || 0,
      currentPrice: item.currentPrice || item.originalPrice || 0,
      co2SavedKg: item.quantity ? Math.round(Number(item.quantity) * 2.5) : 10,
      ...item
    };
    this.foodItems.unshift(newItem);
    this.logAction('FOOD_LOGGED', `Food item '${newItem.title}' logged by ${newItem.donorName}`);
    return newItem;
  }

  updateFood(id, updates) {
    const idx = this.foodItems.findIndex(f => f.id === id);
    if (idx === -1) return null;
    this.foodItems[idx] = { ...this.foodItems[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.foodItems[idx];
  }

  deleteFood(id) {
    const idx = this.foodItems.findIndex(f => f.id === id);
    if (idx === -1) return false;
    this.foodItems.splice(idx, 1);
    return true;
  }

  // --- Organizations ---
  getOrganizations(type) {
    if (!type) return this.organizations;
    return this.organizations.filter(o => o.type === type);
  }

  getOrgById(id) {
    return this.organizations.find(o => o.id === id);
  }

  // --- Receipts ---
  getAllReceipts() {
    return this.receipts;
  }

  getReceiptById(receiptId) {
    return this.receipts.find(r => r.receiptId === receiptId);
  }

  generateReceipt(foodItem, recipientName) {
    const receipt = {
      receiptId: '80G-2026-' + Math.floor(1000 + Math.random() * 9000),
      donorName: foodItem.donorName,
      donorGst: foodItem.donorGst || '33AABCT9988D1Z9',
      foodItem: `${foodItem.title} (${foodItem.quantity} ${foodItem.unit})`,
      recipientName: recipientName || foodItem.matchedRecipientName || 'Registered NGO Partner',
      quantity: `${foodItem.quantity} ${foodItem.unit}`,
      estimatedValue: Number(foodItem.estimatedValue || 1500),
      taxDeductionValue: Number(foodItem.estimatedValue || 1500),
      exemptionSection: 'Section 80G(5) of the Income Tax Act, 1961',
      date: new Date().toISOString().split('T')[0],
      status: 'VERIFIED',
      co2OffsetKg: foodItem.co2SavedKg || Math.round(Number(foodItem.quantity || 10) * 2.5)
    };
    this.receipts.unshift(receipt);
    return receipt;
  }

  // --- Stats & Impact ---
  getStats() {
    const totalRescuedMeals = this.foodItems
      .filter(f => f.status === 'claimed_donation' || f.status === 'sos_donation' || f.status === 'purchased_discount')
      .reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

    const totalCo2Saved = this.foodItems
      .reduce((acc, curr) => acc + (Number(curr.co2SavedKg) || 0), 0);

    const dynamicStoreCount = this.foodItems.filter(f => f.status === 'dynamic_discount').length;
    const sosUrgentCount = this.foodItems.filter(f => f.status === 'sos_donation').length;
    const recycledCount = this.foodItems.filter(f => f.status === 'organic_recycling').length;

    const totalBiogasM3 = this.foodItems
      .filter(f => f.status === 'organic_recycling')
      .reduce((acc, curr) => acc + (Number(curr.biogasYieldM3) || (Number(curr.quantity) * 0.22)), 0);

    const totalCompostKg = this.foodItems
      .filter(f => f.status === 'organic_recycling')
      .reduce((acc, curr) => acc + (Number(curr.compostYieldKg) || (Number(curr.quantity) * 0.4)), 0);

    return {
      totalRescuedMeals,
      totalCo2SavedKg: Math.round(totalCo2Saved),
      dynamicStoreCount,
      sosUrgentCount,
      recycledCount,
      totalBiogasM3: Number(totalBiogasM3.toFixed(1)),
      totalCompostKg: Number(totalCompostKg.toFixed(1)),
      totalReceiptsCount: this.receipts.length
    };
  }

  logAction(type, message) {
    this.auditLogs.unshift({
      timestamp: new Date().toISOString(),
      type,
      message
    });
    if (this.auditLogs.length > 50) this.auditLogs.pop();
  }

  getLogs() {
    return this.auditLogs;
  }

  resetToSeed() {
    this.organizations = [...SEED_ORGANIZATIONS];
    this.foodItems = JSON.parse(JSON.stringify(SEED_FOOD_ITEMS));
    this.receipts = [];
    this.initReceipts();
  }
}

const store = new Store();
module.exports = store;
