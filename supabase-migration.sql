-- Keyco Database Migration to Supabase (PostgreSQL)
-- Run this SQL in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FAQs table
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  q_tr TEXT NOT NULL,
  q_en TEXT NOT NULL,
  a_tr TEXT NOT NULL,
  a_en TEXT NOT NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL, -- store in minor units (e.g., cents)
  currency TEXT NOT NULL DEFAULT 'TRY',
  category TEXT,
  platform TEXT, -- steam, valorant, lol, etc.
  package_level TEXT, -- low, medium, high, random
  discount INTEGER DEFAULT 0, -- indirim yüzdesi (0-100 arası)
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mock',
  external_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated | processing | succeeded | failed | cancelled
  raw_payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_ext ON payments(external_id);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

-- Auth tokens table
CREATE TABLE IF NOT EXISTS auth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'verify' | 'reset' | 'login_otp' | 'change_pwd'
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending users table
CREATE TABLE IF NOT EXISTS pending_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending email changes table
CREATE TABLE IF NOT EXISTS pending_email_changes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support ratings table
CREATE TABLE IF NOT EXISTS support_ratings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_ratings_created ON support_ratings(created_at);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);

-- Featured products table
CREATE TABLE IF NOT EXISTS featured_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  price REAL NOT NULL,
  discount REAL DEFAULT 0,
  badge TEXT,
  icon TEXT,
  image TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_featured_order ON featured_products(display_order);

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')), -- percentage or fixed amount
  value REAL NOT NULL, -- percentage (0-100) or fixed amount in TRY
  min_order_amount INTEGER DEFAULT 0, -- minimum order amount to use coupon
  max_uses INTEGER DEFAULT -1, -- -1 means unlimited
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  target_type TEXT DEFAULT 'all', -- targeting: all | category | platform | product
  target_values TEXT, -- comma separated list (categories/platforms/product ids)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- Coupon usage table
CREATE TABLE IF NOT EXISTS coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount INTEGER NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);

-- Product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id) -- one review per user per product
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'order_status', 'new_product', 'discount', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  related_id INTEGER, -- order_id, product_id, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Order tracking table
CREATE TABLE IF NOT EXISTS order_tracking (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_status ON order_tracking(status);

-- Product codes table
CREATE TABLE IF NOT EXISTS product_codes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, code)
);

CREATE INDEX IF NOT EXISTS idx_product_codes_product ON product_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_codes_used ON product_codes(is_used);

-- Order item codes table
CREATE TABLE IF NOT EXISTS order_item_codes (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code_id INTEGER NOT NULL REFERENCES product_codes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_item_id, code_id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_codes_item ON order_item_codes(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_codes_product ON order_item_codes(product_id);

-- Row Level Security (RLS)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    -- Enable RLS on every public table
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.schemaname, r.tablename);

    -- Ensure service_role can still perform full access for operational tasks
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = r.schemaname
        AND tablename = r.tablename
        AND policyname = 'service role full access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "service role full access" ON %I.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'');',
        r.schemaname,
        r.tablename
      );
    END IF;
  END LOOP;
END $$;

