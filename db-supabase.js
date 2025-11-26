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

    // Seed featured products
    const { data: featured } = await db.supabase.from('featured_products').select('id').limit(1);
    if (!featured || featured.length === 0) {
      await db.supabase.from('featured_products').insert([
        { name: 'Cyberpunk 2077', platform: 'Steam', price: 239, discount: 20, badge: 'discount', icon: 'fas fa-gamepad', display_order: 1 },
        { name: 'Valorant 3650 VP', platform: 'Valorant', price: 800, discount: 0, badge: 'hot', icon: 'fas fa-crosshairs', display_order: 2 },
        { name: 'Elden Ring', platform: 'Steam', price: 399, discount: 0, badge: null, icon: 'fas fa-dragon', display_order: 3 },
        { name: 'Steam Oyun Kodu', platform: 'Steam', price: 75, discount: 0, badge: 'new', icon: 'fab fa-steam', display_order: 4 },
        { name: 'League of Legends RP', platform: 'LoL', price: 240, discount: 0, badge: 'new', icon: 'fas fa-crown', display_order: 5 },
        { name: 'Steam Rastgele Oyun Kodu', platform: 'Steam', price: 102, discount: 15, badge: 'discount', icon: 'fas fa-dice', display_order: 6 }
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

