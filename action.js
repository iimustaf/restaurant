// --- 1. SUPABASE INITIALIZATION ---
const supabaseUrl = 'https://uxudzawdkisvyrpkxcsd.supabase.co';
const supabaseKey = 'sb_publishable_NxTiEFi7jIHyFlYOeRyaYw_RDYqDyjR';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. GLOBAL STATE (Cart & Table) ---
let cart = [];
let selectedTableId = null;

// --- 3. UI SWITCHING LOGIC (From before) ---
function switchTab(tabName) {
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    document.getElementById('view-' + tabName).classList.add('active');
    document.getElementById('nav-' + tabName).classList.add('active');
}

// --- 4. FETCH MENU FROM DATABASE ---
async function loadMenu() {
    // Fetch available items from the 'menu_items' table
    const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true);

    if (error) {
        console.error("Error loading menu:", error);
        return;
    }

    const menuGrid = document.querySelector('.menu-grid');
    menuGrid.innerHTML = ''; // Clear the hardcoded HTML

    // Dynamically build the menu cards based on database rows
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.innerHTML = `
            <div class="card-img" style="display:flex; align-items:center; justify-content:center; color:#555; font-size:2rem;">🍔</div>
            <div class="card-info">
                <h3>${item.name}</h3>
                <p class="price">$${item.price.toFixed(2)}</p>
                <button class="add-btn" onclick="addToCart(${item.item_id}, '${item.name}', ${item.price})">+ Add to Order</button>
            </div>
        `;
        menuGrid.appendChild(card);
    });
}

// --- 5. FETCH TABLES FROM DATABASE ---
async function loadTables() {
    const { data: tables, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });

    if (error) return console.error("Error loading tables:", error);

    const tablesGrid = document.querySelector('.tables-grid');
    tablesGrid.innerHTML = ''; // Clear hardcoded HTML

    tables.forEach(table => {
        const statusClass = table.status.toLowerCase(); // 'available' or 'occupied'
        const card = document.createElement('div');
        card.className = `table-card ${statusClass}`;
        
        // Highlight the table if it's currently selected
        if(table.table_id === selectedTableId) card.style.borderColor = 'var(--accent-red)';

        card.innerHTML = `
            <h2>Table ${table.table_number}</h2>
            <p>Capacity: ${table.capacity}</p>
            <span class="status ${statusClass}">${table.status}</span>
        `;

        // Allow user to select a table if it is available
        if (table.status === 'Available') {
            card.onclick = () => {
                selectedTableId = table.table_id;
                alert(`Table ${table.table_number} selected for the order!`);
                loadTables(); // Refresh UI to show selection
            };
        }
        
        tablesGrid.appendChild(card);
    });
}

// --- 6. CART MANAGEMENT ---
function addToCart(itemId, name, price) {
    cart.push({ item_id: itemId, name: name, unit_price: price, quantity: 1 });
    updateCartUI();
    alert(`${name} added to cart!`);
}

function updateCartUI() {
    const cartBtn = document.querySelector('.cart-btn');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBtn.textContent = `🛒 Cart (${totalItems})`;
}

// --- 7. SUBMIT ORDER TO SUPABASE ---
async function submitOrder() {
    if (!selectedTableId) return alert("Please go to the Tables tab and select a table first!");
    if (cart.length === 0) return alert("Your cart is empty!");

    // Calculate total amount
    const totalAmount = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    // Step A: Create the Order in the 'orders' table
    const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{ table_id: selectedTableId, total_amount: totalAmount, status: 'Pending' }])
        .select(); // .select() returns the new row so we can get the new order_id

    if (orderError) return console.error("Order Error:", orderError);
    
    const orderId = newOrder[0].order_id;

    // Step B: Prepare the order details (link the food items to the new order_id)
    const orderDetailsData = cart.map(item => ({
        order_id: orderId,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price
    }));

    // Step C: Insert into 'order_details' table
    const { error: detailsError } = await supabase
        .from('order_details')
        .insert(orderDetailsData);

    if (detailsError) return console.error("Details Error:", detailsError);

    // Step D: Update the table status to 'Occupied'
    await supabase
        .from('restaurant_tables')
        .update({ status: 'Occupied' })
        .eq('table_id', selectedTableId);

    // Success! Reset everything.
    alert(`Order #${orderId} placed successfully!`);
    cart = [];
    selectedTableId = null;
    updateCartUI();
    loadTables(); // Refresh tables to show it is now occupied
}

// --- 8. INITIALIZE APP ON LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadMenu();
    loadTables();
    
    // Attach submit order function to the CTA button on the home screen
    document.querySelector('.cta-btn').onclick = submitOrder;
});