const token = localStorage.getItem("token");
if (!token || localStorage.getItem("role") !== "admin") {
  window.location.href = "/auth/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const STATUS_FLOW = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "REJECTED"];

async function loadOrders() {
  const ordersContainer = document.getElementById("orders");

  ordersContainer.innerHTML = `
    <div class="no-orders">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading orders...</p>
    </div>
  `;

  try {
    const res = await fetch("/api/orders", { headers });

    if (!res.ok) {
      throw new Error("Failed to load orders");
    }

    const orders = await res.json();

    if (orders.length === 0) {
      ordersContainer.innerHTML = `
        <div class="no-orders">
          <i class="fas fa-inbox"></i>
          <p>No orders found</p>
        </div>
      `;
      return;
    }

    ordersContainer.innerHTML = "";

    orders.forEach((order, index) => {
      const options = STATUS_FLOW.map(
        (s) =>
          `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`
      ).join("");

      const orderCard = document.createElement("div");
      orderCard.className = "order-card";
      orderCard.style.animationDelay = `${index * 0.1}s`;

      orderCard.innerHTML = `
        <div class="order-info">
          <div class="order-details">
            <div class="order-detail-item">
              <span class="order-detail-label">Order ID</span>
              <span class="order-detail-value">#${order.id}</span>
            </div>

            <div class="order-detail-item">
              <span class="order-detail-label">Order Status</span>
              <span class="order-detail-value status-${order.status}">
                ${order.status}
              </span>
            </div>

            <div class="order-detail-item">
              <span class="order-detail-label">Payment</span>
              <span class="order-detail-value">
                ${order.payment.method} — 
                <strong>${order.payment.status}</strong>
              </span>
            </div>
          </div>

          <div class="status-selector">
            <select onchange="updateStatus(${order.id}, this.value, this)">
              ${options}
            </select>

            <button 
              class="btn btn-sm btn-secondary"
              onclick='viewOrder(${JSON.stringify(order).replace(/'/g, "&#39;")})'
            >
              👁 View Details
            </button>
          </div>
        </div>
      `;

      ordersContainer.appendChild(orderCard);
    });
  } catch (error) {
    console.error("Error loading orders:", error);
    ordersContainer.innerHTML = `
      <div class="no-orders">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load orders. Please try again.</p>
      </div>
    `;
  }
}

async function updateStatus(id, status, el) {
  try {
    const res = await fetch(`/api/orders/status/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error("Failed to update status");

    const orderCard = el.closest(".order-card");

    orderCard.style.background =
      "linear-gradient(135deg, rgba(67,233,123,0.2), rgba(56,249,215,0.2))";

    setTimeout(() => {
      orderCard.style.background = "";
    }, 800);

    await loadOrders();
  } catch (err) {
    console.error(err);
    alert("Failed to update order status");
  }
}

function viewOrder(order) {
  const modal = document.getElementById("orderDetailModal");
  const body = document.getElementById("orderDetailBody");

  const subtotal = order.subtotal ?? order.items.reduce((sum, i) => sum + (i.finalPrice ?? i.price) * i.qty, 0);
  const discount = order.discountTotal ?? 0;
  const total = order.grandTotal ?? (subtotal - discount);

  body.innerHTML = `
    <div class="order-detail-container">
      
      <!-- Order Header -->
      <div class="order-detail-header">
        <div class="order-id-badge">
          <i class="fas fa-receipt"></i>
          <span>Order #${order.id}</span>
        </div>
        <div class="order-status-badge status-${order.status}">
          ${order.status}
        </div>
      </div>

      <!-- Order Info Grid -->
      <div class="order-info-grid">
        <div class="info-card">
          <div class="info-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <i class="fas fa-credit-card"></i>
          </div>
          <div class="info-content">
            <span class="info-label">Payment Method</span>
            <span class="info-value">${order.payment.method}</span>
          </div>
        </div>

        <div class="info-card">
          <div class="info-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <i class="fas fa-info-circle"></i>
          </div>
          <div class="info-content">
            <span class="info-label">Payment Status</span>
            <span class="info-value payment-${order.payment.status}">${order.payment.status}</span>
          </div>
        </div>

        <div class="info-card">
          <div class="info-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <i class="fas fa-calendar"></i>
          </div>
          <div class="info-content">
            <span class="info-label">Order Date</span>
            <span class="info-value">${new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div class="info-card">
          <div class="info-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <i class="fas fa-clock"></i>
          </div>
          <div class="info-content">
            <span class="info-label">Order Time</span>
            <span class="info-value">${new Date(order.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <!-- Order Items -->
      <div class="order-items-section">
        <h3><i class="fas fa-shopping-bag"></i> Order Items</h3>
        <div class="items-table">
          ${order.items.map((item, index) => `
            <div class="item-row" style="animation-delay: ${index * 0.1}s">
              <div class="item-details">
                <span class="item-name">${item.name || `Product #${item.productId}`}</span>
                <span class="item-qty">Qty: ${item.qty}</span>
              </div>
              <div class="item-price">
                ${item.finalPrice !== item.price && item.finalPrice ? `
                  <span class="original-price">$${item.price}</span>
                  <span class="discounted-price">$${item.finalPrice}</span>
                ` : `
                  <span class="regular-price">$${item.price}</span>
                `}
                <span class="item-total">= $${((item.finalPrice ?? item.price) * item.qty).toFixed(2)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Order Summary -->
      <div class="order-summary">
        <h3><i class="fas fa-calculator"></i> Order Summary</h3>
        <div class="summary-row">
          <span>Subtotal</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        ${discount > 0 ? `
          <div class="summary-row discount-row">
            <span>Discount</span>
            <span>-$${discount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="summary-row total-row">
          <span>Grand Total</span>
          <span>$${total.toFixed(2)}</span>
        </div>
      </div>

      <!-- Delivery Address -->
      ${order.address ? `
        <div class="delivery-address">
          <h3><i class="fas fa-map-marker-alt"></i> Delivery Address</h3>
          <div class="address-card">
            <div class="address-icon">
              <i class="fas fa-user"></i>
            </div>
            <div class="address-content">
              <p class="customer-name">${order.address.fullName || 'N/A'}</p>
              <p class="customer-phone">${order.address.phone || ''}</p>
              <p class="address-line">${order.address.street || ''}</p>
              <p class="address-line">${order.address.city || ''} ${order.address.zip || ''}</p>
              <p class="address-line">${order.address.country || ''}</p>
            </div>
          </div>
        </div>
      ` : ''}

    </div>
  `;

  modal.style.display = "flex";
}

function closeOrderModal() {
  document.getElementById("orderDetailModal").style.display = "none";
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById("orderDetailModal");
  if (event.target === modal) {
    closeOrderModal();
  }
}

// Load orders on page load
loadOrders();