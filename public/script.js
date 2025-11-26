// Fallback: ensure content is revealed even if any initializer fails
(function ensureReveal() {
    try {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const ls = document.getElementById('loadingScreen');
                if (ls) { ls.classList.add('hide'); ls.style.display = 'none'; }
                document.body.classList.remove('loading');
                document.body.style.opacity = '1';
            }, 2200);
        });
        window.addEventListener('error', () => {
            const ls = document.getElementById('loadingScreen');
            if (ls) { ls.classList.add('hide'); ls.style.display = 'none'; }
            document.body.classList.remove('loading');
            document.body.style.opacity = '1';
        });
    } catch {}
})();
// Connection Management
class ConnectionManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.init();
    }

    init() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Mobil cihazlarda daha güvenilir kontrol
        const isMobile = navigator.userAgent.includes('Mobile') || 
                        navigator.userAgent.includes('Android') || 
                        navigator.userAgent.includes('iPhone');
        
        if (isMobile) {
            // Mobil cihazlarda daha sık kontrol et
            setInterval(() => {
                this.checkConnection();
            }, 10000); // 10 saniyede bir kontrol et
        }
        
        this.updateBanner();
    }

    handleOnline() {
        this.isOnline = true;
        this.updateBanner();
        console.log('Connection restored');
    }

    handleOffline() {
        this.isOnline = false;
        this.updateBanner();
        console.log('Connection lost');
    }

    updateBanner() {
        const banner = document.getElementById('offlineBanner');
        if (banner) {
            // Mobil cihazlarda daha toleranslı ol
            const isMobile = navigator.userAgent.includes('Mobile') || 
                           navigator.userAgent.includes('Android') || 
                           navigator.userAgent.includes('iPhone');
            
            if (isMobile && !this.isOnline) {
                // Mobil cihazlarda sadece 3 saniye göster, sonra gizle
                banner.style.display = 'block';
                setTimeout(() => {
                    if (banner) {
                        banner.style.display = 'none';
                    }
                }, 3000);
            } else {
                banner.style.display = this.isOnline ? 'none' : 'block';
            }
        }
    }

    checkConnection() {
        // Mobil cihazlarda daha güvenilir kontrol
        return fetch('/api/health', { 
            method: 'HEAD',
            cache: 'no-cache',
            mode: 'no-cors'
        })
        .then(() => {
            this.isOnline = true;
            this.updateBanner();
            return true;
        })
        .catch(() => {
            // Mobil cihazlarda daha toleranslı ol
            if (navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone')) {
                // Mobil cihazlarda sadece banner'ı gizle, offline olarak işaretleme
                this.isOnline = true;
                this.updateBanner();
                return true;
            } else {
                this.isOnline = false;
                this.updateBanner();
                return false;
            }
        });
    }
}

// Global connection check function
window.checkConnection = function() {
    if (window.connectionManager) {
        window.connectionManager.checkConnection();
    }
};

// Theme Management
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.setTheme(this.currentTheme);
        this.createThemeToggle();
    }

    createThemeToggle() {
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.innerHTML = this.currentTheme === 'dark' 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
        
        themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Add theme toggle to nav actions
        const navActions = document.querySelector('.nav-actions');
        if (navActions) {
            navActions.insertBefore(themeToggle, navActions.querySelector('.cart-icon'));
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        
        // Update toggle icon
        const toggleBtn = document.querySelector('.theme-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = theme === 'dark' 
                ? '<i class="fas fa-sun"></i>' 
                : '<i class="fas fa-moon"></i>';
        }

        // Swap logos by theme
        const lightLogo = 'logo2.png';
        const darkLogo = 'logo.png';
        const src = theme === 'light' ? lightLogo : darkLogo;
        document.querySelectorAll('img.logo-image, img.mobile-logo-image, img.footer-logo-image').forEach(img => {
            img.setAttribute('src', src);
            img.setAttribute('srcset', src);
        });
        const splash = document.querySelector('#loadingScreen .loading-logo img');
        if (splash) { splash.setAttribute('src', src); splash.setAttribute('srcset', src); }
        // Also OG image meta (best-effort)
        const og = document.querySelector('meta[property="og:image"]');
        if (og) og.setAttribute('content', src);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

// Shopping Cart Management
class ShoppingCart {
    constructor() {
        // Check cart version - clear if old format
        const cartVersion = localStorage.getItem('cartVersion');
        if (cartVersion !== '2.0') {
            console.log('Old cart format detected, clearing cart...');
            localStorage.removeItem('cart');
            localStorage.setItem('cartVersion', '2.0');
            this.items = [];
        } else {
            // Load cart from localStorage and validate format
            const storedCart = JSON.parse(localStorage.getItem('cart')) || [];
            // Clean up any invalid cart items (old format)
            this.items = storedCart.filter(item => {
                // Check if item has required properties and valid price
                if (!item || typeof item.price !== 'number' || item.price <= 0) {
                    console.log('Removing invalid cart item:', item);
                    return false;
                }
                return true;
            });
            // Save cleaned cart
            if (this.items.length !== storedCart.length) {
                localStorage.setItem('cart', JSON.stringify(this.items));
            }
        }
        this.activeCoupon = null;
        this.init();
    }

    init() {
        this.updateCartUI();
        this.bindEvents();
    }

    bindEvents() {
        // Not using document-level listener anymore, buttons handle their own clicks via global addToCart()

        // Cart icon click
        document.querySelector('.cart-icon').addEventListener('click', () => {
            this.toggleCart();
        });

        // Close cart button
        document.querySelector('.close-cart').addEventListener('click', () => {
            this.closeCart();
        });

        // Delegate remove-item clicks inside the cart sidebar
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            cartItemsContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-item');
                if (!removeBtn) return;
                // Prevent outside-click handler from closing the sidebar
                e.preventDefault();
                e.stopPropagation();
                const itemEl = removeBtn.closest('.cart-item');
                const id = Number(itemEl?.dataset?.id);
                if (!Number.isNaN(id)) {
                    this.removeFromCart(id);
                }
            });
        }

        // Checkout button
        document.querySelector('.checkout-btn').addEventListener('click', () => {
            this.checkout();
        });

        // Close cart when clicking outside
        document.addEventListener('click', (e) => {
            const cartSidebar = document.getElementById('cartSidebar');
            const cartIcon = document.querySelector('.cart-icon');
            
            if (!cartSidebar.contains(e.target) && !cartIcon.contains(e.target)) {
                this.closeCart();
            }
        });
    }

    addToCart(productCard, productId = null) {
        // Null kontrolü ekle
        const h3 = productCard.querySelector('h3');
        const priceEl = productCard.querySelector('.current-price');
        const platformEl = productCard.querySelector('.platform span');
        const imageEl = productCard.querySelector('.product-image i');
        const addBtn = productCard.querySelector('.add-to-cart');
        
        if (!h3 || !priceEl) {
            console.warn('Invalid product card format, skipping ShoppingCart.addToCart');
            return;
        }
        
        // Get product_id from button dataset or parameter
        const realProductId = productId || (addBtn ? addBtn.dataset.productId : null);
        
        const product = {
            id: Date.now(), // Unique cart item ID
            product_id: realProductId, // Real product ID from database
            name: h3.textContent,
            price: this.extractPrice(priceEl.textContent),
            platform: platformEl?.textContent || 'Genel',
            image: imageEl?.className || 'fas fa-gamepad'
        };

        this.items.push(product);
        this.saveCart();
        this.updateCartUI();
        this.showAddedToCartAnimation(productCard);
        showToast('success', 'Ürün sepete eklendi');
        
        // Re-validate coupon with new total if active
        if (this.activeCoupon) {
            const newTotal = this.items.reduce((sum, item) => sum + item.price, 0);
            if (newTotal >= this.activeCoupon.min_order_amount / 100) {
                // Re-apply coupon discount
                const discountAmount = parseFloat(document.getElementById('cartDiscountAmount').textContent) || 0;
                if (discountAmount > 0) {
                    this.updateCartWithDiscount(discountAmount);
                }
            }
        }
        
        try {
            const cartIcon = document.querySelector('.cart-icon');
            if (cartIcon) {
                const r = cartIcon.getBoundingClientRect();
                confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
            } else {
                confettiBurst();
            }
        } catch {}
    }

    extractPrice(priceText) {
        // Remove all currency symbols and thousand separators
        const cleanPrice = priceText.replace(/[₺$€£]/g, '').replace(/\./g, '').replace(/,/g, '').trim();
        const price = parseInt(cleanPrice) || 0;
        console.log(`Extracted price: "${priceText}" → ${price}`);
        return price;
    }

    removeFromCart(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveCart();
        this.updateCartUI();
        
        // If all items are removed, close the cart after a short delay
        if (this.items.length === 0) {
            setTimeout(() => this.closeCart(), 250);
                    } else if (this.activeCoupon) {
                // Re-validate coupon with new total
                const newTotal = this.items.reduce((sum, item) => sum + item.price, 0);
                if (newTotal < this.activeCoupon.min_order_amount / 100) {
                    // Coupon no longer valid for new total
                    this.clearCartCoupon();
                }
            }
    }

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.items));
    }

    updateCartUI() {
        // Update cart count
        const cartCount = document.querySelector('.cart-count');
        cartCount.textContent = this.items.length;

        // Update cart items
        const cartItemsContainer = document.getElementById('cartItems');
        
        if (this.items.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart">Sepetiniz boş</p>';
            // Clear coupon when cart is empty
            if (this.activeCoupon) {
                this.clearCartCoupon();
            }
        } else {
            cartItemsContainer.innerHTML = this.items.map(item => `
                <div class="cart-item" data-id="${item.id}">
                    <div class="cart-item-info">
                        <div class="cart-item-icon">
                            <i class="${item.image}"></i>
                        </div>
                        <div class="cart-item-details">
                            <h4>${item.name}</h4>
                            <p>${item.platform}</p>
                            <span class="cart-item-price">₺${item.price.toLocaleString('tr-TR')}</span>
                        </div>
                    </div>
                    <button class="remove-item" type="button" aria-label="Kaldır">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }

        // Update total
        const total = this.items.reduce((sum, item) => sum + item.price, 0);
        document.getElementById('cartTotal').textContent = total.toLocaleString('tr-TR');
        
        // Re-apply coupon discount if active
        if (this.activeCoupon) {
            const discountText = document.getElementById('cartDiscountAmount').textContent.replace(/\./g, '');
            const discountAmount = parseFloat(discountText) || 0;
            if (discountAmount > 0) {
                this.updateCartWithDiscount(discountAmount);
            }
        }
    }

    toggleCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const backToTopBtn = document.getElementById('backToTop');
        const chatbotToggle = document.getElementById('chatbotToggle');
        
        cartSidebar.classList.toggle('open');
        
        // Hide/show back-to-top and chatbot button when cart is open
        if (cartSidebar.classList.contains('open')) {
            if (backToTopBtn) backToTopBtn.style.display = 'none';
            if (chatbotToggle) chatbotToggle.style.display = 'none';
        } else {
            if (backToTopBtn) backToTopBtn.style.display = '';
            if (chatbotToggle) chatbotToggle.style.display = '';
        }
    }

    closeCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const backToTopBtn = document.getElementById('backToTop');
        const chatbotToggle = document.getElementById('chatbotToggle');
        
        cartSidebar.classList.remove('open');
        
        // Show back-to-top and chatbot button when cart is closed
        if (backToTopBtn) backToTopBtn.style.display = '';
        if (chatbotToggle) chatbotToggle.style.display = '';
    }

    showAddedToCartAnimation(productCard) {
        const button = productCard.querySelector('.add-to-cart');
        if (!button) {
            console.warn('Add to cart button not found, skipping animation');
            return;
        }
        const originalText = button.textContent;
        
        button.textContent = 'Eklendi!';
        button.style.background = '#10b981';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 1500);
    }

    checkout() {
        if (this.items.length === 0) {
            showToast('error', 'Sepetiniz boş!');
            return;
        }

        const total = this.items.reduce((sum, item) => sum + item.price, 0);
        let finalTotal = total;
        let discountMessage = '';
        
        // Apply coupon discount if active
        if (this.activeCoupon) {
            const discountAmount = parseFloat(document.getElementById('cartDiscountAmount').textContent) || 0;
            if (discountAmount > 0) {
                finalTotal = Math.max(0, total - discountAmount);
                discountMessage = ` (Kupon indirimi: -₺${discountAmount})`;
            }
        }
        
        const itemsList = this.items.map(item => `${item.name} - ₺${item.price}`).join('\n');
        
        showToast('success', `Satın alma işlemi başlatılıyor...${discountMessage}`);
        
        // Simulate checkout process
        setTimeout(() => {
            showToast('success', 'Satın alma tamamlandı! Kodlar e‑postanıza gönderilecek.');
            try { confettiBurst(window.innerWidth / 2, 140); } catch {}
            this.items = [];
            this.saveCart();
            this.updateCartUI();
            this.closeCart();
        }, 2000);
    }
    
    updateCartWithDiscount(discountAmount) {
        console.log('updateCartWithDiscount called with:', discountAmount);
        
        // Parse formatted number (remove thousand separators)
        const cartTotalText = document.getElementById('cartTotal').textContent.replace(/\./g, '');
        const cartTotal = parseFloat(cartTotalText) || 0;
        console.log('Cart total from DOM:', cartTotal);
        
        const discountDiv = document.getElementById('cartDiscount');
        const finalTotalDiv = document.getElementById('cartFinalTotal');
        const discountAmountSpan = document.getElementById('cartDiscountAmount');
        const finalTotalAmountSpan = document.getElementById('cartFinalTotalAmount');
        
        if (!discountDiv || !finalTotalDiv || !discountAmountSpan || !finalTotalAmountSpan) {
            console.error('Required discount elements not found');
            return;
        }
        
        // Ensure discountAmount is a valid number
        const discount = parseFloat(discountAmount) || 0;
        console.log('Processed discount amount:', discount);
        
        // Show discount
        discountAmountSpan.textContent = discount.toLocaleString('tr-TR');
        // Show discount rate if coupon is percentage
        const coupon = this.activeCoupon;
        let rateEl = document.getElementById('cartDiscountRate');
        if (!rateEl) {
            rateEl = document.createElement('span');
            rateEl.id = 'cartDiscountRate';
            rateEl.style.marginLeft = '6px';
            // Insert right after discount amount span
            discountAmountSpan.parentElement?.insertBefore(rateEl, discountAmountSpan.nextSibling);
        }
        if (coupon && coupon.type === 'percentage') {
            rateEl.textContent = ` (-%${coupon.value})`;
            rateEl.style.display = '';
        } else {
            rateEl.textContent = '';
            rateEl.style.display = 'none';
        }
        discountDiv.style.display = 'flex';
        
        // Calculate and show final total
        const finalTotal = Math.max(0, cartTotal - discount);
        console.log('Final total calculated:', finalTotal);
        finalTotalAmountSpan.textContent = finalTotal.toLocaleString('tr-TR');
        finalTotalDiv.style.display = 'flex';
    }
    
    clearCartCoupon() {
        this.activeCoupon = null;
        
        const couponInput = document.getElementById('cartCouponInput');
        const resultDiv = document.getElementById('cartCouponResult');
        const discountDiv = document.getElementById('cartDiscount');
        const finalTotalDiv = document.getElementById('cartFinalTotal');
        const discountAmountSpan = document.getElementById('cartDiscountAmount');
        
        if (couponInput) couponInput.value = '';
        if (resultDiv) resultDiv.style.display = 'none';
        if (discountDiv) discountDiv.style.display = 'none';
        if (finalTotalDiv) finalTotalDiv.style.display = 'none';
        if (discountAmountSpan) discountAmountSpan.textContent = '0';
        
        console.log('Cart coupon cleared');
    }
}

// Search Functionality
class SearchManager {
    constructor() {
        this.init();
    }

    init() {
        const searchInput = document.querySelector('.search-box input');
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(e.target.value);
            }
        });

        document.querySelector('.search-box i').addEventListener('click', () => {
            this.performSearch(searchInput.value);
        });
    }

    handleSearch(query) {
        if (query.length < 2) return;
        
        // Real-time search suggestions could be implemented here
        console.log('Searching for:', query);
    }

    performSearch(query) {
        if (!query.trim()) return;
        
        const searchTerm = query.toLowerCase().trim();
        
        // Akıllı kategori yönlendirme sistemi
        const smartRedirects = {
            // Valorant anahtar kelimeleri
            'valorant': { key: 'valorant', label: 'Valorant' },
            'vp': { key: 'valorant', label: 'Valorant VP', subcat: 'valorant-vp' },
            'valorant vp': { key: 'valorant', label: 'Valorant VP', subcat: 'valorant-vp' },
            'valorant point': { key: 'valorant', label: 'Valorant VP', subcat: 'valorant-vp' },
            'riot point valorant': { key: 'valorant', label: 'Valorant VP', subcat: 'valorant-vp' },
            
            // LoL anahtar kelimeleri  
            'lol': { key: 'lol', label: 'League of Legends' },
            'league': { key: 'lol', label: 'League of Legends' },
            'league of legends': { key: 'lol', label: 'League of Legends' },
            'rp': { key: 'lol', label: 'LOL RP', subcat: 'lol-rp' },
            'riot point': { key: 'lol', label: 'LOL RP', subcat: 'lol-rp' },
            'lol rp': { key: 'lol', label: 'LOL RP', subcat: 'lol-rp' },
            
            // Steam anahtar kelimeleri
            'steam': { key: 'steam', label: 'Steam Oyunları' },
            'steam oyun': { key: 'steam', label: 'Steam Oyunları' },
            'steam game': { key: 'steam', label: 'Steam Oyunları' },
            'steam kod': { key: 'steam', label: 'Steam Oyunları' },
            
            // Rastgele paketler
            'rastgele vp': { key: 'valorant', label: 'Valorant Rastgele VP', subcat: 'valorant-random-vp' },
            'rastgele rp': { key: 'lol', label: 'LOL Rastgele RP', subcat: 'lol-random-rp' },
            'rastgele steam': { key: 'steam', label: 'Steam Rastgele Oyun', subcat: 'steam-random-game' },
            'random vp': { key: 'valorant', label: 'Valorant Rastgele VP', subcat: 'valorant-random-vp' },
            'random rp': { key: 'lol', label: 'LOL Rastgele RP', subcat: 'lol-random-rp' },
            'random steam': { key: 'steam', label: 'Steam Rastgele Oyun', subcat: 'steam-random-game' },
            'steam rastgele': { key: 'steam', label: 'Steam Rastgele Oyun', subcat: 'steam-random-game' },
            
            // Ana sayfa bölümleri
            'iletişim': { type: 'scroll', target: '#contact', label: 'İletişim Bölümü' },
            'contact': { type: 'scroll', target: '#contact', label: 'Contact Section' },
            'faq': { type: 'scroll', target: '#faq', label: 'FAQ Bölümü' },
            'sss': { type: 'scroll', target: '#faq', label: 'Sıkça Sorulan Sorular' },
            'sıkça sorulan': { type: 'scroll', target: '#faq', label: 'Sıkça Sorulan Sorular' },
            'sorular': { type: 'scroll', target: '#faq', label: 'Sıkça Sorulan Sorular' },
            'özellik': { type: 'scroll', target: '#features', label: 'Özellikler Bölümü' },
            'features': { type: 'scroll', target: '#features', label: 'Features Section' },
            'neden keyco': { type: 'scroll', target: '#features', label: 'Neden Keyco Bölümü' },
            'ürün': { type: 'scroll', target: '#products', label: 'Ürünler Bölümü' },
            'products': { type: 'scroll', target: '#products', label: 'Products Section' },
            'öne çıkan': { type: 'scroll', target: '#products', label: 'Öne Çıkan Ürünler' }
        };
        
        // Tam eşleşme ara
        let redirect = smartRedirects[searchTerm];
        
        // Tam eşleşme yoksa kısmi eşleşme ara
        if (!redirect) {
            for (const [keyword, target] of Object.entries(smartRedirects)) {
                if (searchTerm.includes(keyword) || keyword.includes(searchTerm)) {
                    redirect = target;
                    break;
                }
            }
        }
        
        // Eşleşme bulunduysa yönlendir
        if (redirect) {
            console.log(`🎯 Akıllı yönlendirme: "${searchTerm}" → ${redirect.label}`);
            
            if (redirect.type === 'scroll') {
                // Ana sayfa bölümüne scroll yap
                goToHomePage();
                setTimeout(() => {
                    const targetElement = document.querySelector(redirect.target);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                        console.log(`📍 Scroll yapıldı: ${redirect.target}`);
                    }
                }, 100);
            } else if (redirect.subcat) {
                // Alt kategori varsa - direkt özel parametrelerle çağır
                console.log(`🎯 Alt kategori yönlendirme: ${redirect.subcat}`);
                
                switch(redirect.subcat) {
                    case 'valorant-random-vp':
                        openCategoryPage('valorant', 'Valorant Rastgele VP', { randomVpSpecial: true });
                        break;
                    case 'lol-random-rp':
                        openCategoryPage('lol', 'LOL Rastgele RP', { randomRpSpecial: true });
                        break;
                    case 'steam-random-game':
                        openCategoryPage('steam', 'Steam Rastgele Oyun', { randomSteamSpecial: true });
                        break;
                    case 'valorant-vp':
                        openCategoryPage('valorant', 'Valorant VP', { nameIncludes: 'VP' });
                        break;
                    case 'lol-rp':
                        openCategoryPage('lol', 'LOL RP', { nameIncludes: 'RP' });
                        break;
                    default:
                        console.log(`❌ Bilinmeyen alt kategori: ${redirect.subcat}`);
                }
            } else {
                // Ana kategori
                openCategoryPage(redirect.key, redirect.label);
            }
            
            // Arama kutusunu temizle
            document.querySelector('.search-box input').value = '';
            return;
        }
        
        // Eşleşme yoksa normal arama yap
        console.log(`🔍 Normal arama: "${searchTerm}"`);
        alert(`"${query}" için arama sonuçları gösteriliyor...`);
        this.highlightMatchingProducts(query);
    }

    highlightMatchingProducts(query) {
        const products = document.querySelectorAll('.product-card h3');
        products.forEach(product => {
            const productName = product.textContent.toLowerCase();
            const searchTerm = query.toLowerCase();
            
            if (productName.includes(searchTerm)) {
                product.closest('.product-card').style.border = '3px solid var(--primary-color)';
                product.closest('.product-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                product.closest('.product-card').style.border = '';
            }
        });

        // Reset highlighting after 3 seconds
        setTimeout(() => {
            products.forEach(product => {
                product.closest('.product-card').style.border = '';
            });
        }, 3000);
    }
}

// Mobile Menu Management
class MobileMenuManager {
    constructor() {
        this.init();
    }

    init() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenuPanel = document.getElementById('mobileMenuPanel');
        const mobileMenuClose = document.getElementById('mobileMenuClose');
        const mobileLanguageBtn = document.getElementById('mobileLanguageBtn');
        const mobileLanguageDropdown = document.getElementById('mobileLanguageDropdown');
        const mobileLanguageSelector = document.querySelector('.mobile-language-selector');
        const mobileSubmenuToggles = document.querySelectorAll('.mobile-submenu-toggle');

        console.log('Mobile menu elements:', {
            mobileMenuBtn,
            mobileMenuPanel,
            mobileMenuClose
        });

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-menu-overlay';
        document.body.appendChild(overlay);

        // Open mobile menu
        if (mobileMenuBtn && mobileMenuPanel) {
            // Add both click and touch events for mobile compatibility
            const openMenu = () => {
                console.log('Mobile menu opening...');
                mobileMenuPanel.classList.add('open');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            };

            // Mobile cihazlarda hem touch hem click tetiklenmesini önle
            let touchHandled = false;
            
            mobileMenuBtn.addEventListener('touchstart', (e) => {
                touchHandled = true;
                openMenu();
                setTimeout(() => { touchHandled = false; }, 300);
            }, { passive: true });
            
            mobileMenuBtn.addEventListener('click', (e) => {
                if (!touchHandled) {
                    openMenu();
                }
            });
        }

        // Close mobile menu
        const closeMobileMenu = () => {
            if (mobileMenuPanel) {
                mobileMenuPanel.classList.remove('open');
            }
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            if (mobileLanguageSelector) {
                mobileLanguageSelector.classList.remove('active');
            }
        };

        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', closeMobileMenu);
        }
        overlay.addEventListener('click', closeMobileMenu);

        // Close mobile menu when clicking on a link
        document.querySelectorAll('.mobile-nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                closeMobileMenu();
                // Smooth scroll to section
                const targetId = link.getAttribute('href');
                if (targetId.startsWith('#')) {
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        setTimeout(() => {
                            targetElement.scrollIntoView({ behavior: 'smooth' });
                        }, 300);
                    }
                }
            });
        });

        // Mobile language selector
        if (mobileLanguageBtn && mobileLanguageSelector) {
            mobileLanguageBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileLanguageSelector.classList.toggle('active');
            });

            // Mobile language options
            document.querySelectorAll('.mobile-language-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const lang = option.getAttribute('data-lang');
                    
                    // Update mobile current language display
                    const mobileCurrentLang = document.getElementById('mobileCurrentLang');
                    if (mobileCurrentLang) {
                        mobileCurrentLang.textContent = lang.toUpperCase();
                    }
                    
                    // Update active state
                    document.querySelectorAll('.mobile-language-option').forEach(opt => {
                        opt.classList.remove('active');
                    });
                    option.classList.add('active');
                    
                    // Set language using main language manager
                    if (window.languageManager) {
                        window.languageManager.setLanguage(lang);
                    }
                    
                    mobileLanguageSelector.classList.remove('active');
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!mobileLanguageSelector.contains(e.target)) {
                    mobileLanguageSelector.classList.remove('active');
                }
            });
        }

        // Keyboard escape to close menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenuPanel.classList.contains('open')) {
                closeMobileMenu();
            }
        });

        // Mobile submenu toggles (support multiple levels)
        if (mobileSubmenuToggles && mobileSubmenuToggles.length) {
            mobileSubmenuToggles.forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const parent = toggle.parentElement;
                    const submenu = parent.querySelector(':scope > .mobile-submenu');
                    if (submenu) {
                        submenu.classList.toggle('open');
                        const icon = toggle.querySelector('i');
                        if (icon) {
                            icon.style.transform = submenu.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                            icon.style.transition = 'transform 0.2s ease';
                        }
                    }
                });
            });
        }

        // Mobile theme toggle
        const mobileThemeBtn = document.getElementById('mobileThemeBtn');
        if (mobileThemeBtn) {
            mobileThemeBtn.addEventListener('click', () => {
                if (window.themeManager) {
                    window.themeManager.toggleTheme();
                    // Update mobile theme button icon
                    const icon = mobileThemeBtn.querySelector('i');
                    icon.className = window.themeManager.currentTheme === 'dark' 
                        ? 'fas fa-sun' 
                        : 'fas fa-moon';
                }
            });
        }
    }
}

// Smooth Scrolling for Navigation Links
class SmoothScrollManager {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const href = anchor.getAttribute('href') || '';
                // Skip empty anchors like '#'
                if (href === '#' || href.trim() === '') return;
                let target = null;
                try {
                    target = document.querySelector(href);
                } catch (_) {
                    return; // invalid selector, ignore
                }
                
                if (target) {
                    // Calculate offset using actual header height + padding
                    const headerEl = document.querySelector('.header');
                    const headerHeight = headerEl ? headerEl.offsetHeight : 70;
                    const offset = target.offsetTop - headerHeight - 20;
                    
                    window.scrollTo({
                        top: offset,
                        behavior: 'smooth'
                    });
                    
                    // Update URL hash without jumping
                    history.pushState(null, null, anchor.getAttribute('href'));
                }
            });
        });
    }
}

// Hero Section Animations
class AnimationManager {
    constructor() {
        this.currentSlide = 0;
        this.totalSlides = 4;
        this.init();
    }

    init() {
        this.animateHeroButtons();
        this.animateOnScroll();
        this.initCarousel();
    }

    initCarousel() {
        console.log('🎠 Carousel initializing...');
        
        // Check if carousel elements exist
        const slides = document.querySelectorAll('.gaming-icons-slide');
        const indicators = document.querySelectorAll('.indicator');
        
        console.log('Slides found:', slides.length);
        console.log('Indicators found:', indicators.length);
        
        if (slides.length === 0) {
            console.warn('No carousel slides found. Skipping carousel init.');
            this.totalSlides = 0;
            return;
        }
        
        // Auto slide every 4 seconds
        this._carouselTimer && clearInterval(this._carouselTimer);
        this._carouselTimer = setInterval(() => {
            if (this.totalSlides <= 0) return;
            this.nextSlide();
        }, 4000);

        // Manual indicator clicks
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                console.log('Indicator clicked:', index);
                this.goToSlide(index);
            });
        });
        
        console.log('✅ Carousel initialized successfully');
    }

    nextSlide() {
        console.log('➡️ NextSlide called, current:', this.currentSlide);
        
        const currentSlideElement = document.querySelector('.gaming-icons-slide.active');
        const currentIndicator = document.querySelector('.indicator.active');
        
        console.log('Current slide element:', currentSlideElement);
        console.log('Current indicator:', currentIndicator);
        
        if (currentSlideElement && currentIndicator) {
            // Remove active classes
            currentSlideElement.classList.remove('active');
            currentSlideElement.classList.add('prev');
            currentIndicator.classList.remove('active');
            
            // Calculate next slide
            this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
            console.log('Next slide index:', this.currentSlide);
            
            // Add active to next slide
            const nextSlideElement = document.querySelectorAll('.gaming-icons-slide')[this.currentSlide];
            const nextIndicator = document.querySelectorAll('.indicator')[this.currentSlide];
            
            console.log('Next slide element:', nextSlideElement);
            console.log('Next indicator:', nextIndicator);
            
            if (nextSlideElement && nextIndicator) {
                nextSlideElement.classList.add('active');
                nextSlideElement.classList.remove('prev');
                nextIndicator.classList.add('active');
                console.log('✅ Slide changed successfully');
            }
            
            // Clean up prev class after animation
            setTimeout(() => {
                currentSlideElement.classList.remove('prev');
            }, 800);
        } else {
            // Silently skip when elements are missing
            return;
        }
    }

    goToSlide(slideIndex) {
        const currentSlideElement = document.querySelector('.gaming-icons-slide.active');
        const currentIndicator = document.querySelector('.indicator.active');
        
        if (slideIndex === this.currentSlide) return;
        
        if (currentSlideElement && currentIndicator) {
            // Remove active classes
            currentSlideElement.classList.remove('active');
            currentIndicator.classList.remove('active');
            
            // Set new slide
            this.currentSlide = slideIndex;
            
            // Add active to target slide
            const targetSlideElement = document.querySelectorAll('.gaming-icons-slide')[slideIndex];
            const targetIndicator = document.querySelectorAll('.indicator')[slideIndex];
            
            if (targetSlideElement && targetIndicator) {
                targetSlideElement.classList.add('active');
                targetIndicator.classList.add('active');
            }
        }
    }

    animateHeroButtons() {
        const buttons = document.querySelectorAll('.hero-buttons button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                if (button.textContent.includes('Keşfet')) {
                    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
                } else if (button.textContent.includes('Kategoriler')) {
                    document.querySelector('.categories').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    animateOnScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                }
            });
        }, { 
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe all animated elements
        document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .scale-in').forEach(element => {
            observer.observe(element);
        });
    }
}

// FAQ accordion
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.faq-toggle');
    if (!toggle) return;
    e.preventDefault();
    const item = toggle.closest('.faq-item');
    if (!item) return;
    const content = item.querySelector('.faq-content');

    // Smooth height transition using scrollHeight
    if (item.classList.contains('open')) {
        // collapse
        content.style.maxHeight = content.scrollHeight + 'px';
        // force reflow to ensure transition starts from measured height
        void content.offsetHeight;
        item.classList.remove('open');
        content.style.maxHeight = '0px';
    } else {
        // expand
        item.classList.add('open');
        // set from 0 -> target height
        content.style.maxHeight = '0px';
        void content.offsetHeight;
        content.style.maxHeight = content.scrollHeight + 'px';
    }

    // cleanup inline style after transition
    content.addEventListener('transitionend', function handler(ev){
        if (ev.propertyName === 'max-height') {
            if (item.classList.contains('open')) {
                content.style.maxHeight = 'none';
            }
            content.removeEventListener('transitionend', handler);
        }
    });
});

// Integrate Contact Form with backend
function initContactFormIntegration() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    // Prevent double-binding
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    // Remove previous always-on lock UI; we only warn on submit now
    window.updateContactFormLock = function noop(){};
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Check if user is logged in
        if (!window.authManager || !window.authManager.isLoggedIn()) {
            const lang = window.languageManager?.getCurrentLanguage?.() || 'tr';
            const message = lang === 'tr' 
                ? 'İletişim formunu kullanmak için giriş yapmalısınız!' 
                : 'You must be logged in to use the contact form!';
            showToast('warning', message);
            // Inline prominent warning near the submit button
            try {
                ensureContactSubmitWarning(form, lang);
            } catch {}
            
            // Open login modal
            if (window.openLoginModal) {
                window.openLoginModal();
            }
            return;
        }
        
        const submitBtn = form.querySelector('.contact-submit-btn');
        const payload = {
            name: form.name?.value?.trim() || '',
            email: form.email?.value?.trim() || '',
            subject: form.subject?.value?.trim() || '',
            message: form.message?.value?.trim() || ''
        };
        if (submitBtn) submitBtn.disabled = true;
        try {
            // Attach lightweight auth header with current user email
            const authEmail = window.authManager?.currentUser?.email || '';
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Auth-Email': authEmail },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error('Form error: ' + (err.errors ? err.errors.join(', ') : res.status));
            }
            showToast('success', window.languageManager?.getCurrentLanguage?.() === 'tr' ? 'Mesajınız gönderildi!' : 'Your message has been sent!');
            form.reset();
        } catch (err) {
            showToast('error', window.languageManager?.getCurrentLanguage?.() === 'tr' ? 'Gönderim başarısız. Lütfen alanları kontrol edin.' : 'Send failed. Please check the fields.');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Fallback: ensure binding even if earlier init path is skipped due to an error
try {
    if (document.readyState !== 'loading') {
        initContactFormIntegration();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            try { initContactFormIntegration(); } catch (e) { console.warn('contact form fallback bind fail', e); }
        });
    }
} catch (e) {
    console.warn('contact form fallback outer fail', e);
}

// Inline warning banner shown when user clicks send without login
function ensureContactSubmitWarning(form, lang) {
    let warn = form.querySelector('#contactSubmitWarn');
    if (!warn) {
        warn = document.createElement('div');
        warn.id = 'contactSubmitWarn';
        warn.className = 'contact-submit-warn';
        const title = lang === 'tr' ? 'Giriş gerekli' : 'Login required';
        const desc = lang === 'tr'
            ? 'Mesaj göndermek için hesabınızla giriş yapmalısınız.'
            : 'You need to login to send your message.';
        const cta = lang === 'tr' ? 'Giriş Yap' : 'Login';
        warn.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <div class="txt"><strong>${title}</strong><div>${desc}</div></div>
            <button type="button" class="contact-warn-btn" id="contactWarnLogin">${cta}</button>
        `;
        form.appendChild(warn);
        const btn = form.querySelector('#contactWarnLogin');
        if (btn) btn.onclick = () => { window.openLoginModal && window.openLoginModal(); };
    }
    // small shake to draw attention
    warn.classList.remove('shake');
    // force reflow
    void warn.offsetWidth;
    warn.classList.add('shake');
}

// Load FAQs dynamically from backend
async function loadFaqsFromApi() {
    const container = document.querySelector('#faq .faq-list');
    if (!container) return;
    try {
        const res = await fetch('/api/faqs');
        if (!res.ok) throw new Error('FAQ fetch failed');
        const items = await res.json();
        if (!Array.isArray(items) || items.length === 0) return; // keep static content

        const lang = window.languageManager?.getCurrentLanguage?.() || 'tr';

        // Detect schema variant
        const first = items[0] || {};
        let mapped = [];
        if (typeof first.q_tr !== 'undefined' || typeof first.q_en !== 'undefined') {
            // Variant A: { q_tr, a_tr, q_en, a_en }
            mapped = items.map(it => ({
                title: lang === 'tr' ? it.q_tr : it.q_en,
                content: lang === 'tr' ? it.a_tr : it.a_en,
            }));
        } else if (typeof first.lang !== 'undefined' && typeof first.question !== 'undefined') {
            // Variant B: { lang, question, answer }
            mapped = items
                .filter(it => (lang === 'tr' ? it.lang?.toLowerCase() === 'tr' : it.lang?.toLowerCase() === 'en'))
                .map(it => ({ title: it.question, content: it.answer }));
            if (mapped.length === 0) return; // no matching language, keep static
        } else {
            // Unknown schema, do not touch existing static FAQ
            return;
        }

        // Remove previously injected API items but KEEP static ones
        container.querySelectorAll('[data-source="api"]').forEach(el => el.remove());
        const existingCount = container.children.length;
        mapped.forEach((m, idx) => {
            const item = document.createElement('div');
            item.className = 'faq-item fade-in-up animate';
            item.setAttribute('data-source', 'api');
            item.style.animationDelay = (0.05 * (existingCount + idx + 1)) + 's';
            item.innerHTML = `
                <button class="faq-toggle">
                    <span>${m.title}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="faq-content">
                    <p>${m.content}</p>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        // keep static content if API fails
        console.warn('FAQ load error', e);
    }
}

// Add cart item styles
const cartItemStyles = `
.cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    transition: all 0.3s ease;
}

.cart-item:hover {
    background: var(--bg-secondary);
}

.cart-item-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
}

.cart-item-icon {
    width: 40px;
    height: 40px;
    background: var(--gradient-primary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.cart-item-details h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.2rem;
}

.cart-item-details p {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.2rem;
}

.cart-item-price {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--primary-color);
}

.remove-item {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.3s ease;
}

.remove-item:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

@media (max-width: 768px) {
    .nav-menu.mobile-open {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--bg-primary);
        border-top: 1px solid var(--border-color);
        box-shadow: 0 5px 20px var(--shadow-light);
        padding: 1rem;
        z-index: 1000;
    }
    
    .nav-menu.mobile-open li {
        margin: 0.5rem 0;
    }
    
    .mobile-menu-btn.active {
        color: var(--primary-color);
    }
}
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = cartItemStyles;
document.head.appendChild(styleSheet);

// Authentication Manager
class AuthManager {
    constructor() {
        // Safely parse stored user (could be 'undefined' or malformed)
        const _rawUser = localStorage.getItem('currentUser');
        this.currentUser = (() => {
            if (!_rawUser || _rawUser === 'undefined') return null;
            try { return JSON.parse(_rawUser); } catch { return null; }
        })();
        this.loginOtpTimer = null;
        this.registerOtpTimer = null;
        this.loginRemember = false; // Track remember me option
        this.init();
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    init() {
        this.bindEvents();
        this.updateAuthUI();
        try { this.probeSession(); } catch {}
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target);
        });

        // Forgot password form
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword(e.target);
        });
        // password visibility toggles
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.password-toggle');
            if (!btn) return;
            e.preventDefault();
            const id = btn.getAttribute('data-target');
            let input = id ? document.getElementById(id) : null;
            if (!input) {
                const field = btn.closest('.password-field');
                input = field ? field.querySelector('input') : null;
            }
            if (!input) return;
            const toType = input.type === 'password' ? 'text' : 'password';
            input.type = toType;
            const icon = btn.querySelector('i');
            if (icon) icon.className = toType === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
        // OTP verify buttons
        const vbtn = document.getElementById('verifyOtpBtn');
        const rbtn = document.getElementById('resendOtpBtn');
        if (vbtn) vbtn.addEventListener('click', () => this.handleVerifyOtp());
        if (rbtn) rbtn.addEventListener('click', () => this.handleResendOtp());

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e.target);
        });

        // Live validate register password complexity
        const regPassInput = document.getElementById('registerPassword');
        if (regPassInput) {
            const passField = regPassInput.closest('.password-field');
            const hintEl = passField ? passField.querySelector('.password-hint') : null;
            const validate = () => {
                const val = regPassInput.value || '';
                const ok = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/.test(val);
                if (ok) {
                    regPassInput.classList.remove('invalid');
                    if (hintEl) { hintEl.classList.remove('error'); }
                } else {
                    regPassInput.classList.add('invalid');
                    if (hintEl) { hintEl.classList.add('error'); }
                }
                return ok;
            };
            regPassInput.addEventListener('input', validate);
            regPassInput.addEventListener('blur', validate);
        }

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeAllModals();
            }
        });
    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        // Checkbox'ı doğrudan ID ile kontrol et
        const rememberCheckbox = document.getElementById('loginRememberMe');
        const remember = rememberCheckbox ? rememberCheckbox.checked : false;
        
        console.log('Remember me checkbox status:', remember);
        
        // Store remember option for OTP verification
        this.loginRemember = remember;

        const submitBtn = form.querySelector('.auth-submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Giriş yapılıyor...';
        submitBtn.disabled = true;

        try {
            // Check if we're online
            if (!navigator.onLine) {
                this.showErrorMessage('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin.');
                return;
            }

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, remember })
            });
            const data = await res.json().catch(() => ({}));

            // Show OTP section even when response is 200 with step=otp_required
            if (data?.step === 'done' && data?.ok) {
                // Remember-me flow: user signed in directly
                this.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('token', data.token);
                // Set cookie token for server to pick up on subsequent requests
                try {
                    document.cookie = `token=${encodeURIComponent(data.token)}; Max-Age=${15*24*60*60}; Path=/; SameSite=Lax`;
                } catch {}
                this.updateAuthUI();
                closeModal('loginModal');
                showToast('success', 'Hoş geldiniz');
                return;
            }
            if (data?.step === 'otp_required') {
                const sec = document.getElementById('otpSection');
                if (sec) sec.style.display = '';
                this.showSuccessMessage('Doğrulama kodu e‑postanıza gönderildi. Kod 2 dakika geçerlidir.');
                this.startLoginOtpTimer();
                return;
            }

            if (!res.ok) {
                // Some backends might send otp_required with non-200; handle here too
                if (data?.step === 'otp_required' || data?.error === 'otp_required') {
                    const sec = document.getElementById('otpSection');
                    if (sec) sec.style.display = '';
                    const vbtn = document.getElementById('verifyOtpBtn');
                    if (vbtn) { vbtn.disabled = false; vbtn.innerHTML = '<i class="fas fa-shield-alt"></i> Kodu Doğrula'; vbtn.style.cursor = 'pointer'; }
                    this.showSuccessMessage('Doğrulama kodu e‑postanıza gönderildi. Kod 2 dakika geçerlidir.');
                    this.startLoginOtpTimer();
                    return;
                }
                if (data?.error === 'email_not_verified') {
                    this.showErrorMessage('E-posta doğrulanmamış. Doğrulama maili gönderiliyor...');
                    try {
                        await fetch('/api/auth/verify/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                        this.showSuccessMessage('Doğrulama bağlantısı e-postanıza gönderildi.');
                    } catch {}
                } else if (data?.error === 'invalid_credentials') {
                    this.showErrorMessage('E-posta veya şifre hatalı.');
                } else {
                    this.showErrorMessage('Giriş başarısız.');
                }
                return;
            }
            this.setCurrentUser(data.user);
            this.closeAllModals();
            this.showSuccessMessage('Başarıyla giriş yaptınız!');
        } catch (error) {
            console.error('Login error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                this.showErrorMessage('Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
            } else if (error.name === 'TypeError' && error.message.includes('ERR_INTERNET_DISCONNECTED')) {
                this.showErrorMessage('İnternet bağlantınız kesildi. Lütfen bağlantınızı kontrol edin.');
            } else {
                this.showErrorMessage('Ağ hatası. Lütfen tekrar deneyin.');
            }
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleForgotPassword(form) {
        const formData = new FormData(form);
        const email = formData.get('forgotEmail');

        // E-posta validasyonu
        if (!email || !email.trim()) {
            const statusEl = document.getElementById('forgotPasswordStatus');
            statusEl.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> E-posta adresi gerekli.</div>';
            statusEl.style.display = 'block';
            return;
        }

        // Basit e-posta format kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            const statusEl = document.getElementById('forgotPasswordStatus');
            statusEl.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Geçerli bir e-posta adresi girin.</div>';
            statusEl.style.display = 'block';
            return;
        }

        const submitBtn = form.querySelector('.auth-submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';
        submitBtn.disabled = true;

        const statusEl = document.getElementById('forgotPasswordStatus');
        statusEl.style.display = 'none';

        try {
            // Check if we're online
            if (!navigator.onLine) {
                statusEl.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin.</div>';
                statusEl.style.display = 'block';
                return;
            }

            const res = await fetch('/api/auth/reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                statusEl.innerHTML = '<div class="success-message"><i class="fas fa-check-circle"></i> Şifre sıfırlama linki e-postanıza gönderildi. Lütfen e-postanızı kontrol edin.</div>';
                statusEl.style.display = 'block';
                form.reset();
            } else {
                const errorData = await res.json().catch(() => ({}));
                let errorMessage = 'Bir hata oluştu. Lütfen tekrar deneyin.';
                
                if (errorData.errors && errorData.errors.length > 0) {
                    if (errorData.errors.includes('email')) {
                        errorMessage = 'Geçerli bir e-posta adresi girin.';
                    }
                }
                
                statusEl.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${errorMessage}</div>`;
                statusEl.style.display = 'block';
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            let errorMessage = 'Ağ hatası. Lütfen tekrar deneyin.';
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.';
            } else if (error.name === 'TypeError' && error.message.includes('ERR_INTERNET_DISCONNECTED')) {
                errorMessage = 'İnternet bağlantınız kesildi. Lütfen bağlantınızı kontrol edin.';
            }
            
            statusEl.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${errorMessage}</div>`;
            statusEl.style.display = 'block';
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleVerifyOtp() {
        const email = document.getElementById('loginEmail')?.value;
        const code = document.getElementById('loginOtp')?.value?.trim();
        if (!email || !code || code.length !== 6) { this.showErrorMessage('Kod geçersiz.'); return; }
        try {
            const res = await fetch('/api/auth/login/verify-otp', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ email, code, remember: this.loginRemember }) 
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { this.showErrorMessage('Kod doğrulanamadı.'); return; }
            this.stopLoginOtpTimer();
            this.setCurrentUser(data.user);
            this.closeAllModals();
            this.showSuccessMessage('Giriş tamamlandı.');
        } catch { this.showErrorMessage('Ağ hatası.'); }
    }

    async handleResendOtp() {
        const email = document.getElementById('loginEmail')?.value;
        if (!email) { this.showErrorMessage('E‑posta gerekli.'); return; }
        try {
            await fetch('/api/auth/login/resend-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            this.showSuccessMessage('Kod yeniden gönderildi. Kod 2 dakika geçerlidir.');
            this.startLoginOtpTimer();
        } catch { this.showErrorMessage('Ağ hatası.'); }
    }

    startLoginOtpTimer() {
        this.stopLoginOtpTimer();
        
        const timerElement = document.getElementById('loginOtpTimer');
        const timerText = document.getElementById('loginTimerText');
        
        if (!timerElement || !timerText) return;
        
        timerElement.style.display = 'block';
        timerElement.classList.remove('expired', 'warning');
        timerElement.style.animation = 'slideInUp 0.5s ease-out';
        
        let timeLeft = 120; // 2 minutes
        
        const updateTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 30) {
                timerElement.classList.add('warning');
                timerElement.style.animation = 'pulse 1s infinite';
            }
            
            if (timeLeft <= 0) {
                timerElement.classList.add('expired');
                timerText.textContent = 'Süre doldu!';
                timerElement.style.animation = 'shake 0.5s ease-in-out';
                this.stopLoginOtpTimer();
                
                const verifyBtn = document.getElementById('verifyOtpBtn');
                if (verifyBtn) {
                    verifyBtn.disabled = true;
                    verifyBtn.innerHTML = '<i class="fas fa-clock"></i> Kod süresi doldu';
                    verifyBtn.style.background = 'linear-gradient(135deg, #ff4757, #c44569)';
                    verifyBtn.style.cursor = 'not-allowed';
                }
                
                this.showErrorMessage('Doğrulama kodunun süresi doldu. Yeniden gönderin.');
                return;
            }
            
            timeLeft--;
        };
        
        updateTimer();
        this.loginOtpTimer = setInterval(updateTimer, 1000);
    }

    stopLoginOtpTimer() {
        if (this.loginOtpTimer) {
            clearInterval(this.loginOtpTimer);
            this.loginOtpTimer = null;
        }
        
        const timerElement = document.getElementById('loginOtpTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
            timerElement.style.animation = '';
        }
    }

    startRegisterOtpTimer() {
        this.stopRegisterOtpTimer();
        
        const timerElement = document.getElementById('regOtpTimer');
        const timerText = document.getElementById('regTimerText');
        
        if (!timerElement || !timerText) return;
        
        timerElement.style.display = 'block';
        timerElement.classList.remove('expired', 'warning');
        timerElement.style.animation = 'slideInUp 0.5s ease-out';
        
        let timeLeft = 120; // 2 minutes
        
        const updateTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 30) {
                timerElement.classList.add('warning');
                timerElement.style.animation = 'pulse 1s infinite';
            }
            
            if (timeLeft <= 0) {
                timerElement.classList.add('expired');
                timerText.textContent = 'Süre doldu!';
                timerElement.style.animation = 'shake 0.5s ease-in-out';
                this.stopRegisterOtpTimer();
                
                const verifyBtn = document.getElementById('regVerifyBtn');
                if (verifyBtn) {
                    verifyBtn.disabled = true;
                    verifyBtn.innerHTML = '<i class="fas fa-clock"></i> Kod süresi doldu';
                    verifyBtn.style.background = 'linear-gradient(135deg, #ff4757, #c44569)';
                    verifyBtn.style.cursor = 'not-allowed';
                }
                
                this.showErrorMessage('Doğrulama kodunun süresi doldu. Yeniden gönderin.');
                return;
            }
            
            timeLeft--;
        };
        
        updateTimer();
        this.registerOtpTimer = setInterval(updateTimer, 1000);
    }

    stopRegisterOtpTimer() {
        if (this.registerOtpTimer) {
            clearInterval(this.registerOtpTimer);
            this.registerOtpTimer = null;
        }
        
        const timerElement = document.getElementById('regOtpTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
            timerElement.style.animation = '';
        }
    }

    async handleRegister(form) {
        const formData = new FormData(form);
        const name = formData.get('name');
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const terms = formData.get('terms') === 'on';

        if (password !== confirmPassword) { this.showErrorMessage('Şifreler eşleşmiyor!'); return; }
        // Enforce backend rule: min 8, one uppercase, one special char
        if (!/^(?=.*[A-Z])(?=.*[\W_]).{8,}$/.test(String(password || ''))) {
            const regPassInput = document.getElementById('registerPassword');
            if (regPassInput) regPassInput.classList.add('invalid');
            const hintEl = regPassInput?.closest('.password-field')?.querySelector('.password-hint');
            if (hintEl) hintEl.classList.add('error');
            this.showErrorMessage('Şifre gereksinimlerini karşılamıyor. (En az 8, 1 büyük harf, 1 özel karakter)');
            return;
        }
        if (!terms) { this.showErrorMessage('Kullanım şartlarını kabul etmelisiniz!'); return; }

        const submitBtn = form.querySelector('.auth-submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kayıt yapılıyor...';
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                this.showErrorMessage(data?.error === 'email_exists' ? 'Bu e‑posta ile kayıt zaten var.' : 'Kayıt başarısız.');
                return;
            }
            const sec = document.getElementById('regVerifySection');
            if (sec) sec.style.display = '';
            this.showSuccessMessage('Doğrulama kodu e‑postanıza gönderildi. Kod 2 dakika geçerlidir.');
            this.startRegisterOtpTimer();
        } catch (e) {
            this.showErrorMessage('Ağ hatası. Lütfen tekrar deneyin.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.updateAuthUI();
        // Update contact form lock state if available
        try { window.updateContactFormLock && window.updateContactFormLock(); } catch {}
        // Load notifications for the logged-in user
        try { 
            if (typeof loadNotifications === 'function') {
                setTimeout(() => loadNotifications(), 1000);
            }
        } catch {}
    }

    async logout() {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.updateAuthUI();
        this.showSuccessMessage('Başarıyla çıkış yaptınız!');
        try { window.updateContactFormLock && window.updateContactFormLock(); } catch {}
        // Clear notifications on logout
        try {
            const notificationCount = document.querySelector('.notifications-count');
            if (notificationCount) {
                notificationCount.textContent = '0';
                notificationCount.style.display = 'none';
            }
            const notificationsPanel = document.getElementById('notificationsPanel');
            if (notificationsPanel) {
                notificationsPanel.style.display = 'none';
            }
        } catch {}
    }

    async probeSession() {
        try { const res = await fetch('/api/auth/me'); if (!res.ok) return; const data = await res.json(); if (data?.ok && data.user) { this.setCurrentUser(data.user); } } catch {}
    }

    updateAuthUI() {
        const authButtons = document.querySelector('.auth-buttons');
        const loginBtn = document.querySelector('.login-btn');
        const registerBtn = document.querySelector('.register-btn');
        const userProfile = document.getElementById('userProfileDropdown');

        if (this.currentUser) {
            // Hide both auth buttons, show user profile
            authButtons.style.display = 'none';
            
            // Update user info
            document.getElementById('userName').textContent = this.currentUser.name;
            document.getElementById('userEmail').textContent = this.currentUser.email;
            
            // Show user profile button
            this.createUserProfileButton();
        } else {
            // Show auth buttons, hide user profile
            authButtons.style.display = 'flex';
            loginBtn.style.display = 'flex';
            registerBtn.style.display = 'flex';
            userProfile.classList.remove('active');
            this.removeUserProfileButton();
        }
    }

    createUserProfileButton() {
        let userBtn = document.getElementById('userProfileBtn');
        if (!userBtn) {
            userBtn = document.createElement('div');
            userBtn.id = 'userProfileBtn';
            userBtn.className = 'user-profile-btn';
            userBtn.innerHTML = `
                <div class="user-avatar-small">
                    <i class="fas fa-user"></i>
                </div>
                <span class="user-name-small">${this.currentUser.name}</span>
                <i class="fas fa-chevron-down"></i>
            `;
            
            userBtn.addEventListener('click', () => {
                const dd = document.getElementById('userProfileDropdown');
                dd.classList.toggle('active');
                // position under the button
                const rect = userBtn.getBoundingClientRect();
                const top = rect.bottom + 8;
                const left = Math.min(window.innerWidth - dd.offsetWidth - 8, rect.right - dd.offsetWidth);
                dd.style.top = `${top}px`;
                dd.style.left = `${Math.max(8, left)}px`;
            });

            // Close profile dropdown on outside click anywhere on the page
            document.addEventListener('click', (e) => {
                const dd = document.getElementById('userProfileDropdown');
                const btn = document.getElementById('userProfileBtn');
                if (!dd) return;
                if (dd.classList.contains('active') && !dd.contains(e.target) && !btn.contains(e.target)) {
                    dd.classList.remove('active');
                }
            });

            const insertContainer = document.querySelector('.nav-actions') || document.body;
            const beforeEl = document.querySelector('.cart-icon');
            if (insertContainer && beforeEl && insertContainer.contains(beforeEl)) {
                insertContainer.insertBefore(userBtn, beforeEl);
            } else if (insertContainer) {
                insertContainer.appendChild(userBtn);
            }
        }
    }

    removeUserProfileButton() {
        const userBtn = document.getElementById('userProfileBtn');
        if (userBtn) {
            userBtn.remove();
        }
    }

    simulateAPICall() {
        return new Promise(resolve => {
            setTimeout(resolve, 1500); // Simulate network delay
        });
    }

    showSuccessMessage(message) {
        this.showNotification(message, 'success');
    }

    showErrorMessage(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
        // Stop OTP timers when modals are closed
        this.stopLoginOtpTimer();
        this.stopRegisterOtpTimer();
    }
}

// Global modal functions
function openLoginModal() {
    openModalWithFocus('loginModal');
}

function openRegisterModal() {
    openModalWithFocus('registerModal');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.classList.remove('active');
        el.style.display = 'none';
    }
    removeModalFocusTrap();
    
    // Stop OTP timers when specific modals are closed
    if (modalId === 'loginModal' && window.authManager) {
        window.authManager.stopLoginOtpTimer();
    }
    if (modalId === 'registerModal' && window.authManager) {
        window.authManager.stopRegisterOtpTimer();
    }
}

function showForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.classList.add('active');
        // Reset form and status
        document.getElementById('forgotPasswordForm').reset();
        document.getElementById('forgotPasswordStatus').style.display = 'none';
    }
}

function switchToRegister() {
    closeModal('loginModal');
    openRegisterModal();
}

function switchToLogin() {
    closeModal('registerModal');
    openLoginModal();
}

function logout() {
    window.authManager.logout();
}

// Profile modal helpers
document.addEventListener('click', (e) => {
    const link = e.target.closest('#openProfileModalLink');
    if (link) {
        e.preventDefault();
        openModalWithFocus('profileModal');
    }
    const settingsLink = e.target.closest('#openProfileSettings');
    if (settingsLink) {
        e.preventDefault();
        try {
            const u = window.authManager?.currentUser;
            if (u) {
                const n = document.getElementById('settingsName');
                const em = document.getElementById('settingsEmail');
                if (n) n.value = u.name || '';
                if (em) em.value = u.email || '';
            }
        } catch {}
        openModalWithFocus('profileSettingsModal');
    }
});

document.getElementById('profileChangeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = document.getElementById('profileNewPassword').value;
    const p2 = document.getElementById('profileNewPassword2').value;
    const code = document.getElementById('profileChangeCode').value.trim();
    if (!window.authManager?.isLoggedIn()) { showToast('warning', 'Önce giriş yapın'); return; }
    if (p1 !== p2 || p1.length < 6) { showToast('error', 'Şifreler eşleşmiyor veya kısa'); return; }
    if (!code || code.length !== 6) { showToast('error', 'Kod geçersiz'); return; }
    try {
        const res = await fetch('/api/profile/change-password/perform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, newPassword: p1 }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) { showToast('error', 'Şifre değişmedi'); return; }
        showToast('success', 'Şifre güncellendi');
        closeModal('profileModal');
    } catch { showToast('error', 'Ağ hatası'); }
});

document.getElementById('profileSendCodeBtn')?.addEventListener('click', async () => {
    if (!window.authManager?.isLoggedIn()) { showToast('warning', 'Önce giriş yapın'); return; }
    try {
        const res = await fetch('/api/profile/change-password/request', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) { showToast('error', 'Kod gönderilemedi'); return; }
        showToast('success', 'Kod e‑postanıza gönderildi');
    } catch { showToast('error', 'Ağ hatası'); }
});

// Profile settings submit
document.getElementById('profileSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('settingsName')?.value?.trim();
    const email = document.getElementById('settingsEmail')?.value?.trim();
    try {
        if (name) {
            const res = await fetch('/api/profile/name', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
            await res.json().catch(()=>({}));
        }
        if (email) {
            const res = await fetch('/api/profile/email/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            const data = await res.json().catch(()=>({}));
            if (res.ok && data?.ok) {
                const sec = document.getElementById('emailChangeVerify');
                if (sec) sec.style.display = '';
                showToast('success', 'Doğrulama kodu eski e‑postanıza gönderildi.');
            } else {
                showToast('error', 'E‑posta değişikliği isteği gönderilemedi');
            }
        }
    } catch { showToast('error', 'Ayarlar güncellenemedi'); }
});

// Email change verify
document.getElementById('emailChangeVerifyBtn')?.addEventListener('click', async () => {
    const code = document.getElementById('emailChangeCode')?.value?.trim();
    if (!code || code.length !== 6) { showToast('error', 'Kod geçersiz'); return; }
    try {
        const res = await fetch('/api/profile/email/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        const data = await res.json().catch(()=>({}));
        if (!res.ok || !data?.ok) { showToast('error', 'Doğrulama başarısız'); return; }
        showToast('success', 'E‑posta güncellendi');
        closeModal('profileSettingsModal');
        // Güncel e‑postayı UI'a yansıt
        if (window.authManager?.currentUser) {
            window.authManager.currentUser.email = document.getElementById('settingsEmail')?.value?.trim() || window.authManager.currentUser.email;
            localStorage.setItem('currentUser', JSON.stringify(window.authManager.currentUser));
            document.getElementById('userEmail').textContent = window.authManager.currentUser.email;
        }
    } catch { showToast('error', 'Ağ hatası'); }
});

// Register verify code actions
document.getElementById('regVerifyBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('registerEmail')?.value;
    const code = document.getElementById('regVerifyCode')?.value?.trim();
    if (!email || !code || code.length !== 6) { showToast('error', 'Kod geçersiz'); return; }
    try {
        const res = await fetch('/api/auth/register/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) { showToast('error', 'Doğrulama başarısız'); return; }
        showToast('success', 'Hesap doğrulandı ve giriş yapıldı');
        closeModal('registerModal');
        window.authManager?.stopRegisterOtpTimer?.();
        window.authManager?.setCurrentUser?.(data.user);
    } catch { showToast('error', 'Ağ hatası'); }
});

document.getElementById('regResendBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('registerEmail')?.value;
    if (!email) { showToast('error', 'E‑posta gerekli'); return; }
    try {
        const res = await fetch('/api/auth/register/resend-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) { showToast('error', 'Kod gönderilemedi'); return; }
        showToast('success', 'Kod yeniden gönderildi. Kod 2 dakika geçerlidir.');
        window.authManager?.startRegisterOtpTimer?.();
    } catch { showToast('error', 'Ağ hatası'); }
});

// Modal focus trap helpers
let _prevFocusedEl = null;
let _focusTrapHandler = null;

function openModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    _prevFocusedEl = document.activeElement;
    applyModalFocusTrap(overlay);
}

// Alias for compatibility
function openModalWithFocus(modalId) {
    openModal(modalId);
}

function applyModalFocusTrap(overlay) {
    const focusable = overlay.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const focusables = Array.from(focusable).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (focusables.length) {
        focusables[0].focus();
    }
    _focusTrapHandler = (e) => {
        if (e.key !== 'Tab') return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };
    document.addEventListener('keydown', _focusTrapHandler);
}

function removeModalFocusTrap() {
    if (_focusTrapHandler) {
        document.removeEventListener('keydown', _focusTrapHandler);
        _focusTrapHandler = null;
    }
    if (_prevFocusedEl && typeof _prevFocusedEl.focus === 'function') {
        try { _prevFocusedEl.focus(); } catch {}
    }
    _prevFocusedEl = null;
}

// Global mobile menu functions
function toggleMobileMenu() {
    console.log('🍔 toggleMobileMenu called');
    const mobileMenuPanel = document.getElementById('mobileMenuPanel');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    console.log('Panel found:', !!mobileMenuPanel);
    console.log('Overlay found:', !!overlay);
    
    if (mobileMenuPanel && overlay) {
        console.log('✅ Toggling mobile menu...');
        mobileMenuPanel.classList.toggle('open');
        overlay.classList.toggle('active');
        
        if (mobileMenuPanel.classList.contains('open')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

function closeMobileMenu() {
    const mobileMenuPanel = document.getElementById('mobileMenuPanel');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    if (mobileMenuPanel) {
        mobileMenuPanel.classList.remove('open');
    }
    if (overlay) {
        overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
}

// Global language functions
function toggleLanguageDropdown() {
    const languageSelector = document.querySelector('.language-selector');
    if (languageSelector) {
        console.log('Toggling language dropdown');
        languageSelector.classList.toggle('active');
    }
}

function setLanguage(lang) {
    console.log('Setting language to:', lang);
    if (window.languageManager) {
        window.languageManager.setLanguage(lang);
    }
    // Also update quick UI labels immediately
    const currentLang = document.getElementById('currentLang');
    if (currentLang) currentLang.textContent = lang.toUpperCase();
    const mobileCurrentLang = document.getElementById('mobileCurrentLang');
    if (mobileCurrentLang) mobileCurrentLang.textContent = lang.toUpperCase();

    // Close dropdowns
    const languageSelector = document.querySelector('.language-selector');
    if (languageSelector) languageSelector.classList.remove('active');
    const mobileLanguageSelector = document.querySelector('.mobile-language-selector');
    if (mobileLanguageSelector) mobileLanguageSelector.classList.remove('active');
}

function toggleMobileLanguage() {
    console.log('🌍 Mobile language toggle');
    
    // Get current language
    const mobileCurrentLang = document.getElementById('mobileCurrentLang');
    if (!mobileCurrentLang) return;
    
    const currentLang = mobileCurrentLang.textContent.toLowerCase();
    
    // Toggle between TR and EN
    const newLang = currentLang === 'tr' ? 'en' : 'tr';
    
    // Update language immediately
    setLanguage(newLang);
    
    // Show feedback
    showToast('success', `Dil değiştirildi: ${newLang.toUpperCase()}`);
}

function toggleHeaderLanguage() {
    console.log('🌍 Header language toggle - Mobile');
    
    // Check if we're on mobile
    if (window.innerWidth <= 768) {
        // Mobile: direct language toggle
        const currentLang = document.getElementById('currentLang');
        if (!currentLang) return;
        
        const currentLangText = currentLang.textContent.toLowerCase();
        const newLang = currentLangText === 'tr' ? 'en' : 'tr';
        
        // Update language immediately
        setLanguage(newLang);
        showToast('success', `Dil değiştirildi: ${newLang.toUpperCase()}`);
    } else {
        // Desktop: show dropdown
        toggleLangDropdown();
    }
}

function toggleLangDropdown() {
    console.log('🌍 Dil dropdown toggle');
    const dropdown = document.getElementById('languageDropdown');
    const selector = document.querySelector('.language-selector');
    
    if (dropdown && selector) {
        // Clear inline style if any
        dropdown.style.display = '';
        const isActive = selector.classList.contains('active');
        if (isActive) {
            selector.classList.remove('active');
            console.log('Dropdown kapatıldı');
        } else {
            selector.classList.add('active');
            console.log('Dropdown açıldı');
        }
    } else {
        console.error('Dropdown elementleri bulunamadı');
    }
}

// Simple language change function
function changeLanguage(lang) {
    console.log('🌍 changeLanguage called with:', lang);
    
    // Close dropdown
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.classList.remove('active');
    }
    
    // Update current language display
    const currentLang = document.getElementById('currentLang');
    if (currentLang) {
        currentLang.textContent = lang.toUpperCase();
    }
    
    // Update mobile display
    const mobileCurrentLang = document.getElementById('mobileCurrentLang');
    if (mobileCurrentLang) {
        mobileCurrentLang.textContent = lang.toUpperCase();
    }
    
    // Update active states
    document.querySelectorAll('.language-option').forEach(option => {
        const optionLang = option.getAttribute('data-lang');
        if (optionLang === lang) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Simple translation object
    const translations = {
        tr: {
            'nav.home': 'Ana Sayfa',
            'nav.products': 'Ürünler',
            'nav.categories': 'Kategoriler',
            'nav.categories.valorant': 'Valorant',
            'nav.categories.valorant.vp': 'Valorant VP',
            'nav.categories.valorant.random-vp': 'Valorant Rastgele VP',
            'nav.categories.lol': 'League of Legends',
            'nav.categories.lol.rp': 'LOL RP',
            'nav.categories.lol.random-rp': 'LOL Rastgele RP',
            'nav.categories.steam': 'Steam',
            'nav.categories.steam.wallet': 'Steam Cüzdan Kodu',
            'nav.categories.steam.game-code': 'Steam Oyun Kodu',
            'nav.categories.steam.random-game-code': 'Steam Rastgele Oyun Kodu',
            'nav.contact': 'İletişim',
            'auth.login': 'Giriş Yap',
            'auth.register': 'Kayıt Ol',
            'hero.title': 'En İyi Oyun Kodları ve Dijital Ürünler',
            'hero.subtitle': 'Steam, Origin, Epic Games ve daha fazla platform için binlerce oyun kodu',
            'hero.explore': 'Ürünleri Keşfet',
            'hero.categories': 'Kategoriler',
            'categories.title': 'Popüler Kategoriler',
            'products.title': 'Öne Çıkan Ürünler',
            'products.addtocart': 'Sepete Ekle',
            'features.title': 'Neden Keyco?'
        },
        en: {
            'nav.home': 'Home',
            'nav.products': 'Products',
            'nav.categories': 'Categories',
            'nav.categories.valorant': 'Valorant',
            'nav.categories.valorant.vp': 'Valorant VP',
            'nav.categories.valorant.random-vp': 'Valorant Random VP',
            'nav.categories.lol': 'League of Legends',
            'nav.categories.lol.rp': 'LOL RP',
            'nav.categories.lol.random-rp': 'LOL Random RP',
            'nav.categories.steam': 'Steam',
            'nav.categories.steam.wallet': 'Steam Wallet Code',
            'nav.categories.steam.game-code': 'Steam Game Code',
            'nav.categories.steam.random-game-code': 'Steam Random Game Code',
            'nav.contact': 'Contact',
            'auth.login': 'Login',
            'auth.register': 'Sign Up',
            'hero.title': 'Best Game Codes and Digital Products',
            'hero.subtitle': 'Thousands of game codes for Steam, Origin, Epic Games and more platforms',
            'hero.explore': 'Explore Products',
            'hero.categories': 'Categories',
            'categories.title': 'Popular Categories',
            'products.title': 'Featured Products',
            'products.addtocart': 'Add to Cart',
            'features.title': 'Why Keyco?'
        }
    };

    // Delegate to LanguageManager for full coverage
    if (window.languageManager) {
        window.languageManager.setLanguage(lang);
    }
    
    // Apply translations
    const elements = document.querySelectorAll('[data-i18n]');
    console.log('Found elements to translate:', elements.length);
    
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = translations[lang][key];
        if (translation) {
            console.log(`Translating ${key}: ${element.textContent} → ${translation}`);
            element.textContent = translation;
        }
    });
    
    // Update search placeholder
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.placeholder = lang === 'tr' ? 'Oyun ara...' : 'Search games...';
    }
    
    // Update active states
    document.querySelectorAll('.language-option').forEach(option => {
        const optionLang = option.getAttribute('data-lang');
        if (optionLang === lang) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Save to localStorage
    localStorage.setItem('language', lang);
    
    // Show success message
    showToast('success', `Dil değiştirildi: ${lang.toUpperCase()}`);
    
    console.log('Language changed successfully to:', lang);
}

// Manual test function - call this from console
function testLanguageChange() {
    console.log('🧪 Manual language test starting...');
    changeLanguage('en');
    
    setTimeout(() => {
        changeLanguage('tr');
    }, 3000);
}

// Language Manager
class LanguageManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('language') || 'tr';
        this.translations = {
            tr: {
                'nav.home': 'Ana Sayfa',
                'nav.products': 'Ürünler',
                'nav.categories': 'Kategoriler',
                'nav.categories.valorant': 'Valorant',
                'nav.categories.valorant.vp': 'Valorant VP',
                'nav.categories.steam': 'Steam',
                'nav.categories.steam.wallet': 'Steam Cüzdan Kodu',
                'nav.contact': 'İletişim',
                'auth.login': 'Giriş Yap',
                'auth.register': 'Kayıt Ol',
                'auth.login.title': 'Giriş Yap',
                'auth.register.title': 'Kayıt Ol',
                'auth.email': 'E-posta',
                'auth.password': 'Şifre',
                'auth.name': 'Ad Soyad',
                'auth.confirm.password': 'Şifre Tekrar',
                'auth.remember': 'Beni hatırla',
                'auth.forgot': 'Şifremi unuttum',
                'auth.terms.accept': 'Kullanım şartlarını kabul ediyorum',
                'auth.no.account': 'Hesabın yok mu?',
                'auth.have.account': 'Zaten hesabın var mı?',
                'hero.title': 'En İyi Oyun Kodları ve Dijital Ürünler',
                'hero.subtitle': 'Steam, Origin, Epic Games ve daha fazla platform için binlerce oyun kodu',
                'hero.explore': 'Ürünleri Keşfet',
                'hero.categories': 'Kategoriler',
                'search.placeholder': 'Oyun ara...',
                'categories.title': 'Popüler Kategoriler',
                'categories.steam': 'Steam Oyunları',
                'categories.steam.desc': '500+ Steam oyunu',
                'categories.valorant': 'Valorant',
                'categories.valorant.desc': 'VP ve rastgele paketler',
                'categories.lol': 'League of Legends',
                'categories.lol.desc': 'RP ve rastgele paketler',
                'categories.aaa': 'AAA Oyunlar',
                'categories.aaa.desc': 'En yeni çıkan oyunlar',
                'categories.currency': 'Oyun İçi Para',
                'categories.currency.desc': 'Valorant VP, Riot Points ve daha fazlası',
                'categories.giftcards': 'Hediye Kartları',
                'categories.giftcards.desc': 'Steam, Valorant ve LoL hediye kartları',
                'products.title': 'Öne Çıkan Ürünler',
                'products.addtocart': 'Sepete Ekle',
                'products.valorant.low': 'Valorant VP (Düşük Paket)',
                'products.valorant.medium': 'Valorant VP (Orta Paket)',
                'products.valorant.high': 'Valorant VP (Yüksek Paket)',
                'products.lol.low': 'LoL RP (Düşük Paket)',
                'products.lol.medium': 'LoL RP (Orta Paket)',
                'products.lol.high': 'LoL RP (Yüksek Paket)',
                'products.steam.low': 'Steam Oyun Kodu (Düşük Paket)',
                'products.steam.medium': 'Steam Oyun Kodu (Orta Paket)',
                'products.steam.high': 'Steam Oyun Kodu (Yüksek Paket)',
                'products.steam.wallet.5': 'Steam Cüzdan Kodu 5 USD',
                'products.steam.wallet.10': 'Steam Cüzdan Kodu 10 USD',
                'products.steam.wallet.20': 'Steam Cüzdan Kodu 20 USD',
                'products.steam.wallet.25': 'Steam Cüzdan Kodu 25 USD',
                'products.steam.wallet.50': 'Steam Cüzdan Kodu 50 USD',
                'products.steam.wallet.75': 'Steam Cüzdan Kodu 75 USD',
                'products.steam.wallet.100': 'Steam Cüzdan Kodu 100 USD',
                'descriptions.valorant.low': 'En düşük 475 VP, en yüksek 2050 VP kazanma şansı! Düşük riskli paket.',
                'descriptions.valorant.medium': 'En düşük 1000 VP, en yüksek 3650 VP kazanma şansı! Orta riskli paket.',
                'descriptions.valorant.high': 'En düşük 2050 VP, en yüksek 11000 VP kazanma şansı! Yüksek riskli paket.',
                'descriptions.lol.low': '575-1380 RP arası rastgele LoL pointi',
                'descriptions.lol.medium': '1380-4785 RP arası rastgele LoL pointi',
                'descriptions.lol.high': '4785-14450 RP arası rastgele League of Legends pointi. En büyük ödüller!',
                'descriptions.steam.low': 'En düşük 25₺, en yüksek 100₺ değerinde Steam oyunu kazanma şansı! Düşük riskli paket.',
                'descriptions.steam.medium': 'En düşük 50₺, en yüksek 250₺ değerinde Steam oyunu kazanma şansı! Orta riskli paket.',
                'descriptions.steam.high': 'En düşük 100₺, en yüksek 500₺ değerinde Steam oyunu kazanma şansı! Yüksek riskli paket.',
                'descriptions.steam.wallet.5': 'Steam cüzdanınıza 5 USD ekleyin',
                'descriptions.steam.wallet.10': 'Steam cüzdanınıza 10 USD ekleyin',
                'descriptions.steam.wallet.20': 'Steam cüzdanınıza 20 USD ekleyin',
                'descriptions.steam.wallet.25': 'Steam cüzdanınıza 25 USD ekleyin',
                'descriptions.steam.wallet.50': 'Steam cüzdanınıza 50 USD ekleyin',
                'descriptions.steam.wallet.75': 'Steam cüzdanınıza 75 USD ekleyin',
                'descriptions.steam.wallet.100': 'Steam cüzdanınıza 100 USD ekleyin',
                'features.title': 'Neden Keyco?',
                'features.instant.title': 'Anında Teslimat',
                'features.instant.desc': 'Kodlarınız satın alma sonrası anında mail adresinize gönderilir',
                'features.secure.title': 'Güvenli Ödeme',
                'features.secure.desc': 'SSL şifreleme ile korunan güvenli ödeme sistemi',
                'features.support.title': '7/24 Destek',
                'features.support.desc': 'Uzman ekibimiz her zaman yardımınıza hazır',
                'features.original.title': 'Orijinal Kodlar',
                'features.original.desc': '%100 orijinal ve geçerli oyun kodları garantisi',
                'profile.settings': 'Profil Ayarları',
                'profile.orders': 'Siparişlerim',
                'profile.favorites': 'Favorilerim',
                'profile.wallet': 'Cüzdanım',
                'profile.logout': 'Çıkış Yap',
                'cart.title': 'Sepetim',
                'cart.empty': 'Sepetiniz boş',
                'cart.total.label': 'Toplam:',
                'cart.discount.label': 'İndirim:',
                'cart.final.total.label': 'Son Toplam:',
                'cart.checkout': 'Satın Al',
                'footer.description': 'En güvenilir oyun kodu mağazası',
                'footer.categories': 'Kategoriler',
                'footer.steam': 'Steam Oyunları',
                'footer.valorant': 'Valorant VP',
                'footer.lol': 'League of Legends RP',
                'footer.currency': 'Oyun İçi Paralar',
                'footer.support': 'Destek',
                'footer.faq': 'Sıkça Sorulan Sorular',
                'footer.contact': 'İletişim',
                'footer.refund': 'Geri İade',
                'footer.terms': 'Kullanım Şartları',
                'footer.contact.title': 'İletişim',
                'footer.support.247': '7/24 Destek',
                'footer.copyright': '© 2025 Keyco. Tüm hakları saklıdır.',
                'language.current': 'Dil',
                'theme.toggle': 'Tema',
                'faq.title': 'Sıkça Sorulan Sorular',
                'faq.q1.title': 'Kodlar ne kadar sürede teslim edilir?',
                'faq.q1.content': 'Satın alma işlemi tamamlandıktan sonra kodlarınız genellikle anında, birkaç dakika içinde e‑posta adresinize gönderilir.',
                'faq.q2.title': 'Ödemeler güvenli mi?',
                'faq.q2.content': 'Tüm ödemeler SSL ile şifrelenir ve güvenli ödeme sağlayıcıları üzerinden işlenir.',
                'faq.q3.title': 'Kod çalışmazsa ne yapmalıyım?',
                'faq.q3.content': 'Önce platform bölgesini ve kullanım adımlarını kontrol edin. Sorun devam ederse sipariş numaranızla destek ekibimize ulaşın; inceleyip çözüm üretelim ya da iade sağlayalım.',
                'faq.q4.title': 'Hesap satışlarında garanti var mı?',
                'faq.q4.content': 'Hesap tesliminden sonra belirli bir süre giriş/erişim garantisi sunarız. Detaylar ürün sayfasında belirtilir.',
                'refund.title': 'Geri İade Politikası',
                'refund.content': 'Dijital kodlarda iade, kodun kullanılmamış olması şartıyla mümkündür. İnceleme sonrası uygun bulunursa ücret iadesi yapılır.',
                'terms.title': 'Kullanım Şartları',
                'terms.content': 'Hizmetlerimizi kullanarak platform kurallarımızı ve ilgili politikaları kabul etmiş sayılırsınız. Lütfen satın almadan önce ürün açıklamalarını okuyun.',
                'contact.title': 'İletişime Geçin',
                'contact.subtitle': 'Sorularınız ve talepleriniz için bize yazın. En kısa sürede dönüş yapacağız.',
                'contact.form.name': 'Ad Soyad',
                'contact.form.email': 'E-posta',
                'contact.form.subject': 'Konu',
                'contact.form.message': 'Mesajınız',
                'contact.form.send': 'Gönder',
                'contact.detail.email': 'E-posta',
                'contact.detail.hours': 'Çalışma Saatleri'
            },
            en: {
                'nav.home': 'Home',
                'nav.products': 'Products',
                'nav.categories': 'Categories',
                'nav.categories.valorant': 'Valorant',
                'nav.categories.valorant.vp': 'Valorant VP',
                'nav.categories.steam': 'Steam',
                'nav.categories.steam.wallet': 'Steam Wallet Code',
                'nav.contact': 'Contact',
                'auth.login': 'Login',
                'auth.register': 'Sign Up',
                'auth.login.title': 'Login',
                'auth.register.title': 'Sign Up',
                'auth.email': 'Email',
                'auth.password': 'Password',
                'auth.name': 'Full Name',
                'auth.confirm.password': 'Confirm Password',
                'auth.remember': 'Remember me',
                'auth.forgot': 'Forgot password',
                'auth.terms.accept': 'I accept the terms and conditions',
                'auth.no.account': "Don't have an account?",
                'auth.have.account': 'Already have an account?',
                'hero.title': 'Best Game Codes and Digital Products',
                'hero.subtitle': 'Thousands of game codes for Steam, Origin, Epic Games and more platforms',
                'hero.explore': 'Explore Products',
                'hero.categories': 'Categories',
                'search.placeholder': 'Search games...',
                'categories.title': 'Popular Categories',
                'categories.steam': 'Steam Games',
                'categories.steam.desc': '500+ Steam games',
                'categories.valorant': 'Valorant',
                'categories.valorant.desc': 'VP and random packages',
                'categories.lol': 'League of Legends',
                'categories.lol.desc': 'RP and random packages',
                'categories.aaa': 'AAA Games',
                'categories.aaa.desc': 'Latest released games',
                'categories.currency': 'In-Game Currency',
                'categories.currency.desc': 'Valorant VP, Riot Points and more',
                'categories.giftcards': 'Gift Cards',
                'categories.giftcards.desc': 'Steam, Valorant and LoL gift cards',
                'products.title': 'Featured Products',
                'products.addtocart': 'Add to Cart',
                'products.valorant.low': 'Valorant VP (Low Package)',
                'products.valorant.medium': 'Valorant VP (Medium Package)',
                'products.valorant.high': 'Valorant VP (High Package)',
                'products.lol.low': 'LoL RP (Low Package)',
                'products.lol.medium': 'LoL RP (Medium Package)',
                'products.lol.high': 'LoL RP (High Package)',
                'products.steam.low': 'Steam Game Code (Low Package)',
                'products.steam.medium': 'Steam Game Code (Medium Package)',
                'products.steam.high': 'Steam Game Code (High Package)',
                'products.steam.wallet.5': 'Steam Wallet Code 5 USD',
                'products.steam.wallet.10': 'Steam Wallet Code 10 USD',
                'products.steam.wallet.20': 'Steam Wallet Code 20 USD',
                'products.steam.wallet.25': 'Steam Wallet Code 25 USD',
                'products.steam.wallet.50': 'Steam Wallet Code 50 USD',
                'products.steam.wallet.75': 'Steam Wallet Code 75 USD',
                'products.steam.wallet.100': 'Steam Wallet Code 100 USD',
                'descriptions.valorant.low': 'Chance to win 475-2050 VP! Low risk package.',
                'descriptions.valorant.medium': 'Chance to win 1000-3650 VP! Medium risk package.',
                'descriptions.valorant.high': 'Chance to win 2050-11000 VP! High risk package.',
                'descriptions.lol.low': '575-1380 RP random LoL points',
                'descriptions.lol.medium': '1380-4785 RP random LoL points',
                'descriptions.lol.high': '4785-14450 RP random League of Legends points. Biggest rewards!',
                'descriptions.steam.low': 'Chance to win Steam game worth 25₺-100₺! Low risk package.',
                'descriptions.steam.medium': 'Chance to win Steam game worth 50₺-250₺! Medium risk package.',
                'descriptions.steam.high': 'Chance to win Steam game worth 100₺-500₺! High risk package.',
                'descriptions.steam.wallet.5': 'Add 5 USD to your Steam wallet',
                'descriptions.steam.wallet.10': 'Add 10 USD to your Steam wallet',
                'descriptions.steam.wallet.20': 'Add 20 USD to your Steam wallet',
                'descriptions.steam.wallet.25': 'Add 25 USD to your Steam wallet',
                'descriptions.steam.wallet.50': 'Add 50 USD to your Steam wallet',
                'descriptions.steam.wallet.75': 'Add 75 USD to your Steam wallet',
                'descriptions.steam.wallet.100': 'Add 100 USD to your Steam wallet',
                'features.title': 'Why Keyco?',
                'features.instant.title': 'Instant Delivery',
                'features.instant.desc': 'Your codes are sent to your email immediately after purchase',
                'features.secure.title': 'Secure Payment',
                'features.secure.desc': 'Secure payment system protected with SSL encryption',
                'features.support.title': '24/7 Support',
                'features.support.desc': 'Our expert team is always ready to help you',
                'features.original.title': 'Original Codes',
                'features.original.desc': '100% original and valid game codes guarantee',
                'profile.settings': 'Profile Settings',
                'profile.orders': 'My Orders',
                'profile.favorites': 'Favorites',
                'profile.wallet': 'My Wallet',
                'profile.logout': 'Logout',
                'cart.title': 'My Cart',
                'cart.empty': 'Your cart is empty',
                'cart.total.label': 'Total:',
                'cart.discount.label': 'Discount:',
                'cart.final.total.label': 'Final Total:',
                'cart.checkout': 'Checkout',
                'footer.description': 'Most trusted game codes store',
                'footer.categories': 'Categories',
                'footer.steam': 'Steam Games',
                'footer.valorant': 'Valorant VP',
                'footer.lol': 'League of Legends RP',
                'footer.currency': 'In-Game Currency',
                'footer.support': 'Support',
                'footer.faq': 'Frequently Asked Questions',
                'footer.contact': 'Contact',
                'footer.refund': 'Refund Policy',
                'footer.terms': 'Terms of Service',
                'footer.contact.title': 'Contact',
                'footer.support.247': '24/7 Support',
                'footer.copyright': '© 2025 Keyco. All rights reserved.',
                'language.current': 'Language',
                'theme.toggle': 'Theme',
                'faq.title': 'Frequently Asked Questions',
                'faq.q1.title': 'How soon are codes delivered?',
                'faq.q1.content': 'After purchase, your codes are typically sent instantly to your email within minutes.',
                'faq.q2.title': 'Are payments secure?',
                'faq.q2.content': 'All payments are encrypted with SSL and processed via trusted payment providers.',
                'faq.q3.title': 'What if my code doesn\'t work?',
                'faq.q3.content': 'Check the platform region and redemption steps first. If it still fails, contact support with your order number; we will resolve it or issue a refund.',
                'faq.q4.title': 'Is there a guarantee on account sales?',
                'faq.q4.content': 'We provide a limited access/entry guarantee after delivery. Details are listed on the product page.',
                'refund.title': 'Refund Policy',
                'refund.content': 'Refunds for digital codes are possible if the code has not been redeemed. After review, a refund will be issued if eligible.',
                'terms.title': 'Terms of Service',
                'terms.content': 'By using our services, you agree to our platform rules and policies. Please read product descriptions before purchase.',
                'contact.title': 'Get in Touch',
                'contact.subtitle': 'Send us your questions and requests. We will respond as soon as possible.',
                'contact.form.name': 'Full Name',
                'contact.form.email': 'Email',
                'contact.form.subject': 'Subject',
                'contact.form.message': 'Your Message',
                'contact.form.send': 'Send',
                'contact.detail.email': 'Email',
                'contact.detail.hours': 'Working Hours'
            }
        };
        this.init();
    }

    init() {
        console.log('Language Manager initialized with language:', this.currentLanguage);
        this.bindEvents();
        this.updateLanguage(this.currentLanguage);
        this.updateLanguageUI();
    }

    bindEvents() {
        const languageBtn = document.getElementById('languageBtn');
        const languageSelector = document.querySelector('.language-selector');
        const languageOptions = document.querySelectorAll('.language-option');

        console.log('Language elements found:', {
            languageBtn,
            languageSelector,
            optionsCount: languageOptions.length
        });

        if (languageBtn && languageSelector) {
            languageBtn.addEventListener('click', (e) => {
                console.log('Language button clicked');
                e.stopPropagation();
                languageSelector.classList.toggle('active');
            });

            languageOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const lang = option.getAttribute('data-lang');
                    this.setLanguage(lang);
                    languageSelector.classList.remove('active');
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!languageSelector.contains(e.target)) {
                    languageSelector.classList.remove('active');
                }
            });
        }
    }

    setLanguage(lang) {
        console.log('LanguageManager setLanguage called with:', lang);
        this.currentLanguage = lang;
        localStorage.setItem('language', lang);
        this.updateLanguage(lang);
        this.updateLanguageUI();
        console.log('Language set successfully to:', lang);
    }

    updateLanguage(lang) {
        console.log('Updating language to:', lang);
        const elements = document.querySelectorAll('[data-i18n]');
        console.log('Found elements with data-i18n:', elements.length);
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translations[lang][key];
            if (translation) {
                element.textContent = translation;
            } else {
                // Fallback silently to EN or keep existing
                const fallback = (this.translations.en && this.translations.en[key]) || element.textContent;
                element.textContent = fallback;
            }
        });

        // Update placeholder texts
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.placeholder = this.translations[lang]['search.placeholder'];
        }

        const mobileSearchInput = document.querySelector('.mobile-search input');
        if (mobileSearchInput) {
            mobileSearchInput.placeholder = this.translations[lang]['search.placeholder'];
        }

        // Update document language attribute
        document.documentElement.lang = lang;
        console.log('Language update completed');
    }

    updateLanguageUI() {
        console.log('Updating language UI for:', this.currentLanguage);
        
        // Update desktop language display
        const currentLangSpan = document.getElementById('currentLang');
        if (currentLangSpan) {
            currentLangSpan.textContent = this.currentLanguage.toUpperCase();
        }
        
        // Update mobile language display
        const mobileCurrentLang = document.getElementById('mobileCurrentLang');
        if (mobileCurrentLang) {
            mobileCurrentLang.textContent = this.currentLanguage.toUpperCase();
        }
        
        // Update desktop active language option
        const languageOptions = document.querySelectorAll('.language-option');
        languageOptions.forEach(option => {
            const lang = option.getAttribute('data-lang');
            if (lang === this.currentLanguage) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        // Update mobile active language option
        const mobileLanguageOptions = document.querySelectorAll('.mobile-language-option');
        mobileLanguageOptions.forEach(option => {
            const lang = option.getAttribute('data-lang');
            if (lang === this.currentLanguage) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        console.log('Language UI updated');
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// Animation System
class AnimationSystem {
    constructor() {
        this.loadingScreen = null;
        this.cursorTrails = [];
    }

    init() {
        console.log('🎬 Initializing Animation System...');
        this.initLoadingScreen();
        this.initTypingEffect();
        // Mouse renkli imleç/iz efektleri istenmediği için devre dışı
        this.initRippleEffects();
        this.initScrollAnimations();
        this.initClickRipple();
    }

    initLoadingScreen() {
        this.loadingScreen = document.getElementById('loadingScreen');
        if (!this.loadingScreen) return;

        // Ensure body starts hidden behind loader
        document.body.classList.add('loading');

        // Wait for progress bar animation to complete (3 seconds)
        setTimeout(() => {
            // First hide loader with fade effect
            this.loadingScreen.classList.add('hide');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
                // Then reveal main content
                document.body.classList.remove('loading');
                // Make hero title visible with animation
                const heroTitle = document.querySelector('.hero-content h1');
                if (heroTitle) {
                    heroTitle.style.opacity = '1';
                    heroTitle.style.transform = 'translateX(0)';
                    heroTitle.classList.add('text-glow');
                }
                // Remove skeletons
                document.querySelectorAll('.product-card').forEach(card => card.classList.remove('skeleton'));
            }, 800);
        }, 2200); // 2 seconds for progress bar + 200ms buffer
    }

    initTypingEffect() {
        // Initialize text animations
        this.initTextAnimations();
        console.log('✅ Text animations initialized');
    }

    initTextAnimations() {
        const heroTitle = document.querySelector('.hero-content h1');
        if (!heroTitle) return;

        // Start with slide-in and glow immediately
        setTimeout(() => {
            // Add wave effect after slide-in
            setTimeout(() => {
                this.addWaveEffect(heroTitle);
            }, 400);
        }, 0);

        // Change animation every 5 seconds
        setInterval(() => {
            this.cycleTextAnimations(heroTitle);
        }, 5000);
    }

    addWaveEffect(element) {
        const text = element.textContent;
        const words = text.split(' ');
        
        element.innerHTML = words.map(word => 
            `<span class="text-wave">${word.split('').map(char => 
                char === ' ' ? ' ' : `<span>${char}</span>`
            ).join('')}</span>`
        ).join(' ');
    }

    cycleTextAnimations(element) {
        const animations = ['text-glow', 'text-bounce', 'text-slide-in'];
        const currentClasses = element.className.split(' ');
        
        // Remove current animation classes
        animations.forEach(anim => element.classList.remove(anim));
        
        // Add random animation
        const randomAnim = animations[Math.floor(Math.random() * animations.length)];
        element.classList.add(randomAnim);
        
        console.log(`🎬 Applied animation: ${randomAnim}`);
    }

    typeWriter(element, text, i, speed) {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            setTimeout(() => this.typeWriter(element, text, i + 1, speed), speed);
        } else {
            // Remove cursor after typing is complete
            setTimeout(() => {
                element.style.borderRight = 'none';
            }, 1000);
        }
    }

    initCursorTrail() {
        let mouseX = 0, mouseY = 0;
        let isMouseDown = false;
        
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            this.createTrailDot(mouseX, mouseY);
            this.createInteractiveParticle(mouseX, mouseY, 'trail');
        });

        document.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            this.createInteractiveParticle(e.clientX, e.clientY, 'explosion');
        });

        document.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        document.addEventListener('click', (e) => {
            this.createParticleBurst(e.clientX, e.clientY);
        });
    }

    createTrailDot(x, y) {
        const trail = document.createElement('div');
        trail.className = 'cursor-trail';
        trail.style.left = x - 10 + 'px';
        trail.style.top = y - 10 + 'px';
        
        document.body.appendChild(trail);
        
        // Remove trail dot after animation
        setTimeout(() => {
            if (trail.parentNode) {
                trail.parentNode.removeChild(trail);
            }
        }, 1000);
    }

    createInteractiveParticle(x, y, type) {
        const container = document.getElementById('interactiveParticles');
        if (!container) return;

        const particle = document.createElement('div');
        particle.className = `mouse-particle particle-${type}`;
        
        // Random offset for more natural effect
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        
        particle.style.left = x + offsetX + 'px';
        particle.style.top = y + offsetY + 'px';
        
        container.appendChild(particle);
        
        // Remove particle after animation
        const duration = type === 'explosion' ? 1200 : type === 'trail' ? 800 : 1000;
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, duration);
    }

    createParticleBurst(x, y) {
        const container = document.getElementById('interactiveParticles');
        if (!container) return;

        // Create multiple burst particles
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'mouse-particle particle-burst';
            
            // Calculate circular positions
            const angle = (i / 8) * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            const offsetX = Math.cos(angle) * distance;
            const offsetY = Math.sin(angle) * distance;
            
            particle.style.left = x + offsetX + 'px';
            particle.style.top = y + offsetY + 'px';
            
            // Random color variation
            const hue = Math.random() * 60 + 30; // Yellow to orange range
            particle.style.background = `hsl(${hue}, 70%, 60%)`;
            
            container.appendChild(particle);
            
            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1000);
        }
    }

    initRippleEffects() {
        document.querySelectorAll('.ripple-effect').forEach(button => {
            button.addEventListener('click', (e) => {
                const ripple = document.createElement('span');
                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');
                
                button.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });
    }

    initClickRipple() {
        document.addEventListener('click', (e) => {
            // Ignore right/middle clicks
            if (e.button !== 0) return;
            const ripple = document.createElement('div');
            ripple.className = 'click-effect';
            ripple.style.left = e.clientX + 'px';
            ripple.style.top = e.clientY + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 500);
        });
    }

    initScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                }
            });
        }, { 
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe all animated elements
        document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .scale-in').forEach(element => {
            observer.observe(element);
        });
    }
}

// Simple Q&A Chatbot
class Chatbot {
    constructor(languageManager) {
        this.languageManager = languageManager;
        this.root = document.getElementById('chatbotRoot');
        this.widget = document.getElementById('chatbotWidget');
        this.toggleBtn = document.getElementById('chatbotToggle');
        this.closeBtn = document.getElementById('chatbotClose');
        this.endBtn = document.getElementById('chatbotEnd');
        this.messagesEl = document.getElementById('chatbotMessages');
        this.quickEl = document.getElementById('chatbotQuick');
        this.form = document.getElementById('chatbotForm');
        this.input = document.getElementById('chatbotText');
        this.qaPairs = this.buildQAPairs();
        this.bindEvents();
        // Tarihçe kullanmıyoruz; temiz başlangıç
        this.clearMessages();
        this.greet();
        this.renderQuickReplies();
    }

    t(key, fallback) {
        const lang = this.languageManager?.getCurrentLanguage?.() || 'tr';
        return (this.languageManager?.translations?.[lang]?.[key]) || fallback || key;
    }

    buildQAPairs() {
        // Uses content already present on page for accurate answers
        return [
            {
                keys: ['teslim', 'ne kadar', 'kaç dak', 'delivery', 'time', 'when'],
                answer: {
                    tr: 'Kodlar genellikle anında, birkaç dakika içinde e‑postanıza gönderilir.',
                    en: 'Codes are typically delivered instantly to your email within minutes.'
                }
            },
            {
                keys: ['iade', 'geri iade', 'refund', 'return'],
                answer: {
                    tr: 'Dijital kodlarda iade, kod kullanılmamışsa mümkündür. İnceleme sonrası uygun bulunursa ücret iadesi yapılır (bkz. Geri İade Politikası).',
                    en: 'Refunds for digital codes are possible if not redeemed. After review, eligible orders are refunded (see Refund Policy).'
                }
            },
            {
                keys: ['ödeme', 'güven', 'ssl', 'payment', 'secure'],
                answer: {
                    tr: 'Tüm ödemeler SSL ile şifrelenir ve güvenilir sağlayıcılar üzerinden işlenir.',
                    en: 'All payments are SSL-encrypted and processed via trusted providers.'
                }
            },
            {
                keys: ['hesap', 'garanti', 'account', 'guarantee'],
                answer: {
                    tr: 'Hesap tesliminden sonra belirli bir süre giriş/erişim garantisi sunuyoruz. Detaylar ürün sayfasında.',
                    en: 'We provide limited access/entry guarantee after delivery. Details are on the product page.'
                }
            },
            {
                keys: ['kod', 'çalışmıyor', 'redeem', "doesn't work", 'not working'],
                answer: {
                    tr: 'Önce platform bölgesi ve kullanım adımlarını kontrol edin. Devam ederse sipariş numaranızla bize yazın; çözüm üretelim ya da iade sağlayalım.',
                    en: 'Check platform region and redemption steps first. If it persists, contact us with your order number; we will resolve or refund.'
                }
            }
        ];
    }

    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        if (this.endBtn) {
            this.endBtn.addEventListener('click', () => this.endChat(false));
        }
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = (this.input?.value || '').trim();
                if (!text) return;
                this.addMessage(text, 'user');
                this.input.value = '';
                setTimeout(() => this.answer(text), 200);
            });
        }
        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    updateLanguage() {
        // Update placeholders and quick replies
        if (this.input) {
            const p = this.t('chat.placeholder', this.languageManager.getCurrentLanguage() === 'tr' ? 'Sorunuzu yazın...' : 'Type your question...');
            this.input.placeholder = p;
        }
        // Update header texts (title and end button)
        const titleSpan = this.widget?.querySelector('.chatbot-title span[data-i18n="chat.title"]');
        if (titleSpan) titleSpan.textContent = this.t('chat.title', 'Support Bot');
        const endBtn = document.getElementById('chatbotEnd');
        if (endBtn) {
            const endLabel = endBtn.querySelector('span');
            if (endLabel) endLabel.textContent = this.t('chat.end', this.languageManager.getCurrentLanguage() === 'tr' ? 'Sohbeti Bitir' : 'End Chat');
        }
        this.renderQuickReplies();
    }

    toggle() {
        if (!this.root) return;
        const willOpen = !this.root.classList.contains('open');
        this.root.classList.toggle('open');
        this.widget?.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        if (willOpen) {
            this.resetIfEnded();
            this.scrollToBottom();
        }
    }

    close() {
        if (!this.root) return;
        this.root.classList.remove('open');
        this.widget?.setAttribute('aria-hidden', 'true');
    }

    greet() {
        const lang = this.languageManager.getCurrentLanguage();
        this.addMessage(this.t('chat.greeting', lang === 'tr' ? 'Merhaba! Nasıl yardımcı olabilirim?' : 'Hi! How can I help?'), 'bot');
    }

    renderQuickReplies() {
        if (!this.quickEl) return;
        const lang = this.languageManager.getCurrentLanguage();
        const items = [
            { key: 'chat.quick.delivery', fallback: lang === 'tr' ? 'Teslimat süresi' : 'Delivery time', action: 'delivery' },
            { key: 'chat.quick.refund',   fallback: lang === 'tr' ? 'İade şartları' : 'Refund policy', action: 'refundInfo' },
            { key: 'chat.quick.payment',  fallback: lang === 'tr' ? 'Ödeme güvenliği' : 'Payment security', action: 'payment' },
            { key: 'chat.quick.account',  fallback: lang === 'tr' ? 'Hesap garantisi' : 'Account guarantee', action: 'account' },
            { key: 'chat.quick.contact',  fallback: lang === 'tr' ? 'İletişim formunu aç' : 'Open contact form', action: 'contact' },
            { key: 'chat.quick.end',      fallback: lang === 'tr' ? 'Sohbeti Bitir' : 'End chat', action: 'end' },
        ];
        this.quickEl.innerHTML = '';
        items.forEach(item => {
            const label = this.t(item.key, item.fallback);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-btn';
            btn.textContent = label;
            btn.dataset.action = item.action;
            btn.addEventListener('click', () => {
                this.addMessage(label, 'user');
                switch (item.action) {
                    case 'contact':
                        this.openContact();
                        break;
                    case 'end':
                        this.endChat(true);
                        break;
                    case 'refundInfo':
                        this.replyRefundInfo();
                        break;
                    case 'delivery':
                        this.answer(lang === 'tr' ? 'teslimat' : 'delivery time');
                        break;
                    case 'payment':
                        this.answer(lang === 'tr' ? 'ödeme güvenliği' : 'payment security');
                        break;
                    case 'account':
                        this.answer(lang === 'tr' ? 'hesap garantisi' : 'account guarantee');
                        break;
                    default:
                        this.answer(label);
                }
            });
            this.quickEl.appendChild(btn);
        });
    }

    addMessage(text, author = 'bot') {
        if (!this.messagesEl) return;
        const msg = document.createElement('div');
        msg.className = `chat-msg ${author}`;
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = text;
        msg.appendChild(bubble);
        this.messagesEl.appendChild(msg);
        this.scrollToBottom();
        this.saveHistory();
    }

    answer(query) {
        const lang = this.languageManager.getCurrentLanguage();
        const intent = this.detectIntent(query);
        if (intent && intent.action) {
            switch (intent.action) {
                case 'open_contact':
                    this.openContact();
                    return;
                case 'open_faq':
                    this.openSection('faq');
                    this.addMessage(lang === 'tr' ? 'SSS bölümünü açtım.' : 'Opened FAQ section.', 'bot');
                    return;
                case 'open_refund':
                    this.openSection('refund');
                    this.addMessage(lang === 'tr' ? 'Geri iade politikasını açtım.' : 'Opened refund policy.', 'bot');
                    return;
                case 'open_terms':
                    this.openSection('terms');
                    this.addMessage(lang === 'tr' ? 'Kullanım şartlarını açtım.' : 'Opened terms of service.', 'bot');
                    return;
                case 'open_products':
                    this.openSection('products');
                    this.addMessage(lang === 'tr' ? 'Ürünler bölümüne gittim.' : 'Navigated to products.', 'bot');
                    return;
                case 'open_home':
                    this.openSection('home');
                    this.addMessage(lang === 'tr' ? 'Ana sayfaya gittim.' : 'Navigated to home.', 'bot');
                    return;
                case 'open_cart':
                    if (window.shoppingCart) window.shoppingCart.toggleCart();
                    this.addMessage(lang === 'tr' ? 'Sepeti açtım.' : 'Opened cart.', 'bot');
                    return;
                case 'delivery_info': {
                    const text = lang === 'tr'
                        ? 'Teslimat: Çoğu dijital kod anında, birkaç dakika içinde e‑postanıza düşer. Nadiren ödeme onayı veya yoğunluk nedeniyle 10‑15 dakikaya uzayabilir. 15 dakikayı geçtiyse sipariş numaranızla bize yazın, anında kontrol edelim.'
                        : 'Delivery: Most digital codes are delivered instantly to your email within minutes. In rare cases (payment verification/traffic) it may take up to 10‑15 minutes. If it exceeds 15 minutes, contact us with your order number and we will check immediately.';
                    this.addMessage(text, 'bot');
                    return; }
                case 'refund_info': {
                    const text = lang === 'tr'
                        ? 'Dijital kodlarda iade, kodun kullanılmamış olması şartıyla mümkündür. İnceleme sonrası uygun bulunursa ücret iadesi yapılır.'
                        : 'Refunds for digital codes are possible if the code has not been redeemed. After review, eligible orders are refunded.';
                    this.addMessage(text, 'bot');
                    return; }
                case 'payment_info': {
                    const text = lang === 'tr'
                        ? 'Ödeme güvenliği: Ödemeler SSL ile şifrelenir ve güvenilir sağlayıcılar üzerinden işlenir. Kart verileri saklanmaz. 3D Secure desteklenir. Her işlemde hile/sahtecilik kontrolü uygulanır.'
                        : 'Payment security: All payments are SSL‑encrypted and processed via trusted providers. Card data is not stored. 3D Secure is supported. Fraud checks are applied on each transaction.';
                    this.addMessage(text, 'bot');
                    return; }
                case 'account_guarantee': {
                    const text = lang === 'tr'
                        ? 'Hesap garantisi: Teslim sonrası belirli bir süre erişim/ giriş garantisi sağlıyoruz. Şifre değişimi veya erişim sorunu olursa desteğe yazın; doğrulamadan sonra değişim veya iade seçenekleri sunuyoruz. Ürün sayfasında kapsam belirtilir.'
                        : 'Account guarantee: We provide limited access/entry guarantee after delivery. If you face access issues, contact support; after verification we provide replacement or refund options. The coverage is listed on the product page.';
                    this.addMessage(text, 'bot');
                    return; }
                case 'code_issue': {
                    const text = lang === 'tr'
                        ? 'Kod çalışmıyor ise: (1) Bölge/ülke uyumunu ve platformu kontrol edin. (2) Giriş yaptığınız hesabın uygun olduğundan emin olun. (3) Hata mesajının ekran görüntüsü ve sipariş numaranızla bize yazın; doğrulayıp yenisini sağlayalım veya iade edelim.'
                        : "If a code doesn't work: (1) Check region/platform compatibility. (2) Ensure the signed‑in account is eligible. (3) Send us the exact error and your order number; we'll verify and replace or refund.";
                    this.addMessage(text, 'bot');
                    return; }
                default:
                    break;
            }
        }
        // Fallback: try keyword Q&A
        const q = this.normalize(query);
        const pair = this.qaPairs.find(p => p.keys.some(k => q.includes(k)));
        const text = pair ? (pair.answer[lang] || pair.answer.tr) : (lang === 'tr'
            ? 'Sorunu daha iyi anlayamadım. SSS, İade, Kullanım Şartları veya İletişim sayfasına yönlendirebilirim. "Sohbeti Bitir" diyerek değerlendirme de yapabilirsiniz.'
            : "I couldn't fully understand. I can take you to FAQ, Refund, Terms or Contact. You can also say 'End chat' to rate the experience.");
        this.addMessage(text, 'bot');
    }

    normalize(str) {
        return (str || '').toLowerCase()
            .replace(/ı/g, 'i').replace(/İ/g, 'i')
            .replace(/ş/g, 's').replace(/Ş/g, 's')
            .replace(/ç/g, 'c').replace(/Ç/g, 'c')
            .replace(/ö/g, 'o').replace(/Ö/g, 'o')
            .replace(/ü/g, 'u').replace(/Ü/g, 'u')
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'g');
    }

    detectIntent(query) {
        const q = this.normalize(query);
        const has = (...phrases) => phrases.some(p => q.includes(p));
        // Navigation intents
        if (has('iletisim', 'contact', 'destek')) {
            // any mention of contact directs to opening contact
            return { action: 'open_contact' };
        }
        if (has('sss', 'sikca sorulan', 'faq')) return { action: 'open_faq' };
        // refund: prefer explanation if user asks to explain
        if (has('iade', 'geri iade', 'refund', 'iade sart', 'iade sartlari', 'refund policy')) {
            if (has('acikla', 'aciklamasini', 'aciklamasina', 'nedir', 'hakkinda')) {
                return { action: 'refund_info' };
            }
            return { action: 'open_refund' };
        }
        if (has('kullanim sart', 'terms')) return { action: 'open_terms' };
        if (has('urun', 'products', 'katalog')) return { action: 'open_products' };
        if (has('anasayfa', 'home')) return { action: 'open_home' };
        if (has('sepet', 'cart')) return { action: 'open_cart' };
        // Info intents
        if (has('teslim', 'ne kadar', 'kac dak', 'kaç dak', 'delivery', 'time', 'when')) return { action: 'delivery_info' };
        if (has('odeme', 'ödeme', 'guven', 'güven', 'ssl', 'payment', 'secure')) return { action: 'payment_info' };
        if (has('hesap', 'garanti', 'account', 'guarantee')) return { action: 'account_guarantee' };
        if (has('calismiyor', 'çalışmıyor', 'redeem', 'hata', 'invalid', 'not working')) return { action: 'code_issue' };
        if (has('iade', 'refund', 'geri iade')) return { action: 'refund_info' };
        return null;
    }

    openSection(id) {
        const el = document.getElementById(id.startsWith('#') ? id.slice(1) : id);
        if (!el) return;
        const headerEl = document.querySelector('.header');
        const headerHeight = headerEl ? headerEl.offsetHeight : 70;
        const offset = el.offsetTop - headerHeight - 20;
        window.scrollTo({ top: offset, behavior: 'smooth' });
    }

    replyRefundInfo() {
        const lang = this.languageManager.getCurrentLanguage();
        const text = lang === 'tr'
            ? 'Dijital kodlarda iade, kodun kullanılmamış olması şartıyla mümkündür. İnceleme sonrası uygun bulunursa ücret iadesi yapılır.'
            : 'Refunds for digital codes are possible if the code has not been redeemed. After review, eligible orders are refunded.';
        this.addMessage(text, 'bot');
    }

    scrollToBottom() {
        if (!this.messagesEl) return;
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    saveHistory() {}
    loadHistory() {}

    openContact() {
        const contact = document.getElementById('contact');
        if (contact) {
            const headerEl = document.querySelector('.header');
            const headerHeight = headerEl ? headerEl.offsetHeight : 70;
            const offset = contact.offsetTop - headerHeight - 20;
            window.scrollTo({ top: offset, behavior: 'smooth' });
            // Focus the first field to emphasize opening the form
            setTimeout(() => {
                const nameInput = document.getElementById('contactName');
                if (nameInput) nameInput.focus();
            }, 400);
            this.addMessage(this.languageManager.getCurrentLanguage() === 'tr' ? 'İletişim formunu açtım ve odakladım.' : 'Opened and focused the contact form.', 'bot');
        }
    }

    endChat(closeAfter = false) {
        const lang = this.languageManager.getCurrentLanguage();
        this.addMessage(lang === 'tr' ? 'Sohbeti sonlandırdım. Değerlendirir misin?' : 'Chat ended. Would you rate your experience?', 'bot');
        
        // Check if user is logged in
        if (!window.authManager?.isLoggedIn()) {
            this.addMessage(lang === 'tr' ? 
                '💬 Destek botunu değerlendirmek ve yorum yapmak için önce giriş yapmanız gerekiyor.' : 
                '💬 You need to login first to rate the support bot and leave a comment.', 'bot');
            
            this.addMessage(lang === 'tr' ? 
                '🔐 Giriş yaptıktan sonra değerlendirme formunu kullanabileceksiniz. Aşağıdaki butona tıklayarak giriş yapabilirsiniz:' : 
                '🔐 After logging in, you will be able to use the rating form. Click the button below to login:', 'bot');
            
            // Add login button
            const loginMsg = document.createElement('div');
            loginMsg.className = 'chat-msg bot';
            const loginBubble = document.createElement('div');
            loginBubble.className = 'chat-bubble';
            const loginBtn = document.createElement('button');
            loginBtn.type = 'button';
            loginBtn.className = 'chat-login-btn';
            loginBtn.textContent = lang === 'tr' ? '🚀 Giriş Yap' : '🚀 Login';
            loginBtn.addEventListener('click', () => {
                // Close chatbot and open login modal
                this.close();
                if (window.openLoginModal) {
                    setTimeout(() => {
                        window.openLoginModal();
                    }, 300);
                }
            });
            loginBubble.appendChild(loginBtn);
            loginMsg.appendChild(loginBubble);
            this.messagesEl.appendChild(loginMsg);
        } else {
            // Show rating widget for logged in users
            setTimeout(() => {
                this.close(); // Close chatbot first
                showSupportRating();
            }, 500);
        }
        
        // Disable input and quick replies
        if (this.form) this.form.style.display = 'none';
        if (this.quickEl) this.quickEl.style.display = 'none';
        // Not adding overlay yet; will be added after rating submit
    }

    clearMessages() {
        if (this.messagesEl) this.messagesEl.innerHTML = '';
        try { localStorage.removeItem('chatHistory'); } catch {}
    }

    renderRating() {
        if (!this.messagesEl) return;
        const lang = this.languageManager.getCurrentLanguage();
        const container = document.createElement('div');
        container.className = 'chat-msg bot';
        const wrap = document.createElement('div');
        wrap.className = 'chat-bubble';
        const title = document.createElement('div');
        title.className = 'chat-rating-title';
        title.textContent = this.t('chat.rate.title', lang === 'tr' ? 'Sohbeti değerlendirin' : 'Rate this chat');
        const rating = document.createElement('div');
        rating.className = 'chat-rating';
        let selected = 0;
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            const s = document.createElement('button');
            s.type = 'button';
            s.className = 'chat-star';
            s.setAttribute('aria-label', `${i}`);
            s.textContent = '★';
            s.addEventListener('click', () => {
                selected = i;
                stars.forEach((el, idx) => {
                    el.classList.toggle('active', idx < selected);
                });
            });
            stars.push(s);
            rating.appendChild(s);
        }
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'chat-rate-submit';
        submit.textContent = this.t('chat.rate.submit', lang === 'tr' ? 'Gönder' : 'Submit');
        submit.addEventListener('click', () => {
            if (selected === 0) return;
            try { localStorage.setItem('chatRating', String(selected)); } catch {}
            this.addMessage(this.t('chat.rate.thanks', lang === 'tr' ? 'Teşekkürler! Geri bildiriminiz kaydedildi.' : 'Thanks! Your feedback was saved.'), 'bot');
            container.remove();
            // Small confetti burst
            confettiBurst();
            // Now show ended overlay and close softly with shrink animation
            const overlay = document.createElement('div');
            overlay.className = 'chat-ended-overlay';
            overlay.innerHTML = `<div class="chat-ended-badge">${lang === 'tr' ? 'Sohbet Sonlandırıldı' : 'Chat Ended'}</div>`;
            this.widget.appendChild(overlay);
            this.widget.classList.add('closing');
            setTimeout(() => this.close(), 350);
        });
        wrap.appendChild(title);
        wrap.appendChild(rating);
        wrap.appendChild(submit);
        container.appendChild(wrap);
        this.messagesEl.appendChild(container);
        this.scrollToBottom();
    }

    resetIfEnded() {
        if (!this.widget) return;
        const overlay = this.widget.querySelector('.chat-ended-overlay');
        if (!overlay) return; // not ended previously
        overlay.remove();
        this.clearMessages();
        if (this.form) this.form.style.display = '';
        if (this.quickEl) this.quickEl.style.display = '';
        this.greet();
        this.renderQuickReplies();
    }
}

// Initialize all managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Keyco initializing...');

    // One-time hard refresh to clear old Service Worker and caches
    (function hardReloadOnce() {
        try {
            if (!localStorage.getItem('sw_reset_done')) {
                const unregisterSW = 'serviceWorker' in navigator
                    ? navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())))
                    : Promise.resolve();
                const clearCaches = 'caches' in window
                    ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
                    : Promise.resolve();
                Promise.all([unregisterSW, clearCaches]).then(() => {
                    localStorage.setItem('sw_reset_done', '1');
                    console.log('SW and caches cleared');
                });
            }
        } catch {}
    })();
    
    // Initialize all components
    try {
        window.themeManager = new ThemeManager();
        console.log('✅ ThemeManager initialized');
        
        window.shoppingCart = new ShoppingCart();
        console.log('✅ ShoppingCart initialized');

        window.animationSystem = new AnimationSystem();
        window.animationSystem.init();
        console.log('✅ AnimationSystem initialized');
        
        window.searchManager = new SearchManager();
        console.log('✅ SearchManager initialized');
        
        window.mobileMenuManager = new MobileMenuManager();
        console.log('✅ MobileMenuManager initialized');
        
        window.smoothScrollManager = new SmoothScrollManager();
        console.log('✅ SmoothScrollManager initialized');
        
        window.animationManager = new AnimationManager();
        console.log('✅ AnimationManager initialized');
        
        window.authManager = new AuthManager();
        console.log('✅ AuthManager initialized');
        
        window.languageManager = new LanguageManager();
        console.log('✅ LanguageManager initialized');

        // Favorites UI bindings
        try {
            const refreshFavStates = async () => {
                try {
                    const res = await fetch('/api/favorites');
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data?.ok) return;
                    const favIds = new Set((data.items||[]).map(it => String(it.id)));
                    document.querySelectorAll('.fav-btn[data-product-id]')?.forEach(btn => {
                        const pid = btn.getAttribute('data-product-id');
                        if (favIds.has(pid)) btn.classList.add('favorited'); else btn.classList.remove('favorited');
                    });
                } catch {}
            };
            document.addEventListener('click', async (e) => {
                const btn = e.target.closest('.fav-btn[data-product-id]');
                if (!btn) return;
                e.preventDefault();
                if (!window.authManager?.isLoggedIn()) { showToast('warning', 'Önce giriş yapın'); return; }
                const pid = btn.getAttribute('data-product-id');
                const isFav = btn.classList.contains('favorited');
                try {
                    const url = '/api/favorites/' + encodeURIComponent(pid);
                    const res = await fetch(url, { method: isFav ? 'DELETE' : 'POST' });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data?.ok) { showToast('error', 'Favori işlemi başarısız'); return; }
                    btn.classList.toggle('favorited');
                    showToast('success', isFav ? 'Favoriden çıkarıldı' : 'Favorilere eklendi');
                    // Favoriler sayfası açıksa anında yenile
                    const favoritesPage = document.getElementById('favoritesPage');
                    if (favoritesPage && favoritesPage.style.display !== 'none') {
                        await loadFavoritesIntoFavoritesGrid();
                    }
                } catch { showToast('error', 'Ağ hatası'); }
            }, { capture: true });
            refreshFavStates();
        } catch (err) { console.warn('Favorites UI init failed:', err); }

        // Ensure topbar buttons work even if inline handlers fail
        try {
            const loginBtn = document.querySelector('.login-btn');
            if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); openLoginModal(); });
            const registerBtn = document.querySelector('.register-btn');
            if (registerBtn) registerBtn.addEventListener('click', (e) => { e.preventDefault(); openRegisterModal(); });
            const langBtn = document.getElementById('languageBtn');
            if (langBtn) {
                langBtn.addEventListener('click', (e) => { e.preventDefault(); toggleLangDropdown(); }, { capture: true });
            }
            const langDropdown = document.getElementById('languageDropdown');
            if (langDropdown) {
                langDropdown.addEventListener('click', (ev) => {
                    const opt = ev.target.closest('[data-lang]');
                    if (!opt) return;
                    ev.preventDefault();
                    const lang = opt.getAttribute('data-lang');
                    if (lang) setLanguage(lang);
                });
            }
            const mobileLangBtn = document.getElementById('mobileLanguageBtn');
            if (mobileLangBtn) mobileLangBtn.addEventListener('click', (e) => { e.preventDefault(); toggleMobileLanguageDropdown(); });
            document.querySelectorAll('.mobile-language-option[data-lang]')?.forEach(opt => {
                opt.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const lang = opt.getAttribute('data-lang');
                    if (lang) setLanguage(lang);
                });
            });
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', (e) => { e.preventDefault(); toggleMobileMenu(); });
            const mobileMenuClose = document.getElementById('mobileMenuClose');
            if (mobileMenuClose) mobileMenuClose.addEventListener('click', (e) => { e.preventDefault(); closeMobileMenu(); });

            // Hover fallback to open language dropdown
            const languageSelector = document.getElementById('languageSelector');
            if (languageSelector) {
                languageSelector.addEventListener('mouseenter', () => languageSelector.classList.add('active'));
                languageSelector.addEventListener('mouseleave', () => languageSelector.classList.remove('active'));
            }

            // Fallback: bind explicit password toggles (login/register)
            document.querySelectorAll('.password-toggle[data-target]')?.forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const id = btn.getAttribute('data-target');
                    const input = document.getElementById(id);
                    if (!input) return;
                    const toType = input.type === 'password' ? 'text' : 'password';
                    input.type = toType;
                    const icon = btn.querySelector('i');
                    if (icon) icon.className = toType === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                });
            });
        } catch (err) { console.warn('Topbar handlers bind warning:', err); }

        // Global delegated handlers (modals, switches, overlay click, ESC)
        document.addEventListener('click', (e) => {
            // Close language dropdown by clicking outside
            const selector = document.querySelector('.language-selector');
            if (selector && !e.target.closest('.language-selector')) {
                selector.classList.remove('active');
            }
            // Close modal via X button
            const closeBtn = e.target.closest('.close-modal');
            if (closeBtn) {
                e.preventDefault();
                const overlay = closeBtn.closest('.modal-overlay');
                if (overlay && overlay.id) closeModal(overlay.id);
                return;
            }

            // Close when clicking outside modal content
            const overlayClick = e.target.closest('.modal-overlay');
            if (overlayClick && !e.target.closest('.modal')) {
                e.preventDefault();
                if (overlayClick.id) closeModal(overlayClick.id);
                return;
            }

            // Auth switch links
            const switchLink = e.target.closest('.auth-switch a');
            if (switchLink) {
                e.preventDefault();
                const inLogin = !!switchLink.closest('#loginModal');
                if (inLogin) { switchToRegister(); } else { switchToLogin(); }
                return;
            }

            // Fallback topbar login/register (if rendered dynamically)
            const topLogin = e.target.closest('.login-btn');
            if (topLogin) { e.preventDefault(); openLoginModal(); return; }
            const topRegister = e.target.closest('.register-btn');
            if (topRegister) { e.preventDefault(); openRegisterModal(); return; }

            // Language dropdown toggler
            const topLangBtn = e.target.closest('#languageBtn');
            if (topLangBtn) { e.preventDefault(); toggleLangDropdown(); return; }

            // Language option (desktop/mobile)
            const langOpt = e.target.closest('.language-option[data-lang], .mobile-language-option[data-lang]');
            if (langOpt) {
                e.preventDefault();
                const lang = langOpt.getAttribute('data-lang');
                if (lang) setLanguage(lang);
                return;
            }

            // Mobile menu toggles
            const mobOpen = e.target.closest('#mobileMenuBtn');
            if (mobOpen) { e.preventDefault(); toggleMobileMenu(); return; }
            const mobClose = e.target.closest('#mobileMenuClose');
            if (mobClose) { e.preventDefault(); closeMobileMenu(); return; }
        });

        // ESC closes active modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeOverlay = document.querySelector('.modal-overlay.active');
                if (activeOverlay && activeOverlay.id) {
                    closeModal(activeOverlay.id);
                }
            }
        });

        // Inject chatbot i18n keys if missing and hook language updates
        try {
            const tr = window.languageManager.translations.tr || {};
            const en = window.languageManager.translations.en || {};
            tr['chat.title'] = tr['chat.title'] || 'Destek Botu';
            tr['chat.send'] = tr['chat.send'] || 'Gönder';
            tr['chat.end'] = tr['chat.end'] || 'Sohbeti Bitir';
            tr['chat.placeholder'] = tr['chat.placeholder'] || 'Sorunuzu yazın...';
            tr['chat.greeting'] = tr['chat.greeting'] || 'Merhaba! Nasıl yardımcı olabilirim? Aşağıdaki hazır sorulardan birine tıklayabilir ya da sorunu yazabilirsin.';
            tr['chat.quick.delivery'] = tr['chat.quick.delivery'] || 'Teslimat süresi';
            tr['chat.quick.refund'] = tr['chat.quick.refund'] || 'İade şartları';
            tr['chat.quick.payment'] = tr['chat.quick.payment'] || 'Ödeme güvenliği';
            tr['chat.quick.account'] = tr['chat.quick.account'] || 'Hesap garantisi';

            en['chat.title'] = en['chat.title'] || 'Support Bot';
            en['chat.send'] = en['chat.send'] || 'Send';
            en['chat.end'] = en['chat.end'] || 'End Chat';
            en['chat.placeholder'] = en['chat.placeholder'] || 'Type your question...';
            en['chat.greeting'] = en['chat.greeting'] || 'Hi! How can I help you? You can click a quick question below or type your issue.';
            en['chat.quick.delivery'] = en['chat.quick.delivery'] || 'Delivery time';
            en['chat.quick.refund'] = en['chat.quick.refund'] || 'Refund policy';
            en['chat.quick.payment'] = en['chat.quick.payment'] || 'Payment security';
            en['chat.quick.account'] = en['chat.quick.account'] || 'Account guarantee';

            window.languageManager.translations.tr = tr;
            window.languageManager.translations.en = en;

            const originalSetLanguage = window.languageManager.setLanguage.bind(window.languageManager);
            window.languageManager.setLanguage = function(lang) {
                originalSetLanguage(lang);
                if (window.chatbot) {
                    window.chatbot.updateLanguage();
                }
                if (window.loadFaqsFromApi) {
                    window.loadFaqsFromApi();
                }
            };
        } catch (e) {
            console.warn('Chatbot i18n hook warning:', e);
        }

        // Initialize Chatbot
        try {
            window.chatbot = new Chatbot(window.languageManager);
            console.log('✅ Chatbot initialized');
        } catch (e) {
            console.error('❌ Chatbot init error:', e);
        }

        // Back to Top init
        try {
            initBackToTop();
            console.log('✅ BackToTop initialized');
        } catch (e) {
            console.error('❌ BackToTop init error:', e);
        }

        // Cookie consent
        try {
            initCookieConsent();
            console.log('✅ CookieConsent initialized');
        } catch (e) {
            console.error('❌ CookieConsent init error:', e);
        }

        // Scroll progress
        try {
            initScrollProgress();
        } catch (e) {}

        // PWA service worker (temporarily disabled to resolve caching issues)
        try {
            if ('serviceWorker' in navigator) {
                // Unregister any existing SW and skip registering a new one for now
                navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
            }
        } catch (e) { console.warn('SW disable warning:', e); }

        // Desktop keyboard navigation for top menus
        try {
            initDesktopMenuKeyboard();
        } catch (e) {}

        // Backend integrations
        try { initContactFormIntegration(); } catch (e) { console.warn('contact form bind fail', e); }
        try { loadFaqsFromApi(); } catch (e) { console.warn('faq load fail', e); }
        
        // Test language functionality
        console.log('🌍 Testing language system...');
        console.log('Available translations:', Object.keys(window.languageManager.translations));
        console.log('Current language:', window.languageManager.currentLanguage);
        
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }

    // Add loading animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);

    console.log('🎮 Keyco Gaming Store initialized successfully!');
    
    // Initialize coupon system
    try {
        // Enter key support for cart coupon input
        const cartCouponInput = document.getElementById('cartCouponInput');
        if (cartCouponInput) {
            cartCouponInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    validateCartCoupon();
                }
            });
        }
        
        // Re-apply coupon discount if page is refreshed
        if (window.shoppingCart && window.shoppingCart.activeCoupon) {
            const discountText = (document.getElementById('cartDiscountAmount')?.textContent || '0').replace(/\./g, '');
            const discountAmount = parseFloat(discountText) || 0;
            if (discountAmount > 0) {
                window.shoppingCart.updateCartWithDiscount(discountAmount);
            }
        }
        
        console.log('✅ Coupon system initialized');
    } catch (err) { 
        console.warn('Coupon system init failed:', err); 
    }
    
    // Initialize notification system
    try {
        // Load notifications on login
        if (window.authManager?.isLoggedIn()) {
            loadNotifications();
            
            // Periodically check for new notifications
            setInterval(() => {
                if (window.authManager?.isLoggedIn()) {
                    loadNotifications();
                }
            }, 30000); // Check every 30 seconds
        }
        
        // Close notifications when clicking outside
        document.addEventListener('click', (e) => {
            const notificationsPanel = document.getElementById('notificationsPanel');
            const notificationsIcon = document.querySelector('.notifications-icon');
            
            if (notificationsVisible && 
                !notificationsPanel?.contains(e.target) && 
                !notificationsIcon?.contains(e.target)) {
                toggleNotifications();
            }
        });
        
        console.log('✅ Notification system initialized');
    } catch (err) { 
        console.warn('Notification system init failed:', err); 
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Toggle theme with Ctrl+Shift+T
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        window.themeManager.toggleTheme();
    }
    
    // Open cart with Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        window.shoppingCart.toggleCart();
    }
    
    // Focus search with Ctrl+K
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-box input').focus();
    }
});

// Back to Top button behavior
function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    const onScroll = () => {
        const y = window.scrollY || document.documentElement.scrollTop;
        if (y > 400) btn.classList.add('show'); else btn.classList.remove('show');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Toast helper
function ensureToastContainer() {
    let c = document.querySelector('.toast-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function showToast(type, message) {
    const c = ensureToastContainer();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    c.appendChild(t);
    // async show
    setTimeout(() => t.classList.add('show'), 20);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 250);
    }, 2500);
}

// Lightweight confetti
function confettiBurst(x, y) {
    // default to center-top of widget area
    const cx = x || window.innerWidth - 80;
    const cy = y || 120;
    const colors = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#06b6d4'];
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        const dx = (Math.random() - 0.5) * 160;
        const dy = 80 + Math.random() * 120;
        const rz = Math.random() * 360;
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.setProperty('--dx', dx + 'px');
        p.style.setProperty('--dy', dy + 'px');
        p.style.setProperty('--rz', rz + 'deg');
        p.style.setProperty('--dur', (600 + Math.random() * 400) + 'ms');
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }
}

// Cookie consent basic logic
function initCookieConsent() {
    const bar = document.getElementById('cookieConsent');
    if (!bar) return;
    const accept = document.getElementById('cookieAccept');
    const decline = document.getElementById('cookieDecline');
    const key = 'cookieConsent';
    const saved = localStorage.getItem(key);
    if (!saved) {
        bar.style.display = 'block';
    }
    const close = (value) => {
        localStorage.setItem(key, value);
        bar.style.display = 'none';
    };
    if (accept) accept.addEventListener('click', () => close('accepted'));
    if (decline) decline.addEventListener('click', () => close('declined'));
}

// Scroll progress bar
function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    const onScroll = () => {
        const doc = document.documentElement;
        const scrollTop = doc.scrollTop || document.body.scrollTop;
        const height = doc.scrollHeight - doc.clientHeight;
        const percent = height > 0 ? (scrollTop / height) * 100 : 0;
        bar.style.width = percent + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

// Desktop navbar keyboard support (simple ARIA-less approach)
function initDesktopMenuKeyboard() {
    const topItems = document.querySelectorAll('.nav-menu > li.has-submenu > a');
    const allSubmenus = document.querySelectorAll('.nav-menu .submenu');

    const openItem = (li) => li && li.classList.add('keyboard-open');
    const closeItem = (li) => li && li.classList.remove('keyboard-open');
    const closeAll = () => document.querySelectorAll('.nav-menu li.keyboard-open').forEach(li => li.classList.remove('keyboard-open'));

    topItems.forEach(anchor => {
        const li = anchor.parentElement;
        anchor.setAttribute('tabindex', '0');
        anchor.addEventListener('keydown', (e) => {
            const key = e.key;
            if (key === 'Enter' || key === ' ') {
                e.preventDefault();
                const isOpen = li.classList.contains('keyboard-open');
                closeAll();
                if (!isOpen) openItem(li);
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                openItem(li);
                const first = li.querySelector('.submenu li a');
                if (first) first.focus();
            } else if (key === 'Escape') {
                closeItem(li);
                anchor.focus();
            } else if (key === 'ArrowRight') {
                // move to next top item
                const next = li.nextElementSibling?.querySelector('a');
                if (next) next.focus();
            } else if (key === 'ArrowLeft') {
                const prev = li.previousElementSibling?.querySelector('a');
                if (prev) prev.focus();
            }
        });
    });

    // Submenu navigation
    allSubmenus.forEach(menu => {
        const links = menu.querySelectorAll('a');
        links.forEach((link, idx) => {
            link.setAttribute('tabindex', '0');
            link.addEventListener('keydown', (e) => {
                const key = e.key;
                const li = link.closest('li');
                const parentTop = link.closest('.nav-menu > li.has-submenu');
                if (key === 'ArrowDown') {
                    e.preventDefault();
                    (links[idx + 1] || links[0]).focus();
                } else if (key === 'ArrowUp') {
                    e.preventDefault();
                    (links[idx - 1] || links[links.length - 1]).focus();
                } else if (key === 'ArrowRight') {
                    // open nested submenu if exists
                    const nested = li?.querySelector(':scope > .submenu');
                    if (nested) {
                        li.classList.add('keyboard-open');
                        const first = nested.querySelector('a');
                        if (first) first.focus();
                    }
                } else if (key === 'ArrowLeft') {
                    // close nested and focus parent
                    const parentNestedLi = link.closest('.submenu')?.closest('li');
                    if (parentNestedLi && parentNestedLi.classList.contains('keyboard-open')) {
                        parentNestedLi.classList.remove('keyboard-open');
                        const parentLink = parentNestedLi.querySelector(':scope > a');
                        if (parentLink) parentLink.focus();
                    } else if (parentTop) {
                        // close top submenu
                        parentTop.classList.remove('keyboard-open');
                        const topLink = parentTop.querySelector(':scope > a');
                        if (topLink) topLink.focus();
                    }
                } else if (key === 'Escape') {
                    if (parentTop) {
                        parentTop.classList.remove('keyboard-open');
                        const topLink = parentTop.querySelector(':scope > a');
                        if (topLink) topLink.focus();
                    }
                }
            });
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        const nav = document.querySelector('.nav-menu');
        if (nav && !nav.contains(e.target)) {
            document.querySelectorAll('.nav-menu li.keyboard-open').forEach(li => li.classList.remove('keyboard-open'));
        }
    });
}

// Toggle password visibility function
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.nextElementSibling;
    const icon = toggleBtn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        toggleBtn.setAttribute('title', 'Şifreyi gizle');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        toggleBtn.setAttribute('title', 'Şifreyi göster');
    }
}

// Support Rating System
let currentRating = 0;

// Featured products loading
async function loadFeaturedProducts() {
    try {
        console.log('Loading featured products...');
        
        // Try multiple approaches for Chrome localhost issues
        let response;
        
        try {
            // First attempt: normal fetch
            response = await fetch('/api/featured', {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
        } catch (fetchError) {
            console.log('First fetch attempt failed, trying alternative method...');
            
            // Second attempt: XMLHttpRequest (more reliable for localhost)
            response = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', '/api/featured', true);
                xhr.setRequestHeader('Cache-Control', 'no-cache');
                xhr.setRequestHeader('Pragma', 'no-cache');
                
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        resolve({
                            ok: true,
                            status: xhr.status,
                            json: () => JSON.parse(xhr.responseText)
                        });
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                };
                
                xhr.onerror = () => reject(new Error('XHR request failed'));
                xhr.send();
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('Featured products response:', data);
        
        if (data.ok && data.items) {
            console.log('Displaying featured products:', data.items);
            displayFeaturedProducts(data.items);
        } else {
            console.log('No featured products data or invalid response');
        }
    } catch (error) {
        console.error('Error loading featured products:', error);
        // Show fallback content
        const productsGrid = document.querySelector('#products .products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Öne çıkan ürünler yüklenemiyor. Lütfen sayfayı yenileyin.</p>
                    <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Sayfayı Yenile
                    </button>
                </div>
            `;
        }
    }
}

function displayFeaturedProducts(products) {
    console.log('displayFeaturedProducts called with:', products);
    const productsGrid = document.querySelector('#products .products-grid');
    console.log('Products grid element:', productsGrid);
    
    if (!productsGrid) {
        console.error('Products grid not found!');
        return;
    }
    
    productsGrid.innerHTML = '';
    console.log('Cleared products grid');
    
    products.forEach((product, index) => {
        console.log('Creating product card for:', product);
        const productCard = createFeaturedProductCard(product, index);
        productsGrid.appendChild(productCard);
    });
    
    console.log('Finished displaying products');
}

function createFeaturedProductCard(product, order) {
    const card = document.createElement('div');
    card.className = 'product-card scale-in animate';
    card.style.animationDelay = `${order * 0.1}s`;
    
    // Fiyat zaten TL cinsinden geliyor (featured_products tablosunda)
    const priceInTL = product.price || 0;
    const finalPrice = product.discount > 0 ? 
        priceInTL * (1 - product.discount / 100) : priceInTL;
    
    // Debug: Öne çıkan ürün fiyat hesaplaması
    console.log('Öne çıkan ürün fiyat hesaplaması:', {
        name: product.name,
        originalPrice: product.price,
        priceInTL: priceInTL,
        discount: product.discount,
        finalPrice: finalPrice,
        roundedPrice: Math.round(priceInTL),
        roundedFinal: Math.round(finalPrice),
        toFixedPrice: priceInTL.toFixed(0),
        toFixedFinal: finalPrice.toFixed(0)
    });
    
    // Admin panelinde eklenen logo alanları: image/image_url veya icon
    const rawIcon = String(product.icon || '').trim();
    let imageUrl = product.image || product.image_url || '';
    const isIconClass = rawIcon && /fa[sbrl]?\s|fa-/.test(rawIcon);
    
    // Eğer image_url yoksa, platform/category'ye göre varsayılan resim kullan
    if (!imageUrl) {
        const platform = String(product.platform || '').toLowerCase();
        const category = String(product.category || '').toLowerCase();
        
        if (platform === 'valorant' || category === 'valorant') {
            imageUrl = 'vp.png';
        } else if (platform === 'lol' || category === 'lol') {
            imageUrl = 'rp.png';
        } else if (platform === 'steam' || category === 'steam') {
            imageUrl = 'st.png';
        } else {
            imageUrl = 'vp.png'; // Varsayılan
        }
    }
    
    let mediaHtml = '';
    if (imageUrl) {
        mediaHtml = `<img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null; this.src='vp.png';" style="width:100%;height:100%;object-fit:cover;display:block;">`;
    } else if (isIconClass) {
        mediaHtml = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--bg-secondary);"><i class="${rawIcon}" style="font-size:48px;color:var(--accent-color);"></i></div>`;
    }
    
    let badgeHtml = '';
    if (product.badge) {
        switch (product.badge) {
            case 'discount':
                badgeHtml = `<div class="discount-badge">-${product.discount}%</div>`;
                break;
            case 'hot':
                badgeHtml = `<div class="hot-badge">Popüler</div>`;
                break;
            case 'new':
                badgeHtml = `<div class="new-badge">Yeni</div>`;
                break;
        }
    }
    
    card.innerHTML = `
        ${mediaHtml ? `<div class="product-image">${mediaHtml}${badgeHtml}</div>` : ''}
        <div class="product-info" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
            ${!mediaHtml && badgeHtml ? `<div>${badgeHtml}</div>` : ''}
            <h3 style="margin:0;">${product.name}</h3>
            <div class="platform">
                <i class="fas fa-gamepad"></i>
                <span>${product.platform || ''}</span>
            </div>
            <div class="price">
                ${product.discount > 0 ? `<span class="old-price">₺${Math.round(priceInTL)}</span>` : ''}
                <span class="current-price">₺${Math.round(finalPrice)}</span>
            </div>
            <div class="product-actions" style="margin-top:6px;">
                <button class="add-to-cart" data-i18n="products.addtocart">Sepete Ekle</button>
                <button class="fav-btn" data-product-id="${product.id}" aria-label="Favorilere ekle">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    
    // Event listener'ları ekle
    const addToCartBtn = card.querySelector('.add-to-cart');
    const favBtn = card.querySelector('.fav-btn');
    
    if (addToCartBtn) {
        addToCartBtn.dataset.productId = product.id;
        addToCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Öne çıkan ürün sepete ekleme - Ürün ID:', product.id, 'Ürün adı:', product.name);
            addToCart(product.id);
        }, { once: false });
    }
    
    if (favBtn) {
        favBtn.dataset.productId = product.id;
        favBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!product.id) {
            console.error('Ürün ID bulunamadı!', product);
            return;
          }
          console.log('Öne çıkan ürün favori butonu tıklandı - Ürün ID:', product.id, 'Ürün adı:', product.name);
          console.log('Tam ürün verisi:', product);
          toggleFavorite(product.id, favBtn);
        });
    }
    
    return card;
}

function showSupportRating() {
    document.getElementById('supportRatingWidget').style.display = 'block';
    resetRating();
}

function closeSupportRating() {
    document.getElementById('supportRatingWidget').style.display = 'none';
    document.getElementById('supportRatingThanks').style.display = 'none';
}

function setRating(rating) {
    currentRating = rating;
    const stars = document.querySelectorAll('.star-btn');
    
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('filled');
        } else {
            star.classList.remove('filled');
        }
    });
    
    document.getElementById('supportSubmitBtn').disabled = false;
}

function resetRating() {
    currentRating = 0;
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach(star => star.classList.remove('filled'));
    document.getElementById('supportComment').value = '';
    document.getElementById('supportSubmitBtn').disabled = true;
}

async function submitSupportRating() {
    if (currentRating === 0) return;
    
    try {
        const comment = document.getElementById('supportComment').value.trim();
        const response = await fetch('/api/support/rate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rating: currentRating,
                comment: comment || null
            })
        });
        
        if (response.ok) {
            document.getElementById('supportRatingWidget').style.display = 'none';
            document.getElementById('supportRatingThanks').style.display = 'block';
            
            // 3 saniye sonra kapat
            setTimeout(() => {
                closeSupportRating();
            }, 3000);
        } else {
            showToast('error', 'Değerlendirme gönderilemedi');
        }
    } catch (error) {
        console.error('Rating error:', error);
        showToast('error', 'Bir hata oluştu');
    }
}

// Load featured products on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedProducts();
    
    // Start realtime updates for featured products
    startFeaturedProductsPolling();
    
    // Listen for immediate updates from admin panel
    setupImmediateUpdateListeners();
});

// Realtime updates for featured products
let featuredProductsPollingInterval;
let lastFeaturedProductsHash = '';

function startFeaturedProductsPolling() {
    // Disable polling for now due to Chrome localhost issues
    console.log('Featured products polling disabled - using manual refresh instead');
    
    // Alternative: Use localStorage and BroadcastChannel for real-time updates
    try {
        const channel = new BroadcastChannel('featured-products-updates');
        channel.onmessage = (event) => {
            if (event.data.type === 'featured-products-updated') {
                console.log('Received featured products update via BroadcastChannel');
                loadFeaturedProducts();
            }
        };
        
        // Listen for storage changes (cross-tab communication)
        window.addEventListener('storage', (event) => {
            if (event.key === 'featured-products-updated') {
                console.log('Received featured products update via localStorage');
                loadFeaturedProducts();
            }
            
            // Listen for featured products updates (ürünler için de kullanılıyor)
            if (event.key === 'featuredProductsUpdate') {
                console.log('🚨 localStorage featuredProductsUpdate sinyali alındı!');
                console.log('🔄 Ana sayfa güncelleme başlatılıyor...');
                
                // Öne çıkan ürünleri güncelle
                loadFeaturedProducts().then(() => {
                    showNotification('Öne çıkan ürünler güncellendi', 'success', 2000);
                });
                
                // Tüm ürün kartlarını da güncelle
                updateAllProductCards();
                
                // Kategori sayfasındaysa kategori ürünlerini de güncelle
                const currentCategory = getCurrentCategory();
                if (currentCategory) {
                    loadCategoryProducts(currentCategory);
                }
                
                showNotification('Ürünler güncellendi', 'success', 2000);
            }
        });
        
    } catch (error) {
        console.log('BroadcastChannel not supported, using localStorage only');
    }
}

function stopFeaturedProductsPolling() {
    if (featuredProductsPollingInterval) {
        clearInterval(featuredProductsPollingInterval);
        featuredProductsPollingInterval = null;
    }
}

// Setup immediate update listeners for admin changes
function setupImmediateUpdateListeners() {
    // Kategori güncelleme event'ini dinle
    document.addEventListener('categoryUpdate', (event) => {
        const category = event.detail.category;
        console.log(`🔄 Kategori güncelleme event'i alındı: ${category}`);
        
        // Kategori ürünlerini yeniden yükle
        if (category && category !== 'search') {
            loadCategoryProducts(category);
        }
    });
    
    // Listen for BroadcastChannel messages for featured products - ürünler için de kullan
    if (typeof BroadcastChannel !== 'undefined') {
        const featuredChannel = new BroadcastChannel('featuredProductsChannel');
        featuredChannel.addEventListener('message', (event) => {
            if (event.data.type === 'update') {
                console.log('Received immediate update signal from admin panel (öne çıkan ürünlerdeki gibi)');
                setTimeout(() => {
                    // Öne çıkan ürünleri güncelle
                    loadFeaturedProducts().then(() => {
                        showNotification('Öne çıkan ürünler güncellendi', 'success', 2000);
                    });
                    
                    // Tüm ürün kartlarını da güncelle
                    updateAllProductCards();
                    
                    // Kategori sayfasındaysa kategori ürünlerini de güncelle
                    const currentCategory = getCurrentCategory();
                    if (currentCategory) {
                        loadCategoryProducts(currentCategory);
                    }
                    
                    showNotification('Ürünler güncellendi', 'success', 2000);
                }, 500); // Small delay to ensure database is updated
            }
        });
    }
    
    // Listen for localStorage changes (fallback)
    let lastFeaturedUpdateTime = localStorage.getItem('featuredProductsUpdate') || '0';
    
    setInterval(() => {
        // Check for featured products updates (ürünler için de kullan)
        const currentFeaturedUpdateTime = localStorage.getItem('featuredProductsUpdate') || '0';
        if (currentFeaturedUpdateTime !== lastFeaturedUpdateTime && currentFeaturedUpdateTime !== '0') {
            console.log('Detected featured products localStorage update signal (ürünler için de kullanılıyor)');
            lastFeaturedUpdateTime = currentFeaturedUpdateTime;
            setTimeout(() => {
                // Öne çıkan ürünleri güncelle
                loadFeaturedProducts().then(() => {
                    showNotification('Öne çıkan ürünler güncellendi', 'success', 2000);
                });
                
                // Tüm ürün kartlarını güncelle
                updateAllProductCards();
                
                // Kategori sayfasındaysa kategori ürünlerini de güncelle
                const currentCategory = getCurrentCategory();
                if (currentCategory) {
                    loadCategoryProducts(currentCategory);
                }
                
                showNotification('Ürünler güncellendi', 'success', 2000);
            }, 500);
        }
        

    }, 1000); // Check every second
}

// Get current category helper
function getCurrentCategory() {
    // URL'den kategori bilgisini al
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    
    // Eğer URL'de kategori yoksa, mevcut sayfa durumuna bak
    if (!category) {
        const productsSection = document.getElementById('products');
        if (productsSection && productsSection.style.display !== 'none') {
            const title = productsSection.querySelector('h2');
            if (title) {
                // Başlıktan kategori bilgisini çıkar
                const titleText = title.textContent.toLowerCase();
                if (titleText.includes('valorant')) return 'valorant';
                if (titleText.includes('lol') || titleText.includes('league')) return 'lol';
                if (titleText.includes('steam')) return 'steam';
            }
        }
    }
    
    return category;
}

// Canlı fiyat güncelleme fonksiyonu
async function updateAllProductCards() {
    try {
        console.log('🔄 Tüm ürün kartları güncelleniyor...');
        
        // Önce API'den güncel ürün verilerini al
        const response = await fetch('/api/products?cachebust=' + Date.now(), {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.error('❌ Ürün verileri alınamadı:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        console.log('📡 API Response:', data);
        
        if (!data.ok || !data.items) {
            console.error('❌ Geçersiz ürün verisi:', data);
            return;
        }
        
        const updatedProducts = data.items;
        console.log('📦 Güncel ürün verileri alındı:', updatedProducts.length, 'ürün');
        console.log('📦 Ürün detayları:', updatedProducts.map(p => ({ id: p.id, name: p.name, price: p.price, discount: p.discount })));
        
        // Tüm ürün kartlarını bul ve güncelle (hem ana sayfa hem kategori sayfası)
        const allProductCards = document.querySelectorAll('.product-card, #products .product-card, .products-grid .product-card');
        console.log('🔍 Bulunan ürün kartları:', allProductCards.length);
        
        // Hangi selector'ların ürün kartı bulduğunu kontrol et
        console.log('🔍 Selector testleri:');
        console.log('  .product-card:', document.querySelectorAll('.product-card').length);
        console.log('  #products .product-card:', document.querySelectorAll('#products .product-card').length);
        console.log('  .products-grid .product-card:', document.querySelectorAll('.products-grid .product-card').length);
        console.log('  #products:', document.getElementById('products'));
        console.log('  .products-grid:', document.querySelector('.products-grid'));
        
        if (allProductCards.length === 0) {
            console.warn('⚠️ Hiç ürün kartı bulunamadı!');
            return;
        }
        
        let updatedCount = 0;
        
        allProductCards.forEach((card, index) => {
            console.log(`🔍 Kart ${index + 1} işleniyor...`);
            
            // Ürün ID'sini bul
            const addToCartBtn = card.querySelector('.add-to-cart');
            if (!addToCartBtn) {
                console.log(`⚠️ Kart ${index + 1}: Add to cart butonu bulunamadı`);
                return;
            }
            
            // Ürün ID'sini data attribute'dan al
            let productId = addToCartBtn.dataset.productId;
            console.log(`🔍 Kart ${index + 1}: Data product ID:`, productId);
            
            // Eğer data attribute yoksa, ürün adından bul
            if (!productId) {
                const productName = card.querySelector('h3')?.textContent;
                console.log(`🔍 Kart ${index + 1}: Ürün adından ID bulunuyor:`, productName);
                if (productName) {
                    const product = updatedProducts.find(p => p.name === productName);
                    if (product) {
                        productId = product.id;
                        console.log(`🔍 Kart ${index + 1}: Ürün adından ID bulundu:`, productId);
                    }
                }
            }
            
            if (!productId) {
                console.log('⚠️ Ürün ID bulunamadı:', card.querySelector('h3')?.textContent);
                return;
            }
            
            // Güncel ürün verisini bul
            const updatedProduct = updatedProducts.find(p => p.id == productId);
            if (!updatedProduct) {
                console.log(`⚠️ Ürün ID ${productId} için güncel veri bulunamadı`);
                return;
            }
            
            console.log(`🔍 Kart ${index + 1}: Güncel ürün verisi:`, {
                id: updatedProduct.id,
                name: updatedProduct.name,
                price: updatedProduct.price,
                discount: updatedProduct.discount
            });
            
            // Fiyat bilgilerini güncelle
            const priceContainer = card.querySelector('.price');
            if (priceContainer) {
                // Fiyat kuruş cinsinden gelir, TL'ye çevir
                const priceInTL = (updatedProduct.price || 0) / 100;
                const finalPrice = updatedProduct.discount > 0 ? 
                    priceInTL * (1 - updatedProduct.discount / 100) : priceInTL;
                
                let newPriceHtml = '';
                if (updatedProduct.discount > 0) {
                    newPriceHtml = `
                        <span class="old-price">₺${priceInTL.toFixed(0)}</span>
                        <span class="current-price">₺${finalPrice.toFixed(0)}</span>
                    `;
                } else {
                    newPriceHtml = `<span class="current-price">₺${priceInTL.toFixed(0)}</span>`;
                }
                
                console.log(`💰 Kart ${index + 1}: Mevcut fiyat HTML:`, priceContainer.innerHTML);
                console.log(`💰 Kart ${index + 1}: Yeni fiyat HTML:`, newPriceHtml);
                
                // Sadece fiyat değiştiyse güncelle
                if (priceContainer.innerHTML !== newPriceHtml) {
                    priceContainer.innerHTML = newPriceHtml;
                    console.log(`💰 Ürün ${updatedProduct.id} fiyatı güncellendi: ${updatedProduct.price}₺ → ${finalPrice.toFixed(0)}₺`);
                    updatedCount++;
                } else {
                    console.log(`💰 Kart ${index + 1}: Fiyat zaten güncel`);
                }
            } else {
                console.log(`⚠️ Kart ${index + 1}: Fiyat container bulunamadı`);
            }
            
            // İndirim badge'ini güncelle
            const badgeContainer = card.querySelector('.discount-badge');
            if (updatedProduct.discount > 0) {
                if (!badgeContainer) {
                    // Badge yoksa ekle
                    const productImage = card.querySelector('.product-image');
                    if (productImage) {
                        const newBadge = document.createElement('div');
                        newBadge.className = 'discount-badge';
                        newBadge.textContent = `-${updatedProduct.discount}%`;
                        productImage.appendChild(newBadge);
                        console.log(`🏷️ Ürün ${updatedProduct.id} için indirim badge'i eklendi: %${updatedProduct.discount}`);
                        updatedCount++;
                    } else {
                        console.log(`⚠️ Kart ${index + 1}: Product image bulunamadı`);
                    }
                } else {
                    // Mevcut badge'i güncelle (sadece değiştiyse)
                    if (badgeContainer.textContent !== `-${updatedProduct.discount}%`) {
                        badgeContainer.textContent = `-${updatedProduct.discount}%`;
                        console.log(`🏷️ Ürün ${updatedProduct.id} indirim badge'i güncellendi: %${updatedProduct.discount}`);
                        updatedCount++;
                    } else {
                        console.log(`🏷️ Kart ${index + 1}: Badge zaten güncel`);
                    }
                }
            } else {
                // İndirim yoksa badge'i kaldır
                if (badgeContainer) {
                    badgeContainer.remove();
                    console.log(`🏷️ Ürün ${updatedProduct.id} indirim badge'i kaldırıldı`);
                    updatedCount++;
                }
            }
            
            // Ürün adını güncelle (eğer değiştiyse)
            const nameElement = card.querySelector('h3');
            if (nameElement && nameElement.textContent !== updatedProduct.name) {
                nameElement.textContent = updatedProduct.name;
                console.log(`📝 Ürün ${updatedProduct.id} adı güncellendi: ${nameElement.textContent} → ${updatedProduct.name}`);
                updatedCount++;
            }
            
            // Platform/kategori bilgisini güncelle
            const platformElement = card.querySelector('.platform span');
            if (platformElement) {
                const newPlatform = updatedProduct.category || updatedProduct.platform || 'Genel';
                if (platformElement.textContent !== newPlatform) {
                    platformElement.textContent = newPlatform;
                    console.log(`🎮 Ürün ${updatedProduct.id} platformu güncellendi: ${platformElement.textContent} → ${newPlatform}`);
                    updatedCount++;
                }
            }
        });
        
        console.log(`✅ Güncelleme tamamlandı. ${updatedCount} değişiklik yapıldı.`);
        showNotification(`Ürün fiyatları güncellendi (${updatedCount} değişiklik)`, 'success', 3000);
        
    } catch (error) {
        console.error('❌ Ürün kartları güncellenirken hata:', error);
        showNotification('Fiyat güncelleme hatası', 'error', 3000);
    }
}

// Test fonksiyonu - Manuel fiyat güncelleme testi için
window.testPriceUpdate = function() {
    console.log('🧪 Manuel fiyat güncelleme testi başlatılıyor...');
    updateAllProductCards();
};

// Show notification helper
function showNotification(message, type = 'info', duration = 5000) {
    // Create notification element if it doesn't exist
    let notificationContainer = document.getElementById('realtime-notifications');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'realtime-notifications';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: var(--bg-secondary);
        color: var(--text-primary);
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid ${type === 'info' ? 'var(--info-color)' : 'var(--success-color)'};
        font-size: 14px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        pointer-events: auto;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-${type === 'info' ? 'info-circle' : 'check-circle'}" style="color: ${type === 'info' ? 'var(--info-color)' : 'var(--success-color)'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after duration
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Search functionality
function performSearch() {
  const searchTerm = document.getElementById('searchInput').value.trim();
  
  if (!searchTerm) {
    showToast('warning', 'Lütfen arama yapmak istediğiniz kelimeyi girin');
    return;
  }
  
  // Build search parameters
  const params = new URLSearchParams();
  params.append('search', searchTerm);
  
  // Perform search
  searchProducts(params.toString());
}

async function searchProducts(queryString) {
  try {
    const response = await fetch(`/api/products?${queryString}`);
    if (!response.ok) throw new Error('Arama başarısız');
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Display search results
      displaySearchResults(data.items);
      showToast('success', `${data.total} ürün bulundu`);
    } else {
      showToast('info', 'Arama kriterlerinize uygun ürün bulunamadı');
      // Show all products or empty state
      displaySearchResults([]);
    }
    
  } catch (error) {
    console.error('Search error:', error);
    showToast('error', 'Arama sırasında hata oluştu');
  }
}

function displaySearchResults(products) {
  const productsContainer = document.querySelector('.products-grid') || document.querySelector('#products');
  
  if (!productsContainer) {
    console.warn('Products container not found');
    return;
  }
  
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="no-results">
        <i class="fas fa-search" style="font-size: 48px; color: #666; margin-bottom: 20px;"></i>
        <h3>Arama sonucu bulunamadı</h3>
        <p>Arama kriterlerinizi değiştirmeyi deneyin</p>
      </div>
    `;
    return;
  }
  
  // Clear existing products
  productsContainer.innerHTML = '';
  
  // Add search results
  products.forEach(product => {
    const productCard = createProductCard(product);
    productsContainer.appendChild(productCard);
  });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card scale-in animate';
    
    // Fiyat kuruş cinsinden gelir, TL'ye çevir
    const priceInTL = (product.price || 0) / 100;
    const finalPrice = product.discount > 0 ? 
        priceInTL * (1 - product.discount / 100) : priceInTL;
    
    // Debug: Fiyat hesaplaması
    console.log('Fiyat hesaplaması:', {
        name: product.name,
        originalPrice: product.price,
        priceInTL: priceInTL,
        discount: product.discount,
        finalPrice: finalPrice
    });
    
    // Fiyat hesaplaması tamamlandı
    
    // Fiyat hesaplaması tamamlandı
    
    // Görseli kategoriye göre seç
    const categoryName = String(product.category || product.platform || '').toLowerCase();
    const level = String(product.package_level || '').toLowerCase();
    let imgSrc = 'vp.png'; // Varsayılan
    
    // Önce product.image_url varsa onu kullan
    if (product.image_url) {
        imgSrc = product.image_url;
        console.log('🖼️ Resim URL kullanılıyor:', product.name, '→', imgSrc);
    } else if (categoryName === 'valorant' || product.name.includes('Valorant')) {
        imgSrc = level === 'high' ? 'vp2.png' : level === 'medium' ? 'vp1.png' : 'vp.png';
    } else if (categoryName === 'lol' || product.name.includes('League')) {
        // LoL rastgele paketleri için farklı görseller
        if (['low', 'medium', 'high'].includes(level)) {
            imgSrc = level === 'high' ? 'rp3.png' : level === 'medium' ? 'rp2.png' : 'rpex.png';
        } else {
            imgSrc = 'rp.png'; // Normal LoL ürünleri için
        }
    } else if (categoryName === 'steam') {
        // Steam rastgele paketleri için farklı görseller
        if (['low', 'medium', 'high'].includes(level)) {
            imgSrc = level === 'high' ? 'st2.png' : level === 'medium' ? 'st1.png' : 'st.png';
        } else {
            imgSrc = 'st.png'; // Normal Steam ürünleri için
        }
    }
    
    let badgeHtml = '';
    if (product.discount > 0) {
        badgeHtml = `<div class="discount-badge">-${product.discount}%</div>`;
    }
    if (product.isVirtual) {
        badgeHtml += `<div class="new-badge" style="right:auto;left:8px;">Özel Paket</div>`;
    }
    
    // Ürün ismini i18n ile çevir
    let productName = product.name;
    if (categoryName === 'valorant' && ['low', 'medium', 'high'].includes(level)) {
        productName = `<span data-i18n="products.valorant.${level}">${product.name}</span>`;
    } else if (categoryName === 'lol' && ['low', 'medium', 'high'].includes(level)) {
        productName = `<span data-i18n="products.lol.${level}">${product.name}</span>`;
    } else if (categoryName === 'steam' && ['low', 'medium', 'high'].includes(level)) {
        productName = `<span data-i18n="products.steam.${level}">${product.name}</span>`;
    } else if (categoryName === 'steam' && product.name.toLowerCase().includes('cüzdan')) {
        // Steam cüzdan kodları için USD değerini çıkar
        const usdMatch = product.name.match(/(\d+)\s*USD/);
        if (usdMatch) {
            const usdValue = usdMatch[1];
            productName = `<span data-i18n="products.steam.wallet.${usdValue}">${product.name}</span>`;
        }
    }

    // Ürün açıklamasını i18n ile çevir veya description_en kullan
    let productDescription = product.description;
    const currentLang = localStorage.getItem('language') || 'tr';
    
    if (categoryName === 'valorant' && ['low', 'medium', 'high'].includes(level)) {
        productDescription = `<span data-i18n="descriptions.valorant.${level}">${product.description || ''}</span>`;
    } else if (categoryName === 'lol' && ['low', 'medium', 'high'].includes(level)) {
        productDescription = `<span data-i18n="descriptions.lol.${level}">${product.description || ''}</span>`;
    } else if (categoryName === 'steam' && ['low', 'medium', 'high'].includes(level)) {
        productDescription = `<span data-i18n="descriptions.steam.${level}">${product.description || ''}</span>`;
    } else if (categoryName === 'steam' && product.name.toLowerCase().includes('cüzdan')) {
        // Steam cüzdan kodları için USD değerini çıkar
        const usdMatch = product.name.match(/(\d+)\s*USD/);
        if (usdMatch) {
            const usdValue = usdMatch[1];
            productDescription = `<span data-i18n="descriptions.steam.wallet.${usdValue}">${product.description || ''}</span>`;
        }
    } else if (level === 'exclusive' && product.description_en && currentLang === 'en') {
        // Steam exclusive oyunlar için İngilizce açıklama
        productDescription = product.description_en;
    }

    card.innerHTML = `
        <div class="product-image">
            <img src="${imgSrc}" alt="${product.name}" onerror="this.onerror=null; this.src='vp.png';" style="width:100%;height:100%;object-fit:cover;display:block;">
            ${badgeHtml}
        </div>
        <div class="product-info">
            <h3>${productName}</h3>
            <div class="platform">
                <i class="fas fa-gamepad"></i>
                <span>${product.category || 'Genel'}</span>
            </div>
            ${productDescription ? `<div class="product-description" style="font-size: 11px; color: #888; margin: 6px 0; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${productDescription}</div>` : ''}
            <div class="price">
                ${product.discount > 0 ? `<span class="old-price">₺${Math.round(priceInTL)}</span>` : ''}
                <span class="current-price">₺${Math.round(finalPrice)}</span>
            </div>
            <div class="product-actions">
                <button class="add-to-cart" data-i18n="products.addtocart">Sepete Ekle</button>
                <button class="fav-btn" data-product-id="${product.id || ''}" aria-label="Favorilere ekle">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    
    // Event listener'ları ekle
    const addToCartBtn = card.querySelector('.add-to-cart');
    const favBtn = card.querySelector('.fav-btn');
    const isVirtual = !!product.isVirtual || product.id == null;
    
    if (addToCartBtn) {
        if (isVirtual) {
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = 'Yakında';
            addToCartBtn.title = 'Bu paket admin tarafından tanımlanmalı';
        } else {
            addToCartBtn.dataset.productId = product.id;
            addToCartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                addToCart(product.id);
            }, { once: false });
        }
    }
    
    if (favBtn) {
        if (!isVirtual) {
            favBtn.dataset.productId = product.id;
            favBtn.addEventListener('click', () => toggleFavorite(product.id, favBtn));
        } else {
            favBtn.style.display = 'none';
        }
    }
    
    // i18n çevirisini tetikle
    if (window.i18n && window.i18n.translateElement) {
        window.i18n.translateElement(card);
    }
    
    return card;
}

// Prevent rapid double-clicks on add to cart
let addToCartInProgress = false;

async function addToCart(productId, quantity = 1) {
  // Prevent double-click
  if (addToCartInProgress) {
    console.log('Add to cart already in progress, ignoring duplicate click');
    return;
  }
  
  // Giriş yapılmış mı kontrol et
  if (!window.authManager?.isLoggedIn()) {
    showToast('warning', 'Sepete eklemek için giriş yapın');
    openLoginModal();
    return;
  }
  
  addToCartInProgress = true;
  
  try {
    // Öne çıkan ürün ID'lerini normal ürün ID'leriyle eşleştir
    const featuredToNormalIdMap = {
      57: 56,  // Cyberpunk 2077 → Cyberpunk 2077
      58: 12,  // Valorant 3650 VP → Valorant 3650 VP  
      59: 58,  // Elden Ring → Elden Ring (ID: 58)
      60: 40,  // Steam Oyun Kodu (Düşük Paket) → Steam Oyun Kodu (Düşük Paket)
      61: 30,  // League of Legends 2800 RP → League of Legends 2800 RP
      62: 41   // Steam Oyun Kodu (Orta Paket) → Steam Oyun Kodu (Orta Paket)
    };
    
    // Eşleştirme varsa normal ürün ID'sini kullan
    const actualProductId = featuredToNormalIdMap[productId] || productId;
    
    // Ürün bilgilerini API'den al
    const response = await fetch(`/api/products/${actualProductId}`);
    if (!response.ok) {
      throw new Error('Ürün bulunamadı');
    }
    
    const product = await response.json();
    
    // Fiyatı hesapla (indirim varsa uygula)
    let priceInTL = product.price;
    if (product.discount && product.discount > 0) {
      priceInTL = priceInTL * (1 - product.discount / 100);
    }
    
    // ShoppingCart class'ına ekle
    if (window.shoppingCart) {
      // Gerçek product kartını bul
      const allProductCards = document.querySelectorAll('.product-card');
      let realProductCard = null;
      
      for (const card of allProductCards) {
        const addBtn = card.querySelector('.add-to-cart');
        if (addBtn && addBtn.dataset.productId == productId) {
          realProductCard = card;
          break;
        }
      }
      
      if (realProductCard) {
        // Gerçek kartı kullan - doğru bilgileri alır, productId'yi de geç
        console.log('Gerçek kart bulundu, sepete ekleniyor:', product.name);
        window.shoppingCart.addToCart(realProductCard, productId);
      } else {
        // Gerçek kart bulunamazsa, manuel olarak ürünü ekle
        console.log('Product card not found, adding manually for:', product.name);
        const manualProduct = {
          id: Date.now(), // Unique cart item ID
          product_id: productId, // Real product ID
          name: product.name,
          price: Math.round(priceInTL),
          platform: product.category || 'Genel',
          image: 'fas fa-gamepad'
        };
        window.shoppingCart.items.push(manualProduct);
        window.shoppingCart.saveCart();
        window.shoppingCart.updateCartUI();
        showToast('success', 'Ürün sepete eklendi');
        
        // Confetti animasyonu
        try {
          const cartIcon = document.querySelector('.cart-icon');
          if (cartIcon) {
            const r = cartIcon.getBoundingClientRect();
            confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
          }
        } catch {}
      }
    }
    
    // Update cart badge to reflect ShoppingCart items
    updateCartBadge();
    
  } catch (error) {
    console.error('Sepete eklenirken hata:', error);
    showToast('error', 'Ürün sepete eklenemedi');
  } finally {
    // Reset flag after 500ms to allow next add
    setTimeout(() => {
      addToCartInProgress = false;
    }, 500);
  }
}

function removeFromCart(itemId) {
  // Redirect to ShoppingCart class method
  if (window.shoppingCart) {
    window.shoppingCart.removeFromCart(itemId);
  }
}

function updateCartBadge() {
  const el = document.querySelector('.cart-count');
  if (el) {
    // Use ShoppingCart.items (the actual visible cart)
    const count = window.shoppingCart ? window.shoppingCart.items.length : 0;
    el.textContent = String(count);
  }
}

async function createOrder() {
  try {
    if (!window.authManager?.isLoggedIn()) {
      showToast('warning', 'Sipariş için giriş yapın');
      return null;
    }
    
    // Use ShoppingCart items
    if (!window.shoppingCart || !window.shoppingCart.items.length) {
      showToast('warning', 'Sepetiniz boş');
      return null;
    }
    
    // Convert ShoppingCart items to order format
    // Note: ShoppingCart uses { id, product_id, name, price, platform, image }
    // We need { product_id, quantity } for backend
    const orderItems = window.shoppingCart.items.map(item => ({
      product_id: item.product_id || item.id, // Use real product_id if available
      quantity: 1,
      price: item.price
    }));
    
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ items: orderItems })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'order_failed');
    return data.order;
  } catch (e) {
    console.error('Create order error:', e);
    showToast('error', 'Sipariş oluşturulamadı');
    return null;
  }
}

async function startPayment(order) {
  try {
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ order_id: order.id })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'payment_init_failed');

    // If iyzico, inject checkout form content and open modal
    if (data.provider === 'iyzico' && data.checkoutFormContent) {
      const container = document.getElementById('iyzicoCheckoutContainer');
      if (container) {
        container.innerHTML = data.checkoutFormContent;
        openModal('paymentModal');
      }
      return true;
    }
    // mock fallback
    if (data.provider === 'mock') {
      await verifyPayment(data.payment_id, 'succeeded');
      return true;
    }
    return false;
  } catch (e) {
    console.error('Start payment error:', e);
    showToast('error', 'Ödeme başlatılamadı');
    return false;
  }
}

async function verifyPayment(paymentId, status) {
  try {
    const res = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ payment_id: paymentId, status })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error('payment_verify_failed');
    showToast('success', 'Ödeme tamamlandı');
    
    // Clear ShoppingCart
    if (window.shoppingCart) {
      window.shoppingCart.items = [];
      window.shoppingCart.saveCart();
      window.shoppingCart.updateCartUI();
    }
    updateCartBadge();
  } catch (e) {
    console.error('Verify payment error:', e);
    showToast('error', 'Ödeme doğrulanamadı');
  }
}

async function checkout() {
  const order = await createOrder();
  if (!order) return;
  const ok = await startPayment(order);
  if (ok) {
    try {
      // Optional: Refresh notifications or order history
      if (typeof loadNotifications === 'function') loadNotifications();
    } catch (_) {}
  }
}

// My Orders and Codes
async function loadMyOrders() {
  if (!window.authManager?.isLoggedIn()) {
    showToast('warning', 'Siparişleri görmek için giriş yapın');
    return;
  }
  const container = document.getElementById('ordersList');
  container.innerHTML = '<div class="skeleton">Yükleniyor...</div>';
  try {
    const res = await fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error('orders_failed');
    if (items.length === 0) {
      container.innerHTML = '<p>Henüz siparişiniz yok.</p>';
      return;
    }
    container.innerHTML = items.map(o => `
      <div class="order-card">
        <div class="order-head">
          <strong>#${o.id}</strong>
          <span>${new Date(o.created_at).toLocaleString('tr-TR')}</span>
          <span class="status-badge ${o.status}">${o.status}</span>
        </div>
        <div class="order-actions">
          <button class="btn" onclick="loadOrderCodes(${o.id}, this)"><i class="fas fa-key"></i> Kodları Gör</button>
          <button class="btn" onclick="loadOrderTracking(${o.id}, this)"><i class="fas fa-shipping-fast"></i> Takip</button>
        </div>
        <div class="order-details" id="orderCodes_${o.id}" style="display:none;"></div>
        <div class="order-tracking" id="orderTrack_${o.id}" style="display:none;"></div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = '<p>Siparişler yüklenemedi.</p>';
  }
}

async function loadOrderCodes(orderId, btn) {
  const box = document.getElementById(`orderCodes_${orderId}`);
  const visible = box.style.display === 'block';
  box.style.display = visible ? 'none' : 'block';
  if (visible) return;
  box.innerHTML = 'Yükleniyor...';
  try {
    const res = await fetch(`/api/orders/${orderId}/codes`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!data.ok) throw new Error('codes_failed');
    if (data.total === 0) { box.innerHTML = '<em>Bu sipariş için kod bulunamadı.</em>'; return; }
    box.innerHTML = '<ul class="codes-list">' + data.items.map(it => `<li><strong>${it.product_name || it.product_id}:</strong> <code>${it.code}</code></li>`).join('') + '</ul>';
  } catch (e) {
    box.innerHTML = 'Kodlar yüklenemedi';
  }
}

async function loadOrderTracking(orderId, btn) {
  const box = document.getElementById(`orderTrack_${orderId}`);
  const visible = box.style.display === 'block';
  box.style.display = visible ? 'none' : 'block';
  if (visible) return;
  box.innerHTML = 'Yükleniyor...';
  try {
    const res = await fetch(`/api/orders/${orderId}/tracking`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!data.ok) throw new Error('tracking_failed');
    if (!data.tracking_history || data.tracking_history.length === 0) { box.innerHTML = '<em>Takip kaydı yok.</em>'; return; }
    box.innerHTML = '<ul class="tracking-list">' + data.tracking_history.map(it => `<li><span>${new Date(it.created_at).toLocaleString('tr-TR')}</span> — ${it.status}: ${it.message || ''}</li>`).join('') + '</ul>';
  } catch (e) {
    box.innerHTML = 'Takip bilgisi yüklenemedi';
  }
}

// Open orders modal and load data
document.addEventListener('click', (e) => {
  const el = e.target.closest('.orders-icon');
  if (el) {
    if (!window.authManager?.isLoggedIn()) { showToast('warning', 'Giriş yapın'); return; }
    openModal('ordersModal');
    loadMyOrders();
  }
});

// Profile dropdown: open orders and favorites
document.addEventListener('click', (e) => {
  const ordersLink = e.target.closest('#openOrdersFromProfile');
  if (ordersLink) {
    e.preventDefault();
    if (!window.authManager?.isLoggedIn()) { showToast('warning', 'Giriş yapın'); return; }
    openModal('ordersModal');
    loadMyOrders();
  }
  const favLink = e.target.closest('#openFavoritesFromProfile');
  if (favLink) {
    e.preventDefault();
    if (!window.authManager?.isLoggedIn()) { showToast('warning', 'Giriş yapın'); return; }
    // Navigate to favorites page section
    openFavoritesPage();
  }
});

async function toggleFavorite(productId, btnEl) {
  try {
    if (!window.authManager?.isLoggedIn()) { 
      showToast('warning', 'Favori eklemek için giriş yapın'); 
      openLoginModal();
      return; 
    }
    
    const token = localStorage.getItem('token');
    
    // Öne çıkan ürün ID'lerini normal ürün ID'leriyle eşleştir
    const featuredToNormalIdMap = {
      57: 56,  // Cyberpunk 2077 → Cyberpunk 2077
      58: 12,  // Valorant 3650 VP → Valorant 3650 VP  
      59: 58,  // Elden Ring → Elden Ring (ID: 58)
      60: 40,  // Steam Oyun Kodu (Düşük Paket) → Steam Oyun Kodu (Düşük Paket)
      61: 30,  // League of Legends 2800 RP → League of Legends 2800 RP
      62: 41   // Steam Oyun Kodu (Orta Paket) → Steam Oyun Kodu (Orta Paket)
    };
    
    // Eşleştirme varsa normal ürün ID'sini kullan
    const actualProductId = featuredToNormalIdMap[productId] || productId;
    
    const isFav = btnEl?.classList?.contains('favorited');
    console.log('Favori durumu:', isFav, 'Product ID:', productId, 'Actual ID:', actualProductId);
    const url = '/api/favorites/' + encodeURIComponent(actualProductId);
    const res = await fetch(url, {
      method: isFav ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      // 401 hatası durumunda sessizce geç, diğer hatalar için mesaj göster
      if (res.status === 401) {
        return;
      }
      throw new Error('Favori işlemi başarısız');
    }
    
    const data = await res.json().catch(() => ({}));
    if (!data?.ok) { showToast('error', 'Favori işlemi başarısız'); return; }
    
    btnEl?.classList?.toggle('favorited');
    showToast('success', isFav ? 'Favoriden çıkarıldı' : 'Favorilere eklendi');
    
    // Favoriler sayfasında ise listeyi yenile
    if (document.getElementById('favoritesPage').style.display !== 'none') {
      loadFavoritesIntoFavoritesGrid();
    }
  } catch (e) {
    showToast('error', 'Ağ hatası');
  }
}

function showSection(elId) {
  // hide all top-level sections by default
  document.querySelectorAll('body > section').forEach(sec => { sec.style.display = 'none'; });
  // also hide footer for dedicated pages
  const footer = document.querySelector('.footer');
  if (footer) footer.style.display = 'none';
  // show requested section
  const target = document.getElementById(elId);
  if (target) target.style.display = '';
  // show footer only on main pages (not for favorites)
  if (elId !== 'favoritesPage' && footer) footer.style.display = '';
}

// Ana sayfaya dönüş fonksiyonu
function goToHomePage() {
  console.log('Ana sayfaya dönülüyor...');
  
  // Favoriler sayfasını gizle
  const favoritesPage = document.getElementById('favoritesPage');
  if (favoritesPage) {
    favoritesPage.style.display = 'none';
    console.log('Favoriler sayfası gizlendi');
  }

  // Tüm ana sayfa bölümlerini göster (varsayılan düzen)
  // Varsayılan CSS düzenine bırak (display='')
  const selectors = ['.hero', '.categories', '#products', '.features', '#faq', '#contact'];
  selectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = '';
  });

  // Ürünler başlığını sıfırla ve öne çıkanları yükle
  const productsSection = document.getElementById('products');
  const productsTitle = productsSection?.querySelector('h2');
  if (productsTitle) productsTitle.textContent = 'Öne Çıkan Ürünler';
  try { loadFeaturedProducts && loadFeaturedProducts(); } catch {}
  
  // Footer'ı göster
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.style.display = 'block';
    console.log('Footer gösterildi');
  }
  
  // Sayfayı en üste kaydır
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log('Ana sayfaya dönüş tamamlandı');
}

async function openFavoritesPage() {
  console.log('Favoriler sayfası açılıyor...');
  
  // Favoriler sayfasını göster
  const favoritesPage = document.getElementById('favoritesPage');
  if (favoritesPage) {
    favoritesPage.style.display = 'block';
    console.log('Favoriler sayfası gösterildi');
  }
  
  // Ana sayfa bölümlerini gizle (sadece favoriler kalsın)
  const mainSections = ['products', 'faq', 'contact'];
  mainSections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
      console.log(`${sectionId} bölümü gizlendi`);
    }
  });
  
  // Hero ve categories bölümlerini de gizle
  const heroSection = document.querySelector('.hero');
  if (heroSection) {
    heroSection.style.display = 'none';
    console.log('Hero bölümü gizlendi');
  }
  
  const categoriesSection = document.querySelector('.categories');
  if (categoriesSection) {
    categoriesSection.style.display = 'none';
    console.log('Categories bölümü gizlendi');
  }
  
  // Footer'ı gizle
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.style.display = 'none';
    console.log('Footer gizlendi');
  }
  
  await loadFavoritesIntoFavoritesGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log('Favoriler sayfası açıldı');
}

function createFavoriteProductCard(product) {
  console.log('Favori ürün verisi:', product);
  
  // Fiyat hesaplaması - ana sayfadaki gibi
  const priceInTL = (product.price || 0) / 100;
  const finalPrice = product.discount > 0 ? 
      priceInTL * (1 - product.discount / 100) : priceInTL;
  
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <div class="product-image">
      <img src="${(() => {
        // Ana sayfadaki resim mantığını kullan
        if (product.image_url) {
          return product.image_url;
        }
        
        const categoryName = String(product.category || product.platform || '').toLowerCase();
        const level = String(product.package_level || '').toLowerCase();
        
        if (categoryName === 'valorant' || product.name.includes('Valorant')) {
          return level === 'high' ? 'vp2.png' : level === 'medium' ? 'vp1.png' : 'vp.png';
        } else if (categoryName === 'lol' || product.name.includes('League')) {
          if (['low', 'medium', 'high'].includes(level)) {
            return level === 'high' ? 'rp3.png' : level === 'medium' ? 'rp2.png' : 'rpex.png';
          } else {
            return 'rp.png';
          }
        } else if (categoryName === 'steam') {
          if (['low', 'medium', 'high'].includes(level)) {
            return level === 'high' ? 'st2.png' : level === 'medium' ? 'st1.png' : 'st.png';
          } else {
            return 'st.png';
          }
        } else {
          return '/logo.png';
        }
      })()}" alt="${product.name}" loading="lazy">
      <div class="product-overlay">
        <button class="fav-btn favorited" data-product-id="${product.id}">
          <i class="fas fa-heart"></i>
        </button>
      </div>
    </div>
    <div class="product-info">
      <h3 class="product-title">${product.name}</h3>
      <div class="price">
        ${product.discount > 0 ? `<span class="old-price">₺${priceInTL.toFixed(0)}</span>` : ''}
        <span class="current-price">₺${finalPrice.toFixed(0)}</span>
      </div>
      <button class="add-to-cart" data-product-id="${product.id}">
        <i class="fas fa-shopping-cart"></i>
        Sepete Ekle
      </button>
    </div>
  `;
  
  // Event listeners ekle
  const favBtn = card.querySelector('.fav-btn');
  if (favBtn) {
    favBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await toggleFavorite(product.id, favBtn);
    });
  }
  
  const addToCartBtn = card.querySelector('.add-to-cart');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Sepete eklenen ürün ID:', product.id, 'Ürün adı:', product.name);
      addToCart(product.id);
    });
  }
  
  return card;
}

async function loadFavoritesIntoFavoritesGrid() {
  try {
    const token = localStorage.getItem('token');
    console.log('Favoriler yükleniyor, token:', token ? 'var' : 'yok');
    console.log('Token değeri:', token);

    console.log('Favoriler API çağrısı yapılıyor...');
    const res = await fetch('/api/favorites', {
      headers: {
        'Authorization': `Bearer ${token || ''}`
      }
    });
    
    console.log('Favoriler API yanıtı:', res.status, res.ok);
    
    if (!res.ok) {
      if (res.status === 401) {
        // Token geçersiz, sadece hata mesajı göster
        showToast('error', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      showToast('error', 'Favoriler yüklenemedi');
      return;
    }
    
    const data = await res.json();
    console.log('Favoriler verisi:', data);
    
    if (!data.ok) {
      showToast('error', data.message || 'Favoriler yüklenemedi');
      return;
    }
    
    const productsContainer = document.querySelector('#favoritesPage .favorites-grid');
    if (!productsContainer) {
      console.error('Favorites grid container bulunamadı');
      return;
    }
    
    // Clear existing content
    productsContainer.innerHTML = '';
    
    const items = data.items || [];
    console.log('Favoriler sayısı:', items.length);
    
    if (items.length === 0) {
      productsContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Henüz favori ürününüz yok.</p>';
      return;
    }
    
    items.forEach(p => {
      const card = createFavoriteProductCard(p);
      // Mark as favorited in favorites page
      const favBtn = card.querySelector('.fav-btn, .favorite-btn');
      if (favBtn) favBtn.classList.add('favorited');
      productsContainer.appendChild(card);
    });
    
    console.log('Favoriler başarıyla yüklendi');
    
  } catch (error) {
    console.error('Favoriler yüklenirken hata:', error);
    showToast('error', 'Favoriler yüklenirken bir hata oluştu');
  }
}

// Enter key support for search
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }

  // Ana sayfa linklerine tıklandığında favoriler sayfasından çık
  document.querySelectorAll('a[href="#home"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToHomePage();
    });
  });

  // Logo'ya tıklandığında da ana sayfaya dön
  document.querySelectorAll('.logo, .mobile-logo').forEach(logo => {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      goToHomePage();
    });
  });

  // Kategori kartları: sadece görsel amaçlı (tıklanabilir değil)
  const categoryCards = document.querySelectorAll('.categories .category-card');
  categoryCards.forEach((card) => {
    card.style.cursor = 'default'; // Normal cursor
    // Tıklama eventi kaldırıldı - sadece görsel amaçlı
  });

  // Footer kategori linkleri: çalışır hale getir
  document.querySelectorAll('a[data-footer-category]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const categoryKey = link.getAttribute('data-footer-category');
      
      // Kategori mapping - direkt ana kategorilere git
      const categoryMapping = {
        'steam': { key: 'steam', label: 'Steam Oyunları' },
        'valorant': { key: 'valorant', label: 'Valorant' },
        'lol': { key: 'lol', label: 'League of Legends' }
      };
      
      const category = categoryMapping[categoryKey];
      if (category) {
        // Direkt ana kategori sayfasına git
        openCategoryPage(category.key, category.label);
      }
    });
  });

  // Footer destek sayfası linkleri
  document.querySelectorAll('a[data-footer-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageKey = link.getAttribute('data-footer-page');
      
      // Sayfa yönlendirmeleri
      switch(pageKey) {
        case 'faq':
          // FAQ bölümüne scroll yap veya FAQ sayfasını aç
          showFAQSection();
          break;
        case 'contact':
          // İletişim bölümüne scroll yap veya iletişim sayfasını aç
          showContactSection();
          break;
        case 'refund':
          // Geri iade politikası modal'ını aç
          showRefundPolicy();
          break;
        case 'terms':
          // Kullanım şartları modal'ını aç
          showTermsOfService();
          break;
      }
    });
  });

  // Navbar anchor linkleri (iletişim, faq vb.)
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      
      // Sadece sayfa içi anchor linkler için
      if (href.startsWith('#') && href.length > 1) {
        e.preventDefault();
        
        const targetId = href.substring(1); // # işaretini kaldır
        console.log(`🔗 Anchor link tıklandı: ${href} → ${targetId}`);
        
        // Ana sayfaya git
        goToHomePage();
        
        // Target element'e scroll yap
        setTimeout(() => {
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
            console.log(`📍 Scroll yapıldı: #${targetId}`);
          } else {
            console.log(`❌ Element bulunamadı: #${targetId}`);
          }
        }, 100);
      }
    });
  });

  // Navbar alt menü tıklamaları (ör. Valorant VP)
  document.querySelectorAll('a[data-subcat]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sub = link.getAttribute('data-subcat');
      switch (sub) {
        case 'valorant-vp':
          openCategoryPage('valorant', 'Valorant VP', { nameIncludes: 'VP' });
          break;
        case 'valorant-random-vp':
          openCategoryPage('valorant', 'Valorant Rastgele VP', { randomVpSpecial: true });
          break;
        case 'lol-rp':
          openCategoryPage('lol', 'LOL RP', { nameIncludes: 'RP' });
          break;
        case 'lol-random-rp':
          openCategoryPage('lol', 'LOL Rastgele RP', { randomRpSpecial: true });
          break;
        case 'steam-wallet':
          openCategoryPage('steam', 'Steam Cüzdan Kodları', { nameIncludes: 'Cüzdan' });
          break;
        case 'steam-game-code':
          openCategoryPage('steam', 'Steam Oyun Kodları', { steamGameCodeOnly: true });
          break;
        case 'steam-random-game-code':
          openCategoryPage('steam', 'Steam Rastgele Oyun Kodları', { randomSteamSpecial: true });
          break;
        default:
          openCategoryPage(sub, 'Ürünler');
      }
    });
  });
});

// Kategori sayfası: sadece ürünler bölümü açık, kategoriye göre listele
async function openCategoryPage(categoryKey, label, opts = {}) {
  // Bölümleri gizle, sadece products kalsın
  document.querySelectorAll('body > section').forEach(sec => { sec.style.display = 'none'; });
  const productsSection = document.getElementById('products');
  if (productsSection) productsSection.style.display = 'block';
  const footer = document.querySelector('.footer');
  if (footer) footer.style.display = '';

  // Başlığı ayarla
  const titleEl = productsSection?.querySelector('h2');
  if (titleEl) titleEl.textContent = label || 'Ürünler';

  // Steam oyunları için filtreleme paneli ekle
  if (categoryKey === 'steam' && opts.steamGameCodeOnly) {
    addSteamFilters(productsSection);
  } else {
    // Diğer kategorilerde filtreyi kaldır
    const existingFilter = productsSection.querySelector('.steam-filters');
    if (existingFilter) existingFilter.remove();
  }

  // Ürünleri yükle
  await loadCategoryProducts(categoryKey, opts);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Steam oyunları için filtreleme paneli
function addSteamFilters(productsSection) {
  // Mevcut filtreyi kaldır
  const existingFilter = productsSection.querySelector('.steam-filters');
  if (existingFilter) existingFilter.remove();

  const filterHTML = `
    <div class="steam-filters" style="
      background: var(--gradient-primary);
      padding: 20px;
      border-radius: 16px;
      margin: 24px 0;
      box-shadow: 0 8px 24px var(--shadow-medium);
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: end;">
        <div style="flex: 1; min-width: min(220px, 100%);">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: rgba(255,255,255,0.95); font-size: 13px; letter-spacing: 0.3px;">
            <i class="fas fa-search" style="margin-right: 6px;"></i>OYUN ARA
          </label>
          <input type="text" id="steam-search" placeholder="Oyun adını yazın..." 
            style="
              width: 100%;
              padding: 13px 16px;
              border: 2px solid rgba(255,255,255,0.2);
              border-radius: 10px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
              transition: all 0.3s ease;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            "
            onfocus="this.style.borderColor='rgba(255,255,255,0.5)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
            onblur="this.style.borderColor='rgba(255,255,255,0.2)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
        </div>
        
        <div style="flex: 1; min-width: min(190px, 100%);">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: rgba(255,255,255,0.95); font-size: 13px; letter-spacing: 0.3px;">
            <i class="fas fa-sort-amount-down" style="margin-right: 6px;"></i>SIRALAMA
          </label>
          <select id="steam-sort" 
            style="
              width: 100%;
              padding: 13px 16px;
              border: 2px solid rgba(255,255,255,0.2);
              border-radius: 10px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              appearance: none;
              background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23666%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e');
              background-repeat: no-repeat;
              background-position: right 12px center;
              background-size: 18px;
              padding-right: 40px;
            ">
            <option value="price-asc">💰 Fiyat: Düşük → Yüksek</option>
            <option value="price-desc">💎 Fiyat: Yüksek → Düşük</option>
            <option value="name-asc">🔤 İsim: A → Z</option>
            <option value="name-desc">🔤 İsim: Z → A</option>
            <option value="discount-desc">🔥 En Çok İndirimli</option>
          </select>
        </div>
        
        <div style="flex: 1; min-width: min(210px, 100%);">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: rgba(255,255,255,0.95); font-size: 13px; letter-spacing: 0.3px;">
            <i class="fas fa-filter" style="margin-right: 6px;"></i>FİYAT ARALIĞI
          </label>
          <select id="steam-price-range" 
            style="
              width: 100%;
              padding: 13px 16px;
              border: 2px solid rgba(255,255,255,0.2);
              border-radius: 10px;
              font-size: 14px;
              background: var(--bg-primary);
              color: var(--text-primary);
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              appearance: none;
              background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23666%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e');
              background-repeat: no-repeat;
              background-position: right 12px center;
              background-size: 18px;
              padding-right: 40px;
            ">
            <option value="all">Tüm Fiyatlar</option>
            <option value="0-50">0₺ - 50₺</option>
            <option value="50-100">50₺ - 100₺</option>
            <option value="100-500">100₺ - 500₺</option>
            <option value="500-1000">500₺ - 1.000₺</option>
            <option value="1000-2000">1.000₺ - 2.000₺</option>
            <option value="2000-99999">2.000₺+</option>
          </select>
        </div>
        
        <div style="flex: 0 1 auto; min-width: min(150px, 100%);">
          <button id="steam-reset-filters" 
            style="
              width: 100%;
              padding: 13px 20px;
              background: var(--bg-primary);
              color: var(--text-primary);
              border: 2px solid rgba(255,255,255,0.3);
              border-radius: 10px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              transition: all 0.3s ease;
              font-size: 14px;
              letter-spacing: 0.3px;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
            <i class="fas fa-redo" style="margin-right: 6px;"></i>Sıfırla
          </button>
        </div>
      </div>
    </div>
  `;

  // Başlıktan sonra ekle
  const title = productsSection.querySelector('h2');
  if (title) {
    title.insertAdjacentHTML('afterend', filterHTML);
    
    // Event listener'ları ekle
    const searchInput = document.getElementById('steam-search');
    const sortSelect = document.getElementById('steam-sort');
    const priceRangeSelect = document.getElementById('steam-price-range');
    const resetButton = document.getElementById('steam-reset-filters');
    
    let filterTimeout;
    
    const applyFilters = () => {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => {
        filterSteamGames();
      }, 300);
    };
    
    searchInput?.addEventListener('input', applyFilters);
    sortSelect?.addEventListener('change', applyFilters);
    priceRangeSelect?.addEventListener('change', applyFilters);
    
    resetButton?.addEventListener('click', () => {
      searchInput.value = '';
      sortSelect.value = 'price-asc';
      priceRangeSelect.value = 'all';
      filterSteamGames();
    });
  }
}

// Steam oyunlarını filtrele ve sırala
function filterSteamGames() {
  const searchTerm = document.getElementById('steam-search')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('steam-sort')?.value || 'price-asc';
  const priceRange = document.getElementById('steam-price-range')?.value || 'all';
  
  const grid = document.querySelector('#products .products-grid');
  if (!grid) return;
  
  const cards = Array.from(grid.querySelectorAll('.product-card'));
  
  // Filtreleme
  let filteredCards = cards.filter(card => {
    const name = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const priceText = card.querySelector('.current-price')?.textContent.replace(/[^\d]/g, '') || '0';
    const price = parseInt(priceText);
    
    // Arama filtresi
    if (searchTerm && !name.includes(searchTerm)) {
      return false;
    }
    
    // Fiyat aralığı filtresi
    if (priceRange !== 'all') {
      const [min, max] = priceRange.split('-').map(Number);
      if (price < min || price > max) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sıralama
  filteredCards.sort((a, b) => {
    const aName = a.querySelector('h3')?.textContent || '';
    const bName = b.querySelector('h3')?.textContent || '';
    const aPrice = parseInt(a.querySelector('.current-price')?.textContent.replace(/[^\d]/g, '') || '0');
    const bPrice = parseInt(b.querySelector('.current-price')?.textContent.replace(/[^\d]/g, '') || '0');
    const aDiscount = parseInt(a.querySelector('.discount-badge')?.textContent.replace(/[^\d]/g, '') || '0');
    const bDiscount = parseInt(b.querySelector('.discount-badge')?.textContent.replace(/[^\d]/g, '') || '0');
    
    switch(sortBy) {
      case 'price-asc':
        return aPrice - bPrice;
      case 'price-desc':
        return bPrice - aPrice;
      case 'name-asc':
        return aName.localeCompare(bName);
      case 'name-desc':
        return bName.localeCompare(aName);
      case 'discount-desc':
        return bDiscount - aDiscount;
      default:
        return 0;
    }
  });
  
  // Grid'i temizle ve yeniden ekle
  grid.innerHTML = '';
  
  if (filteredCards.length === 0) {
    grid.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: var(--text-secondary); font-size: 16px; background: var(--bg-secondary); border-radius: 16px; border: 2px dashed var(--border-color);"><i class="fas fa-search" style="font-size: 56px; margin-bottom: 20px; display: block; opacity: 0.5;"></i><div style="font-weight: 600; margin-bottom: 8px; font-size: 18px;">Oyun Bulunamadı</div><div style="opacity: 0.7;">Aradığınız kriterlere uygun oyun yok. Filtreleri değiştirmeyi deneyin.</div></div>';
  } else {
    filteredCards.forEach(card => {
      card.style.display = 'block';
      grid.appendChild(card);
    });
    
    // Sonuç sayısını göster
    const filterContainer = document.querySelector('.steam-filters');
    let resultInfo = filterContainer?.querySelector('.filter-result-info');
    if (!resultInfo) {
      resultInfo = document.createElement('div');
      resultInfo.className = 'filter-result-info';
      resultInfo.style.cssText = 'margin-top: 16px; color: rgba(255,255,255,0.95); font-size: 14px; text-align: center; font-weight: 600; letter-spacing: 0.5px; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 10px; backdrop-filter: blur(10px);';
      filterContainer?.appendChild(resultInfo);
    }
    resultInfo.innerHTML = `<i class="fas fa-gamepad" style="margin-right: 8px;"></i><strong style="font-size: 16px; color: #fff;">${filteredCards.length}</strong> oyun bulundu`;
  }
}

async function loadCategoryProducts(categoryKey, opts = {}) {
  try {
    console.log('🚀 loadCategoryProducts çağrıldı:', categoryKey, opts);
    const grid = document.querySelector('#products .products-grid');
    if (!grid) {
      console.log('❌ Grid bulunamadı');
      return;
    }
    grid.innerHTML = '<div style="padding:16px;opacity:.8;">Yükleniyor...</div>';

    const url = `/api/products?category=${encodeURIComponent(categoryKey)}&cachebust=${Date.now()}&t=${Math.random()}`;
    console.log('🌐 API çağrısı:', url);
    
    const res = await fetch(url, { 
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const data = await res.json();
    console.log('📡 API yanıtı:', data);
    
    if (!res.ok || !data?.ok) { 
      console.log('❌ API hatası');
      grid.innerHTML = '<div style="padding:16px;opacity:.8;">Ürünler yüklenemedi</div>'; 
      return; 
    }
    let items = data.items || data.products || [];
    console.log('📦 API\'den gelen ürünler:', items.length);
    // İsteğe bağlı isim filtresi (örn. VP paketleri)
    if (opts.nameIncludes) {
      const needle = String(opts.nameIncludes).toLowerCase();
      items = items.filter(p => String(p.name||'').toLowerCase().includes(needle));
    }
    // Küçükten büyüğe fiyata göre sırala (price kuruş cinsinden)
    items.sort((a,b) => (a.price||0) - (b.price||0));
    grid.innerHTML = '';

    // Özel: Valorant Rastgele VP 3'lü (düşük, orta, yüksek) — ürünlerden otomatik seç
    // Sadece 'Valorant → Valorant Rastgele VP' alt görünümünde göster
    const wantsRandomVp = !!(opts && opts.randomVpSpecial === true);
    if (categoryKey === 'valorant' && wantsRandomVp) {
      console.log('🎮 Valorant rastgele VP özel görünümü yükleniyor...');
      console.log('📦 Mevcut ürünler:', items.length);
      
      // Önce "random" package_level'ı veya slug'ında "random"/"rastgele" geçen özel paketleri bul
      const randomPackets = items.filter(p => {
        const slug = (p.slug || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const packageLevel = (p.package_level || '').toLowerCase();
        const isValorant = (p.category || '').toLowerCase() === 'valorant' || (p.platform || '').toLowerCase() === 'valorant';
        return isValorant && (
          packageLevel === 'random' || 
          slug.includes('random') || slug.includes('rastgele') ||
          name.includes('rastgele') || name.includes('random')
        );
      });
      
      console.log('🎲 Rastgele VP paketleri (özel):', randomPackets.length, 'adet');
      
      if (randomPackets.length >= 3) {
        // Eğer 3 veya daha fazla random paket varsa, ilk 3'ünü göster
        const selectedPackets = randomPackets.slice(0, 3);
        grid.innerHTML = '';
        selectedPackets.forEach((p) => {
          console.log('🎮 Rastgele VP Paketi:', p.name, 'Fiyat:', (p.price/100) + '₺');
          const card = createProductCard(p);
          grid.appendChild(card);
        });
        console.log('✅ Rastgele VP kartları eklendi (özel paketler)');
        return;
      }
      
      // Fallback: package_level'a göre bul (low, medium, high)
      const fallbackPackets = items.filter(p => 
        (p.category||'').toLowerCase() === 'valorant' && 
        ['low', 'medium', 'high'].includes((p.package_level||'').toLowerCase())
      );
      console.log('🔄 Tüm VP paketleri:', fallbackPackets.length, 'adet');
      
      if (fallbackPackets.length > 0) {
        // Her seviyeden bir tane seç (low, medium, high)
        const selectedPackets = [];
        const levels = ['low', 'medium', 'high'];
        
        levels.forEach(level => {
          const levelPackets = fallbackPackets.filter(p => (p.package_level||'').toLowerCase() === level);
          if (levelPackets.length > 0) {
            // Fiyata göre sırala ve en ucuz olanı seç
            levelPackets.sort((a, b) => (a.price || 0) - (b.price || 0));
            selectedPackets.push(levelPackets[0]);
          }
        });
        
        console.log('🎯 Seçilen VP paketleri:', selectedPackets.length, 'adet');
        
        if (selectedPackets.length > 0) {
          // Seviyeye göre sırala: low, medium, high
          selectedPackets.sort((a, b) => {
            const order = { low: 1, medium: 2, high: 3 };
            return (order[a.package_level] || 99) - (order[b.package_level] || 99);
          });
          
          // Grid'i temizle ve sadece seçilen paketleri göster
          grid.innerHTML = '';
          
          // Normal grid düzenini kullan (products-grid CSS'i ile)
          selectedPackets.forEach((p) => {
            console.log('🎮 VP Paketi kartı oluşturuluyor:', p.name, 'Fiyat:', (p.price/100) + '₺', 'Seviye:', p.package_level);
            const card = createProductCard(p);
            grid.appendChild(card);
          });
          
          console.log('✅ Rastgele VP kartları eklendi');
          return; // Fonksiyonu bitir, sadece 3 paket gösterilsin
        }
      }
      
      console.log('❌ VP paketleri bulunamadı');
    }

    // LoL Rastgele RP özel görünümü (Valorant VP gibi)
    const wantsRandomRp = !!(opts && opts.randomRpSpecial === true);
    if (categoryKey === 'lol' && wantsRandomRp) {
      console.log('🎮 LoL rastgele RP özel görünümü yükleniyor...');
      console.log('📦 Mevcut ürünler:', items.length);
      
      // Önce "random" package_level'ı veya slug'ında "random"/"rastgele" geçen özel paketleri bul
      // Sadece "Düşük Paket", "Orta Paket", "Yüksek Paket" içeren ürünleri göster (basit "LoL Rastgele RP" hariç)
      const randomPackets = items.filter(p => {
        const slug = (p.slug || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const packageLevel = (p.package_level || '').toLowerCase();
        const isLol = (p.category || '').toLowerCase() === 'lol' || (p.platform || '').toLowerCase() === 'lol';
        
        // Sadece "Düşük Paket", "Orta Paket", "Yüksek Paket" içeren ürünleri göster
        const hasPackageLevel = name.includes('düşük paket') || name.includes('orta paket') || name.includes('yüksek paket') ||
                                slug.includes('dusuk') || slug.includes('orta') || slug.includes('yuksek');
        
        return isLol && hasPackageLevel && (
          packageLevel === 'random' || 
          slug.includes('random') || slug.includes('rastgele') ||
          name.includes('rastgele') || name.includes('random')
        );
      });
      
      console.log('🎲 Rastgele RP paketleri (özel):', randomPackets.length, 'adet');
      
      if (randomPackets.length >= 3) {
        // Eğer 3 veya daha fazla random paket varsa, ilk 3'ünü göster
        const selectedPackets = randomPackets.slice(0, 3);
        grid.innerHTML = '';
        selectedPackets.forEach((p) => {
          console.log('🎮 Rastgele RP Paketi:', p.name, 'Fiyat:', (p.price/100) + '₺');
          const card = createProductCard(p);
          grid.appendChild(card);
        });
        console.log('✅ Rastgele RP kartları eklendi (özel paketler)');
        return;
      }
      
      // Fallback: package_level'a göre bul (low, medium, high)
      const fallbackPackets = items.filter(p => 
        (p.category||'').toLowerCase() === 'lol' && 
        ['low', 'medium', 'high'].includes((p.package_level||'').toLowerCase())
      );
      console.log('🔄 Tüm RP paketleri:', fallbackPackets.length, 'adet');
      
      if (fallbackPackets.length > 0) {
        // Her seviyeden bir tane seç (low, medium, high)
        const selectedPackets = [];
        const levels = ['low', 'medium', 'high'];
        
        levels.forEach(level => {
          const levelPackets = fallbackPackets.filter(p => (p.package_level||'').toLowerCase() === level);
          if (levelPackets.length > 0) {
            // Fiyata göre sırala ve en ucuz olanı seç
            levelPackets.sort((a, b) => (a.price || 0) - (b.price || 0));
            selectedPackets.push(levelPackets[0]);
          }
        });
        
        console.log('🎯 Seçilen RP paketleri:', selectedPackets.length, 'adet');
        
        if (selectedPackets.length > 0) {
          // Seviyeye göre sırala: low, medium, high
          selectedPackets.sort((a, b) => {
            const order = { low: 1, medium: 2, high: 3 };
            return (order[a.package_level] || 99) - (order[b.package_level] || 99);
          });
          
          // Grid'i temizle ve sadece seçilen paketleri göster
          grid.innerHTML = '';
          
          // Normal grid düzenini kullan (products-grid CSS'i ile)
          selectedPackets.forEach((p) => {
            console.log('🎮 RP Paketi kartı oluşturuluyor:', p.name, 'Fiyat:', (p.price/100) + '₺', 'Seviye:', p.package_level);
            const card = createProductCard(p);
            grid.appendChild(card);
          });
          
          console.log('✅ Rastgele RP kartları eklendi');
          return; // Fonksiyonu bitir, sadece 3 paket gösterilsin
        }
      }
      
      console.log('❌ RP paketleri bulunamadı');
    }

    // Steam Rastgele Oyun özel görünümü (Valorant VP ve LoL RP gibi)
    const wantsRandomSteam = !!(opts && opts.randomSteamSpecial === true);
    if (categoryKey === 'steam' && wantsRandomSteam) {
      console.log('🎮 Steam rastgele oyun özel görünümü yükleniyor...');
      console.log('📦 Mevcut ürünler:', items.length);
      
      // Önce "random" package_level'ı veya slug'ında "random"/"rastgele" geçen özel paketleri bul
      // Sadece "Düşük Paket", "Orta Paket", "Yüksek Paket" içeren ürünleri göster
      const randomPackets = items.filter(p => {
        const slug = (p.slug || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const packageLevel = (p.package_level || '').toLowerCase();
        const isSteam = (p.category || '').toLowerCase() === 'steam' || (p.platform || '').toLowerCase() === 'steam';
        
        // Sadece "Düşük Paket", "Orta Paket", "Yüksek Paket" içeren ürünleri göster
        const hasPackageLevel = name.includes('düşük paket') || name.includes('orta paket') || name.includes('yüksek paket') ||
                                slug.includes('dusuk') || slug.includes('orta') || slug.includes('yuksek');
        
        return isSteam && hasPackageLevel && (
          packageLevel === 'random' || 
          slug.includes('random') || slug.includes('rastgele') ||
          name.includes('rastgele') || name.includes('random')
        );
      });
      
      console.log('🎲 Rastgele Steam paketleri (özel):', randomPackets.length, 'adet');
      
      if (randomPackets.length >= 3) {
        // Fiyata göre sırala (düşük, orta, yüksek)
        randomPackets.sort((a, b) => (a.price || 0) - (b.price || 0));
        const selectedPackets = randomPackets.slice(0, 3);
        grid.innerHTML = '';
        selectedPackets.forEach((p) => {
          console.log('🎮 Rastgele Steam Paketi:', p.name, 'Fiyat:', (p.price/100) + '₺');
          const card = createProductCard(p);
          grid.appendChild(card);
        });
        console.log('✅ Rastgele Steam kartları eklendi (özel paketler)');
        return;
      }
      
      // Fallback: package_level'a göre bul (low, medium, high)
      const fallbackPackets = items.filter(p => 
        (p.category||'').toLowerCase() === 'steam' && 
        ['low', 'medium', 'high'].includes((p.package_level||'').toLowerCase())
      );
      console.log('🔄 Tüm Steam paketleri:', fallbackPackets.length, 'adet');
      
      if (fallbackPackets.length > 0) {
        // Her seviyeden bir tane seç (low, medium, high)
        const selectedPackets = [];
        const levels = ['low', 'medium', 'high'];
        
        levels.forEach(level => {
          const levelPackets = fallbackPackets.filter(p => (p.package_level||'').toLowerCase() === level);
          if (levelPackets.length > 0) {
            // Fiyata göre sırala ve en ucuz olanı seç
            levelPackets.sort((a, b) => (a.price||0) - (b.price||0));
            selectedPackets.push(levelPackets[0]);
          }
        });
        
        if (selectedPackets.length > 0) {
          grid.innerHTML = '';
          selectedPackets.forEach((p) => {
            console.log('🎮 Steam Paketi (fallback):', p.name, 'Fiyat:', (p.price/100) + '₺');
            const card = createProductCard(p);
            grid.appendChild(card);
          });
          console.log('✅ Rastgele Steam kartları eklendi (fallback)');
          return;
        }
      }
      
      console.log('❌ Steam paketleri bulunamadı');
        console.log('🔄 Fallback Steam paketler:', fallbackPackets.length, 'adet');
        
        if (fallbackPackets.length > 0) {
          grid.innerHTML = '';
          fallbackPackets.forEach(p => {
            const card = createProductCard(p);
            grid.appendChild(card);
          });
          
          return; // Fonksiyonu bitir
        }
      }
    }

    // Kategori: Valorant genel listede üçlü Rastgele VP paketlerini gizle
    if (categoryKey === 'valorant' && !wantsRandomVp) {
      console.log('🔍 Normal Valorant görünümü - rastgele VP paketlerini gizliyorum');
      const beforeFilter = items.length;
      items = items.filter(p => {
        const slug = String(p.slug || '').toLowerCase();
        const name = String(p.name || '').toLowerCase();
        const isTrioSlug = /^(valorant-vp-(dusuk|orta|yuksek))/.test(slug);
        const mentionsRandom = /rastgele\s*vp/.test(name);
        const shouldHide = isTrioSlug || mentionsRandom;
        if (shouldHide) {
          console.log('🚫 Gizlenen ürün:', p.name, '(slug:', slug + ')');
        }
        return !shouldHide;
      });
      console.log('📊 Filtreleme sonrası:', beforeFilter, '→', items.length, 'ürün');
    } else if (categoryKey === 'valorant' && wantsRandomVp) {
      console.log('🎲 Rastgele VP özel görünümü - tüm ürünler gösteriliyor');
    }

    // Kategori: LoL genel listede ve LoL RP alt kategorisinde üçlü Rastgele RP paketlerini gizle
    const isLolRpCategory = categoryKey === 'lol' && opts && opts.nameIncludes === 'RP';
    if (categoryKey === 'lol' && !wantsRandomRp) {
      const categoryName = isLolRpCategory ? 'LoL RP' : 'Normal LoL';
      console.log(`🔍 ${categoryName} görünümü - rastgele RP paketlerini gizliyorum`);
      console.log('🔍 Debug - opts:', opts);
      console.log('🔍 Debug - categoryKey:', categoryKey);
      console.log('🔍 Debug - wantsRandomRp:', wantsRandomRp);
      const beforeFilter = items.length;
      items = items.filter(p => {
        const slug = String(p.slug || '').toLowerCase();
        const name = String(p.name || '').toLowerCase();
        const isTrioSlug = /^(lol-rp-random-(dusuk|orta|yuksek))/.test(slug);
        const mentionsRandom = /rastgele\s*rp/.test(name);
        // Sadece rastgele RP paketlerini kontrol et (LoL RP + paket seviyesi)
        const isRandomRpPacket = /lol\s*rp.*\((düşük|orta|yüksek)\s*paket\)/i.test(name);
        const shouldHide = isTrioSlug || mentionsRandom || isRandomRpPacket;
        if (shouldHide) {
          console.log('🚫 Gizlenen LoL ürünü:', p.name, '(slug:', slug + ')');
        }
        return !shouldHide;
      });
      console.log(`📊 ${categoryName} filtreleme sonrası:`, beforeFilter, '→', items.length, 'ürün');
    } else if (categoryKey === 'lol' && wantsRandomRp) {
      console.log('🎲 Rastgele RP özel görünümü - tüm ürünler gösteriliyor');
    }

    // Kategori: Steam Oyun Kodları - sadece rastgele paketleri gizle
    const wantsSteamGameCodeOnly = !!(opts && opts.steamGameCodeOnly === true);
    if (categoryKey === 'steam' && wantsSteamGameCodeOnly) {
      console.log('🔍 Steam Oyun Kodları görünümü - rastgele paketlerini ve cüzdan kodlarını gizliyorum');
      const beforeFilter = items.length;
      items = items.filter(p => {
        const slug = String(p.slug || '').toLowerCase();
        const name = String(p.name || '').toLowerCase();
        const isRandomSlug = /^(steam-random-(dusuk|orta|yuksek))/.test(slug);
        const mentionsRandom = /rastgele\s*oyun/.test(name);
        // Steam rastgele paketlerini kontrol et (Steam Oyun Kodu + paket seviyesi)
        const isRandomSteamPacket = /steam\s*oyun\s*kodu.*\((düşük|orta|yüksek)\s*paket\)/i.test(name);
        // Steam cüzdan kodlarını kontrol et
        const isWalletCode = /cüzdan/i.test(name);
        const shouldHide = isRandomSlug || mentionsRandom || isRandomSteamPacket || isWalletCode;
        if (shouldHide) {
          console.log('🚫 Gizlenen Steam ürünü:', p.name, '(slug:', slug + ')');
        }
        return !shouldHide;
      });
      console.log(`📊 Steam Oyun Kodları filtreleme sonrası:`, beforeFilter, '→', items.length, 'ürün');
    }

    // Kategori: Steam Cüzdan Kodları - sadece cüzdan kodlarını göster
    const wantsSteamWalletOnly = !!(opts && opts.nameIncludes === 'Cüzdan');
    if (categoryKey === 'steam' && wantsSteamWalletOnly) {
      console.log('🔍 Steam Cüzdan Kodları görünümü - sadece cüzdan kodlarını gösteriyorum');
      const beforeFilter = items.length;
      items = items.filter(p => {
        const name = String(p.name || '').toLowerCase();
        const isWalletCode = /cüzdan/i.test(name);
        if (!isWalletCode) {
          console.log('🚫 Gizlenen Steam ürünü:', p.name, '(cüzdan kodu değil)');
        }
        return isWalletCode;
      });
      console.log(`📊 Steam Cüzdan Kodları filtreleme sonrası:`, beforeFilter, '→', items.length, 'ürün');
    }

    console.log('📊 Final ürün listesi:', items.length, 'ürün');
    if (items.length === 0) {
      console.log('❌ Hiç ürün bulunamadı, boş mesajı gösteriliyor');
      grid.innerHTML += '<div style="padding:16px;opacity:.8;">Bu kategoride ürün yok. (Debug: Toplam API ürünü: ' + (data.items?.length || 0) + ')</div>';
      return;
    }
    items.forEach(p => {
      const card = createProductCard(p);
      grid.appendChild(card);
    });
  } catch (err) {
    const grid = document.querySelector('#products .products-grid');
    if (grid) grid.innerHTML = '<div style="padding:16px;">Ağ hatası</div>';
  }
}

// Kategori sayfasında fiyat güncelleme dinleyicisini kur
function setupCategoryPriceUpdateListener(categoryKey) {
  console.log(`🔧 Kategori ${categoryKey} için fiyat güncelleme dinleyicisi kuruluyor...`);
  
  // Mevcut dinleyicileri temizle
  if (window.categoryPriceUpdateInterval) {
    clearInterval(window.categoryPriceUpdateInterval);
  }
  
  // Kategori ürünlerini periyodik olarak güncelle
  window.categoryPriceUpdateInterval = setInterval(async () => {
    try {
      // Sadece ürünler sayfasındaysa güncelle
      const productsSection = document.getElementById('products');
      if (!productsSection || productsSection.style.display === 'none') {
        return;
      }
      
      // Ürün kartlarını bul
      const productCards = document.querySelectorAll('#products .product-card');
      if (productCards.length === 0) {
        return;
      }
      
      // API'den güncel verileri al
      const response = await fetch(`/api/products?category=${encodeURIComponent(categoryKey)}&cachebust=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data.ok || !data.items) return;
      
      const updatedProducts = data.items;
      
      // Her ürün kartını güncelle
      productCards.forEach(card => {
        const addToCartBtn = card.querySelector('.add-to-cart');
        if (!addToCartBtn) return;
        
        const productId = addToCartBtn.dataset.productId;
        if (!productId) return;
        
        // Güncel ürün verisini bul
        const updatedProduct = updatedProducts.find(p => p.id == productId);
        if (!updatedProduct) return;
        
        // Fiyat bilgilerini güncelle
        const priceContainer = card.querySelector('.price');
        if (priceContainer) {
          const finalPrice = updatedProduct.discount > 0 ? 
            updatedProduct.price * (1 - updatedProduct.discount / 100) : updatedProduct.price;
          
          let newPriceHtml = '';
          if (updatedProduct.discount > 0) {
            newPriceHtml = `
              <span class="old-price">₺${updatedProduct.price}</span>
              <span class="current-price">₺${finalPrice.toFixed(0)}</span>
            `;
          } else {
            newPriceHtml = `<span class="current-price">₺${updatedProduct.price}</span>`;
          }
          
          // Sadece fiyat değiştiyse güncelle
          if (priceContainer.innerHTML !== newPriceHtml) {
            priceContainer.innerHTML = newPriceHtml;
            console.log(`💰 Kategori ${categoryKey}: Ürün ${updatedProduct.id} fiyatı güncellendi`);
          }
        }
        
        // İndirim badge'ini güncelle
        const badgeContainer = card.querySelector('.discount-badge');
        if (updatedProduct.discount > 0) {
          if (!badgeContainer) {
            // Badge yoksa ekle
            const productImage = card.querySelector('.product-image');
            if (productImage) {
              const newBadge = document.createElement('div');
              newBadge.className = 'discount-badge';
              newBadge.textContent = `-${updatedProduct.discount}%`;
              productImage.appendChild(newBadge);
            }
          } else {
            // Mevcut badge'i güncelle
            if (badgeContainer.textContent !== `-${updatedProduct.discount}%`) {
              badgeContainer.textContent = `-${updatedProduct.discount}%`;
            }
          }
        } else {
          // İndirim yoksa badge'i kaldır
          if (badgeContainer) {
            badgeContainer.remove();
          }
        }
      });
      
    } catch (error) {
      console.error('Kategori fiyat güncelleme hatası:', error);
    }
  }, 5000); // 5 saniyede bir kontrol et
  
  console.log(`✅ Kategori ${categoryKey} için fiyat güncelleme dinleyicisi kuruldu`);
}

// Alt kategori/arama bazlı açma (örn. Valorant VP)
async function openCategorySearch(searchTerm, label) {
  document.querySelectorAll('body > section').forEach(sec => { sec.style.display = 'none'; });
  const productsSection = document.getElementById('products');
  if (productsSection) productsSection.style.display = 'block';
  const footer = document.querySelector('.footer');
  if (footer) footer.style.display = 'block';

  const titleEl = productsSection?.querySelector('h2');
  if (titleEl) titleEl.textContent = label || 'Ürünler';

  const grid = document.querySelector('#products .products-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="padding:16px;opacity:.8;">Yükleniyor...</div>';
  try {
    const res = await fetch(`/api/products?search=${encodeURIComponent(searchTerm)}&cachebust=${Date.now()}&t=${Math.random()}`, { 
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const data = await res.json();
    const items = data.items || data.products || [];
    grid.innerHTML = '';
    if (!res.ok || !data?.ok || items.length === 0) {
      grid.innerHTML = '<div style="padding:16px;opacity:.8;">Uygun ürün bulunamadı.</div>';
      return;
    }
    items.forEach(p => {
      const card = createProductCard(p);
      grid.appendChild(card);
    });
    
    // Kategori arama sonuçları yüklendikten sonra fiyat güncelleme dinleyicisini aktifleştir
    setupCategoryPriceUpdateListener('search');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    grid.innerHTML = '<div style="padding:16px;">Ağ hatası</div>';
  }
}

// Notification System Functions
let notificationsPanel = null;
let notificationsVisible = false;

async function loadNotifications() {
    try {
        if (!window.authManager?.isLoggedIn()) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }

        const response = await fetch('/api/notifications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token geçersiz, kullanıcıyı çıkış yap
                window.authManager?.logout();
                return;
            }
            return;
        }

        const data = await response.json();
        
        if (data.ok) {
            displayNotifications(data.notifications);
            updateNotificationCount(data.unread_count);
        }
    } catch (error) {
        // Sadece console'da göster, kullanıcıya gösterme
        console.log('Notifications not loaded:', error.message);
    }
}

function displayNotifications(notifications) {
    const notificationsList = document.getElementById('notificationsList');
    const notificationsEmpty = document.getElementById('notificationsEmpty');
    
    if (!notificationsList) return;
    
    if (notifications.length === 0) {
        notificationsList.style.display = 'none';
        if (notificationsEmpty) notificationsEmpty.style.display = 'block';
        return;
    }
    
    if (notificationsEmpty) notificationsEmpty.style.display = 'none';
    notificationsList.style.display = 'block';
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? '' : 'unread'}" 
             onclick="markNotificationRead(${notification.id})">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${formatNotificationTime(notification.created_at)}</div>
        </div>
    `).join('');
}

function updateNotificationCount(count) {
    const notificationCount = document.querySelector('.notifications-count');
    if (notificationCount) {
        notificationCount.textContent = count;
        notificationCount.style.display = count > 0 ? 'block' : 'none';
    }
}

function formatNotificationTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Şimdi';
    if (diffInMinutes < 60) return `${diffInMinutes} dakika önce`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} saat önce`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} gün önce`;
    
    return date.toLocaleDateString('tr-TR');
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;
    
    notificationsVisible = !notificationsVisible;
    
    if (notificationsVisible) {
        panel.style.display = 'block';
        loadNotifications();
    } else {
        panel.style.display = 'none';
    }
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            loadNotifications(); // Reload to update UI
        }
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            loadNotifications(); // Reload to update UI
            showToast('success', 'Tüm bildirimler okundu olarak işaretlendi');
        }
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        showToast('error', 'Bildirimler güncellenirken hata oluştu');
    }
}

// Cart Coupon Functions

async function validateCartCoupon() {
  const couponInput = document.getElementById('cartCouponInput');
  const couponCode = couponInput.value.trim();
  const resultDiv = document.getElementById('cartCouponResult');
  
  if (!couponCode) {
    showCouponResult('error', 'Lütfen bir kupon kodu girin');
    return;
  }
  
  if (!window.authManager?.isLoggedIn()) {
    showCouponResult('error', 'Kupon kullanmak için giriş yapmanız gerekiyor');
    return;
  }
  
  try {
    // Parse formatted cart total (remove thousand separators)
    const cartTotalText = document.getElementById('cartTotal').textContent.replace(/\./g, '');
    const cartTotal = parseFloat(cartTotalText) || 0;
    
    if (cartTotal === 0) {
      showCouponResult('error', 'Sepetiniz boş, kupon kullanamazsınız');
      return;
    }
    
    const token = localStorage.getItem('token');
    const user = window.authManager?.currentUser;
    
    console.log('Sending coupon validation request:', {
      code: couponCode,
      order_amount: cartTotal,
      user_id: user?.id || null
    });
    
    const response = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: couponCode,
        // Sipariş tutarını TL olarak gönderiyoruz
        order_amount: cartTotal,
        user_id: user?.id || null
      })
    });
    
    console.log('Coupon validation response status:', response.status);
    
    const data = await response.json();
    console.log('Coupon validation response data:', data);
    
    if (response.ok && data.ok) {
      console.log('Coupon applied successfully:', data.coupon);
      
      // Set coupon in shopping cart instance
      if (window.shoppingCart) {
        window.shoppingCart.activeCoupon = data.coupon;
      }
      
      // Sunucu TL olarak döner: data.coupon.discount_amount
      const discountAmount = parseFloat(data.coupon.discount_amount) || 0;
      console.log('Discount amount (TL):', discountAmount);
      
      // Mesajı kupon tipine göre zenginleştir
      if (data.coupon.type === 'percentage') {
        showCouponResult('success', `Kupon uygulandı! %${data.coupon.value} indirim — ${discountAmount.toFixed(2)}₺ düşüldü`);
      } else {
        showCouponResult('success', `Kupon uygulandı! ${discountAmount.toFixed(2)}₺ indirim`);
      }
      
      if (window.shoppingCart) {
        window.shoppingCart.updateCartWithDiscount(discountAmount);
      }
    } else {
      // Detailed error handling
      let msg = 'Kupon doğrulanamadı';
      switch (data?.error) {
        case 'missing_info':
          msg = 'Eksik bilgi: kupon kodu veya tutar bulunamadı';
          break;
        case 'invalid_coupon':
          msg = 'Kupon bulunamadı veya aktif değil';
          break;
        case 'min_amount_not_met':
          {
            const required = parseFloat(data?.min_amount) || 0;
            msg = `Minimum sipariş tutarı ₺${required.toFixed(2)}. Sepet tutarınız yetersiz.`;
          }
          break;
        case 'coupon_already_used':
          msg = 'Bu kuponu daha önce kullanmışsınız';
          break;
        default:
          msg = data?.error ? `Hata: ${data.error}` : 'Kupon kodu geçersiz';
      }
      showCouponResult('error', msg);
    }
    
  } catch (error) {
    console.error('Coupon validation error:', error);
    showCouponResult('error', 'Kupon doğrulanırken hata oluştu');
  }
}

function showCouponResult(type, message) {
  const resultDiv = document.getElementById('cartCouponResult');
  if (!resultDiv) {
    console.error('Coupon result element not found');
    return;
  }
  
  resultDiv.textContent = message;
  resultDiv.className = `coupon-result ${type}`;
  resultDiv.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (resultDiv) {
      resultDiv.style.display = 'none';
    }
  }, 5000);
}

// Initialize Connection Manager
window.connectionManager = new ConnectionManager();

// Aç: Valorant → Valorant Rastgele VP
window.openValorantRandom = function() {
  try {
    // Tüm ana bölümleri gizle, ürünleri göster
    document.querySelectorAll('body > section').forEach(sec => { sec.style.display = 'none'; });
    const productsSection = document.getElementById('products');
    if (productsSection) productsSection.style.display = 'block';
    const footer = document.querySelector('.footer');
    if (footer) footer.style.display = 'block';

    // Başlık
    const titleEl = productsSection?.querySelector('h2');
    if (titleEl) titleEl.textContent = 'Valorant Rastgele VP';

    // İçeriği yükle (özel blok ile)
    loadCategoryProducts('valorant', { randomVpSpecial: true });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error('openValorantRandom error:', e);
  }
};

// Footer destek sayfası fonksiyonları
function showFAQSection() {
  // Ana sayfaya git ve FAQ bölümüne scroll yap
  goToHomePage();
  setTimeout(() => {
    const faqSection = document.querySelector('#faq');
    if (faqSection) {
      faqSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
}

function showContactSection() {
  // Ana sayfaya git ve iletişim bölümüne scroll yap
  goToHomePage();
  setTimeout(() => {
    const contactSection = document.querySelector('#contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
}

function showRefundPolicy() {
  // Geri iade politikası alert ile göster
  alert(`GERI İADE POLİTİKASI

Geri İade Koşulları:
• Kullanılmamış dijital kodlar için 14 gün içinde iade hakkı
• Kod kullanıldıktan sonra iade yapılamaz  
• İade talebi için satın alma kanıtı gereklidir
• İade işlemi 3-5 iş günü içinde tamamlanır

İade Süreci:
İade talebi için keycoglobal@gmail.com adresine mail atabilirsiniz.`);
}

function showTermsOfService() {
  // Kullanım şartları alert ile göster
  alert(`KULLANIM ŞARTLARI

Genel Şartlar:
• Dijital kodlar tek kullanımlıktır
• Kodların paylaşılması yasaktır
• Sahte bilgi ile alışveriş yapılamaz
• Fiyatlar değişiklik gösterebilir

Sorumluluk:
Keyco, dijital kodların doğruluğunu garanti eder ancak üçüncü taraf platformlardaki sorunlardan sorumlu değildir.`);
}






