-- ==============================================================================
-- 🌿 FoodCycle AI - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- to create all tables, indexes, row-level security, and initial seed data.
-- ==============================================================================

-- 1. Organizations & Verification Registry (Shelters, Orphanages, Biogas Plants)
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'orphanage', 'old_age_home', 'shelter', 'biogas_plant', 'compost_plant'
    address TEXT,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    contact VARCHAR(50),
    capacity INTEGER DEFAULT 50,
    daily_capacity_kg NUMERIC(10, 2) DEFAULT 500.0,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Food Inventory & Surplus Batches
CREATE TABLE IF NOT EXISTS food_items (
    id VARCHAR(50) PRIMARY KEY,
    title TEXT NOT NULL,
    donor_name TEXT NOT NULL,
    donor_type VARCHAR(50), -- 'marriage_hall', 'bakery', 'catering', 'supermarket', 'canteen'
    donor_phone VARCHAR(50),
    donor_address TEXT,
    donor_gst VARCHAR(50),
    lat NUMERIC(10, 6) DEFAULT 13.0827,
    lng NUMERIC(10, 6) DEFAULT 80.2707,
    category VARCHAR(50) NOT NULL, -- 'fresh_cooked', 'bakery', 'packaged', 'perishable_spoilage'
    food_type VARCHAR(50) DEFAULT 'veg', -- 'veg', 'non_veg', 'dairy', 'mixed'
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'servings',
    estimated_value NUMERIC(10, 2) DEFAULT 0,
    storage_temp NUMERIC(5, 2) DEFAULT 28.0,
    prepared_at TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'logged', -- 'logged', 'dynamic_discount', 'sos_donation', 'claimed_donation', 'organic_recycling', 'recycled_completed'
    discount_tier INTEGER DEFAULT 0,
    original_price NUMERIC(10, 2) DEFAULT 0,
    current_price NUMERIC(10, 2) DEFAULT 0,
    matched_recipient_id VARCHAR(50) REFERENCES organizations(id) ON DELETE SET NULL,
    matched_recipient_name TEXT,
    matched_recipient_distance_km NUMERIC(6, 2),
    co2_saved_kg NUMERIC(10, 2) DEFAULT 0,
    biogas_yield_m3 NUMERIC(10, 2) DEFAULT 0,
    compost_yield_kg NUMERIC(10, 2) DEFAULT 0,
    status_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Form 10BE / Section 80G Tax Exemption Receipts
CREATE TABLE IF NOT EXISTS tax_receipts (
    receipt_id VARCHAR(50) PRIMARY KEY,
    donor_name TEXT NOT NULL,
    donor_gst VARCHAR(50),
    food_item TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    quantity VARCHAR(50),
    estimated_value NUMERIC(10, 2) DEFAULT 0,
    tax_deduction_value NUMERIC(10, 2) DEFAULT 0,
    exemption_section VARCHAR(100) DEFAULT 'Section 80G(5) Income Tax Act, 1961',
    date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'VERIFIED',
    co2_offset_kg NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Real-Time Audit Logs & Event Stream
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_status ON food_items(status);
CREATE INDEX IF NOT EXISTS idx_food_created ON food_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON tax_receipts(date DESC);

-- Enable Row Level Security (RLS) & Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow Public Read/Write for API integration (can be restricted with Auth tokens in production)
DROP POLICY IF EXISTS "Public Full Access Orgs" ON organizations;
CREATE POLICY "Public Full Access Orgs" ON organizations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Food" ON food_items;
CREATE POLICY "Public Full Access Food" ON food_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Receipts" ON tax_receipts;
CREATE POLICY "Public Full Access Receipts" ON tax_receipts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Logs" ON audit_logs;
CREATE POLICY "Public Full Access Logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 🚀 Initial Seed Data
-- ==============================================================================

INSERT INTO organizations (id, name, type, address, lat, lng, contact, capacity, daily_capacity_kg)
VALUES
    ('ngo-1', 'Karunai Illam Orphanage', 'orphanage', 'Anna Nagar, Chennai', 13.0850, 80.2100, '+91 98765 43210', 85, 0),
    ('ngo-2', 'Anbalayam Senior Care Home', 'old_age_home', 'T. Nagar, Chennai', 13.0418, 80.2341, '+91 98412 11223', 60, 0),
    ('ngo-3', 'Sneha Shelter for Homeless', 'shelter', 'Vadapalani, Chennai', 13.0524, 80.2088, '+91 94440 98765', 120, 0),
    ('plant-1', 'GreenEarth Biogas & Fertilizer Hub', 'biogas_plant', 'Ambattur Industrial Estate', 13.1143, 80.1548, '+91 91234 56789', 0, 5000),
    ('plant-2', 'EcoBio Compost Solutions', 'compost_plant', 'Guindy Industrial Area', 13.0067, 80.2025, '+91 99887 76655', 0, 2500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO food_items (
    id, title, donor_name, donor_type, donor_phone, donor_address, donor_gst, lat, lng, 
    category, food_type, quantity, unit, estimated_value, storage_temp, status, original_price, current_price,
    matched_recipient_id, matched_recipient_name, co2_saved_kg
)
VALUES
    ('food-001', '50 Servings Royal Veg Biryani & Paneer Gravy', 'Grand Palace Marriage Hall', 'marriage_hall', '+91 98401 23456', '12th Cross St, Vadapalani, Chennai', '33AABCT1234Z1Z8', 13.0505, 80.2115, 'fresh_cooked', 'veg', 50, 'servings', 4500, 32, 'sos_donation', 4500, 0, 'ngo-1', 'Karunai Illam Orphanage', 125),
    ('food-002', 'Assorted Whole Wheat Bread & Butter Croissants (15 Packs)', 'FreshBake Artisan Patisserie', 'bakery', '+91 98845 67890', '5th Main Rd, Anna Nagar, Chennai', '33BBXPK9876L1Z4', 13.0827, 80.2160, 'bakery', 'veg', 15, 'packs', 1800, 24, 'sos_donation', 1800, 0, 'ngo-1', 'Karunai Illam Orphanage', 42),
    ('food-003', 'Organic Milk Cartons & Greek Yogurt Cups (25 Units)', 'SuperDaily Mart - Hypermarket', 'supermarket', '+91 97900 12121', 'Pondy Bazaar, T. Nagar, Chennai', '33AAACS5555M1Z2', 13.0405, 80.2337, 'packaged', 'dairy', 25, 'units', 1250, 4, 'dynamic_discount', 1250, 625, NULL, NULL, 35)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tax_receipts (receipt_id, donor_name, donor_gst, food_item, recipient_name, quantity, estimated_value, tax_deduction_value, co2_offset_kg)
VALUES
    ('80G-2026-0891', 'Grand Palace Marriage Hall', '33AABCT1234Z1Z8', 'Veg Biryani & Paneer Gravy (50 Servings)', 'Karunai Illam Orphanage', '50 servings', 4500, 4500, 125)
ON CONFLICT (receipt_id) DO NOTHING;

INSERT INTO audit_logs (type, message)
VALUES
    ('SYSTEM_INIT', 'FoodCycle AI database schema verified with Supabase PostgreSQL integration.');
