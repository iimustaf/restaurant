// --- 1. INITIALIZATION ---
const supabaseUrl = 'https://uxudzawdkisvyrpkxcsd.supabase.co';
const supabaseKey = 'sb_publishable_NxTiEFi7jIHyFlYOeRyaYw_RDYqDyjR';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let selectedTableId = null;

const MIN_ORDER_AMOUNT = 10000; // 10,000 IQD minimum

// --- 2. UI & SECURE AUTHENTICATION LOGIC ---

function handleStaffNav() {
    if (sessionStorage.getItem('staff_role')) {
        switchTab('admin');
    } else {
        openLoginModal();
    }
}

function openLoginModal() {
    document.getElementById('admin-login-modal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('admin-login-modal').style.display = 'none';
    document.getElementById('admin-login-form').reset();
}

async function attemptAdminLogin(e) {
    e.preventDefault(); 
    
    const usernameInput = document.getElementById('admin-username').value.trim();
    const passwordInput = document.getElementById('admin-password').value;

    if (!usernameInput || !passwordInput) return;

    // Call the secure database function via Supabase
    const { data, error } = await supabaseClient
        .rpc('login_staff', { 
            p_username: usernameInput, 
            p_password: passwordInput 
        });

    if (error) {
        alert("Server error during login: " + error.message);
        return;
    }

    if (data && data.length > 0) {
        const user = data[0];
        
        // Store session 
        sessionStorage.setItem('staff_role', user.role);
        sessionStorage.setItem('staff_name', user.full_name);
        
        // Reveal the hidden Orders tab for staff
        const navOrders = document.getElementById('nav-orders');
        if (navOrders) navOrders.style.display = 'inline-block';
        
        closeLoginModal(); 
        switchTab('admin');
        
        console.log(`Welcome, ${user.full_name}!`);
    } else {
        alert("Invalid username or password. Access denied.");
        document.getElementById('admin-password').value = ""; 
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    const targetView = document.getElementById('view-' + tabName);
    const targetNav = document.getElementById('nav-' + tabName);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    if (tabName === 'menu') {
        loadCategories();
        loadMenu();
    }
    if (tabName === 'tables') loadTables();
    if (tabName === 'orders') loadStaffOrders(); // New orders tab
    if (tabName === 'admin') {
        loadAdminTables();
        loadAdminMenu();
        loadAdminCategories();
    }
}

// --- 3. DATABASE: CATEGORIES & MENU ---
async function loadCategories() {
    const { data: categories, error } = await supabaseClient.from('categories').select('*');
    if (error) return console.error(error);

    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;

    let html = `<button onclick="loadMenu(null)" style="padding: 0.5rem 1.5rem; border-radius: 20px; border: none; background: var(--accent-red); color: white; cursor: pointer; font-weight: bold;">All</button>`;

    categories.forEach(cat => {
        html += `<button onclick="loadMenu(${cat.category_id})" style="padding: 0.5rem 1.5rem; border-radius: 20px; border: 1px solid var(--text-muted); background: transparent; color: var(--text-main); cursor: pointer;">${cat.name}</button>`;
    });

    tabsContainer.innerHTML = html;
}

async function loadMenu(categoryId = null) {
    let query = supabaseClient.from('menu_items').select('*').eq('is_available', true);
    if (categoryId !== null) query = query.eq('category_id', categoryId);

    const { data: items, error } = await query;
    if (error) return console.error(error);

    const container = document.getElementById('menu-container');
    if (!container) return;

    container.innerHTML = items.map(item => `
        <div class="menu-card">
            <div class="card-img">🍔</div>
            <div class="card-info">
                <h3>${item.name}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">${item.description || ''}</p>
                <p class="price">${parseFloat(item.price).toLocaleString()} IQD</p>
                <button class="add-btn" onclick="addToCart(${item.item_id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})">+ Add to Order</button>
            </div>
        </div>
    `).join('');
}

// --- 4. DATABASE: TABLES (CUSTOMER VIEW) ---
async function loadTables() {
    const { data: tables, error } = await supabaseClient.from('restaurant_tables').select('*').order('table_number', { ascending: true });
    if (error) return console.error(error);

    const container = document.getElementById('tables-container');
    if (!container) return;

    container.innerHTML = tables.map(table => `
        <div class="table-card ${table.status.toLowerCase()} ${selectedTableId == table.table_id ? 'selected' : ''}"
             onclick="${table.status === 'Available' ? `selectTable(${table.table_id})` : ''}">
            <h2>Table ${table.table_number}</h2>
            <p>Seats: ${table.capacity}</p>
            <span class="status ${table.status.toLowerCase()}">${table.status}</span>
        </div>
    `).join('');
}

function selectTable(id) {
    selectedTableId = id;
    loadTables();
}

// --- 5. CART MANAGEMENT ---
function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
    document.getElementById('cart-overlay').classList.toggle('active');
}

function addToCart(id, name, price) {
    const existing = cart.find(item => item.item_id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ item_id: id, name, unit_price: price, quantity: 1 });
    }
    updateCartUI();
    if (!document.getElementById('cart-sidebar').classList.contains('open')) toggleCart();
}

function changeQuantity(id, delta) {
    const item = cart.find(i => i.item_id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.item_id !== id);
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) cartCount.innerText = totalItems;

    const container = document.getElementById('cart-items-container');
    const submitBtn = document.getElementById('submit-order-btn');
    const minimumNotice = document.getElementById('minimum-notice');

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Your cart is empty.</p>';
        document.getElementById('cart-total-price').innerText = '0 IQD';
        if (submitBtn) submitBtn.style.display = 'none';
        if (minimumNotice) {
            minimumNotice.style.display = 'block';
            minimumNotice.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Minimum order: ${MIN_ORDER_AMOUNT.toLocaleString()} IQD</span>`;
        }
        return;
    }

    let totalAmount = 0;
    container.innerHTML = cart.map(item => {
        const itemTotal = item.unit_price * item.quantity;
        totalAmount += itemTotal;
        return `
            <div class="cart-item">
                <div>
                    <h4 style="margin-bottom: 5px;">${item.name}</h4>
                    <span style="color: var(--accent-green); font-size: 0.9rem;">${itemTotal.toLocaleString()} IQD</span>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="changeQuantity(${item.item_id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="changeQuantity(${item.item_id}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('cart-total-price').innerText = `${totalAmount.toLocaleString()} IQD`;

    if (totalAmount >= MIN_ORDER_AMOUNT) {
        if (submitBtn) submitBtn.style.display = 'block';
        if (minimumNotice) minimumNotice.style.display = 'none';
    } else {
        if (submitBtn) submitBtn.style.display = 'none';
        const remaining = MIN_ORDER_AMOUNT - totalAmount;
        if (minimumNotice) {
            minimumNotice.style.display = 'block';
            minimumNotice.innerHTML = `
                <div style="background: rgba(255,170,0,0.1); border: 1px solid rgba(255,170,0,0.3); border-radius: 10px; padding: 0.75rem; text-align: center;">
                    <span style="color: #ffaa00; font-size: 0.85rem;">⚠️ Add <strong>${remaining.toLocaleString()} IQD</strong> more to place your order<br><span style="opacity:0.7;">(Minimum: ${MIN_ORDER_AMOUNT.toLocaleString()} IQD)</span></span>
                </div>
            `;
        }
    }
}

// --- 6. SUBMIT ORDER ---
async function submitOrder() {
    if (!selectedTableId) {
        toggleCart();
        alert("Please go to the 'Tables' tab and select an available table first!");
        switchTab('tables');
        return;
    }
    if (cart.length === 0) return alert("Your cart is empty!");

    const total = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    if (total < MIN_ORDER_AMOUNT) return alert(`Minimum order is ${MIN_ORDER_AMOUNT.toLocaleString()} IQD.`);

    const { data: order, error: err1 } = await supabaseClient
        .from('orders')
        .insert([{ table_id: selectedTableId, total_amount: total, status: 'Pending', order_time: new Date().toISOString() }])
        .select();

    if (err1) {
        console.error("Order Error:", err1);
        return alert("Error creating order. Check console.");
    }

    const details = cart.map(item => ({
        order_id: order[0].order_id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price
    }));

    const { error: err2 } = await supabaseClient.from('order_details').insert(details);
    if (err2) console.error("Details Error:", err2);

    await supabaseClient.from('restaurant_tables').update({ status: 'Occupied' }).eq('table_id', selectedTableId);

    alert(`Success! Order placed. Total: ${total.toLocaleString()} IQD`);
    cart = [];
    selectedTableId = null;
    updateCartUI();
    toggleCart();
    switchTab('tables');
}

// --- 7. ADMIN / STAFF FUNCTIONS ---
async function loadAdminTables() {
    const { data: tables, error } = await supabaseClient
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });

    if (error) return console.error("Error loading admin tables:", error);

    const container = document.getElementById('admin-tables-container');
    if (!container) return;

    container.innerHTML = tables.map(table => `
        <div class="table-card ${table.status.toLowerCase()}">
            <h2>Table ${table.table_number}</h2>
            <span class="status ${table.status.toLowerCase()}" style="margin-bottom: 1rem; display: inline-block;">${table.status}</span>
            <br>
            ${table.status === 'Occupied'
                ? `<button onclick="clearTable(${table.table_id})" style="background: var(--accent-red); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 10px; cursor: pointer; font-weight: bold; margin-top: 10px;">Clear Table</button>`
                : `<span style="color: var(--text-muted); font-size: 0.9rem;">Ready for guests</span>`
            }
        </div>
    `).join('');
}

async function clearTable(tableId) {
    if (!confirm("Are you sure you want to clear this table?")) return;

    const { error } = await supabaseClient
        .from('restaurant_tables')
        .update({ status: 'Available' })
        .eq('table_id', tableId);

    if (error) return alert("Error clearing table. Check console.");

    loadAdminTables();
    loadTables();
}

// --- 8. ADMIN: MENU MANAGEMENT ---
async function loadAdminCategories() {
    const { data: categories, error } = await supabaseClient.from('categories').select('*');
    if (error) return console.error(error);

    const select = document.getElementById('new-item-category');
    if (!select) return;
    select.innerHTML = categories.map(cat =>
        `<option value="${cat.category_id}">${cat.name}</option>`
    ).join('');
}

async function loadAdminMenu() {
    const { data: items, error } = await supabaseClient
        .from('menu_items')
        .select('*, categories(name)')
        .order('item_id', { ascending: true });

    if (error) return console.error(error);

    const container = document.getElementById('admin-menu-container');
    if (!container) return;

    container.innerHTML = items.map(item => `
        <div class="admin-menu-item" id="menu-item-${item.item_id}">
            <div class="admin-menu-item-info">
                <div style="display:flex; align-items:center; gap: 0.75rem;">
                    <span style="font-size: 1.5rem;">🍔</span>
                    <div>
                        <h4 style="margin:0;">${item.name}</h4>
                        <span style="color: var(--text-muted); font-size: 0.8rem;">${item.categories?.name || 'Uncategorized'}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap: 1rem; flex-shrink: 0;">
                    <span style="color: var(--accent-green); font-weight: bold;">${parseFloat(item.price).toLocaleString()} IQD</span>
                    <span class="availability-badge ${item.is_available ? 'badge-available' : 'badge-unavailable'}">
                        ${item.is_available ? 'Available' : 'Hidden'}
                    </span>
                    <button onclick="toggleItemAvailability(${item.item_id}, ${item.is_available})" class="admin-action-btn toggle-btn" title="${item.is_available ? 'Hide from menu' : 'Show on menu'}">
                        ${item.is_available ? '👁️ Hide' : '👁️ Show'}
                    </button>
                    <button onclick="deleteMenuItem(${item.item_id})" class="admin-action-btn delete-btn" title="Delete item">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function toggleItemAvailability(itemId, currentStatus) {
    const { error } = await supabaseClient
        .from('menu_items')
        .update({ is_available: !currentStatus })
        .eq('item_id', itemId);

    if (error) return alert("Error updating item. Check console.");
    loadAdminMenu();
    loadMenu(); 
}

async function deleteMenuItem(itemId) {
    if (!confirm("Are you sure you want to permanently delete this menu item?")) return;

    const { error } = await supabaseClient
        .from('menu_items')
        .delete()
        .eq('item_id', itemId);

    if (error) return alert("Error deleting item: " + error.message);
    loadAdminMenu();
    loadMenu();
}

async function addMenuItem(e) {
    e.preventDefault();
    const name = document.getElementById('new-item-name').value.trim();
    const description = document.getElementById('new-item-description').value.trim();
    const price = parseFloat(document.getElementById('new-item-price').value);
    const category_id = parseInt(document.getElementById('new-item-category').value);

    if (!name || isNaN(price) || price <= 0) return alert("Please fill in all required fields correctly.");

    const { error } = await supabaseClient
        .from('menu_items')
        .insert([{ name, description, price, category_id, is_available: true }]);

    if (error) return alert("Error adding item: " + error.message);

    document.getElementById('add-item-form').reset();
    document.getElementById('add-item-form-container').style.display = 'none';

    loadAdminMenu();
    loadMenu();
    alert(`"${name}" has been added to the menu!`);
}

function toggleAddItemForm() {
    const form = document.getElementById('add-item-form-container');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

// --- 9. STAFF: ORDERS MANAGEMENT ---
async function loadStaffOrders() {
    if (!sessionStorage.getItem('staff_role')) {
        alert("Access denied. Staff only.");
        switchTab('menu');
        return;
    }

    const { data: orders, error } = await supabaseClient
        .from('orders')
        .select('order_id, total_amount, status, order_time, table_id, restaurant_tables(table_number)')
        .order('order_time', { ascending: false });

    if (error) {
        console.error("Error loading orders:", error);
        return alert("Failed to load orders: " + error.message);
    }

    const container = document.getElementById('staff-orders-container');
    if (!container) return;
    
    if (orders.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No orders found.</p>';
        return;
    }

    container.innerHTML = orders.map(order => {
        const isPending = order.status === 'Pending';
        const borderColor = isPending ? 'var(--accent-red)' : 'var(--accent-green)';
        const timeFormatted = new Date(order.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div style="background: var(--bg-dark); padding: 1.5rem; border-radius: 12px; border-left: 5px solid ${borderColor}; box-shadow: 0 4px 10px rgba(0,0,0,0.3); margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; margin-bottom: 5px;">Order #${order.order_id}</h3>
                        <p style="color: var(--text-muted); margin: 0; font-size: 0.9rem;">
                            Table ${order.restaurant_tables?.table_number ?? order.table_id ?? 'N/A'} • ${timeFormatted}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: bold; color: var(--text-main); font-size: 1.1rem;">${parseFloat(order.total_amount).toLocaleString()} IQD</span><br>
                        <span style="color: ${borderColor}; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${order.status}</span>
                    </div>
                </div>
                ${isPending ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--text-muted); text-align: right;">
                        <button onclick="updateOrderStatus(${order.order_id}, 'Completed')" style="background: var(--accent-green); color: var(--bg-dark); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            ✓ Mark Completed
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    const { error } = await supabaseClient
        .from('orders')
        .update({ status: newStatus })
        .eq('order_id', orderId);
    
    if (error) {
        console.error(error);
        return alert("Error updating order.");
    }
    
    loadStaffOrders();
}

// --- 10. STAFF LOGOUT ---
function staffLogout() {
    sessionStorage.removeItem('staff_role');
    sessionStorage.removeItem('staff_name');

    const navOrders = document.getElementById('nav-orders');
    if (navOrders) navOrders.style.display = 'none';

    switchTab('home');
}

// Initial Load
window.onload = () => {
    loadCategories();
    loadMenu();
    loadTables();
    updateCartUI(); 
};
// --- 11. CLEAR ALL COMPLETED ORDERS ---
async function clearCompletedOrders() {
    if (!confirm("Delete all Completed orders permanently? This cannot be undone.")) return;

    // Must delete order_details first (child rows) before orders (parent)
    const { data: completed, error: fetchErr } = await supabaseClient
        .from('orders')
        .select('order_id')
        .eq('status', 'Completed');

    if (fetchErr) return alert("Error fetching completed orders: " + fetchErr.message);
    if (!completed || completed.length === 0) return alert("No completed orders to clear.");

    const ids = completed.map(o => o.order_id);

    const { error: detailsErr } = await supabaseClient
        .from('order_details')
        .delete()
        .in('order_id', ids);

    if (detailsErr) return alert("Error clearing order details: " + detailsErr.message);

    const { error: ordersErr } = await supabaseClient
        .from('orders')
        .delete()
        .in('order_id', ids);

    if (ordersErr) return alert("Error clearing orders: " + ordersErr.message);

    alert(`${ids.length} completed order(s) cleared.`);
    loadStaffOrders();
}