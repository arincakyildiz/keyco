require('dotenv').config();
const db = require('./db.js');

(async () => {
  try {
    if (db.supabase) {
      console.log('🔄 Updating Steam and LoL RP images...\n');
      
      // Get all Steam products
      const { data: steamProducts } = await db.supabase
        .from('products')
        .select('id, name, slug, image_url, package_level')
        .or('category.eq.steam,platform.eq.steam')
        .order('package_level');
      
      console.log('Steam ürünleri:');
      steamProducts?.forEach(p => {
        console.log(`  ${p.name} (${p.package_level}): ${p.image_url}`);
      });
      
      // Get all LoL products
      const { data: lolProducts } = await db.supabase
        .from('products')
        .select('id, name, slug, image_url, package_level')
        .or('category.eq.lol,platform.eq.lol')
        .order('package_level');
      
      console.log('\nLoL ürünleri:');
      lolProducts?.forEach(p => {
        console.log(`  ${p.name} (${p.package_level}): ${p.image_url}`);
      });
      
      console.log('\n🔄 Updating images...\n');
      
      // Update Steam products
      for (const product of steamProducts || []) {
        const slug = (product.slug || '').toLowerCase();
        const isRandom = slug.includes('random') || slug.includes('rastgele') || product.package_level === 'random';
        
        let newImage = null;
        
        if (isRandom) {
          // Rastgele Steam paketleri: package_level'a göre
          const level = (product.package_level || '').toLowerCase();
          if (level === 'random') {
            // Slug'a göre düşük/orta/yüksek belirle
            if (slug.includes('dusuk') || slug.includes('düşük')) {
              newImage = 'st.png';
            } else if (slug.includes('orta')) {
              newImage = 'st1.png';
            } else if (slug.includes('yuksek') || slug.includes('yüksek')) {
              newImage = 'st2.png';
            }
          }
        } else {
          // Normal Steam ürünleri: hepsi st.png
          newImage = 'st.png';
        }
        
        if (newImage && product.image_url !== newImage) {
          const { error } = await db.supabase
            .from('products')
            .update({ image_url: newImage })
            .eq('id', product.id);
          
          if (error) {
            console.log(`  ❌ Error updating ${product.name}: ${error.message}`);
          } else {
            console.log(`  ✅ Updated Steam: ${product.name}: ${product.image_url} -> ${newImage}`);
          }
        } else if (newImage) {
          console.log(`  ℹ️  Steam: ${product.name} already has correct image: ${product.image_url}`);
        }
      }
      
      // Update LoL RP products
      for (const product of lolProducts || []) {
        const slug = (product.slug || '').toLowerCase();
        const isRandom = slug.includes('random') || slug.includes('rastgele') || product.package_level === 'random';
        
        let newImage = null;
        
        if (isRandom) {
          // Rastgele LoL RP paketleri: package_level'a göre
          const level = (product.package_level || '').toLowerCase();
          if (level === 'random') {
            // Slug'a göre düşük/orta/yüksek belirle
            if (slug.includes('dusuk') || slug.includes('düşük')) {
              newImage = 'rp.png';
            } else if (slug.includes('orta')) {
              newImage = 'rp2.png';
            } else if (slug.includes('yuksek') || slug.includes('yüksek')) {
              newImage = 'rp3.png';
            }
          }
        } else {
          // Normal LoL RP ürünleri: hepsi rp.png
          newImage = 'rp.png';
        }
        
        if (newImage && product.image_url !== newImage) {
          const { error } = await db.supabase
            .from('products')
            .update({ image_url: newImage })
            .eq('id', product.id);
          
          if (error) {
            console.log(`  ❌ Error updating ${product.name}: ${error.message}`);
          } else {
            console.log(`  ✅ Updated LoL: ${product.name}: ${product.image_url} -> ${newImage}`);
          }
        } else if (newImage) {
          console.log(`  ℹ️  LoL: ${product.name} already has correct image: ${product.image_url}`);
        }
      }
      
      console.log('\n✅ Image update completed!');
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();

