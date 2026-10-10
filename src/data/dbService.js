/**
 * Unified Database Service for FoodCycle AI
 * Integrates Supabase PostgreSQL Cloud with local in-memory store fallback.
 */

const { supabase, isConfigured, testConnection } = require('./supabaseClient');
const store = require('./store');

// Helper to map snake_case from PostgreSQL to camelCase for API
function mapFromDb(item) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title,
    donorName: item.donor_name,
    donorType: item.donor_type,
    donorPhone: item.donor_phone,
    donorAddress: item.donor_address,
    donorGst: item.donor_gst,
    lat: item.lat !== null ? Number(item.lat) : 13.0827,
    lng: item.lng !== null ? Number(item.lng) : 80.2707,
    category: item.category,
    foodType: item.food_type,
    quantity: item.quantity !== null ? Number(item.quantity) : 0,
    unit: item.unit,
    estimatedValue: item.estimated_value !== null ? Number(item.estimated_value) : 0,
    storageTemp: item.storage_temp !== null ? Number(item.storage_temp) : 28,
    preparedAt: item.prepared_at,
    expiryDate: item.expiry_date,
    status: item.status,
    discountTier: item.discount_tier !== null ? Number(item.discount_tier) : 0,
    originalPrice: item.original_price !== null ? Number(item.original_price) : 0,
    currentPrice: item.current_price !== null ? Number(item.current_price) : 0,
    matchedRecipientId: item.matched_recipient_id,
    matchedRecipientName: item.matched_recipient_name,
    matchedRecipientDistanceKm: item.matched_recipient_distance_km !== null ? Number(item.matched_recipient_distance_km) : null,
    co2SavedKg: item.co2_saved_kg !== null ? Number(item.co2_saved_kg) : 0,
    biogasYieldM3: item.biogas_yield_m3 !== null ? Number(item.biogas_yield_m3) : 0,
    compostYieldKg: item.compost_yield_kg !== null ? Number(item.compost_yield_kg) : 0,
    statusNote: item.status_note,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

// Helper to map camelCase to snake_case for PostgreSQL
function mapToDb(item) {
  return {
    id: item.id,
    title: item.title,
    donor_name: item.donorName,
    donor_type: item.donorType,
    donor_phone: item.donorPhone,
    donor_address: item.donorAddress,
    donor_gst: item.donorGst,
    lat: item.lat,
    lng: item.lng,
    category: item.category,
    food_type: item.foodType,
    quantity: item.quantity,
    unit: item.unit,
    estimated_value: item.estimatedValue,
    storage_temp: item.storageTemp,
    prepared_at: item.preparedAt,
    expiry_date: item.expiryDate,
    status: item.status,
    discount_tier: item.discountTier,
    original_price: item.originalPrice,
    current_price: item.currentPrice,
    matched_recipient_id: item.matchedRecipientId,
    matched_recipient_name: item.matchedRecipientName,
    matched_recipient_distance_km: item.matchedRecipientDistanceKm,
    co2_saved_kg: item.co2SavedKg,
    biogas_yield_m3: item.biogasYieldM3,
    compost_yield_kg: item.compostYieldKg,
    status_note: item.statusNote
  };
}

class DbService {
  // Check active DB Status
  async getStatus() {
    const conn = await testConnection();
    return {
      provider: conn.connected ? 'Supabase PostgreSQL (Cloud)' : 'Local In-Memory Cache (Supabase Hybrid Ready)',
      connected: conn.connected,
      configured: isConfigured(),
      details: conn
    };
  }

  // --- Food Items ---
  async getAllFood() {
    if (isConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('food_items').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map(mapFromDb);
        }
      } catch (err) {
        console.warn('[DbService] Falling back to local store for getAllFood:', err.message);
      }
    }
    return store.getAllFood();
  }

  async getFoodById(id) {
    if (isConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('food_items').select('*').eq('id', id).single();
        if (!error && data) {
          return mapFromDb(data);
        }
      } catch (err) {
        console.warn('[DbService] Falling back to local store for getFoodById:', err.message);
      }
    }
    return store.getFoodById(id);
  }

  async addFood(item) {
    // Save to local store
    const localSaved = store.addFood(item);

    if (isConfigured() && supabase) {
      try {
        const dbPayload = mapToDb(localSaved);
        const { data, error } = await supabase.from('food_items').insert([dbPayload]).select();
        if (!error && data && data[0]) {
          console.log('[Supabase] Inserted food batch into PostgreSQL:', localSaved.id);
          return mapFromDb(data[0]);
        }
      } catch (err) {
        console.error('[Supabase Error] addFood insert failed:', err.message);
      }
    }

    return localSaved;
  }

  async updateFood(id, updates) {
    const localUpdated = store.updateFood(id, updates);

    if (isConfigured() && supabase) {
      try {
        const dbUpdates = {};
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.discountTier !== undefined) dbUpdates.discount_tier = updates.discountTier;
        if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
        if (updates.matchedRecipientId !== undefined) dbUpdates.matched_recipient_id = updates.matchedRecipientId;
        if (updates.matchedRecipientName !== undefined) dbUpdates.matched_recipient_name = updates.matchedRecipientName;
        if (updates.matchedRecipientDistanceKm !== undefined) dbUpdates.matched_recipient_distance_km = updates.matchedRecipientDistanceKm;
        if (updates.statusNote !== undefined) dbUpdates.status_note = updates.statusNote;
        dbUpdates.updated_at = new Date().toISOString();

        await supabase.from('food_items').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.error('[Supabase Error] updateFood failed:', err.message);
      }
    }

    return localUpdated;
  }

  // --- Organizations ---
  async getOrganizations(type) {
    if (isConfigured() && supabase) {
      try {
        let query = supabase.from('organizations').select('*');
        if (type) query = query.eq('type', type);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('[DbService] Falling back to local store for getOrganizations:', err.message);
      }
    }
    return store.getOrganizations(type);
  }

  // --- Receipts ---
  async getAllReceipts() {
    if (isConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('tax_receipts').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map(r => ({
            receiptId: r.receipt_id,
            donorName: r.donor_name,
            donorGst: r.donor_gst,
            foodItem: r.food_item,
            recipientName: r.recipient_name,
            quantity: r.quantity,
            estimatedValue: Number(r.estimated_value),
            taxDeductionValue: Number(r.tax_deduction_value),
            exemptionSection: r.exemption_section,
            date: r.date,
            status: r.status,
            co2OffsetKg: Number(r.co2_offset_kg)
          }));
        }
      } catch (err) {
        console.warn('[DbService] Falling back to local store for receipts:', err.message);
      }
    }
    return store.getAllReceipts();
  }

  async generateReceipt(foodItem, recipientName) {
    const receipt = store.generateReceipt(foodItem, recipientName);

    if (isConfigured() && supabase) {
      try {
        await supabase.from('tax_receipts').insert([{
          receipt_id: receipt.receiptId,
          donor_name: receipt.donorName,
          donor_gst: receipt.donorGst,
          food_item: receipt.foodItem,
          recipient_name: receipt.recipientName,
          quantity: receipt.quantity,
          estimated_value: receipt.estimatedValue,
          tax_deduction_value: receipt.taxDeductionValue,
          exemption_section: receipt.exemptionSection,
          date: receipt.date,
          status: receipt.status,
          co2_offset_kg: receipt.co2OffsetKg
        }]);
        console.log('[Supabase] Generated Form 10BE Receipt in PostgreSQL:', receipt.receiptId);
      } catch (err) {
        console.error('[Supabase Error] generateReceipt insert failed:', err.message);
      }
    }

    return receipt;
  }

  // --- Seed Sync from in-memory to Supabase ---
  async syncSeedToSupabase() {
    if (!isConfigured() || !supabase) {
      return { success: false, message: 'Supabase credentials not configured in environment.' };
    }

    try {
      const orgs = store.getOrganizations();
      for (const org of orgs) {
        await supabase.from('organizations').upsert([org], { onConflict: 'id' });
      }

      const foods = store.getAllFood();
      for (const f of foods) {
        await supabase.from('food_items').upsert([mapToDb(f)], { onConflict: 'id' });
      }

      const receipts = store.getAllReceipts();
      for (const r of receipts) {
        await supabase.from('tax_receipts').upsert([{
          receipt_id: r.receiptId,
          donor_name: r.donorName,
          donor_gst: r.donorGst,
          food_item: r.foodItem,
          recipient_name: r.recipientName,
          quantity: r.quantity,
          estimated_value: r.estimatedValue,
          tax_deduction_value: r.taxDeductionValue,
          exemption_section: r.exemptionSection,
          date: r.date,
          status: r.status,
          co2_offset_kg: r.co2OffsetKg
        }], { onConflict: 'receipt_id' });
      }

      return { success: true, message: 'Local food batches and organizations synced to Supabase PostgreSQL!' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

const dbService = new DbService();
module.exports = dbService;
