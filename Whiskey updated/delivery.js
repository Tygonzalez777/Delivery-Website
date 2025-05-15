console.log('⚙️ delivery.js is running');
// Delivery Scheduler System for Alcohol Direct
// This script adds delivery scheduling functionality to the website

// Delivery management system
class DeliverySystem {
    constructor() {
      this.orders = [];
      this.drivers = [
        { id: 1, name: 'Main Driver', status: 'available', currentOrder: null, deliveries: [] }
      ];
      this.deliveryZones = [
        { id: 1, name: 'Zone 1', estimatedDeliveryTime: 30 },
        { id: 2, name: 'Zone 2', estimatedDeliveryTime: 45 },
        { id: 3, name: 'Zone 3', estimatedDeliveryTime: 60 }
      ];
      
      // Bind methods
      this.addOrder = this.addOrder.bind(this);
      this.assignOrder = this.assignOrder.bind(this);
      this.completeOrder = this.completeOrder.bind(this);
      this.updateDriverStatus = this.updateDriverStatus.bind(this);
      this.getNextDelivery = this.getNextDelivery.bind(this);
      this.getEstimatedDeliveryTime = this.getEstimatedDeliveryTime.bind(this);
      this.initDriverInterface = this.initDriverInterface.bind(this);
      this.renderDriverDashboard = this.renderDriverDashboard.bind(this);
      this.renderOrderQueue = this.renderOrderQueue.bind(this);
      
      // Initialize driver interface
      this.initDriverInterface();
      
      // Initialize local storage
      this.loadFromStorage();
      
      // Set up automatic saving to localStorage
      setInterval(() => this.saveToStorage(), 30000); // Save every 30 seconds
    }
    
    // Load data from localStorage
    loadFromStorage() {
      try {
        const savedOrders = localStorage.getItem('alcoholDirectOrders');
        const savedDrivers = localStorage.getItem('alcoholDirectDrivers');
        
        if (savedOrders) {
          this.orders = JSON.parse(savedOrders);
        }
        
        if (savedDrivers) {
          this.drivers = JSON.parse(savedDrivers);
        }
      } catch (error) {
        console.error('Error loading from storage:', error);
      }
    }
    
    // Save data to localStorage
    saveToStorage() {
      try {
        localStorage.setItem('alcoholDirectOrders', JSON.stringify(this.orders));
        localStorage.setItem('alcoholDirectDrivers', JSON.stringify(this.drivers));
      } catch (error) {
        console.error('Error saving to storage:', error);
      }
    }
    
    // Add a new order to the system
    addOrder(orderData) {
      // Generate an ID for the order
      const orderId = Date.now();
      
      // Create the order object
      const order = {
        id: orderId,
        timestamp: new Date().toISOString(),
        customer: orderData.customer,
        address: orderData.address,
        items: orderData.items,
        total: orderData.total,
        status: 'pending',
        zone: this.determineZone(orderData.address),
        assignedDriver: null,
        scheduledTime: null,
        estimatedDeliveryTime: null
      };
      
      // Add to orders array
      this.orders.push(order);
      
      // Auto-assign the order if possible
      this.assignOrder(order.id);
      
      // Save to storage
      this.saveToStorage();
      
      // Notify about the new order
      this.notifyNewOrder(order);
      
      return orderId;
    }
    
    // Determine delivery zone based on address
    determineZone(address) {
      // This is a simplified version - in a real implementation, you might
      // use geocoding or a more sophisticated algorithm
      if (address.toLowerCase().includes('downtown')) {
        return 1;
      } else if (address.toLowerCase().includes('suburbs')) {
        return 2;
      } else {
        return 3;
      }
    }
    
    // Assign an order to a driver
    assignOrder(orderId) {
      const order = this.orders.find(o => o.id === orderId);
      if (!order) return false;
      
      // Find available driver
      const availableDriver = this.drivers.find(d => d.status === 'available');
      
      if (availableDriver) {
        // Assign the order
        order.status = 'assigned';
        order.assignedDriver = availableDriver.id;
        order.estimatedDeliveryTime = this.getEstimatedDeliveryTime(order.zone);
        
        // Update driver status
        availableDriver.status = 'delivering';
        availableDriver.currentOrder = orderId;
        
        // Update driver's deliveries list
        availableDriver.deliveries.push({
          orderId: orderId,
          startTime: new Date().toISOString(),
          estimatedDeliveryTime: order.estimatedDeliveryTime
        });
        
        // Save changes
        this.saveToStorage();
        
        // Notify about assignment
        this.notifyOrderAssigned(order, availableDriver);
        
        return true;
      } else {
        // No available driver
        order.status = 'queued';
        this.saveToStorage();
        return false;
      }
    }
    
    // Mark an order as completed
    completeOrder(orderId) {
      const order = this.orders.find(o => o.id === orderId);
      if (!order) return false;
      
      order.status = 'completed';
      order.completedAt = new Date().toISOString();
      
      // Find the driver
      const driver = this.drivers.find(d => d.id === order.assignedDriver);
      if (driver) {
        driver.status = 'available';
        driver.currentOrder = null;
        
        // Update the delivery in driver's history
        const deliveryIndex = driver.deliveries.findIndex(d => d.orderId === orderId);
        if (deliveryIndex >= 0) {
          driver.deliveries[deliveryIndex].completedAt = new Date().toISOString();
        }
        
        // Assign the next order if there's one in queue
        const nextOrder = this.getNextDelivery();
        if (nextOrder) {
          this.assignOrder(nextOrder.id);
        }
      }
      
      this.saveToStorage();
      return true;
    }
    
    // Update driver status
    updateDriverStatus(driverId, newStatus) {
      const driver = this.drivers.find(d => d.id === driverId);
      if (!driver) return false;
      
      driver.status = newStatus;
      
      if (newStatus === 'available' && driver.currentOrder) {
        // If setting to available while having an order, clear the current order
        driver.currentOrder = null;
      }
      
      if (newStatus === 'available') {
        // Assign the next order if there's one in queue
        const nextOrder = this.getNextDelivery();
        if (nextOrder) {
          this.assignOrder(nextOrder.id);
        }
      }
      
      this.saveToStorage();
      return true;
    }
    
    // Get the next delivery to be assigned
    getNextDelivery() {
      return this.orders.find(o => o.status === 'pending' || o.status === 'queued');
    }
    
    // Get estimated delivery time based on zone
    getEstimatedDeliveryTime(zoneId) {
      const zone = this.deliveryZones.find(z => z.id === zoneId);
      if (!zone) return 60; // Default 60 minutes
      
      const now = new Date();
      const estimatedTime = new Date(now.getTime() + zone.estimatedDeliveryTime * 60000);
      return estimatedTime.toISOString();
    }
    
    // Notify about new order
    notifyNewOrder(order) {
      // Play notification sound if available
      const audio = new Audio('/notification.mp3');
      if (audio) {
        audio.play().catch(err => console.log('Could not play notification sound'));
      }
      
      // Show notification if browser supports it
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('New Order', {
            body: `New order #${order.id} received for ${order.address}`,
            icon: '/favicon.ico'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('New Order', {
                body: `New order #${order.id} received for ${order.address}`,
                icon: '/favicon.ico'
              });
            }
          });
        }
      }
      
      // Update UI
      this.renderOrderQueue();
    }
    
    // Notify about order assignment
    notifyOrderAssigned(order, driver) {
      // Update UI
      this.renderDriverDashboard();
      this.renderOrderQueue();
    }
    
    // Initialize driver interface
    initDriverInterface() {
      document.addEventListener('DOMContentLoaded', () => {
        // Add driver interface to the page
        const driverInterfaceContainer = document.createElement('div');
        driverInterfaceContainer.id = 'driver-interface';
        // NEW:
driverInterfaceContainer.style.cssText = `
position: fixed;
bottom: 0;
right: 0;
width: 300px;
background-color: var(--primary);
color: white;
border-radius: 8px 0 0 0;
padding: 10px;
z-index: 1000;
box-shadow: -2px -2px 10px rgba(0,0,0,0.2);
`;

        
        driverInterfaceContainer.innerHTML = `
          <div class="driver-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3>Driver Dashboard</h3>
            <button id="toggle-driver-dashboard" style="background: none; border: none; color: white; cursor: pointer;">▼</button>
          </div>
          <div id="driver-content" style="display: none;">
            <div id="driver-status" style="margin-bottom: 10px;"></div>
            <div id="current-delivery" style="margin-bottom: 10px;"></div>
            <div id="delivery-queue" style="margin-bottom: 10px;"></div>
            <div class="driver-controls">
              <button id="driver-available" class="btn btn-primary" style="margin-right: 5px;">Available</button>
              <button id="driver-break" class="btn btn-outline" style="color: var(--secondary); border-color: var(--secondary);">On Break</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(driverInterfaceContainer);
        
        // Set up toggle functionality
        document.getElementById('toggle-driver-dashboard').addEventListener('click', function() {
          const content = document.getElementById('driver-content');
          const isVisible = content.style.display !== 'none';
          content.style.display = isVisible ? 'none' : 'block';
          this.textContent = isVisible ? '▼' : '▲';
        });
        
        // Set up driver status buttons
        document.getElementById('driver-available').addEventListener('click', () => {
          this.updateDriverStatus(1, 'available');
          this.renderDriverDashboard();
        });
        
        document.getElementById('driver-break').addEventListener('click', () => {
          this.updateDriverStatus(1, 'break');
          this.renderDriverDashboard();
        });
        
        // Initial render
        this.renderDriverDashboard();
        this.renderOrderQueue();
      });
    }
    
    // Render driver dashboard
    renderDriverDashboard() {
      const driver = this.drivers[0]; // Assuming single driver for now
      if (!driver) return;
      
      const statusElement = document.getElementById('driver-status');
      const currentDeliveryElement = document.getElementById('current-delivery');
      
      if (statusElement) {
        statusElement.innerHTML = `
          <p>Status: <strong>${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}</strong></p>
        `;
      }
      
      if (currentDeliveryElement) {
        if (driver.currentOrder) {
          const order = this.orders.find(o => o.id === driver.currentOrder);
          if (order) {
            // Format estimated time
            const estimatedTime = new Date(order.estimatedDeliveryTime);
            const formattedTime = estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            currentDeliveryElement.innerHTML = `
              <h4>Current Delivery</h4>
              <p>Order #${order.id}</p>
              <p>Address: ${order.address}</p>
              <p>ETA: ${formattedTime}</p>
              <button id="complete-current-delivery" class="btn btn-primary" style="margin-top: 10px;">Mark Completed</button>
            `;
            
            // Set up complete button
            setTimeout(() => {
              const completeBtn = document.getElementById('complete-current-delivery');
              if (completeBtn) {
                completeBtn.addEventListener('click', () => {
                  this.completeOrder(order.id);
                  this.renderDriverDashboard();
                  this.renderOrderQueue();
                });
              }
            }, 0);
          } else {
            currentDeliveryElement.innerHTML = '<p>No active delivery</p>';
          }
        } else {
          currentDeliveryElement.innerHTML = '<p>No active delivery</p>';
        }
      }
    }
    
    // Render order queue
    renderOrderQueue() {
      const queueElement = document.getElementById('delivery-queue');
      if (!queueElement) return;
      
      const pendingOrders = this.orders.filter(o => o.status === 'pending' || o.status === 'queued');
      
      if (pendingOrders.length === 0) {
        queueElement.innerHTML = '<p>No orders in queue</p>';
        return;
      }
      
      let queueHtml = '<h4>Delivery Queue</h4><ul style="list-style: none; padding: 0;">';
      
      pendingOrders.forEach(order => {
        queueHtml += `
          <li style="margin-bottom: 5px; padding: 5px; background-color: rgba(0,0,0,0.1); border-radius: 4px;">
            Order #${order.id} - ${order.address}
          </li>
        `;
      });
      
      queueHtml += '</ul>';
      queueElement.innerHTML = queueHtml;
    }
  }
  
  // Create and initialize the delivery system
  const deliverySystem = new DeliverySystem();
  
  // Add to window for debugging
  window.deliverySystem = deliverySystem;
  
  // Extend the checkout process to include address details
  document.addEventListener('DOMContentLoaded', function() {
    // Add delivery address form to cart modal
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
      const modalContent = cartModal.querySelector('.modal-content');
      
      // Add "Checkout" button event listener
      const checkoutButton = modalContent.querySelector('.btn-primary');
      if (checkoutButton) {
        checkoutButton.addEventListener('click', function() {
          openDeliveryDetailsModal();
        });
      }
    }
    
    // Create delivery details modal
    function createDeliveryDetailsModal() {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'delivery-details-modal';
      
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">Delivery Details</h2>
            <button class="close-modal" onclick="closeModal('delivery-details-modal')">&times;</button>
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="delivery-name" required>
          </div>
          <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" id="delivery-phone" required>
          </div>
          <div class="form-group">
            <label>Delivery Address</label>
            <input type="text" id="delivery-address" required>
          </div>
          <div class="form-group">
            <label>Apartment/Unit (optional)</label>
            <input type="text" id="delivery-apt">
          </div>
          <div class="form-group">
            <label>Delivery Instructions (optional)</label>
            <textarea id="delivery-instructions" rows="3"></textarea>
          </div>
          <div class="age-verification">
            <label>
              <input type="checkbox" id="age-verification" required>
              I confirm that I am 21 years or older
            </label>
          </div>
          <div class="form-footer">
            <button class="btn btn-primary" id="submit-delivery">Submit Order</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Add event listener for submit
      document.getElementById('submit-delivery').addEventListener('click', function() {
        const nameInput = document.getElementById('delivery-name');
        const phoneInput = document.getElementById('delivery-phone');
        const addressInput = document.getElementById('delivery-address');
        const ageVerification = document.getElementById('age-verification');
        
        if (nameInput.value && phoneInput.value && addressInput.value && ageVerification.checked) {
          submitOrder();
        } else {
          alert('Please fill in all required fields and confirm you are 21 or older.');
        }
      });
    }
    
    // Open delivery details modal
    function openDeliveryDetailsModal() {
      // Create the modal if it doesn't exist
      if (!document.getElementById('delivery-details-modal')) {
        createDeliveryDetailsModal();
      }
      
      // Open the modal
      const modal = document.getElementById('delivery-details-modal');
      modal.style.display = 'flex';
      
      // Close cart modal
      closeModal('cart-modal');
    }
    
    // Submit order function
    function submitOrder() {
      // Get cart items from the cart global variable
      const items = window.cart || [];
      
      // Calculate total
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Get customer details
      const customer = {
        name: document.getElementById('delivery-name').value,
        phone: document.getElementById('delivery-phone').value
      };
      
      // Get delivery address
      const apartment = document.getElementById('delivery-apt').value;
      const instructions = document.getElementById('delivery-instructions').value;
      const address = `${document.getElementById('delivery-address').value}${apartment ? ', Apt ' + apartment : ''}`;
      
      // Create order data
      const orderData = {
        customer,
        address,
        instructions,
        items,
        total
      };
      
      // Add order to delivery system
      const orderId = deliverySystem.addOrder(orderData);
      
      // Close the modal
      closeModal('delivery-details-modal');
      
      // Show order confirmation modal
      showOrderConfirmation(orderId);
      
      // Clear cart
      window.cart = [];
      updateCartCount();
    }
    
    // Show order confirmation
    function showOrderConfirmation(orderId) {
      // Create confirmation modal
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'order-confirmation-modal';
      
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">Order Confirmation</h2>
            <button class="close-modal" onclick="closeModal('order-confirmation-modal')">&times;</button>
          </div>
          <div style="text-align: center; padding: 20px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h3 style="margin: 20px 0;">Order Placed Successfully!</h3>
            <p>Your order #${orderId} has been received.</p>
            <p>We will deliver your order as soon as possible.</p>
            <p>You will receive updates on your delivery status.</p>
          </div>
          <div class="form-footer">
            <button class="btn btn-primary" onclick="closeModal('order-confirmation-modal')">Continue Shopping</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Show the modal
      modal.style.display = 'flex';
    }
  });
  
  // Add order tracking modal
  document.addEventListener('DOMContentLoaded', function() {
    // Add Track Order link to nav
    const navList = document.querySelector('nav ul');
    if (navList) {
      const trackOrderItem = document.createElement('li');
      trackOrderItem.innerHTML = '<a href="#" id="track-order-link">Track Order</a>';
      navList.appendChild(trackOrderItem);
      
      // Add event listener for track order link
      document.getElementById('track-order-link').addEventListener('click', function(e) {
        e.preventDefault();
        openTrackOrderModal();
      });
    }
    
    // Create track order modal
    function createTrackOrderModal() {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'track-order-modal';
      
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">Track Your Order</h2>
            <button class="close-modal" onclick="closeModal('track-order-modal')">&times;</button>
          </div>
          <div class="form-group">
            <label>Order Number</label>
            <input type="text" id="order-number" placeholder="Enter your order number">
          </div>
          <div class="form-footer">
            <button class="btn btn-primary" id="track-order-button">Track</button>
          </div>
          <div id="order-status-container" style="margin-top: 20px; display: none;"></div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Add event listener for track button
      document.getElementById('track-order-button').addEventListener('click', function() {
        const orderNumber = document.getElementById('order-number').value;
        if (orderNumber) {
          displayOrderStatus(orderNumber);
        } else {
          alert('Please enter an order number');
        }
      });
    }
    
    // Open track order modal
    function openTrackOrderModal() {
      // Create the modal if it doesn't exist
      if (!document.getElementById('track-order-modal')) {
        createTrackOrderModal();
      }
      
      // Open the modal
      const modal = document.getElementById('track-order-modal');
      modal.style.display = 'flex';
    }
    
    // Display order status
    function displayOrderStatus(orderNumber) {
      const order = deliverySystem.orders.find(o => o.id.toString() === orderNumber.toString());
      const statusContainer = document.getElementById('order-status-container');
      
      if (!statusContainer) return;
      
      if (!order) {
        statusContainer.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12" y2="16"></line>
            </svg>
            <h3 style="margin: 10px 0; color: var(--error);">Order Not Found</h3>
            <p>We couldn't find an order with this number. Please check the order number and try again.</p>
          </div>
        `;
        statusContainer.style.display = 'block';
        return;
      }
      
      // Get status information
      let statusText, statusColor, statusIcon, estimatedTime;
      
      switch (order.status) {
        case 'pending':
          statusText = 'Order Received';
          statusColor = 'var(--secondary)';
          statusIcon = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line>';
          estimatedTime = 'Waiting for assignment';
          break;
        case 'queued':
          statusText = 'In Queue';
          statusColor = 'var(--secondary)';
          statusIcon = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line>';
          estimatedTime = 'Waiting for driver';
          break;
        case 'assigned':
          statusText = 'Driver Assigned';
          statusColor = 'var(--accent)';
          statusIcon = '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>';
          
          const etaTime = new Date(order.estimatedDeliveryTime);
          estimatedTime = `ETA: ${etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          break;
        case 'completed':
          statusText = 'Delivered';
          statusColor = 'var(--success)';
          statusIcon = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
          estimatedTime = 'Order completed';
          break;
        default:
          statusText = 'Processing';
          statusColor = 'var(--primary)';
          statusIcon = '<circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line>';
          estimatedTime = 'Processing order';
      }
      
      // Display status
      statusContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${statusIcon}
          </svg>
          <h3 style="margin: 10px 0; color: ${statusColor};">${statusText}</h3>
          <p>${estimatedTime}</p>
          <div style="margin-top: 20px;">
            <h4>Order Details</h4>
            <p>Order #${order.id}</p>
            <p>Total: $${order.total.toFixed(2)}</p>
            <p>Address: ${order.address}</p>
          </div>
        </div>
      `;
      statusContainer.style.display = 'block';
    }
  });
  
  // Admin dashboard for managing orders and drivers
  document.addEventListener('DOMContentLoaded', function() {
    // Add Admin link to nav for admin access
    const navList = document.querySelector('nav ul');
    if (navList) {
      const adminItem = document.createElement('li');
      adminItem.innerHTML = '<a href="#" id="admin-panel-link">Admin</a>';
      navList.appendChild(adminItem);
      
      // Add event listener for admin panel link
      document.getElementById('admin-panel-link').addEventListener('click', function(e) {
        e.preventDefault();
        openAdminPanel();
      });
    }
    
    // Create admin panel
    function createAdminPanel() {
      const panel = document.createElement('div');
      panel.className = 'modal';
      panel.id = 'admin-panel';
      
      panel.innerHTML = `
        <div class="modal-content" style="max-width: 800px; width: 90%;">
          <div class="modal-header">
            <h2 class="modal-title">Admin Dashboard</h2>
            <button class="close-modal" onclick="closeModal('admin-panel')">&times;</button>
          </div>
          <div style="display: flex; margin-bottom: 20px;">
            <div style="flex: 1; padding: 10px;">
              <button class="btn btn-primary" id="admin-orders-tab" style="width: 100%;">Orders</button>
            </div>
            <div style="flex: 1; padding: 10px;">
              <button class="btn btn-outline" id="admin-drivers-tab" style="width: 100%;">Drivers</button>
            </div>
          </div>
          <div id="admin-content">
            <!-- Content will be loaded here -->
          </div>
        </div>
      `;
      
      document.body.appendChild(panel);
      
      // Add event listeners for tabs
      document.getElementById('admin-orders-tab').addEventListener('click', function() {
        document.getElementById('admin-orders-tab').className = 'btn btn-primary';
        document.getElementById('admin-drivers-tab').className = 'btn btn-outline';
        renderOrdersTab();
      });
      
      document.getElementById('admin-drivers-tab').addEventListener('click', function() {
        document.getElementById('admin-orders-tab').className = 'btn btn-outline';
        document.getElementById('admin-drivers-tab').className = 'btn btn-primary';
        renderDriversTab();
      });
    }   // ← closes createAdminPanel()

});  // ← closes document.addEventListener('DOMContentLoaded', ...)
