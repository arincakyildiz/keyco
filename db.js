const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Determine database path - use /tmp for serverless, __dirname for local
let dbPath;
const isServerless = process.env.LAMBDA_TASK_ROOT || 
                     process.env.AWS_LAMBDA_FUNCTION_NAME || 
                     process.env.VERCEL || 
                     process.env.VERCEL_ENV ||
                     String(__dirname || '').includes('/var/task') ||
                     String(__dirname || '').includes('/var/runtime') ||
                     String(process.cwd() || '').includes('/var/task') ||
                     String(process.cwd() || '').includes('/var/runtime');

console.log('Environment check:', {
  LAMBDA_TASK_ROOT: process.env.LAMBDA_TASK_ROOT,
  AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  __dirname: __dirname,
  cwd: process.cwd(),
  isServerless: isServerless
});

if (isServerless) {
  // Serverless environment (Lambda, Vercel, etc.) - use /tmp directory (writable)
  dbPath = '/tmp/data.sqlite';
  console.log('Serverless environment detected, using /tmp/data.sqlite');
  
  // Ensure /tmp directory exists
  if (!fs.existsSync('/tmp')) {
    try {
      fs.mkdirSync('/tmp', { recursive: true });
      console.log('Created /tmp directory');
    } catch (e) {
      console.error('Could not create /tmp directory:', e.message);
    }
  }
  
  // Copy from __dirname to /tmp if source exists and /tmp doesn't
  const sourcePath = path.join(__dirname, 'data.sqlite');
  if (fs.existsSync(sourcePath) && !fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(sourcePath, dbPath);
      console.log('Database copied to /tmp/data.sqlite');
    } catch (e) {
      console.log('Could not copy database to /tmp, will create new one:', e.message);
    }
  }
} else {
  // Local environment
  dbPath = path.join(__dirname, 'data.sqlite');
  console.log('Local environment detected, using:', dbPath);
}

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory:', dbDir);
  } catch (e) {
    console.error('Could not create database directory:', e.message);
  }
}

// Final safety check: if dbPath contains /var/task, force to /tmp
if (String(dbPath).includes('/var/task') || String(dbPath).includes('/var/runtime')) {
  console.log('WARNING: dbPath contains /var/task or /var/runtime, forcing to /tmp/data.sqlite');
  dbPath = '/tmp/data.sqlite';
  // Ensure /tmp exists
  if (!fs.existsSync('/tmp')) {
    try {
      fs.mkdirSync('/tmp', { recursive: true });
    } catch (e) {
      console.error('Could not create /tmp:', e.message);
    }
  }
}

let db;
try {
  // Try to open database with WAL mode for better concurrency
  db = new Database(dbPath, { 
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });
  // Enable WAL mode for better performance in serverless
  db.pragma('journal_mode = WAL');
  console.log('Database opened successfully at:', dbPath);
} catch (error) {
  console.error('Failed to open database at:', dbPath);
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
  console.error('__dirname:', __dirname);
  console.error('process.cwd():', process.cwd());
  
  // If path contains /var/task, force to /tmp
  if (String(dbPath).includes('/var/task') || String(dbPath).includes('/var/runtime')) {
    console.log('Path contains /var/task, forcing to /tmp/data.sqlite');
    dbPath = '/tmp/data.sqlite';
    try {
      // Ensure /tmp exists
      if (!fs.existsSync('/tmp')) {
        fs.mkdirSync('/tmp', { recursive: true });
      }
      // Try to create new database at /tmp
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      console.log('New database created successfully at:', dbPath);
    } catch (e2) {
      console.error('Failed to create database at /tmp:', e2.message);
      throw error; // Throw original error
    }
  } else if (isServerless && dbPath === '/tmp/data.sqlite') {
    // If we're in serverless and /tmp failed, try creating a new database
    console.log('Attempting to create new database at /tmp/data.sqlite');
    try {
      // Remove old file if it exists and is corrupted
      if (fs.existsSync(dbPath)) {
        try {
          fs.unlinkSync(dbPath);
          console.log('Removed corrupted database file');
        } catch (e) {
          console.log('Could not remove corrupted file:', e.message);
        }
      }
      // Create new database
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      console.log('New database created successfully at:', dbPath);
    } catch (e2) {
      console.error('Failed to create new database:', e2.message);
      throw error; // Throw original error
    }
  } else {
    throw error;
  }
}

// Initialize schema
db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q_tr TEXT NOT NULL,
  q_en TEXT NOT NULL,
  a_tr TEXT NOT NULL,
  a_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL, -- store in minor units (e.g., cents)
  currency TEXT NOT NULL DEFAULT 'TRY',
  category TEXT,
  platform TEXT, -- steam, valorant, lol, etc.
  package_level TEXT, -- low, medium, high, random
  discount INTEGER DEFAULT 0, -- indirim yüzdesi (0-100 arası)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  external_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated | processing | succeeded | failed | cancelled
  raw_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_ext ON payments(external_id);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Shopping cart (temporary cart items)
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(user_id, product_id)
);

-- Tokens for email verification and password reset
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'verify' | 'reset' | 'login_otp' | 'change_pwd'
  expires_at DATETIME NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- Pending registrations (email code must be confirmed before creating real user)
CREATE TABLE IF NOT EXISTS pending_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pending email changes (verify code sent to old email)
CREATE TABLE IF NOT EXISTS pending_email_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  new_email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Support chatbot ratings
CREATE TABLE IF NOT EXISTS support_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_support_ratings_created ON support_ratings(created_at);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);

-- Featured Products
CREATE TABLE IF NOT EXISTS featured_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  price REAL NOT NULL,
  discount REAL DEFAULT 0,
  badge TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_featured_order ON featured_products(display_order);

-- Coupons/Discount Codes
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')), -- percentage or fixed amount
  value REAL NOT NULL, -- percentage (0-100) or fixed amount in TRY
  min_order_amount INTEGER DEFAULT 0, -- minimum order amount to use coupon
  max_uses INTEGER DEFAULT -1, -- -1 means unlimited
  used_count INTEGER DEFAULT 0,
  valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
  valid_until DATETIME,
  is_active INTEGER DEFAULT 1,
  -- targeting: all | category | platform | product
  target_type TEXT DEFAULT 'all',
  target_values TEXT, -- comma separated list (categories/platforms/product ids)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);

-- Product Reviews and Ratings
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_verified_purchase INTEGER DEFAULT 0, -- whether user actually bought this product
  is_approved INTEGER DEFAULT 1, -- admin approval for reviews
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, product_id) -- one review per user per product
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);

-- Notifications System
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'order_status', 'new_product', 'discount', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  related_id INTEGER, -- order_id, product_id, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Order Tracking System
CREATE TABLE IF NOT EXISTS order_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_status ON order_tracking(status);

-- Product code inventory (digital delivery)
CREATE TABLE IF NOT EXISTS product_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  is_used INTEGER NOT NULL DEFAULT 0,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, code),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_product_codes_product ON product_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_codes_used ON product_codes(is_used);

-- Delivered codes per order item (supports quantity > 1)
CREATE TABLE IF NOT EXISTS order_item_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  code_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_item_id, code_id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);
CREATE INDEX IF NOT EXISTS idx_order_item_codes_item ON order_item_codes(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_codes_product ON order_item_codes(product_id);
`);

// Lightweight migrations
try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  const hasEmailVerified = cols.some(c => String(c.name).toLowerCase() === 'email_verified');
  if (!hasEmailVerified) {
    db.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0').run();
  }
} catch (e) {}

// Add discount column to products table if it doesn't exist
try {
  const productCols = db.prepare("PRAGMA table_info(products)").all();
  const hasDiscount = productCols.some(c => String(c.name).toLowerCase() === 'discount');
  if (!hasDiscount) {
    db.prepare('ALTER TABLE products ADD COLUMN discount INTEGER DEFAULT 0').run();
    console.log('Added discount column to products table');
  }
} catch (e) {
  console.log('Could not add discount column:', e.message);
}

// Seed FAQs if empty
const faqCount = db.prepare('SELECT COUNT(*) AS c FROM faqs').get().c;
if (faqCount === 0) {
  const seed = db.prepare('INSERT INTO faqs (q_tr, q_en, a_tr, a_en) VALUES (?, ?, ?, ?)');
  seed.run('Kodlar nasıl teslim edilir?', 'How are codes delivered?', 'Ödemeden sonra e‑posta ile anında.', 'Instantly via email after payment.');
  seed.run('İade politikası nedir?', 'What is the refund policy?', 'Kullanılmamış kodlarda 14 gün içinde iade.', 'Refunds within 14 days for unused codes.');
}

// Seed admin user if none exists
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  // Create default admin user
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@keyco.local';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(adminPass, 10);
  const ins = db.prepare('INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)');
  ins.run(adminName, adminEmail, hash, 'admin');
  
  // Create custom admin user
  const customAdminName = 'Keyco Admin';
  const customAdminEmail = 'keycoglobal@gmail.com';
  const customAdminPass = 'arinc240208';
  const customHash = bcrypt.hashSync(customAdminPass, 10);
  const customIns = db.prepare('INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)');
  customIns.run(customAdminName, customAdminEmail, customHash, 'admin');
}

// Ensure seeded admin is verified if already present
try {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@keyco.local';
  db.prepare('UPDATE users SET email_verified = 1, role = CASE WHEN role IS NULL THEN \"admin\" ELSE role END WHERE email = ?').run(adminEmail);
} catch (e) {}

// Seed sample products if empty
const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (prodCount === 0) {
  const insP = db.prepare('INSERT INTO products (name, slug, description, price, currency, category, platform, package_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  
  // Steam Products
  insP.run('Steam Oyun Kodu', 'steam-game-code', 'Steam oyun kodu - Düşük Paket', 2500, 'TRY', 'steam', 'steam', 'low');
  insP.run('Steam Oyun Kodu', 'steam-game-code-medium', 'Steam oyun kodu - Orta Paket', 5000, 'TRY', 'steam', 'steam', 'medium');
  insP.run('Steam Oyun Kodu', 'steam-game-code-high', 'Steam oyun kodu - Yüksek Paket', 10000, 'TRY', 'steam', 'steam', 'high');
  insP.run('Steam Rastgele Kod', 'steam-random-code', 'Steam rastgele oyun kodu', 1500, 'TRY', 'steam', 'steam', 'random');
  
  // Valorant Products
  insP.run('Valorant VP', 'valorant-vp', 'Valorant VP dijital kod', 10000, 'TRY', 'valorant', 'valorant', 'standard');
  insP.run('Valorant Rastgele Kod', 'valorant-random-code', 'Valorant rastgele kod', 5000, 'TRY', 'valorant', 'valorant', 'random');
  
  // League of Legends Products
  insP.run('LoL RP', 'lol-rp', 'League of Legends RP kodu', 8000, 'TRY', 'lol', 'lol', 'standard');
  insP.run('LoL Rastgele RP', 'lol-random-rp', 'LoL rastgele RP kodu', 4000, 'TRY', 'lol', 'lol', 'random');
}

// Seed featured products if empty
const featuredCount = db.prepare('SELECT COUNT(*) AS c FROM featured_products').get().c;
if (featuredCount === 0) {
  const insF = db.prepare('INSERT INTO featured_products (name, platform, price, discount, badge, icon, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  insF.run('Cyberpunk 2077', 'Steam', 239, 20, 'discount', 'fas fa-gamepad', 1);
  insF.run('Valorant 3650 VP', 'Valorant', 800, 0, 'hot', 'fas fa-crosshairs', 2);
  insF.run('Elden Ring', 'Steam', 399, 0, null, 'fas fa-dragon', 3);
  insF.run('Steam Oyun Kodu', 'Steam', 75, 0, 'new', 'fab fa-steam', 4);
  insF.run('League of Legends RP', 'LoL', 240, 0, 'new', 'fas fa-crown', 5);
  insF.run('Steam Rastgele Oyun Kodu', 'Steam', 102, 15, 'discount', 'fas fa-dice', 6);
}

// Ensure Valorant VP variants exist with requested prices (TL)
try {
  const ensureProduct = (name, slug, priceTl) => {
    const priceKurus = Math.round(priceTl * 100);
    const exists = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (!exists) {
      db.prepare('INSERT INTO products (name, slug, description, price, currency, category, platform, package_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(name, slug, name, priceKurus, 'TRY', 'valorant', 'valorant', 'standard');
    } else {
      db.prepare('UPDATE products SET price = ?, currency = ? WHERE slug = ?')
        .run(priceKurus, 'TRY', slug);
    }
  };
  ensureProduct('Valorant 475 VP', 'valorant-475-vp', 120);
  ensureProduct('Valorant 1000 VP', 'valorant-1000-vp', 250);
  ensureProduct('Valorant 2050 VP', 'valorant-2050-vp', 500);
  ensureProduct('Valorant 3650 VP', 'valorant-3650-vp', 850);
  ensureProduct('Valorant 5350 VP', 'valorant-5350-vp', 1230);
  ensureProduct('Valorant 11000 VP', 'valorant-11000-vp', 2450);
} catch (e) { /* noop */ }

// Remove generic Valorant VP 100 TL product if present
try {
  db.prepare("DELETE FROM products WHERE slug = 'valorant-vp' OR (category = 'valorant' AND LOWER(name) = 'valorant vp')").run();
} catch (e) { /* noop */ }

// Seed sample coupons if empty
const couponCount = db.prepare('SELECT COUNT(*) AS c FROM coupons').get().c;
if (couponCount === 0) {
  const insC = db.prepare('INSERT INTO coupons (code, type, value, min_order_amount, max_uses, valid_until) VALUES (?, ?, ?, ?, ?, ?)');
  
  // 20% off for orders over 100 TL
  insC.run('WELCOME20', 'percentage', 20, 10000, 100, new Date(Date.now() + 30*24*60*60*1000).toISOString());
  
  // 50 TL off for orders over 200 TL
  insC.run('SAVE50', 'fixed', 5000, 20000, 50, new Date(Date.now() + 60*24*60*60*1000).toISOString());
  
  // 15% off for Steam products
  insC.run('STEAM15', 'percentage', 15, 5000, 200, new Date(Date.now() + 90*24*60*60*1000).toISOString());
}

module.exports = db;


