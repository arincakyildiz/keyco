require('dotenv').config();
const db = require('./db.js');

(async () => {
  try {
    if (!db.supabase) {
      console.log('❌ Supabase not configured');
      process.exit(1);
    }
    
    console.log('🌱 Seeding products...\n');
    
    // Check if products exist
    const { data: existing } = await db.supabase.from('products').select('id').limit(1);
    
    if (existing && existing.length > 0) {
      console.log('⚠️ Products already exist, skipping seed.');
      process.exit(0);
    }
    
    // Insert products
    const { data, error } = await db.supabase.from('products').insert([
      // Valorant Products
      { name: 'Valorant 475 VP', slug: 'valorant-475-vp', description: '475 Valorant VP', price: 12000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'low', discount: 0, image_url: 'vp.png' },
      { name: 'Valorant 1000 VP', slug: 'valorant-1000-vp', description: '1000 Valorant VP', price: 25000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'medium', discount: 0, image_url: 'vp.png' },
      { name: 'Valorant 2050 VP', slug: 'valorant-2050-vp', description: '2050 Valorant VP', price: 50000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'medium', discount: 0, image_url: 'vp.png' },
      { name: 'Valorant 3650 VP', slug: 'valorant-3650-vp', description: '3650 Valorant VP', price: 85000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'high', discount: 0, image_url: 'vp.png' },
      { name: 'Valorant 5350 VP', slug: 'valorant-5350-vp', description: '5350 Valorant VP', price: 123000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'high', discount: 0, image_url: 'vp.png' },
      { name: 'Valorant 11000 VP', slug: 'valorant-11000-vp', description: '11000 Valorant VP', price: 245000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'high', discount: 0, image_url: 'vp.png' },
      
      // League of Legends Products
      { name: 'League of Legends RP 650', slug: 'lol-rp-650', description: '650 League of Legends RP', price: 15000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'low', discount: 0, image_url: 'rp.png' },
      { name: 'League of Legends RP 1380', slug: 'lol-rp-1380', description: '1380 League of Legends RP', price: 30000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'medium', discount: 0, image_url: 'rp.png' },
      { name: 'League of Legends RP 2800', slug: 'lol-rp-2800', description: '2800 League of Legends RP', price: 60000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'medium', discount: 0, image_url: 'rp.png' },
      { name: 'League of Legends RP 5000', slug: 'lol-rp-5000', description: '5000 League of Legends RP', price: 100000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'high', discount: 0, image_url: 'rp.png' },
      
      // Steam Products
      { name: 'Steam Cüzdan Kodu 50 TL', slug: 'steam-wallet-50tl', description: '50 TL Steam Cüzdan Kodu', price: 5000, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'low', discount: 0, image_url: 'st.png' },
      { name: 'Steam Cüzdan Kodu 100 TL', slug: 'steam-wallet-100tl', description: '100 TL Steam Cüzdan Kodu', price: 10000, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'medium', discount: 0, image_url: 'st.png' },
      { name: 'Steam Cüzdan Kodu 200 TL', slug: 'steam-wallet-200tl', description: '200 TL Steam Cüzdan Kodu', price: 20000, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'high', discount: 0, image_url: 'st.png' },
      { name: 'Cyberpunk 2077', slug: 'cyberpunk-2077', description: 'Cyberpunk 2077 PC Oyunu', price: 59900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 10, image_url: 'https://image.example.com/cyberpunk.jpg' },
      { name: 'Grand Theft Auto V', slug: 'gta-v', description: 'Grand Theft Auto V PC Oyunu', price: 29900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 5, image_url: 'https://image.example.com/gtav.jpg' },
      { name: 'Elden Ring', slug: 'elden-ring', description: 'Elden Ring PC Oyunu', price: 69900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 0, image_url: 'https://image.example.com/eldenring.jpg' },
      { name: 'Red Dead Redemption 2', slug: 'red-dead-redemption-2', description: 'Red Dead Redemption 2 PC Oyunu', price: 49900, currency: 'TRY', category: 'steam', platform: 'steam', package_level: 'standard', discount: 0, image_url: 'https://image.example.com/rdr2.jpg' }
    ]).select();
    
    if (error) {
      console.error('❌ Error seeding products:', error);
      process.exit(1);
    }
    
    console.log(`✅ Successfully seeded ${data?.length || 0} products!`);
    console.log('\n📦 Seeded products:');
    data.forEach(p => {
      console.log(`  - ${p.name} (${p.category}/${p.platform})`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();

