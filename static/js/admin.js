// Baza Shop Owner Control Panel Logic

// ---- Currency formatter (mirrors store.js fmt()) ----
let _adminCurrencySymbol = 'RWF';
(async () => {
    try {
        const r = await fetch('/api/settings');
        const d = await r.json();
        _adminCurrencySymbol = d.currency_symbol || 'RWF';
    } catch(e) {}
})();
function fmtA(amount) {
    const sym = _adminCurrencySymbol || 'RWF';
    const num = Math.round(Number(amount));
    const formatted = num.toLocaleString('en-RW');
    const isShortSymbol = sym.length <= 2;
    return isShortSymbol ? `${sym}${formatted}` : `${formatted} ${sym}`;
}
// --------------------------------------------------------

let currentAdminTab = 'dashboard';
let adminProductsList = [];
let adminOrdersList = [];
let activeOrderFilter = 'All';

document.addEventListener('DOMContentLoaded', () => {
    initLucide();
    checkAdminAuth();
    initDropZone();
    initGlobalDragAndDrop();
});

function initLucide() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ------------------- AUTHENTICATION ------------------- //

async function checkAdminAuth() {
    try {
        const res = await fetch('/api/admin/check-auth');
        const data = await res.json();
        if (data.authenticated) {
            showAdminDashboard();
        } else {
            showLoginScreen();
        }
    } catch (err) {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminApp').classList.add('hidden');
}

function showAdminDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    loadDashboardMetrics();
    loadAdminProducts();
    loadAdminOrders();
    loadAdminCoupons();
    loadAdminSettings();
    initLucide();
}

function togglePinVisibility() {
    const input = document.getElementById('adminPinInput');
    const icon = document.getElementById('pinEyeIcon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    initLucide();
}

function fillDefaultPin() {
    const input = document.getElementById('adminPinInput');
    if (input) {
        input.value = 'admin123';
        input.focus();
        showAdminToast("Default PIN 'admin123' filled!");
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const pin = document.getElementById('adminPinInput').value.trim();
    const errorEl = document.getElementById('loginErrorMsg');
    const btn = document.getElementById('loginBtn');

    btn.disabled = true;
    errorEl.classList.add('hidden');

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showAdminDashboard();
        } else {
            errorEl.textContent = data.error || "Invalid PIN. Please try again.";
            errorEl.classList.remove('hidden');
        }
    } catch (err) {
        errorEl.textContent = "Error connecting to server.";
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
}

async function handleAdminLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
}

// ------------------- PASSWORD RESET ------------------- //

function openResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    const keyInput = document.getElementById('resetRecoveryKey');
    const newPinInput = document.getElementById('resetNewPin');
    const confirmPinInput = document.getElementById('resetConfirmPin');
    const errorMsg = document.getElementById('resetErrorMsg');
    const successMsg = document.getElementById('resetSuccessMsg');

    if (keyInput) keyInput.value = '';
    if (newPinInput) newPinInput.value = '';
    if (confirmPinInput) confirmPinInput.value = '';
    if (errorMsg) errorMsg.classList.add('hidden');
    if (successMsg) successMsg.classList.add('hidden');

    if (modal) {
        modal.classList.remove('hidden');
        initLucide();
    }
}

function closeResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    if (modal) modal.classList.add('hidden');
}

async function handleResetPassword(e) {
    e.preventDefault();
    const recoveryKey = document.getElementById('resetRecoveryKey').value.trim();
    const newPin = document.getElementById('resetNewPin').value.trim();
    const confirmPin = document.getElementById('resetConfirmPin').value.trim();
    const errorMsg = document.getElementById('resetErrorMsg');
    const successMsg = document.getElementById('resetSuccessMsg');
    const submitBtn = document.getElementById('resetSubmitBtn');

    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');

    if (!recoveryKey) {
        errorMsg.textContent = "Please enter your master recovery key.";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (newPin !== confirmPin) {
        errorMsg.textContent = "New passwords do not match. Please verify.";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (newPin.length < 3) {
        errorMsg.textContent = "Password must be at least 3 characters long.";
        errorMsg.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Updating Password...";

    try {
        const res = await fetch('/api/admin/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recovery_key: recoveryKey,
                new_pin: newPin
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            successMsg.textContent = data.message;
            successMsg.classList.remove('hidden');

            // Pre-fill the login input
            const loginInput = document.getElementById('adminPinInput');
            if (loginInput) loginInput.value = newPin;

            showAdminToast("Password updated successfully!");

            setTimeout(() => {
                closeResetPasswordModal();
            }, 1600);
        } else {
            errorMsg.textContent = data.error || "Failed to reset password.";
            errorMsg.classList.remove('hidden');
        }
    } catch (err) {
        errorMsg.textContent = "Server connection error.";
        errorMsg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save New Password";
    }
}

// ------------------- CHANGE PASSWORD INSIDE CONTROL PANEL ------------------- //

function openChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    const currentInput = document.getElementById('changeCurrentPin');
    const newInput = document.getElementById('changeNewPin');
    const confirmInput = document.getElementById('changeConfirmPin');
    const errorMsg = document.getElementById('changeErrorMsg');
    const successMsg = document.getElementById('changeSuccessMsg');

    if (currentInput) currentInput.value = '';
    if (newInput) newInput.value = '';
    if (confirmInput) confirmInput.value = '';
    if (errorMsg) errorMsg.classList.add('hidden');
    if (successMsg) successMsg.classList.add('hidden');

    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        initLucide();
    }
}

function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const currentPin = document.getElementById('changeCurrentPin').value.trim();
    const newPin = document.getElementById('changeNewPin').value.trim();
    const confirmPin = document.getElementById('changeConfirmPin').value.trim();
    const errorMsg = document.getElementById('changeErrorMsg');
    const successMsg = document.getElementById('changeSuccessMsg');
    const submitBtn = document.getElementById('changeSubmitBtn');

    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');

    if (!currentPin) {
        errorMsg.textContent = "Please enter your current password.";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (newPin !== confirmPin) {
        errorMsg.textContent = "New passwords do not match. Please re-type.";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (newPin.length < 3) {
        errorMsg.textContent = "New password must be at least 3 characters.";
        errorMsg.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";

    try {
        const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_pin: currentPin,
                new_pin: newPin
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            successMsg.textContent = data.message;
            successMsg.classList.remove('hidden');

            if (document.getElementById('settingAdminPin')) {
                document.getElementById('settingAdminPin').value = newPin;
            }

            showAdminToast("Admin password changed successfully!");

            setTimeout(() => {
                closeChangePasswordModal();
            }, 1500);
        } else {
            errorMsg.textContent = data.error || "Failed to change password.";
            errorMsg.classList.remove('hidden');
        }
    } catch (err) {
        errorMsg.textContent = "Server connection error.";
        errorMsg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Update Password Now";
    }
}

// ------------------- TAB SWITCHING ------------------- //

function switchTab(tabName) {
    currentAdminTab = tabName;

    // Hide all tab contents
    const contents = ['dashboard', 'products', 'orders', 'coupons', 'settings'];
    contents.forEach(t => {
        const el = document.getElementById(`tabContent-${t}`);
        const btn = document.getElementById(`tabBtn-${t}`);
        if (el) el.classList.add('hidden');
        if (btn) {
            btn.classList.remove('active-admin-tab', 'border-amber-400', 'text-amber-400');
            btn.classList.add('border-transparent', 'text-slate-400');
        }
    });

    // Show active tab
    const activeEl = document.getElementById(`tabContent-${tabName}`);
    const activeBtn = document.getElementById(`tabBtn-${tabName}`);
    if (activeEl) activeEl.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.classList.add('active-admin-tab', 'border-amber-400', 'text-amber-400');
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
    }

    if (tabName === 'dashboard') loadDashboardMetrics();
    if (tabName === 'products') loadAdminProducts();
    if (tabName === 'orders') loadAdminOrders();
    if (tabName === 'coupons') loadAdminCoupons();
    if (tabName === 'settings') loadAdminSettings();

    initLucide();
}

// ------------------- METRICS & DASHBOARD ------------------- //

async function loadDashboardMetrics() {
    try {
        const res = await fetch('/api/admin/metrics');
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('metricRevenue').textContent = fmtA(data.revenue);
        document.getElementById('metricOrders').textContent = data.orders_count;
        document.getElementById('metricProducts').textContent = data.products_count;
        document.getElementById('metricLowStock').textContent = data.low_stock_count;
        document.getElementById('metricPendingOrders').textContent = data.pending_orders;

        const pendingBadge = document.getElementById('pendingBadge');
        if (data.pending_orders > 0) {
            pendingBadge.textContent = data.pending_orders;
            pendingBadge.classList.remove('hidden');
        } else {
            pendingBadge.classList.add('hidden');
        }

        renderRecentOrders(data.recent_orders || []);
        initLucide();
    } catch (err) {
        console.error("Metrics error:", err);
    }
}

function renderRecentOrders(orders) {
    const table = document.getElementById('dashboardRecentOrdersTable');
    if (!orders || orders.length === 0) {
        table.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">No orders placed yet.</td></tr>`;
        return;
    }

    table.innerHTML = orders.map(o => `
        <tr class="hover:bg-[#1b212f] transition">
            <td class="py-3 px-4 font-mono font-bold text-amber-300">${o.order_code}</td>
            <td class="py-3 px-4 font-semibold text-white">${o.customer_name}</td>
            <td class="py-3 px-4 text-slate-400">${o.customer_phone} • ${o.city}</td>
            <td class="py-3 px-4 font-bold text-white">${fmtA(o.total)}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(o.status)}">
                    ${o.status}
                </span>
            </td>
            <td class="py-3 px-4 text-slate-400 text-[11px]">${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// ------------------- PRODUCTS MANAGEMENT ------------------- //

async function loadAdminProducts() {
    try {
        const res = await fetch('/api/admin/products');
        if (!res.ok) return;
        adminProductsList = await res.json();
        renderAdminProducts(adminProductsList);
    } catch (err) {
        console.error("Products error:", err);
    }
}

function renderAdminProducts(products) {
    const table = document.getElementById('adminProductsTable');
    const countEl = document.getElementById('adminProductCount');
    countEl.textContent = `${products.length} product(s) in catalog`;

    if (products.length === 0) {
        table.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No products found. Click "Add New Product" to get started.</td></tr>`;
        return;
    }

    table.innerHTML = products.map(p => `
        <tr class="hover:bg-[#1b212f] transition">
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <img src="${p.image_url}" alt="${p.name}" class="w-10 h-10 rounded-lg object-cover bg-black/40 border border-slate-700">
                    <div>
                        <div class="font-bold text-white">${p.name}</div>
                        <div class="text-[11px] text-slate-400">SKU: ${p.slug}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4 text-slate-300 font-medium">${p.category}</td>
            <td class="py-3 px-4 font-bold text-amber-300">
                ${fmtA(p.price)}
                ${p.compare_at_price ? `<span class="block text-[10px] text-slate-500 line-through">${fmtA(p.compare_at_price)}</span>` : ''}
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.stock < 5 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-300'}">
                    ${p.stock} in stock
                </span>
            </td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-1.5">
                    ${p.is_featured ? `<span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">Featured</span>` : ''}
                    ${p.is_trending ? `<span class="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">Hot</span>` : ''}
                </div>
            </td>
            <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editProduct(${p.id})" class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition" title="Edit Product">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete Product">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    initLucide();
}

function filterAdminProducts() {
    const q = document.getElementById('adminProductSearch').value.toLowerCase().trim();
    if (!q) {
        renderAdminProducts(adminProductsList);
        return;
    }

    const filtered = adminProductsList.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q)
    );
    renderAdminProducts(filtered);
}

function openProductEditor(product = null) {
    const modal = document.getElementById('productEditorModal');
    const title = document.getElementById('productEditorTitle');

    if (product) {
        title.textContent = "Edit Product";
        document.getElementById('editProductId').value = product.id;
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodCategory').value = product.category;
        document.getElementById('prodPrice').value = product.price;
        document.getElementById('prodComparePrice').value = product.compare_at_price || '';
        document.getElementById('prodStock').value = product.stock;
        document.getElementById('prodImageUrl').value = product.image_url;
        document.getElementById('prodDesc').value = product.description || '';
        document.getElementById('prodIsFeatured').checked = !!product.is_featured;
        document.getElementById('prodIsTrending').checked = !!product.is_trending;

        if (product.image_url) {
            setDropZonePreview(product.image_url, product.name || "Current Product Photo");
        } else {
            resetDropZone();
        }
    } else {
        title.textContent = "Add New Product";
        document.getElementById('editProductId').value = '';
        document.getElementById('prodName').value = '';
        document.getElementById('prodCategory').value = 'Chandeliers';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodComparePrice').value = '';
        document.getElementById('prodStock').value = '15';
        document.getElementById('prodImageUrl').value = '';
        document.getElementById('prodDesc').value = '';
        document.getElementById('prodIsFeatured').checked = false;
        document.getElementById('prodIsTrending').checked = false;
        resetDropZone();
    }

    const manualUrl = document.getElementById('prodImageUrlManual');
    if (manualUrl) manualUrl.value = '';
    const urlContainer = document.getElementById('urlFieldContainer');
    if (urlContainer) urlContainer.classList.add('hidden');
    const urlLabel = document.getElementById('urlToggleLabel');
    if (urlLabel) urlLabel.textContent = "Or use an image web link";

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    initLucide();
}

function triggerFileInput() {
    const fileInput = document.getElementById('prodFileInput');
    if (fileInput) fileInput.click();
}

function toggleUrlField() {
    const container = document.getElementById('urlFieldContainer');
    const label = document.getElementById('urlToggleLabel');
    if (!container) return;
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (label) label.textContent = "Hide web link field";
    } else {
        container.classList.add('hidden');
        if (label) label.textContent = "Or use an image web link";
    }
}

function handleManualUrlInput(val) {
    const url = val.trim();
    document.getElementById('prodImageUrl').value = url;
    if (url) {
        setDropZonePreview(url, "Web Image Link");
    } else {
        resetDropZone();
    }
}

// ------------------- DRAG & DROP PHOTO UPLOAD ------------------- //

function initDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('prodFileInput');
    if (!dropZone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-amber-400', 'bg-amber-500/10', 'scale-[1.01]');
        }, false);
    });

    ['dragleave', 'dragend'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-amber-400', 'bg-amber-500/10', 'scale-[1.01]');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-amber-400', 'bg-amber-500/10', 'scale-[1.01]');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handlePhotoDrop(files[0]);
        }
    }, false);

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handlePhotoDrop(e.target.files[0]);
        }
    });
}

function initGlobalDragAndDrop() {
    // If user drops an image anywhere onto the products tab, open the product editor with that photo!
    const productsTab = document.getElementById('tabContent-products');
    if (!productsTab) return;

    window.addEventListener('dragover', (e) => {
        if (currentAdminTab === 'products') {
            e.preventDefault();
        }
    });

    window.addEventListener('drop', (e) => {
        const modal = document.getElementById('productEditorModal');
        // Only trigger global drop if modal is closed and on products tab
        if (currentAdminTab === 'products' && modal.classList.contains('hidden')) {
            const files = e.dataTransfer.files;
            if (files && files.length > 0 && files[0].type.startsWith('image/')) {
                e.preventDefault();
                openProductEditor();
                handlePhotoDrop(files[0]);
            }
        }
    });
}

async function handlePhotoDrop(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert("Please drop a valid image file (PNG, JPG, JPEG, WEBP, or GIF).");
        return;
    }

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    const previewContainer = document.getElementById('dropPreviewContainer');
    const prompt = document.getElementById('dropPrompt');
    const uploadingIndicator = document.getElementById('dropUploading');
    const previewImg = document.getElementById('dropPreviewImg');
    const fileNameEl = document.getElementById('uploadFileName');
    const statusBadge = document.getElementById('uploadStatusBadge');

    previewImg.src = localUrl;
    fileNameEl.textContent = file.name;
    prompt.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    uploadingIndicator.classList.remove('hidden');
    statusBadge.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Uploading...`;
    statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 mb-1';
    initLucide();

    // Auto-populate Title if empty
    const nameInput = document.getElementById('prodName');
    if (!nameInput.value.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        nameInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }

    // Upload to server
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/admin/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        uploadingIndicator.classList.add('hidden');
        if (res.ok && data.success) {
            document.getElementById('prodImageUrl').value = data.image_url;
            statusBadge.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Saved on Device`;
            statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 mb-1';
            showAdminToast(`Photo "${file.name}" uploaded successfully!`);
        } else {
            statusBadge.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3"></i> Upload Failed`;
            statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 mb-1';
            alert(data.error || "Failed to upload image.");
        }
    } catch (err) {
        uploadingIndicator.classList.add('hidden');
        console.error("Upload error:", err);
        statusBadge.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3"></i> Upload Error`;
        statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 mb-1';
    } finally {
        initLucide();
    }
}

function setDropZonePreview(imageUrl, filename = "Product Image") {
    const prompt = document.getElementById('dropPrompt');
    const previewContainer = document.getElementById('dropPreviewContainer');
    const previewImg = document.getElementById('dropPreviewImg');
    const fileNameEl = document.getElementById('uploadFileName');
    const statusBadge = document.getElementById('uploadStatusBadge');
    const uploadingIndicator = document.getElementById('dropUploading');

    previewImg.src = imageUrl;
    fileNameEl.textContent = filename;
    prompt.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    if (uploadingIndicator) uploadingIndicator.classList.add('hidden');

    statusBadge.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Active Photo`;
    statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 mb-1';
    initLucide();
}

function resetDropZone() {
    const prompt = document.getElementById('dropPrompt');
    const previewContainer = document.getElementById('dropPreviewContainer');
    const fileInput = document.getElementById('prodFileInput');
    const uploadingIndicator = document.getElementById('dropUploading');

    if (fileInput) fileInput.value = '';
    if (prompt) prompt.classList.remove('hidden');
    if (previewContainer) previewContainer.classList.add('hidden');
    if (uploadingIndicator) uploadingIndicator.classList.add('hidden');
    initLucide();
}

function clearUploadedImage(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    document.getElementById('prodImageUrl').value = '';
    const manualUrl = document.getElementById('prodImageUrlManual');
    if (manualUrl) manualUrl.value = '';
    resetDropZone();
}

function closeProductEditor() {
    document.getElementById('productEditorModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function editProduct(productId) {
    const p = adminProductsList.find(x => x.id === productId);
    if (p) openProductEditor(p);
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const editId = document.getElementById('editProductId').value;
    
    let finalImageUrl = document.getElementById('prodImageUrl').value.trim();
    if (!finalImageUrl) {
        finalImageUrl = "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80";
    }

    const payload = {
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        compare_at_price: document.getElementById('prodComparePrice').value ? parseFloat(document.getElementById('prodComparePrice').value) : null,
        stock: parseInt(document.getElementById('prodStock').value),
        image_url: finalImageUrl,
        description: document.getElementById('prodDesc').value.trim(),
        is_featured: document.getElementById('prodIsFeatured').checked,
        is_trending: document.getElementById('prodIsTrending').checked
    };

    const url = editId ? `/api/admin/products/${editId}` : '/api/admin/products';
    const method = editId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            closeProductEditor();
            showAdminToast(data.message);
            loadAdminProducts();
            loadDashboardMetrics();
        } else {
            alert(data.error || "Failed to save product.");
        }
    } catch (err) {
        console.error("Save product error:", err);
    }
}

async function deleteProduct(productId, productName) {
    if (!confirm(`Are you sure you want to remove "${productName}" from the store?`)) return;

    try {
        const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`Removed "${productName}"`);
            loadAdminProducts();
            loadDashboardMetrics();
        }
    } catch (err) {
        console.error("Delete error:", err);
    }
}

// ------------------- ORDERS MANAGEMENT ------------------- //

async function loadAdminOrders() {
    try {
        let url = '/api/admin/orders';
        if (activeOrderFilter !== 'All') {
            url += `?status=${encodeURIComponent(activeOrderFilter)}`;
        }
        const res = await fetch(url);
        if (!res.ok) return;
        adminOrdersList = await res.json();
        renderAdminOrders(adminOrdersList);
    } catch (err) {
        console.error("Orders error:", err);
    }
}

function filterAdminOrders(status) {
    activeOrderFilter = status;
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === status.toLowerCase()) {
            btn.classList.add('active-order-filter', 'text-white');
            btn.classList.remove('text-slate-400');
        } else {
            btn.classList.remove('active-order-filter', 'text-white');
            btn.classList.add('text-slate-400');
        }
    });
    loadAdminOrders();
}

function renderAdminOrders(orders) {
    const table = document.getElementById('adminOrdersTable');
    if (!orders || orders.length === 0) {
        table.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No orders found matching this filter.</td></tr>`;
        return;
    }

    table.innerHTML = orders.map(o => `
        <tr class="hover:bg-[#1b212f] transition">
            <td class="py-3 px-4 font-mono font-bold text-amber-300">
                ${o.order_code}
                <div class="text-[10px] text-slate-500 font-normal">${new Date(o.created_at).toLocaleDateString()}</div>
            </td>
            <td class="py-3 px-4">
                <div class="font-bold text-white">${o.customer_name}</div>
                <div class="text-[11px] text-slate-400">${o.customer_phone}</div>
                <div class="text-[11px] text-slate-500 truncate max-w-xs">${o.address}, ${o.city}</div>
            </td>
            <td class="py-3 px-4">
                <span class="text-slate-300 font-medium">${(o.items || []).length} items</span>
            </td>
            <td class="py-3 px-4">
                <div class="font-extrabold text-white text-sm">${fmtA(o.total)}</div>
                <div class="text-[10px] text-slate-400 uppercase">${o.payment_method}</div>
            </td>
            <td class="py-3 px-4">
                <!-- Status Change Selector -->
                <select onchange="updateOrderStatus(${o.id}, this.value)" class="bg-[#121620] border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none cursor-pointer ${getStatusBadgeClass(o.status)}">
                    <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                    <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td class="py-3 px-4 text-right">
                <button onclick="viewOrderDetail(${o.id})" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition">
                    View
                </button>
            </td>
        </tr>
    `).join('');

    initLucide();
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(data.message);
            loadDashboardMetrics();
            loadAdminOrders();
        }
    } catch (err) {
        console.error("Status update error:", err);
    }
}

function viewOrderDetail(orderId) {
    const o = adminOrdersList.find(x => x.id === orderId);
    if (!o) return;

    document.getElementById('detailOrderCode').textContent = o.order_code;
    const stEl = document.getElementById('detailOrderStatus');
    stEl.textContent = o.status.toUpperCase();
    stEl.className = `ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(o.status)}`;

    document.getElementById('detailOrderDate').textContent = new Date(o.created_at).toLocaleString();
    document.getElementById('detailCustomerName').textContent = o.customer_name;
    document.getElementById('detailCustomerPhone').textContent = o.customer_phone + (o.customer_email ? ` • ${o.customer_email}` : '');
    document.getElementById('detailCustomerAddress').textContent = `${o.address}, ${o.city}`;

    const notesContainer = document.getElementById('detailNotesContainer');
    if (o.notes) {
        notesContainer.textContent = `Note: "${o.notes}"`;
        notesContainer.classList.remove('hidden');
    } else {
        notesContainer.classList.add('hidden');
    }

    // Items
    const itemsContainer = document.getElementById('detailOrderItems');
    itemsContainer.innerHTML = (o.items || []).map(it => `
        <div class="flex items-center justify-between bg-[#151924] p-2.5 rounded-lg border border-slate-800">
            <div class="flex items-center gap-2.5">
                <img src="${it.product_image || ''}" class="w-8 h-8 rounded object-cover bg-black/40">
                <div>
                    <div class="font-bold text-white text-xs">${it.product_name}</div>
                    <div class="text-[11px] text-slate-400">${it.quantity} x ${fmtA(it.price)}</div>
                </div>
            </div>
            <div class="font-bold text-amber-300 text-xs">${fmtA(it.subtotal)}</div>
        </div>
    `).join('');

    document.getElementById('detailSubtotal').textContent = fmtA(o.subtotal);
    document.getElementById('detailDiscount').textContent = `-${fmtA(o.discount || 0)}`;
    document.getElementById('detailShipping').textContent = fmtA(o.shipping_fee || 0);
    document.getElementById('detailTotal').textContent = fmtA(o.total);

    document.getElementById('orderDetailModal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    initLucide();
}

function closeOrderDetailModal() {
    document.getElementById('orderDetailModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// ------------------- COUPONS MANAGEMENT ------------------- //

async function loadAdminCoupons() {
    try {
        const res = await fetch('/api/admin/coupons');
        if (!res.ok) return;
        const coupons = await res.json();
        renderAdminCoupons(coupons);
    } catch (err) {
        console.error("Coupons error:", err);
    }
}

function renderAdminCoupons(coupons) {
    const table = document.getElementById('adminCouponsTable');
    if (!coupons || coupons.length === 0) {
        table.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-500">No active promo codes.</td></tr>`;
        return;
    }

    table.innerHTML = coupons.map(c => `
        <tr class="hover:bg-[#1b212f] transition">
            <td class="py-3 px-4 font-mono font-bold text-amber-300">${c.code}</td>
            <td class="py-3 px-4 font-bold text-emerald-400">${c.discount_percent}% OFF</td>
            <td class="py-3 px-4 text-slate-300 font-medium">${fmtA(c.min_order_amount)}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                </span>
            </td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteCoupon(${c.id}, '${c.code}')" class="p-1.5 text-slate-400 hover:text-rose-400 transition" title="Delete Coupon">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');

    initLucide();
}

function openCouponModal() {
    document.getElementById('newCouponCode').value = '';
    document.getElementById('newCouponPercent').value = '15';
    document.getElementById('newCouponMin').value = '40';
    document.getElementById('couponModal').classList.remove('hidden');
}

function closeCouponModal() {
    document.getElementById('couponModal').classList.add('hidden');
}

async function handleCreateCoupon(e) {
    e.preventDefault();
    const payload = {
        code: document.getElementById('newCouponCode').value.trim(),
        discount_percent: parseFloat(document.getElementById('newCouponPercent').value),
        min_order_amount: parseFloat(document.getElementById('newCouponMin').value || 0)
    };

    try {
        const res = await fetch('/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeCouponModal();
            showAdminToast(data.message);
            loadAdminCoupons();
        } else {
            alert(data.error || "Failed to create coupon");
        }
    } catch (err) {
        console.error("Create coupon error:", err);
    }
}

async function deleteCoupon(couponId, code) {
    if (!confirm(`Delete coupon code ${code}?`)) return;
    try {
        const res = await fetch(`/api/admin/coupons/${couponId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`Deleted coupon ${code}`);
            loadAdminCoupons();
        }
    } catch (err) {
        console.error("Delete coupon error:", err);
    }
}

// ------------------- SETTINGS ------------------- //

async function loadAdminSettings() {
    try {
        const res = await fetch('/api/admin/settings');
        if (!res.ok) return;
        const s = await res.json();

        if (document.getElementById('settingStoreName')) document.getElementById('settingStoreName').value = s.store_name || '';
        if (document.getElementById('settingCurrency')) document.getElementById('settingCurrency').value = s.currency_symbol || '$';
        if (document.getElementById('settingInstagram')) document.getElementById('settingInstagram').value = s.instagram_handle || '';
        if (document.getElementById('settingWhatsApp')) document.getElementById('settingWhatsApp').value = s.whatsapp_number || '';
        if (document.getElementById('settingDeliveryFee')) document.getElementById('settingDeliveryFee').value = s.delivery_fee || '5.00';
        if (document.getElementById('settingFreeShipping')) document.getElementById('settingFreeShipping').value = s.free_shipping_threshold || '75.00';
        if (document.getElementById('settingAnnouncement')) document.getElementById('settingAnnouncement').value = s.announcement_text || '';
        if (document.getElementById('settingAdminPin')) document.getElementById('settingAdminPin').value = s.admin_pin || 'admin123';
        if (document.getElementById('settingRecoveryKey')) document.getElementById('settingRecoveryKey').value = s.recovery_key || 'BAZA-RESET-2026';
    } catch (err) {
        console.error("Settings error:", err);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const payload = {
        store_name: document.getElementById('settingStoreName').value.trim(),
        currency_symbol: document.getElementById('settingCurrency').value.trim(),
        instagram_handle: document.getElementById('settingInstagram').value.trim(),
        whatsapp_number: document.getElementById('settingWhatsApp').value.trim(),
        delivery_fee: document.getElementById('settingDeliveryFee').value.trim(),
        free_shipping_threshold: document.getElementById('settingFreeShipping').value.trim(),
        announcement_text: document.getElementById('settingAnnouncement').value.trim(),
        admin_pin: document.getElementById('settingAdminPin').value.trim(),
        recovery_key: document.getElementById('settingRecoveryKey') ? document.getElementById('settingRecoveryKey').value.trim() : undefined
    };

    try {
        const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast("Settings updated successfully!");
        }
    } catch (err) {
        console.error("Save settings error:", err);
    }
}

// ------------------- UTILITIES ------------------- //

function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'badge-pending';
        case 'processing': return 'badge-processing';
        case 'shipped': return 'badge-shipped';
        case 'delivered': return 'badge-delivered';
        default: return 'badge-cancelled';
    }
}

function showAdminToast(message) {
    const toast = document.getElementById('adminToast');
    const msg = document.getElementById('adminToastMsg');
    if (!toast) return;

    msg.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('flex');

    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
    }, 3500);
}
