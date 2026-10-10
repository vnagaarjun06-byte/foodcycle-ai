/**
 * Supabase Client Initialization for FoodCycle AI
 * Connects to Supabase Cloud PostgreSQL database.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;
let isConfigured = false;

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false
      }
    });
    isConfigured = true;
    console.log('[Supabase] Initialized client for:', SUPABASE_URL);
  } catch (err) {
    console.error('[Supabase Error] Failed to create client:', err.message);
  }
} else {
  console.log('[Supabase] No credentials found in environment. Operating in hybrid/fallback store mode.');
}

async function testConnection() {
  if (!isConfigured || !supabase) {
    return {
      connected: false,
      configured: false,
      message: 'Supabase URL/Key not configured in environment (.env).'
    };
  }

  try {
    const { data, error } = await supabase.from('organizations').select('id').limit(1);
    if (error) {
      return {
        connected: false,
        configured: true,
        error: error.message,
        message: `Connected to Supabase endpoint, but table query failed: ${error.message}`
      };
    }
    return {
      connected: true,
      configured: true,
      url: SUPABASE_URL,
      message: 'Successfully connected to Supabase PostgreSQL database!'
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      error: err.message,
      message: `Supabase connection check failed: ${err.message}`
    };
  }
}

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
  testConnection
};
