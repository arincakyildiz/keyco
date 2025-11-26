// Supabase Database Client
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  console.error('See SUPABASE_SETUP.md for instructions');
  throw new Error('Supabase credentials not configured');
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase client initialized');

// Database wrapper to maintain compatibility with existing code
// This provides a similar interface to better-sqlite3
class SupabaseDB {
  constructor() {
    this.supabase = supabase;
  }

  // Prepare-like method for compatibility
  prepare(query) {
    return new SupabasePreparedStatement(query, this.supabase);
  }

  // Exec-like method for running raw SQL (Supabase doesn't support this directly)
  // We'll use RPC functions or direct queries instead
  async exec(sql) {
    console.warn('exec() is not fully supported in Supabase. Use prepare() instead.');
    // For migration purposes, you should run SQL in Supabase Dashboard
    return Promise.resolve();
  }

  // Get Supabase client directly
  get client() {
    return this.supabase;
  }
}

// Prepared statement wrapper
class SupabasePreparedStatement {
  constructor(query, supabase) {
    this.query = query;
    this.supabase = supabase;
    this.params = [];
  }

  // Bind parameters (like better-sqlite3)
  bind(...params) {
    this.params = params;
    return this;
  }

  // Run query (INSERT, UPDATE, DELETE)
  async run(...params) {
    const finalParams = params.length > 0 ? params : this.params;
    return this._execute('run', finalParams);
  }

  // Get single row
  async get(...params) {
    const finalParams = params.length > 0 ? params : this.params;
    return this._execute('get', finalParams);
  }

  // Get all rows
  async all(...params) {
    const finalParams = params.length > 0 ? params : this.params;
    return this._execute('all', finalParams);
  }

  // Execute query based on type
  async _execute(type, params) {
    // Parse SQL query and convert to Supabase query
    const { table, operation, where, values, select } = this._parseQuery(this.query, params);
    
    try {
      let result;
      
      switch (operation) {
        case 'SELECT':
          result = await this._select(table, where, select);
          return type === 'get' ? (result.data?.[0] || null) : (result.data || []);
        
        case 'INSERT':
          result = await this._insert(table, values);
          return { changes: result.data?.length || 0, lastInsertRowid: result.data?.[0]?.id };
        
        case 'UPDATE':
          result = await this._update(table, values, where);
          return { changes: result.count || 0 };
        
        case 'DELETE':
          result = await this._delete(table, where);
          return { changes: result.count || 0 };
        
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
  }

  // Parse SQL query (basic parser)
  _parseQuery(query, params) {
    const normalized = query.trim().toUpperCase();
    const parts = query.trim().split(/\s+/);
    
    let operation = 'SELECT';
    if (normalized.startsWith('SELECT')) operation = 'SELECT';
    else if (normalized.startsWith('INSERT')) operation = 'INSERT';
    else if (normalized.startsWith('UPDATE')) operation = 'UPDATE';
    else if (normalized.startsWith('DELETE')) operation = 'DELETE';
    
    // Extract table name
    let table = null;
    if (normalized.includes('FROM')) {
      const fromIndex = parts.indexOf('FROM');
      table = parts[fromIndex + 1]?.replace(/[`"]/g, '');
    } else if (normalized.includes('INTO')) {
      const intoIndex = parts.indexOf('INTO');
      table = parts[intoIndex + 1]?.replace(/[`"]/g, '');
    } else if (normalized.startsWith('UPDATE')) {
      table = parts[1]?.replace(/[`"]/g, '');
    }
    
    // Extract WHERE clause
    const where = this._extractWhere(query, params);
    
    // Extract values for INSERT/UPDATE
    const values = this._extractValues(query, params);
    
    // Extract SELECT columns
    const select = this._extractSelect(query);
    
    return { table, operation, where, values, select };
  }

  _extractWhere(query, params) {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (!whereMatch) return {};
    
    const whereClause = whereMatch[1];
    const conditions = {};
    
    // Simple WHERE parsing (column = ?)
    const eqMatch = whereClause.match(/(\w+)\s*=\s*\?/);
    if (eqMatch && params.length > 0) {
      conditions[eqMatch[1]] = params[0];
    }
    
    return conditions;
  }

  _extractValues(query, params) {
    const valuesMatch = query.match(/VALUES\s*\((.+?)\)/i);
    if (!valuesMatch) return {};
    
    // Map params to column names (simplified)
    // This is a basic implementation - may need refinement
    const columnsMatch = query.match(/INSERT\s+INTO\s+\w+\s*\((.+?)\)/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
      const values = {};
      columns.forEach((col, i) => {
        if (params[i] !== undefined) {
          values[col] = params[i];
        }
      });
      return values;
    }
    
    return {};
  }

  _extractSelect(query) {
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    if (!selectMatch) return '*';
    return selectMatch[1].trim();
  }

  // Supabase query methods
  async _select(table, where, select) {
    let query = this.supabase.from(table).select(select || '*');
    
    // Apply WHERE conditions
    Object.entries(where || {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    return await query;
  }

  async _insert(table, values) {
    return await this.supabase.from(table).insert(values).select();
  }

  async _update(table, values, where) {
    let query = this.supabase.from(table).update(values);
    
    // Apply WHERE conditions
    Object.entries(where || {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    return await query.select();
  }

  async _delete(table, where) {
    let query = this.supabase.from(table).delete();
    
    // Apply WHERE conditions
    Object.entries(where || {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    return await query.select();
  }
}

// Create database instance
const db = new SupabaseDB();

// Seed data functions (async versions)
async function seedData() {
  try {
    // Seed FAQs
    const { data: faqs } = await db.supabase.from('faqs').select('id').limit(1);
    if (!faqs || faqs.length === 0) {
      await db.supabase.from('faqs').insert([
        {
          q_tr: 'Kodlar nasıl teslim edilir?',
          q_en: 'How are codes delivered?',
          a_tr: 'Ödemeden sonra e‑posta ile anında.',
          a_en: 'Instantly via email after payment.'
        },
        {
          q_tr: 'İade politikası nedir?',
          q_en: 'What is the refund policy?',
          a_tr: 'Kullanılmamış kodlarda 14 gün içinde iade.',
          a_en: 'Refunds within 14 days for unused codes.'
        }
      ]);
    }

    // Seed admin user
    const { data: users } = await db.supabase.from('users').select('id').limit(1);
    if (!users || users.length === 0) {
      const adminName = process.env.ADMIN_NAME || 'Admin';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@keyco.local';
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
      const hash = bcrypt.hashSync(adminPass, 10);
      
      await db.supabase.from('users').insert({
        name: adminName,
        email: adminEmail,
        password_hash: hash,
        role: 'admin',
        email_verified: true
      });

      // Custom admin
      const customHash = bcrypt.hashSync('arinc240208', 10);
      await db.supabase.from('users').insert({
        name: 'Keyco Admin',
        email: 'keycoglobal@gmail.com',
        password_hash: customHash,
        role: 'admin',
        email_verified: true
      });
    }

    // Seed products
    const { data: products } = await db.supabase.from('products').select('id').limit(1);
    if (!products || products.length === 0) {
      await db.supabase.from('products').insert([
        // Valorant Products (fiyatlar kuruş cinsinden: TL * 100)
        // Normal VP ürünleri: hepsi vp.png kullanır
        { name: 'Valorant 475 VP', slug: 'valorant-475-vp', description: '475 Valorant VP', price: 12000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'low', discount: 0, image_url: 'vp.png' },
        { name: 'Valorant 1000 VP', slug: 'valorant-1000-vp', description: '1000 Valorant VP', price: 25000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'medium', discount: 0, image_url: 'vp.png' },
        { name: 'Valorant 2050 VP', slug: 'valorant-2050-vp', description: '2050 Valorant VP', price: 50000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'medium', discount: 0, image_url: 'vp.png' },
        { name: 'Valorant 3650 VP', slug: 'valorant-3650-vp', description: '3650 Valorant VP', price: 85000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'high', discount: 0, image_url: 'vp.png' },
        { name: 'Valorant 5350 VP', slug: 'valorant-5350-vp', description: '5350 Valorant VP', price: 123000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'high', discount: 0, image_url: 'vp.png' },
        { name: 'Valorant 11000 VP', slug: 'valorant-11000-vp', description: '11000 Valorant VP', price: 245000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'high', discount: 0, image_url: 'vp.png' },
        
        // Valorant Rastgele VP Paketleri (3 ayrı paket: düşük, orta, yüksek)
        { name: 'Valorant Rastgele VP (Düşük Paket)', slug: 'valorant-vp-random-dusuk', description: 'Valorant Rastgele VP - Düşük Paket', price: 15000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'random', discount: 0, image_url: 'vp.png' },
        { name: 'Valorant Rastgele VP (Orta Paket)', slug: 'valorant-vp-random-orta', description: 'Valorant Rastgele VP - Orta Paket', price: 35000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'random', discount: 0, image_url: 'vp1.png' },
        { name: 'Valorant Rastgele VP (Yüksek Paket)', slug: 'valorant-vp-random-yuksek', description: 'Valorant Rastgele VP - Yüksek Paket', price: 70000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'random', discount: 0, image_url: 'vp2.png' },
        
        // League of Legends Products
        { name: 'League of Legends RP 650', slug: 'lol-rp-650', description: '650 League of Legends RP', price: 15000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'low', discount: 0, image_url: 'rp.png' },
        { name: 'League of Legends RP 1380', slug: 'lol-rp-1380', description: '1380 League of Legends RP', price: 30000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'medium', discount: 0, image_url: 'rp.png' },
        { name: 'League of Legends RP 2800', slug: 'lol-rp-2800', description: '2800 League of Legends RP', price: 60000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'medium', discount: 0, image_url: 'rp.png' },
        { name: 'League of Legends RP 5000', slug: 'lol-rp-5000', description: '5000 League of Legends RP', price: 100000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'high', discount: 0, image_url: 'rp.png' },
        
        // LoL Rastgele RP Paketleri (3 ayrı paket: düşük, orta, yüksek)
        { name: 'LoL Rastgele RP (Düşük Paket)', slug: 'lol-rp-random-dusuk', description: 'LoL Rastgele RP - Düşük Paket', price: 20000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'random', discount: 0, image_url: 'rp.png' },
        { name: 'LoL Rastgele RP (Orta Paket)', slug: 'lol-rp-random-orta', description: 'LoL Rastgele RP - Orta Paket', price: 45000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'random', discount: 0, image_url: 'rp2.png' },
        { name: 'LoL Rastgele RP (Yüksek Paket)', slug: 'lol-rp-random-yuksek', description: 'LoL Rastgele RP - Yüksek Paket', price: 80000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'random', discount: 0, image_url: 'rp3.png' },
        
        // Steam Products
        // Normal Steam ürünleri: hepsi st.png kullanır
        { name: 'Steam Cüzdan Kodu 50 TL', slug: 'steam-wallet-50tl', description: '50 TL Steam Cüzdan Kodu', price: 5000, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'low', discount: 0, image_url: 'st.png' },
        { name: 'Steam Cüzdan Kodu 100 TL', slug: 'steam-wallet-100tl', description: '100 TL Steam Cüzdan Kodu', price: 10000, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'medium', discount: 0, image_url: 'st.png' },
        { name: 'Steam Cüzdan Kodu 200 TL', slug: 'steam-wallet-200tl', description: '200 TL Steam Cüzdan Kodu', price: 20000, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'high', discount: 0, image_url: 'st.png' },
        { name: 'Cyberpunk 2077', slug: 'cyberpunk-2077', description: 'Cyberpunk 2077 PC Oyunu', price: 59900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 10, image_url: 'st.png' },
        { name: 'Grand Theft Auto V', slug: 'gta-v', description: 'Grand Theft Auto V PC Oyunu', price: 29900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 5, image_url: 'st.png' },
        { name: 'Elden Ring', slug: 'elden-ring', description: 'Elden Ring PC Oyunu', price: 69900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 0, image_url: 'st.png' },
        { name: 'Red Dead Redemption 2', slug: 'red-dead-redemption-2', description: 'Red Dead Redemption 2 PC Oyunu', price: 49900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 0, image_url: 'st.png' }
      ]);
      console.log('✅ Products seeded');
    }
    
    // Seed featured products
    const { data: featured } = await db.supabase.from('featured_products').select('id').limit(1);
    if (!featured || featured.length === 0) {
      await db.supabase.from('featured_products').insert([
        { name: 'Cyberpunk 2077', platform: 'Steam', price: 599, discount: 10, badge: 'new', icon: 'fas fa-fire', display_order: 1 },
        { name: 'Grand Theft Auto V', platform: 'Epic Games', price: 299, discount: 5, badge: 'sale', icon: 'fas fa-tag', display_order: 2 },
        { name: 'Elden Ring', platform: 'Steam', price: 699, discount: 0, badge: 'hot', icon: 'fas fa-star', display_order: 3 },
        { name: 'Red Dead Redemption 2', platform: 'Rockstar', price: 499, discount: 0, badge: 'new', icon: 'fas fa-plus', display_order: 4 }
      ]);
    }

    // Seed coupons
    const { data: coupons } = await db.supabase.from('coupons').select('id').limit(1);
    if (!coupons || coupons.length === 0) {
      await db.supabase.from('coupons').insert([
        {
          code: 'WELCOME20',
          type: 'percentage',
          value: 20,
          min_order_amount: 10000,
          max_uses: 100,
          valid_until: new Date(Date.now() + 30*24*60*60*1000).toISOString()
        },
        {
          code: 'SAVE50',
          type: 'fixed',
          value: 5000,
          min_order_amount: 20000,
          max_uses: 50,
          valid_until: new Date(Date.now() + 60*24*60*60*1000).toISOString()
        },
        {
          code: 'STEAM15',
          type: 'percentage',
          value: 15,
          min_order_amount: 5000,
          max_uses: 200,
          valid_until: new Date(Date.now() + 90*24*60*60*1000).toISOString()
        }
      ]);
    }

    console.log('✅ Seed data completed');
  } catch (error) {
    console.error('❌ Seed data error:', error);
  }
}

// Run seed data on initialization
seedData().catch(console.error);

module.exports = db;

