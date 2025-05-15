// Inventory Management System for Alcohol Direct
// This file handles inventory tracking, stock management, and order processing

// Initialize Firebase references (ensure this runs after Firebase is loaded)
let db, auth;

// Initialize once document is loaded and Firebase is available
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Firebase to be available through the global window.firebaseStuff 
  const initInterval = setInterval(() => {
    if (window.firebaseStuff && window.firebaseStuff.db) {
      db = window.firebaseStuff.db;
      auth = window.firebaseStuff.auth;
      const { collection, getDocs, addDoc, updateDoc, doc, onSnapshot } = window.firebaseStuff;
      
      // Store these Firebase methods for later use
      window.inventorySystem = {
        collection, getDocs, addDoc, updateDoc, doc, onSnapshot,
        db, auth,
        products: [],
        init: initializeInventorySystem,
        getProducts: getProducts,
        updateStock: updateStock,
        processOrder: processOrder,
        checkLowStock: checkLowStock,
        updateProductDisplay: updateProductDisplay,
        loadInventoryDashboard: loadInventoryDashboard
      };
      
      // Initialize the inventory system
      initializeInventorySystem();
      clearInterval(initInterval);
    }
  }, 500);
});

/**
 * Initialize the inventory management system
 */
async function initializeInventorySystem() {
  console.log("Initializing inventory system...");
  
  try {
    // Load products from Firestore
    await getProducts();
    
    // Set up UI event listeners for admin functions if on admin page
    if (document.getElementById('inventory-dashboard')) {
      setupInventoryDashboardUI();
    }
    
    // Update product displays with current stock information
    updateProductDisplay();
    
    // Set up live inventory updates
    setupLiveInventoryUpdates();
    
    console.log("✅ Inventory system initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing inventory system:", error);
  }
}

/**
 * Fetch products from Firestore
 */
async function getProducts() {
  try {
    const { collection, getDocs } = window.inventorySystem;
    const productsRef = collection(db, "products");
    const snapshot = await getDocs(productsRef);
    
    window.inventorySystem.products = [];
    snapshot.forEach(doc => {
      window.inventorySystem.products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Loaded ${window.inventorySystem.products.length} products`);
    return window.inventorySystem.products;
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    return [];
  }
}

/**
 * Update stock quantity for a product
 * @param {string} productId - Product ID
 * @param {number} newQuantity - New stock quantity
 */
async function updateStock(productId, newQuantity) {
  try {
    const { doc, updateDoc } = window.inventorySystem;
    const productRef = doc(db, "products", productId);
    
    await updateDoc(productRef, {
      stock: newQuantity,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`✅ Updated stock for product ${productId} to ${newQuantity}`);
    
    // Update local cache
    const product = window.inventorySystem.products.find(p => p.id === productId);
    if (product) {
      product.stock = newQuantity;
      product.lastUpdated = new Date().toISOString();
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating stock for product ${productId}:`, error);
    return false;
  }
}

/**
 * Process an order by updating inventory quantities
 * @param {Array} items - Array of order items with product ID and quantity
 * @param {string} orderId - Order ID
 */
async function processOrder(items, orderId) {
  try {
    console.log(`Processing order ${orderId} with ${items.length} items`);
    
    const { doc, updateDoc, addDoc, collection } = window.inventorySystem;
    const batch = [];
    
    // Update each product's stock
    for (const item of items) {
      const { productId, quantity } = item;
      const product = window.inventorySystem.products.find(p => p.id === productId);
      
      if (!product) {
        console.error(`Product ${productId} not found`);
        continue;
      }
      
      if (product.stock < quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
      
      const newStock = product.stock - quantity;
      
      // Add update operation to batch
      batch.push({
        productId,
        newStock,
        action: async () => {
          const productRef = doc(db, "products", productId);
          await updateDoc(productRef, {
            stock: newStock,
            lastUpdated: new Date().toISOString()
          });
        }
      });
    }
    
    // Execute all update operations
    for (const operation of batch) {
      await operation.action();
      
      // Update local cache
      const product = window.inventorySystem.products.find(p => p.id === operation.productId);
      if (product) {
        product.stock = operation.newStock;
        product.lastUpdated = new Date().toISOString();
      }
    }
    
    // Record inventory transaction
    await addDoc(collection(db, "inventory_transactions"), {
      orderId,
      items,
      type: "order",
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Order ${orderId} processed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing order ${orderId}:`, error);
    return false;
  }
}

/**
 * Check for products with low stock
 * @param {number} threshold - Stock level threshold
 * @returns {Array} - Array of products with stock below threshold
 */
function checkLowStock(threshold = 5) {
  const lowStockProducts = window.inventorySystem.products.filter(product => {
    return product.stock <= threshold;
  });
  
  console.log(`Found ${lowStockProducts.length} products with low stock (threshold: ${threshold})`);
  return lowStockProducts;
}

/**
 * Update product display with current stock information
 */
function updateProductDisplay() {
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    const addButton = card.querySelector('.add-to-cart');
    if (!addButton) return;
    
    const productId = addButton.dataset.id;
    const product = window.inventorySystem.products.find(p => p.id === productId);
    
    if (product) {
      // Update stock display if element exists
      const stockDisplay = card.querySelector('.product-stock');
      if (stockDisplay) {
        stockDisplay.textContent = `In stock: ${product.stock}`;
      } else {
        // Create stock display if it doesn't exist
        const stockEl = document.createElement('div');
        stockEl.className = 'product-stock';
        stockEl.textContent = `In stock: ${product.stock}`;
        card.querySelector('.product-info').insertBefore(
          stockEl, 
          card.querySelector('.product-actions')
        );
      }
      
      // Disable add button if out of stock
      if (product.stock <= 0) {
        addButton.disabled = true;
        addButton.textContent = 'Out of Stock';
        addButton.classList.add('disabled');
      } else {
        addButton.disabled = false;
        addButton.textContent = 'Add';
        addButton.classList.remove('disabled');
      }
    }
  });
}

/**
 * Set up live inventory updates
 */
function setupLiveInventoryUpdates() {
  const { collection, onSnapshot } = window.inventorySystem;
  
  // Listen for changes to the products collection
  const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "modified") {
        const updatedProduct = {
          id: change.doc.id,
          ...change.doc.data()
        };
        
        // Update local cache
        const index = window.inventorySystem.products.findIndex(p => p.id === updatedProduct.id);
        if (index !== -1) {
          window.inventorySystem.products[index] = updatedProduct;
        } else {
          window.inventorySystem.products.push(updatedProduct);
        }
      }
      
      if (change.type === "added") {
        const newProduct = {
          id: change.doc.id,
          ...change.doc.data()
        };
        
        // Check if product already exists in local cache
        const exists = window.inventorySystem.products.some(p => p.id === newProduct.id);
        if (!exists) {
          window.inventorySystem.products.push(newProduct);
        }
      }
      
      if (change.type === "removed") {
        // Remove from local cache
        const productId = change.doc.id;
        window.inventorySystem.products = window.inventorySystem.products.filter(p => p.id !== productId);
      }
    });
    
    // Update UI with new data
    updateProductDisplay();
    
    // Update dashboard if it exists
    if (document.getElementById('inventory-dashboard')) {
      loadInventoryDashboard();
    }
  });
  
  // Store unsubscribe function for cleanup
  window.inventorySystem.unsubscribeLiveUpdates = unsubscribe;
}

/**
 * Set up UI event listeners for inventory dashboard
 */
function setupInventoryDashboardUI() {
  // Add product form
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const { addDoc, collection } = window.inventorySystem;
      
      const name = document.getElementById('product-name').value;
      const category = document.getElementById('product-category').value;
      const price = parseFloat(document.getElementById('product-price').value);
      const stock = parseInt(document.getElementById('product-stock').value);
      const imageUrl = document.getElementById('product-image').value || '/api/placeholder/200/200';
      
      try {
        const productData = {
          name,
          category,
          price,
          stock,
          imageUrl,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        await addDoc(collection(db, "products"), productData);
        
        alert('✅ Product added successfully!');
        addProductForm.reset();
        
        // Refresh product list
        await getProducts();
        loadInventoryDashboard();
      } catch (error) {
        console.error('❌ Error adding product:', error);
        alert('Error adding product: ' + error.message);
      }
    });
  }
  
  // Update stock form
  const updateStockForm = document.getElementById('update-stock-form');
  if (updateStockForm) {
    updateStockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const productId = document.getElementById('stock-product-id').value;
      const quantity = parseInt(document.getElementById('stock-quantity').value);
      
      try {
        await updateStock(productId, quantity);
        alert('✅ Stock updated successfully!');
        updateStockForm.reset();
        
        // Refresh dashboard
        loadInventoryDashboard();
      } catch (error) {
        console.error('❌ Error updating stock:', error);
        alert('Error updating stock: ' + error.message);
      }
    });
  }
  
  // Load initial dashboard
  loadInventoryDashboard();
}

/**
 * Load inventory dashboard with current product data
 */
function loadInventoryDashboard() {
  const productList = document.getElementById('product-list');
  if (!productList) return;
  
  productList.innerHTML = '';
  
  // Create table header
  const tableHeader = document.createElement('tr');
  tableHeader.innerHTML = `
    <th>ID</th>
    <th>Name</th>
    <th>Category</th>
    <th>Price</th>
    <th>Stock</th>
    <th>Last Updated</th>
    <th>Actions</th>
  `;
  productList.appendChild(tableHeader);
  
  // Create table rows
  window.inventorySystem.products.forEach(product => {
    const row = document.createElement('tr');
    const lastUpdated = new Date(product.lastUpdated).toLocaleString();
    
    row.innerHTML = `
      <td>${product.id.substring(0, 6)}...</td>
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>$${product.price.toFixed(2)}</td>
      <td class="${product.stock <= 5 ? 'low-stock' : ''}">${product.stock}</td>
      <td>${lastUpdated}</td>
      <td>
        <button class="btn-edit" data-id="${product.id}">Edit</button>
        <button class="btn-delete" data-id="${product.id}">Delete</button>
      </td>
    `;
    
    productList.appendChild(row);
  });
  
  // Low stock warning
  const lowStockList = document.getElementById('low-stock-list');
  if (lowStockList) {
    lowStockList.innerHTML = '';
    
    const lowStockProducts = checkLowStock(5);
    
    if (lowStockProducts.length === 0) {
      lowStockList.innerHTML = '<p>No products with low stock.</p>';
    } else {
      const ul = document.createElement('ul');
      
      lowStockProducts.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.name} - ${product.stock} left`;
        if (product.stock === 0) {
          li.classList.add('out-of-stock');
        }
        ul.appendChild(li);
      });
      
      lowStockList.appendChild(ul);
    }
  }
  
  // Update stock form product select
  const productSelect = document.getElementById('stock-product-id');
  if (productSelect) {
    productSelect.innerHTML = '';
    
    window.inventorySystem.products.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = `${product.name} (Current: ${product.stock})`;
      productSelect.appendChild(option);
    });
  }
  
  // Attach edit button event listeners
  document.querySelectorAll('.btn-edit').forEach(button => {
    button.addEventListener('click', async () => {
      const productId = button.dataset.id;
      const product = window.inventorySystem.products.find(p => p.id === productId);
      
      if (product) {
        document.getElementById('stock-product-id').value = productId;
        document.getElementById('stock-quantity').value = product.stock;
        document.getElementById('update-stock-form').scrollIntoView();
      }
    });
  });
  
  // Attach delete button event listeners
  document.querySelectorAll('.btn-delete').forEach(button => {
    button.addEventListener('click', async () => {
      const productId = button.dataset.id;
      const product = window.inventorySystem.products.find(p => p.id === productId);
      
      if (product && confirm(`Are you sure you want to delete ${product.name}?`)) {
        try {
          const { doc, deleteDoc } = window.firebaseStuff;
          await deleteDoc(doc(db, "products", productId));
          
          alert('✅ Product deleted successfully!');
          
          // Refresh product list
          await getProducts();
          loadInventoryDashboard();
        } catch (error) {
          console.error('❌ Error deleting product:', error);
          alert('Error deleting product: ' + error.message);
        }
      }
    });
  });
}

// Update cart system to check inventory before adding items
document.addEventListener('DOMContentLoaded', () => {
  // Wait for both cart and inventory systems to be ready
  const cartInterval = setInterval(() => {
    if (window.cart && window.inventorySystem && window.inventorySystem.products.length > 0) {
      enhanceCartSystem();
      clearInterval(cartInterval);
    }
  }, 500);
});

/**
 * Enhance the existing cart system with inventory checks
 */
function enhanceCartSystem() {
  // Store original add-to-cart functions
  const originalButtons = document.querySelectorAll('.add-to-cart');
  
  originalButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      // Check if we have the original handler still attached
      if (!button.dataset.inventoryEnabled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const id = button.dataset.id;
        const name = button.dataset.name;
        const price = parseFloat(button.dataset.price);
        const quantityInput = button.parentElement.querySelector('.qty-input');
        const quantity = parseInt(quantityInput.value);
        
        // Check if we have enough inventory
        const product = window.inventorySystem.products.find(p => p.id === id);
        
        if (!product) {
          console.error(`Product ${id} not found in inventory`);
          alert('Sorry, this product is not available.');
          return;
        }
        
        if (product.stock < quantity) {
          alert(`Sorry, only ${product.stock} units available.`);
          quantityInput.value = product.stock > 0 ? product.stock : 1;
          return;
        }
        
        // Find if item already exists in cart
        const existingItem = window.cart.find(item => item.id === id);
        const totalRequestedQuantity = existingItem 
          ? existingItem.quantity + quantity 
          : quantity;
        
        // Final check against total requested quantity
        if (product.stock < totalRequestedQuantity) {
          alert(`Sorry, you already have ${existingItem.quantity} in your cart. Only ${product.stock} units available in total.`);
          return;
        }
        
        // All checks passed, proceed with adding to cart
        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          window.cart.push({ id, name, price, quantity });
        }
        
        // Update cart display
        if (window.updateCartCount) {
          window.updateCartCount();
        }
        
        // Show confirmation
        alert(`Added ${quantity} ${name} to cart!`);
      }
    }, true);
    
    // Mark this button as enhanced
    button.dataset.inventoryEnabled = 'true';
  });
}

// Checkout process enhancement
document.addEventListener('DOMContentLoaded', () => {
  const checkoutButton = document.querySelector('#cart-modal .btn.btn-primary');
  
  if (checkoutButton) {
    checkoutButton.addEventListener('click', async (e) => {
      // If we already enhanced the checkout button, don't do it again
      if (checkoutButton.dataset.inventoryEnabled === 'true') return;
      
      e.preventDefault();
      e.stopImmediatePropagation();
      
      // Basic validation
      if (!window.cart || window.cart.length === 0) {
        alert('Your cart is empty.');
        return;
      }
      
      const addressInput = document.getElementById('delivery-address');
      if (!addressInput || !addressInput.value.trim()) {
        alert('Please enter a delivery address.');
        return;
      }
      
      // Check inventory availability again (in case it changed since adding to cart)
      let insufficientStock = false;
      const unavailableItems = [];
      
      for (const item of window.cart) {
        const product = window.inventorySystem.products.find(p => p.id === item.id);
        
        if (!product || product.stock < item.quantity) {
          insufficientStock = true;
          unavailableItems.push({
            name: item.name,
            requested: item.quantity,
            available: product ? product.stock : 0
          });
        }
      }
      
      if (insufficientStock) {
        let message = 'Some items in your cart are no longer available:\n\n';
        unavailableItems.forEach(item => {
          message += `${item.name}: You requested ${item.requested}, but only ${item.available} available.\n`;
        });
        message += '\nPlease update your cart.';
        
        alert(message);
        return;
      }
      
      // All inventory checks passed, create order
      try {
        const { addDoc, collection } = window.inventorySystem;
        
        // Generate order ID
        const orderId = 'ORD-' + Date.now();
        
        // Create order in Firestore
        const orderData = {
          id: orderId,
          items: window.cart.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          total: window.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          address: addressInput.value.trim(),
          status: 'pending',
          customerName: localStorage.getItem('userName') || 'Guest',
          createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, "orders"), orderData);
        
        // Update inventory
        const orderItems = window.cart.map(item => ({
          productId: item.id,
          quantity: item.quantity
        }));
        
        await processOrder(orderItems, orderId);
        
        // Clear cart
        window.cart = [];
        window.updateCartCount();
        
        // Close modal
        closeModal('cart-modal');
        
        // Show success message
        alert(`Order placed successfully! Order ID: ${orderId}`);
      } catch (error) {
        console.error('❌ Error processing checkout:', error);
        alert('Error processing checkout: ' + error.message);
      }
    }, true);
    
    // Mark this button as enhanced
    checkoutButton.dataset.inventoryEnabled = 'true';
  }
});