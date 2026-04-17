// --- 1. INITIALIZATION ---
const supabaseUrl = 'https://uxudzawdkisvyrpkxcsd.supabase.co';
const supabaseKey = 'sb_publishable_NxTiEFi7jIHyFlYOeRyaYw_RDYqDyjR';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let selectedTableId = null;

// --- 2. UI & TAB SWITCHING LOGIC ---
const STAFF_PASSWORD = "1234"; // <--- Change your password here

function checkAdminPassword() {
    const enteredPassword = prompt("Please enter the Staff Password to access this dashboard:");
    if (enteredPassword === STAFF_PASSWORD) {
        switchTab('admin');
    } else if (enteredPassword !== null) { // If they didn't just click 'Cancel'
        alert("Incorrect password. Access denied.");
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
    if (tabName === 'admin') loadAdminTables();
}

// --- 3. DATABASE: CATEGORIES & MENU ---
async function loadCategories() {
    const { data: categories, error } = await supabaseClient.from('categories').select('*');
    if (error) return console.error(error);

    const tabsContainer = document.getElementById('category-tabs');
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
    container.innerHTML = items.map(item => `
        <div class="menu-card">
            <div class="card-img">🍲</div>
            <div class="card-info">
                <h3>${item.name}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">${item.description || ''}</p>
                <p class="price">${parseFloat(item.price).toLocaleString()} IQD</p> 
                <button class="add-btn" onclick="addToCart(${item.item_id}, '${item.name}', ${item.price})">+ Add to Order</button>
            </div>
        </div>
    `).join('');
}

// --- 4. DATABASE: TABLES (CUSTOMER VIEW) ---
async function loadTables() {
    const { data: tables, error } = await supabaseClient.from('restaurant_tables').select('*').order('table_number', { ascending: true });
    if (error) return console.error(error);

    const container = document.getElementById('tables-container');
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
    loadTables(); // Refresh UI
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
    document.getElementById('cart-count').innerText = totalItems;

    const container = document.getElementById('cart-items-container');
    if (cart.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Your cart is empty.</p>';
        document.getElementById('cart-total-price').innerText = '0 IQD';
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

    const { data: order, error: err1 } = await supabaseClient
        .from('orders')
        .insert([{ table_id: selectedTableId, total_amount: total, status: 'Pending' }])
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
    if(!confirm("Are you sure you want to clear this table?")) return;

    const { error } = await supabaseClient
        .from('restaurant_tables')
        .update({ status: 'Available' })
        .eq('table_id', tableId);

    if (error) return alert("Error clearing table. Check console.");

    loadAdminTables(); // Refresh Admin View
    loadTables(); // Refresh Customer View in the background
}

// Initial Load
window.onload = () => {
    loadCategories();
    loadMenu();
    loadTables();
};