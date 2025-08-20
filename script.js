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
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

// Shopping Cart Management
class ShoppingCart {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('cart')) || [];
        this.init();
    }

    init() {
        this.updateCartUI();
        this.bindEvents();
    }

    bindEvents() {
        // Add to cart buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-cart')) {
                const productCard = e.target.closest('.product-card');
                this.addToCart(productCard);
            }
        });

        // Cart icon click
        document.querySelector('.cart-icon').addEventListener('click', () => {
            this.toggleCart();
        });

        // Close cart button
        document.querySelector('.close-cart').addEventListener('click', () => {
            this.closeCart();
        });

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

    addToCart(productCard) {
        const product = {
            id: Date.now(),
            name: productCard.querySelector('h3').textContent,
            price: this.extractPrice(productCard.querySelector('.current-price').textContent),
            platform: productCard.querySelector('.platform span').textContent,
            image: productCard.querySelector('.product-image i').className
        };

        this.items.push(product);
        this.saveCart();
        this.updateCartUI();
        this.showAddedToCartAnimation(productCard);
    }

    extractPrice(priceText) {
        return parseInt(priceText.replace('₺', '').replace('.', ''));
    }

    removeFromCart(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveCart();
        this.updateCartUI();
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
                            <span class="cart-item-price">₺${item.price}</span>
                        </div>
                    </div>
                    <button class="remove-item" onclick="cart.removeFromCart(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }

        // Update total
        const total = this.items.reduce((sum, item) => sum + item.price, 0);
        document.getElementById('cartTotal').textContent = total;
    }

    toggleCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        cartSidebar.classList.toggle('open');
    }

    closeCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        cartSidebar.classList.remove('open');
    }

    showAddedToCartAnimation(productCard) {
        const button = productCard.querySelector('.add-to-cart');
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
            alert('Sepetiniz boş!');
            return;
        }

        const total = this.items.reduce((sum, item) => sum + item.price, 0);
        const itemsList = this.items.map(item => `${item.name} - ₺${item.price}`).join('\n');
        
        alert(`Satın alma işlemi başlatılıyor...\n\nÜrünler:\n${itemsList}\n\nToplam: ₺${total}`);
        
        // Simulate checkout process
        setTimeout(() => {
            alert('Satın alma işlemi tamamlandı! Kodlarınız e-posta adresinize gönderilecek.');
            this.items = [];
            this.saveCart();
            this.updateCartUI();
            this.closeCart();
        }, 2000);
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
        
        // Simulate search results
        alert(`"${query}" için arama sonuçları gösteriliyor...`);
        
        // In a real application, this would filter products or navigate to search results
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

            mobileMenuBtn.addEventListener('click', openMenu);
            mobileMenuBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                openMenu();
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
                const target = document.querySelector(anchor.getAttribute('href'));
                
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
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
            console.error('No carousel slides found!');
            return;
        }
        
        // Auto slide every 4 seconds
        setInterval(() => {
            console.log('🔄 Auto sliding...');
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
            console.error('❌ Carousel elements not found');
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
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateAuthUI();
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target);
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e.target);
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeAllModals();
            }
        });
    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            remember: formData.get('remember') === 'on'
        };

        // Show loading state
        const submitBtn = form.querySelector('.auth-submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Giriş yapılıyor...';
        submitBtn.disabled = true;

        try {
            // Simulate API call
            await this.simulateAPICall();
            
            // For demo purposes, accept any email/password
            const user = {
                id: Date.now(),
                name: loginData.email.split('@')[0],
                email: loginData.email,
                avatar: null,
                loginTime: new Date().toISOString()
            };

            this.setCurrentUser(user);
            this.closeAllModals();
            this.showSuccessMessage('Başarıyla giriş yaptınız!');
            
        } catch (error) {
            this.showErrorMessage('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleRegister(form) {
        const formData = new FormData(form);
        const registerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword'),
            terms: formData.get('terms') === 'on'
        };

        // Validate passwords match
        if (registerData.password !== registerData.confirmPassword) {
            this.showErrorMessage('Şifreler eşleşmiyor!');
            return;
        }

        // Validate terms accepted
        if (!registerData.terms) {
            this.showErrorMessage('Kullanım şartlarını kabul etmelisiniz!');
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('.auth-submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kayıt yapılıyor...';
        submitBtn.disabled = true;

        try {
            // Simulate API call
            await this.simulateAPICall();
            
            const user = {
                id: Date.now(),
                name: registerData.name,
                email: registerData.email,
                avatar: null,
                registerTime: new Date().toISOString()
            };

            this.setCurrentUser(user);
            this.closeAllModals();
            this.showSuccessMessage('Hesabınız başarıyla oluşturuldu!');
            
        } catch (error) {
            this.showErrorMessage('Kayıt olurken bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.updateAuthUI();
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.updateAuthUI();
        this.showSuccessMessage('Başarıyla çıkış yaptınız!');
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
                document.getElementById('userProfileDropdown').classList.toggle('active');
            });

            document.querySelector('.nav-icons').insertBefore(userBtn, document.querySelector('.cart-icon'));
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
    }
}

// Global modal functions
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function openRegisterModal() {
    document.getElementById('registerModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
    
    // Close dropdown
    const languageSelector = document.querySelector('.language-selector');
    if (languageSelector) {
        languageSelector.classList.remove('active');
    }
    
    // Close mobile dropdown
    const mobileLanguageSelector = document.querySelector('.mobile-language-selector');
    if (mobileLanguageSelector) {
        mobileLanguageSelector.classList.remove('active');
    }
}

function toggleMobileLanguageDropdown() {
    const mobileLanguageSelector = document.querySelector('.mobile-language-selector');
    if (mobileLanguageSelector) {
        console.log('Toggling mobile language dropdown');
        mobileLanguageSelector.classList.toggle('active');
    }
}

function toggleLangDropdown() {
    console.log('🌍 Dil dropdown toggle');
    const dropdown = document.getElementById('languageDropdown');
    const selector = document.querySelector('.language-selector');
    
    if (dropdown && selector) {
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
                'categories.aaa': 'AAA Oyunlar',
                'categories.aaa.desc': 'En yeni çıkan oyunlar',
                'categories.currency': 'Oyun İçi Para',
                'categories.currency.desc': 'V-Bucks, Riot Points ve daha fazlası',
                'categories.giftcards': 'Hediye Kartları',
                'categories.giftcards.desc': 'Steam, PSN, Xbox hediye kartları',
                'products.title': 'Öne Çıkan Ürünler',
                'products.addtocart': 'Sepete Ekle',
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
                'cart.checkout': 'Satın Al',
                'footer.description': 'En güvenilir oyun kodu mağazası',
                'footer.categories': 'Kategoriler',
                'footer.steam': 'Steam Oyunları',
                'footer.playstation': 'PlayStation Kodları',
                'footer.xbox': 'Xbox Kodları',
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
                'theme.toggle': 'Tema'
            },
            en: {
                'nav.home': 'Home',
                'nav.products': 'Products',
                'nav.categories': 'Categories',
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
                'categories.aaa': 'AAA Games',
                'categories.aaa.desc': 'Latest released games',
                'categories.currency': 'In-Game Currency',
                'categories.currency.desc': 'V-Bucks, Riot Points and more',
                'categories.giftcards': 'Gift Cards',
                'categories.giftcards.desc': 'Steam, PSN, Xbox gift cards',
                'products.title': 'Featured Products',
                'products.addtocart': 'Add to Cart',
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
                'cart.checkout': 'Checkout',
                'footer.description': 'Most trusted game codes store',
                'footer.categories': 'Categories',
                'footer.steam': 'Steam Games',
                'footer.playstation': 'PlayStation Codes',
                'footer.xbox': 'Xbox Codes',
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
                'theme.toggle': 'Theme'
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
                console.log(`Translating ${key}: ${element.textContent} → ${translation}`);
                element.textContent = translation;
            } else {
                console.warn(`Missing translation for key: ${key} in language: ${lang}`);
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
        this.initCursorTrail();
        this.initRippleEffects();
        this.initScrollAnimations();
    }

    initLoadingScreen() {
        this.loadingScreen = document.getElementById('loadingScreen');
        if (!this.loadingScreen) return;

        // Hide loading screen after 1 second
        setTimeout(() => {
            // First show the main content
            document.body.classList.remove('loading');
            
            // Make hero title immediately visible
            const heroTitle = document.querySelector('.hero-content h1');
            if (heroTitle) {
                heroTitle.style.opacity = '1';
                heroTitle.style.transform = 'translateX(0)';
                heroTitle.classList.add('text-glow');
            }
            
            // Then hide loading screen
            this.loadingScreen.classList.add('hide');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
            }, 800);
        }, 1000);
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

// Initialize all managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Keyco initializing...');
    
    // Initialize all components
    try {
        window.themeManager = new ThemeManager();
        console.log('✅ ThemeManager initialized');
        
        window.cart = new ShoppingCart();
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
        window.cart.toggleCart();
    }
    
    // Focus search with Ctrl+K
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-box input').focus();
    }
});
