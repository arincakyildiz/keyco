require('dotenv').config();
const db = require('./db.js');

(async () => {
  try {
    if (!db.supabase) {
      console.log('❌ Supabase not configured');
      process.exit(1);
    }
    
    console.log('🌱 Seeding random VP and RP packages...\n');
    
    // Check if random packages exist
    const { data: existing } = await db.supabase
      .from('products')
      .select('id, name, slug')
      .or('slug.ilike.*random*,package_level.eq.random')
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log('⚠️ Random packages already exist, skipping seed.');
      process.exit(0);
    }
    
    // Insert Valorant Rastgele VP packages
    const { data: vpData, error: vpError } = await db.supabase.from('products').insert([
      { name: 'Valorant Rastgele VP (Düşük Paket)', slug: 'valorant-vp-random-dusuk', description: 'Valorant Rastgele VP - Düşük Paket', price: 15000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'random', discount: 0, image_url: 'vp.png' },
      { name: 'Valorant Rastgele VP (Orta Paket)', slug: 'valorant-vp-random-orta', description: 'Valorant Rastgele VP - Orta Paket', price: 35000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'random', discount: 0, image_url: 'vp1.png' },
      { name: 'Valorant Rastgele VP (Yüksek Paket)', slug: 'valorant-vp-random-yuksek', description: 'Valorant Rastgele VP - Yüksek Paket', price: 70000, currency: 'TRY', category: 'valorant', platform: 'valorant', package_level: 'random', discount: 0, image_url: 'vp2.png' }
    ]).select();
    
    if (vpError) {
      console.error('❌ Error seeding Valorant random packages:', vpError);
    } else {
      console.log(`✅ Seeded ${vpData?.length || 0} Valorant Rastgele VP packages`);
      vpData?.forEach(p => console.log(`   - ${p.name}: ${p.price/100}₺`));
    }
    
    // Insert LoL Rastgele RP packages
    const { data: rpData, error: rpError } = await db.supabase.from('products').insert([
      { name: 'LoL Rastgele RP (Düşük Paket)', slug: 'lol-rp-random-dusuk', description: 'LoL Rastgele RP - Düşük Paket', price: 20000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'random', discount: 0, image_url: 'rp.png' },
      { name: 'LoL Rastgele RP (Orta Paket)', slug: 'lol-rp-random-orta', description: 'LoL Rastgele RP - Orta Paket', price: 45000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'random', discount: 0, image_url: 'rp2.png' },
      { name: 'LoL Rastgele RP (Yüksek Paket)', slug: 'lol-rp-random-yuksek', description: 'LoL Rastgele RP - Yüksek Paket', price: 80000, currency: 'TRY', category: 'lol', platform: 'lol', package_level: 'random', discount: 0, image_url: 'rp3.png' }
    ]).select();
    
    if (rpError) {
      console.error('❌ Error seeding LoL random packages:', rpError);
    } else {
      console.log(`✅ Seeded ${rpData?.length || 0} LoL Rastgele RP packages`);
      rpData?.forEach(p => console.log(`   - ${p.name}: ${p.price/100}₺`));
    }
    
    console.log('\n✅ Random packages seeding completed!');
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();

