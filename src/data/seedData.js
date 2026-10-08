/**
 * Seed data for FoodCycle AI
 * Realistic items reflecting catering halls, bakeries, canteens, orphanages, NGOs, and biogas units
 */

const SEED_ORGANIZATIONS = [
  {
    id: 'ngo-1',
    name: 'Karunai Illam Orphanage',
    type: 'orphanage',
    contact: '+91 98765 43210',
    address: 'Anna Nagar, Chennai',
    lat: 13.0850,
    lng: 80.2100,
    capacity: 65,
    verified: true
  },
  {
    id: 'ngo-2',
    name: 'Anbalayam Senior Care Home',
    type: 'old_age_home',
    contact: '+91 98412 11223',
    address: 'T. Nagar, Chennai',
    lat: 13.0418,
    lng: 80.2341,
    capacity: 45,
    verified: true
  },
  {
    id: 'ngo-3',
    name: 'Sneha Shelter for Homeless',
    type: 'shelter',
    contact: '+91 94440 98765',
    address: 'Vadapalani, Chennai',
    lat: 13.0524,
    lng: 80.2088,
    capacity: 80,
    verified: true
  },
  {
    id: 'plant-1',
    name: 'GreenEarth Biogas & Fertilizer Hub',
    type: 'biogas_plant',
    contact: '+91 91234 56789',
    address: 'Ambattur Industrial Estate, Chennai',
    lat: 13.1143,
    lng: 80.1548,
    dailyCapacityKg: 2000,
    verified: true
  },
  {
    id: 'plant-2',
    name: 'EcoBio Compost Solutions',
    type: 'compost_plant',
    contact: '+91 99887 76655',
    address: 'Guindy Industrial Area, Chennai',
    lat: 13.0067,
    lng: 80.2025,
    dailyCapacityKg: 1500,
    verified: true
  }
];

const SEED_FOOD_ITEMS = [
  {
    id: 'food-001',
    donorName: 'Grand Palace Marriage Hall',
    donorType: 'marriage_hall',
    donorPhone: '+91 98401 23456',
    donorAddress: '12th Cross St, Vadapalani, Chennai',
    donorGst: '33AABCT1234Z1Z8',
    lat: 13.0505,
    lng: 80.2115,
    title: '50 Servings Royal Veg Biryani & Paneer Gravy',
    category: 'fresh_cooked',
    foodType: 'veg',
    quantity: 50,
    unit: 'servings',
    estimatedValue: 4500,
    preparedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    expiryDate: new Date(Date.now() + 3 * 3600 * 1000).toISOString(), // 3 hours remaining (SOS stage)
    storageTemp: 32, // Room temp °C
    status: 'sos_donation', // Dynamic stage: SOS Triggered
    discountTier: 0,
    originalPrice: 4500,
    currentPrice: 0,
    matchedRecipientId: 'ngo-1',
    matchedRecipientName: 'Karunai Illam Orphanage',
    co2SavedKg: 125,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  },
  {
    id: 'food-002',
    donorName: 'FreshBake Artisan Patisserie',
    donorType: 'bakery',
    donorPhone: '+91 98845 67890',
    donorAddress: '5th Main Rd, Anna Nagar, Chennai',
    donorGst: '33BBXPK9876L1Z4',
    lat: 13.0827,
    lng: 80.2160,
    title: 'Assorted Whole Wheat Bread & Butter Croissants (15 Packs)',
    category: 'bakery',
    foodType: 'veg',
    quantity: 15,
    unit: 'packs',
    estimatedValue: 1800,
    preparedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // 2 days left -> 50% discount
    storageTemp: 24,
    status: 'dynamic_discount',
    discountTier: 50,
    originalPrice: 1800,
    currentPrice: 900,
    co2SavedKg: 42,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'food-003',
    donorName: 'SuperDaily Mart - Hypermarket',
    donorType: 'supermarket',
    donorPhone: '+91 97900 12121',
    donorAddress: 'Pondy Bazaar, T. Nagar, Chennai',
    donorGst: '33AAACS5555M1Z2',
    lat: 13.0405,
    lng: 80.2337,
    title: 'Organic Milk Cartons & Greek Yogurt Cups (25 Units)',
    category: 'packaged',
    foodType: 'dairy',
    quantity: 25,
    unit: 'units',
    estimatedValue: 1250,
    preparedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + 144 * 3600 * 1000).toISOString(), // 6 days left -> 20% discount
    storageTemp: 4,
    status: 'dynamic_discount',
    discountTier: 20,
    originalPrice: 1250,
    currentPrice: 1000,
    co2SavedKg: 35,
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString()
  },
  {
    id: 'food-004',
    donorName: 'SRM Tech Campus Food Court',
    donorType: 'canteen',
    donorPhone: '+91 94441 55667',
    donorAddress: 'Kattankulathur Canteen 3, Chennai',
    donorGst: '33AABCT9988D1Z9',
    lat: 12.8230,
    lng: 80.0440,
    title: '40 Servings South Indian Lunch (Sambar Rice & Poriyal)',
    category: 'fresh_cooked',
    foodType: 'veg',
    quantity: 40,
    unit: 'servings',
    estimatedValue: 2800,
    preparedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // 2 hours remaining
    storageTemp: 30,
    status: 'sos_donation',
    discountTier: 0,
    originalPrice: 2800,
    currentPrice: 0,
    matchedRecipientId: 'ngo-2',
    matchedRecipientName: 'Anbalayam Senior Care Home',
    co2SavedKg: 98,
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    id: 'food-005',
    donorName: 'Nilgiris Superstore',
    donorType: 'supermarket',
    donorPhone: '+91 98402 33445',
    donorAddress: 'Kilpauk Garden Rd, Chennai',
    donorGst: '33AABCN4444F1Z3',
    lat: 13.0811,
    lng: 80.2405,
    title: 'Cracked Shell Eggs & Overripe Fruit Crates (30 kg)',
    category: 'perishable_spoilage',
    foodType: 'mixed',
    quantity: 30,
    unit: 'kg',
    estimatedValue: 1500,
    preparedAt: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
    expiryDate: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // Expired
    storageTemp: 28,
    status: 'organic_recycling',
    discountTier: 0,
    originalPrice: 1500,
    currentPrice: 0,
    recyclingFacilityId: 'plant-1',
    recyclingFacilityName: 'GreenEarth Biogas & Fertilizer Hub',
    recyclingType: 'Biogas Methane Digester',
    co2SavedKg: 75,
    biogasYieldM3: 6.8,
    compostYieldKg: 12.5,
    createdAt: new Date(Date.now() - 10 * 86400 * 1000).toISOString()
  }
];

module.exports = {
  SEED_ORGANIZATIONS,
  SEED_FOOD_ITEMS
};
