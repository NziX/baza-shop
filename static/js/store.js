// Baza Shop Client-side Store Logic

let currentCategory = 'All';
let currentProducts = [];
let storeSettings = {
    store_name: "Baza Shop",
    currency_symbol: "RWF",
    delivery_fee: 3000.0,
    free_shipping_threshold: 75000.0,
    whatsapp_number: "",
    instagram_handle: "baza_shop2"
};

// Currency formatting helper — automatically adapts to storeSettings.currency_symbol
function fmt(amount) {
    const sym = storeSettings.currency_symbol || "RWF";
    const isShortSymbol = sym.length <= 2; // e.g. $ € £
    const formatted = Math.round(amount).toLocaleString('en-RW');
    return isShortSymbol ? `${sym}${formatted}` : `${formatted} ${sym}`;
}

// Cart State (Persisted in LocalStorage)
let cart = JSON.parse(localStorage.getItem('baza_cart') || '[]');
let activeCoupon = JSON.parse(localStorage.getItem('baza_coupon') || 'null');
let activeModalProduct = null;
let modalSelectedQty = 1;

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    initLucide();
    loadStoreSettings();
    loadCategories();
    fetchProducts();
    updateCartUI();

    // Setup live search listeners
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    let debounceTimer;
    const handleSearch = (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        debounceTimer = setTimeout(() => {
            fetchProducts();
        }, 300);
    };

    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (mobileSearchInput) mobileSearchInput.addEventListener('input', handleSearch);

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (mobileSearchInput) mobileSearchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            fetchProducts();
        });
    }
});

function initLucide() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ------------------- API CALLS & DATA ------------------- //

async function loadStoreSettings() {
    try {
        const res = await fetch('/api/store-info');
        const data = await res.json();
        storeSettings = { ...storeSettings, ...data };

        // Update announcement bar
        if (data.announcement_text) {
            document.getElementById('announcementText').textContent = data.announcement_text;
        }

        // Update Instagram links
        if (data.instagram_handle) {
            const igUrl = `https://www.instagram.com/${data.instagram_handle}`;
            const topIg = document.getElementById('topInstagramLink');
            const headIg = document.getElementById('headerInstagramLink');
            if (topIg) {
                topIg.href = igUrl;
                topIg.querySelector('span').textContent = `@${data.instagram_handle}`;
            }
            if (headIg) headIg.href = igUrl;
        }

        // Update WhatsApp links
        if (data.whatsapp_number) {
            const cleanNum = data.whatsapp_number.replace(/[^\d]/g, '');
            const waBtn = document.getElementById('footerWaBtn');
            if (waBtn) waBtn.href = `https://wa.me/${cleanNum}`;
        }
    } catch (err) {
        console.error("Error loading store info:", err);
    }
}

async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const categories = await res.json();
        const container = document.getElementById('categoryPillsContainer');
        
        let html = `
            <button onclick="selectCategory('All')" class="category-pill ${currentCategory === 'All' ? 'active-pill' : ''} px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition">
                All Products
            </button>
        `;

        categories.forEach(cat => {
            html += `
                <button onclick="selectCategory('${cat.name}')" class="category-pill ${currentCategory === cat.name ? 'active-pill' : ''} px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5">
                    <span>${cat.name}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-normal">${cat.count}</span>
                </button>
            `;
        });

        container.innerHTML = html;
        initLucide();
    } catch (err) {
        console.error("Error loading categories:", err);
    }
}

async function fetchProducts() {
    try {
        const searchInput = document.getElementById('searchInput');
        const searchVal = searchInput ? searchInput.value.trim() : '';
        const sortVal = document.getElementById('sortSelect').value;

        let url = `/api/products?sort=${encodeURIComponent(sortVal)}`;
        if (currentCategory && currentCategory !== 'All') {
            url += `&category=${encodeURIComponent(currentCategory)}`;
        }
        if (searchVal) {
            url += `&search=${encodeURIComponent(searchVal)}`;
        }

        const res = await fetch(url);
        currentProducts = await res.json();
        renderProducts(currentProducts);
        updateHeroFeaturedCard(currentProducts);

        // Update filter status bar
        const statusEl = document.getElementById('filterStatus');
        const statusText = document.getElementById('filterStatusText');
        const resetBtn = document.getElementById('resetFiltersBtn');

        if (searchVal || currentCategory !== 'All') {
            statusEl.classList.remove('hidden');
            resetBtn.classList.remove('hidden');
            let text = `Showing ${currentProducts.length} product(s)`;
            if (currentCategory !== 'All') text += ` in "${currentCategory}"`;
            if (searchVal) text += ` matching "${searchVal}"`;
            statusText.textContent = text;
        } else {
            statusEl.classList.add('hidden');
            resetBtn.classList.add('hidden');
        }
    } catch (err) {
        console.error("Error fetching products:", err);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    const empty = document.getElementById('noProductsFound');

    if (!products || products.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        initLucide();
        return;
    }

    empty.classList.add('hidden');

    grid.innerHTML = products.map(p => {
        const discountBadge = p.compare_at_price && p.compare_at_price > p.price
            ? `<span class="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-10">SALE</span>`
            : (p.is_trending ? `<span class="absolute top-3 left-3 bg-amber-500 text-stone-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-10">HOT</span>` : '');

        return `
            <div class="group bg-[#151922] border border-slate-800/80 hover:border-brand-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/10 flex flex-col relative">
                ${discountBadge}
                
                <!-- Product Image -->
                <div class="relative overflow-hidden aspect-square bg-[#0b0d13] cursor-pointer" onclick="openProductModalById(${p.id})">
                    <img 
                        src="${p.image_url}" 
                        alt="${p.name}" 
                        class="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        loading="lazy"
                    >
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span class="px-3.5 py-1.5 rounded-xl bg-white/90 text-stone-900 text-xs font-semibold backdrop-blur-sm flex items-center gap-1 shadow-lg">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Quick View
                        </span>
                    </div>
                </div>

                <!-- Product Body -->
                <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider mb-1">${p.category}</div>
                        <h3 class="font-display font-bold text-sm text-white group-hover:text-amber-300 transition-colors line-clamp-1 cursor-pointer" onclick="openProductModalById(${p.id})">
                            ${p.name}
                        </h3>
                        <p class="text-slate-400 text-xs line-clamp-2 mt-1.5 font-light leading-relaxed">
                            ${p.description || ''}
                        </p>
                    </div>

                    <!-- Price & Cart Action -->
                    <div class="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <div>
                            <div class="text-base font-extrabold text-amber-300">
                                ${fmt(p.price)}
                            </div>
                            ${p.compare_at_price ? `<div class="text-[11px] text-slate-500 line-through">${fmt(p.compare_at_price)}</div>` : ''}
                        </div>

                        <button onclick="quickAddToCart(${p.id})" class="px-3 py-2 bg-[#1f2533] hover:bg-brand-500 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 border border-slate-700/60 hover:border-brand-400 shadow-sm">
                            <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i>
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    initLucide();
}

function updateHeroFeaturedCard(products) {
    const card = document.getElementById('heroFeaturedCard');
    if (!card) return;

    const featured = products && products.length > 0 
        ? (products.find(p => p.is_featured == 1) || products[0])
        : null;

    if (!featured) {
        card.innerHTML = `
            <div class="w-full h-[400px] bg-gradient-to-br from-[#1a1f2c] via-[#121622] to-[#0d1017] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <div class="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center mb-3 shadow-xl shadow-pink-500/20">
                    <img src="/static/images/baza-logo.png" alt="Baza Shop Logo" class="w-full h-full rounded-full object-cover bg-white">
                </div>
                <span class="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-1">OFFICIAL INSTAGRAM SHOP</span>
                <h3 class="font-display text-2xl font-extrabold text-white">Baza Shop</h3>
                <p class="text-[11px] text-amber-300 font-bold uppercase tracking-wider mb-2">JUST ASK</p>
                <p class="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">Modern lighting fixtures, smart ambient lamps & curated home decor.</p>
                <a href="https://www.instagram.com/${storeSettings.instagram_handle || 'baza_shop2'}" target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 text-white text-xs font-bold shadow-lg hover:opacity-95 transition flex items-center gap-2.5 group">
                    <img src="/static/images/baza-logo.png" alt="Baza Shop" class="w-5 h-5 rounded-full object-cover group-hover:scale-110 transition-transform">
                    <i data-lucide="instagram" class="w-4 h-4"></i>
                    <span>Follow @${storeSettings.instagram_handle || 'baza_shop2'}</span>
                </a>
            </div>
        `;
    } else {
        card.innerHTML = `
            <img 
                src="${featured.image_url}" 
                alt="${featured.name}" 
                class="w-full h-[400px] object-cover group-hover:scale-105 transition duration-700"
            >
            <div class="absolute inset-0 bg-gradient-to-t from-[#0c0e12] via-[#0c0e12]/40 to-transparent"></div>
            <div class="absolute bottom-5 left-5 right-5 p-4 rounded-xl bg-[#141822]/90 backdrop-blur-md border border-slate-700/70">
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-xs font-semibold text-amber-400 tracking-wider uppercase">Featured Piece</span>
                    <span class="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">In Stock</span>
                </div>
                <h4 class="text-sm font-bold text-white mb-2 cursor-pointer hover:text-amber-300 transition" onclick="openProductModalById(${featured.id})">${featured.name}</h4>
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-lg font-extrabold text-amber-300">${fmt(featured.price)}</span>
                        ${featured.compare_at_price ? `<span class="text-xs text-slate-400 line-through ml-1.5">${fmt(featured.compare_at_price)}</span>` : ''}
                    </div>
                    <button onclick="quickAddToCart(${featured.id})" class="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-400 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-md">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
    }
    initLucide();
}

function selectCategory(cat) {
    currentCategory = cat;
    loadCategories();
    fetchProducts();
}

function applyFilters() {
    fetchProducts();
}

function resetFilters() {
    currentCategory = 'All';
    const s1 = document.getElementById('searchInput');
    const s2 = document.getElementById('mobileSearchInput');
    const sort = document.getElementById('sortSelect');
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    if (sort) sort.value = 'featured';
    document.getElementById('clearSearchBtn').classList.add('hidden');
    loadCategories();
    fetchProducts();
}

// ------------------- CART SYSTEM ------------------- //

function saveCart() {
    localStorage.setItem('baza_cart', JSON.stringify(cart));
    localStorage.setItem('baza_coupon', JSON.stringify(activeCoupon));
    updateCartUI();
}

function quickAddToCart(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = cart.findIndex(it => it.id === productId);
    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            quantity: 1
        });
    }

    saveCart();
    showToast(`Added "${product.name}" to your cart!`);
    openCartDrawer();
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(it => it.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(it => it.id !== productId);
    }
    saveCart();
}

function removeFromCart(productId) {
    cart = cart.filter(it => it.id !== productId);
    saveCart();
    showToast("Item removed from cart");
}

function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;

    if (activeCoupon) {
        if (subtotal >= activeCoupon.min_order_amount) {
            discount = subtotal * (activeCoupon.discount_percent / 100);
        } else {
            // Coupon min order no longer met
            activeCoupon = null;
            localStorage.removeItem('baza_coupon');
        }
    }

    const freeThreshold = parseFloat(storeSettings.free_shipping_threshold || 75.0);
    const standardFee = parseFloat(storeSettings.delivery_fee || 5.0);
    const shipping = (subtotal - discount) >= freeThreshold || cart.length === 0 ? 0 : standardFee;
    const total = Math.max(0, subtotal - discount + shipping);

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        shipping: parseFloat(shipping.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        freeThreshold
    };
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cartCountBadge');
    const drawerCount = document.getElementById('drawerCartCount');

    if (badge) {
        badge.textContent = totalCount;
        badge.classList.remove('cart-badge-bounce');
        void badge.offsetWidth;
        badge.classList.add('cart-badge-bounce');
    }
    if (drawerCount) drawerCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

    const itemsContainer = document.getElementById('cartItemsContainer');
    const emptyView = document.getElementById('emptyCartView');
    const cartFooter = document.getElementById('cartFooter');

    if (cart.length === 0) {
        if (itemsContainer) itemsContainer.innerHTML = '';
        if (emptyView) emptyView.classList.remove('hidden');
        if (cartFooter) cartFooter.classList.add('hidden');
    } else {
        if (emptyView) emptyView.classList.add('hidden');
        if (cartFooter) cartFooter.classList.remove('hidden');

        if (itemsContainer) {
            itemsContainer.innerHTML = cart.map(item => `
                <div class="flex items-center gap-3 bg-[#171b26] p-3 rounded-xl border border-slate-800">
                    <img src="${item.image_url}" alt="${item.name}" class="w-14 h-14 rounded-lg object-cover bg-black/40">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                        <div class="text-xs font-bold text-amber-300 mt-0.5">${fmt(item.price)}</div>
                        
                        <div class="flex items-center gap-2 mt-2">
                            <div class="flex items-center border border-slate-700 bg-[#12151d] rounded-lg">
                                <button onclick="updateCartQuantity(${item.id}, -1)" class="px-2 py-0.5 text-slate-400 hover:text-white transition">
                                    <i data-lucide="minus" class="w-3 h-3"></i>
                                </button>
                                <span class="px-2 text-xs font-bold text-white">${item.quantity}</span>
                                <button onclick="updateCartQuantity(${item.id}, 1)" class="px-2 py-0.5 text-slate-400 hover:text-white transition">
                                    <i data-lucide="plus" class="w-3 h-3"></i>
                                </button>
                            </div>

                            <button onclick="removeFromCart(${item.id})" class="text-[11px] text-slate-400 hover:text-rose-400 transition ml-auto">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Update totals & free shipping bar
    const totals = calculateTotals();
    const subtotalEl = document.getElementById('cartSubtotalText');
    const discountRow = document.getElementById('cartDiscountRow');
    const discountEl = document.getElementById('cartDiscountText');
    const shippingEl = document.getElementById('cartShippingText');
    const totalEl = document.getElementById('cartTotalText');

    if (subtotalEl) subtotalEl.textContent = fmt(totals.subtotal);
    if (totalEl) totalEl.textContent = fmt(totals.total);
    if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'FREE' : fmt(totals.shipping);

    if (discountRow) {
        if (totals.discount > 0) {
            discountRow.classList.remove('hidden');
            discountEl.textContent = `-${fmt(totals.discount)} (${activeCoupon.code})`;
        } else {
            discountRow.classList.add('hidden');
        }
    }

    // Free shipping progress
    const notice = document.getElementById('freeShippingNotice');
    const percentEl = document.getElementById('freeShippingPercent');
    const bar = document.getElementById('freeShippingBar');

    if (bar && totals.subtotal > 0) {
        const pct = Math.min(100, Math.round((totals.subtotal / totals.freeThreshold) * 100));
        bar.style.width = `${pct}%`;
        if (percentEl) percentEl.textContent = `${pct}%`;

        if (pct >= 100) {
            notice.innerHTML = `<span class="text-emerald-400 font-bold">🎉 You've unlocked FREE Express Shipping!</span>`;
        } else {
            const needed = totals.freeThreshold - totals.subtotal;
            notice.textContent = `Add ${fmt(needed)} more to unlock Free Express Shipping`;
        }
    } else if (bar) {
        bar.style.width = '0%';
        if (percentEl) percentEl.textContent = '0%';
        if (notice) notice.textContent = `Free shipping on orders over ${fmt(totals.freeThreshold)}`;
    }

    initLucide();
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (drawer.classList.contains('translate-x-full')) {
        openCartDrawer();
    } else {
        closeCartDrawer();
    }
}

function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    drawer.classList.remove('translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closeCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    drawer.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

async function applyCoupon() {
    const input = document.getElementById('couponInput');
    const msg = document.getElementById('couponMessage');
    const code = input.value.trim();

    if (!code) return;

    const totals = calculateTotals();
    try {
        const res = await fetch('/api/coupon/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, subtotal: totals.subtotal })
        });
        const data = await res.json();

        msg.classList.remove('hidden');
        if (data.valid) {
            activeCoupon = {
                code: data.code,
                discount_percent: data.discount_percent,
                min_order_amount: 0
            };
            msg.className = "text-xs text-emerald-400 font-semibold";
            msg.textContent = data.message;
            saveCart();
            showToast(`Promo code ${data.code} applied!`);
        } else {
            msg.className = "text-xs text-rose-400 font-semibold";
            msg.textContent = data.message || "Invalid coupon code";
        }
    } catch (err) {
        console.error("Coupon error:", err);
    }
}

// ------------------- PRODUCT MODAL ------------------- //

async function openProductModalById(productId) {
    try {
        const res = await fetch(`/api/products/${productId}`);
        const product = await res.json();
        activeModalProduct = product;
        modalSelectedQty = 1;

        document.getElementById('modalProductImage').src = product.image_url;
        document.getElementById('modalProductName').textContent = product.name;
        document.getElementById('modalProductCategory').textContent = product.category;
        document.getElementById('modalProductPrice').textContent = fmt(product.price);
        
        const compEl = document.getElementById('modalProductComparePrice');
        if (product.compare_at_price) {
            compEl.textContent = fmt(product.compare_at_price);
            compEl.classList.remove('hidden');
        } else {
            compEl.classList.add('hidden');
        }

        document.getElementById('modalProductDesc').textContent = product.description || '';
        document.getElementById('modalQtyDisplay').textContent = '1';

        // Specs
        const specsContainer = document.getElementById('modalProductSpecs');
        if (product.specs && typeof product.specs === 'object') {
            specsContainer.innerHTML = Object.entries(product.specs).map(([k, v]) => `
                <div class="flex justify-between py-1 border-b border-slate-800/60">
                    <span class="text-slate-400">${k}:</span>
                    <span class="font-medium text-white">${v}</span>
                </div>
            `).join('');
            specsContainer.classList.remove('hidden');
        } else {
            specsContainer.classList.add('hidden');
        }

        // Reviews
        const reviewsCount = product.reviews ? product.reviews.length : 0;
        document.getElementById('modalReviewsCount').textContent = reviewsCount;
        document.getElementById('modalProductRatingText').textContent = `${product.rating_avg || 5.0} (${reviewsCount} review${reviewsCount === 1 ? '' : 's'})`;
        
        const starsContainer = document.getElementById('modalProductStars');
        starsContainer.innerHTML = generateStarsHTML(product.rating_avg || 5.0);

        renderModalReviews(product.reviews || []);

        document.getElementById('modalAddToCartBtn').onclick = () => {
            for (let i = 0; i < modalSelectedQty; i++) {
                quickAddToCart(product.id);
            }
            closeProductModal();
        };

        document.getElementById('productModal').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        initLucide();
    } catch (err) {
        console.error("Error loading product detail:", err);
    }
}

function adjustModalQty(delta) {
    modalSelectedQty = Math.max(1, modalSelectedQty + delta);
    document.getElementById('modalQtyDisplay').textContent = modalSelectedQty;
}

function closeProductModal() {
    document.getElementById('productModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function toggleProductReviews() {
    const rev = document.getElementById('modalReviewsContainer');
    rev.classList.toggle('hidden');
}

function renderModalReviews(reviews) {
    const container = document.getElementById('modalReviewsContainer');
    if (!reviews || reviews.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-xs italic">No reviews yet. Be the first to review this product!</p>`;
        return;
    }

    container.innerHTML = reviews.map(r => `
        <div class="bg-[#181d28] p-3 rounded-xl border border-slate-800 text-xs">
            <div class="flex items-center justify-between mb-1">
                <span class="font-bold text-white">${r.customer_name}</span>
                <span class="text-amber-400 text-[10px]">${'★'.repeat(r.rating)}</span>
            </div>
            <p class="text-slate-300">${r.comment}</p>
        </div>
    `).join('');
}

function generateStarsHTML(rating) {
    let html = '';
    const full = Math.floor(rating);
    for (let i = 0; i < full; i++) html += '★';
    if (rating % 1 >= 0.5) html += '½';
    return html;
}

// ------------------- CHECKOUT & ORDER SUBMISSION ------------------- //

function openCheckoutModal() {
    if (cart.length === 0) {
        showToast("Your cart is empty!");
        return;
    }

    closeCartDrawer();
    const totals = calculateTotals();
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    document.getElementById('checkoutItemsCount').textContent = totalCount;
    document.getElementById('checkoutSubtotal').textContent = fmt(totals.subtotal);
    document.getElementById('checkoutShipping').textContent = totals.shipping === 0 ? 'FREE' : fmt(totals.shipping);
    document.getElementById('checkoutTotal').textContent = fmt(totals.total);

    const discRow = document.getElementById('checkoutDiscountRow');
    if (totals.discount > 0) {
        discRow.classList.remove('hidden');
        document.getElementById('checkoutDiscount').textContent = `-${fmt(totals.discount)}`;
    } else {
        discRow.classList.add('hidden');
    }

    document.getElementById('checkoutModal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    initLucide();
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

async function submitOrder(e) {
    e.preventDefault();

    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.innerHTML = `<span>Processing Order...</span>`;

    const orderPayload = {
        customer_name: document.getElementById('custName').value.trim(),
        customer_phone: document.getElementById('custPhone').value.trim(),
        customer_email: document.getElementById('custEmail').value.trim(),
        address: document.getElementById('custAddress').value.trim(),
        city: document.getElementById('custCity').value.trim(),
        notes: document.getElementById('custNotes').value.trim(),
        payment_method: document.querySelector('input[name="paymentMethod"]:checked').value,
        coupon_code: activeCoupon ? activeCoupon.code : "",
        items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity
        }))
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        const result = await res.json();

        if (res.ok && result.success) {
            // Clear cart
            cart = [];
            activeCoupon = null;
            saveCart();

            closeCheckoutModal();

            // Populate Success Modal
            document.getElementById('successOrderCode').textContent = result.order_code;
            document.getElementById('successOrderTotal').textContent = fmt(result.total);

            const waBtn = document.getElementById('successWhatsAppBtn');
            if (result.whatsapp_link) {
                waBtn.href = result.whatsapp_link;
                waBtn.classList.remove('hidden');
            } else {
                waBtn.classList.add('hidden');
            }

            document.getElementById('orderSuccessModal').classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
            initLucide();
        } else {
            alert(result.error || "Failed to place order. Please try again.");
        }
    } catch (err) {
        console.error("Order error:", err);
        alert("An error occurred while placing your order.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Confirm Order Now</span>`;
        initLucide();
    }
}

function closeSuccessModal() {
    document.getElementById('orderSuccessModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// ------------------- ORDER TRACKING ------------------- //

function openTrackModal() {
    document.getElementById('trackModal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    initLucide();
}

function closeTrackModal() {
    document.getElementById('trackModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

async function searchTrackOrder() {
    const code = document.getElementById('trackCodeInput').value.trim();
    const container = document.getElementById('trackResultContainer');
    if (!code) return;

    container.innerHTML = `<div class="text-center py-4 text-slate-400">Looking up ${code}...</div>`;
    container.classList.remove('hidden');

    try {
        const res = await fetch(`/api/orders/track/${encodeURIComponent(code)}`);
        const order = await res.json();

        if (!res.ok || order.error) {
            container.innerHTML = `<div class="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">Order "${code}" was not found. Please verify the code.</div>`;
            return;
        }

        const statuses = ['pending', 'processing', 'shipped', 'delivered'];
        const currentIdx = statuses.indexOf(order.status.toLowerCase());

        container.innerHTML = `
            <div class="bg-[#181d28] p-4 rounded-xl border border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-mono font-bold text-amber-300 text-sm">${order.order_code}</span>
                        <div class="text-[11px] text-slate-400">${new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">
                        ${order.status}
                    </span>
                </div>

                <!-- Status Step Timeline -->
                <div class="py-2">
                    <div class="flex items-center justify-between relative">
                        ${statuses.map((st, i) => {
                            const isDone = i <= currentIdx;
                            return `
                                <div class="flex flex-col items-center z-10">
                                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isDone ? 'bg-amber-500 text-stone-900 shadow-md shadow-amber-500/30' : 'bg-slate-800 text-slate-400'}">
                                        ${i + 1}
                                    </div>
                                    <span class="text-[10px] mt-1 capitalize ${isDone ? 'text-amber-300 font-semibold' : 'text-slate-500'}">${st}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Recipient & Items -->
                <div class="border-t border-slate-800 pt-2 space-y-1 text-slate-300">
                    <div><strong class="text-white">Customer:</strong> ${order.customer_name}</div>
                    <div><strong class="text-white">Delivery to:</strong> ${order.address}, ${order.city}</div>
                    <div><strong class="text-white">Total:</strong> ${fmt(order.total)} (${order.payment_method.toUpperCase()})</div>
                </div>
            </div>
        `;
        initLucide();
    } catch (err) {
        console.error("Track error:", err);
    }
}

function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'badge-pending';
        case 'processing': return 'badge-processing';
        case 'shipped': return 'badge-shipped';
        case 'delivered': return 'badge-delivered';
        default: return 'badge-cancelled';
    }
}

// ------------------- TOAST NOTIFICATIONS ------------------- //

function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMsg');
    const icon = document.getElementById('toastIcon');

    if (!toast) return;

    msg.textContent = message;
    icon.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>`;
    initLucide();

    toast.classList.remove('hidden');
    toast.classList.add('flex');

    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
    }, 3500);
}
