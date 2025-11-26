require('dotenv').config();
const db = require('./db.js');

(async () => {
  try {
    if (db.supabase) {
      console.log('🔄 Updating Valorant VP images...\n');
      
      // Get all Valorant products
      const { data: products } = await db.supabase
        .from('products')
        .select('id, name, slug, image_url, package_level')
        .or('category.eq.valorant,platform.eq.valorant')
        .order('package_level');
      
      console.log('Valorant ürünleri:');
      products?.forEach(p => {
        console.log(`  ${p.name} (${p.package_level}): ${p.image_url}`);
      });
      
      console.log('\n🔄 Updating images...');
      
      for (const product of products || []) {
        const slug = (product.slug || '').toLowerCase();
        const isRandom = slug.includes('random') || slug.includes('rastgele') || product.package_level === 'random';
        
        let newImage = null;
        
        if (isRandom) {
          // Rastgele paketler: package_level'a göre
          const level = (product.package_level || '').toLowerCase();
          if (level === 'random') {
            // Slug'a göre düşük/orta/yüksek belirle
            if (slug.includes('dusuk') || slug.includes('düşük')) {
              newImage = 'vp.png';
            } else if (slug.includes('orta')) {
              newImage = 'vp1.png';
            } else if (slug.includes('yuksek') || slug.includes('yüksek')) {
              newImage = 'vp2.png';
            }
          }
        } else {
          // Normal VP ürünleri: hepsi vp.png
          newImage = 'vp.png';
        }
        
        if (newImage && product.image_url !== newImage) {
          const { error } = await db.supabase
            .from('products')
            .update({ image_url: newImage })
            .eq('id', product.id);
          
          if (error) {
            console.log(`  ❌ Error updating ${product.name}: ${error.message}`);
          } else {
            console.log(`  ✅ Updated ${product.name}: ${product.image_url} -> ${newImage}`);
          }
        } else if (newImage) {
          console.log(`  ℹ️  ${product.name} already has correct image: ${product.image_url}`);
        }
      }
      
      console.log('\n✅ Image update completed!');
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();

