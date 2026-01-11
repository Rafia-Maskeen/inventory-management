const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "buyer") {
  window.location.href = "/auth/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

let allOrders = [];

// Load orders on page load
document.addEventListener("DOMContentLoaded", () => {
  loadOrders();
});

// Fetch buyer orders
async function loadOrders() {
  try {
    const res = await fetch("/api/orders/my", { headers });

    if (!res.ok) {
      throw new Error("Failed to fetch orders");
    }

    allOrders = await res.json();
    renderOrders(allOrders);
  } catch (err) {
    console.error(err);
    document.getElementById("orders").innerHTML = `
      <div class="no-orders">
        <i class="fas fa-box-open"></i>
        <p>Failed to load orders</p>
      </div>
    `;
  }
}

// Filter orders by status
function filterOrders(status, event) {
  document.querySelectorAll(".filter-tab").forEach((btn) => btn.classList.remove("active"));
  event.target.closest(".filter-tab").classList.add("active");

  if (status === "all") {
    renderOrders(allOrders);
  } else {
    const filtered = allOrders.filter((o) => o.status === status);
    renderOrders(filtered);
  }
}

// Mark order as paid
async function markPaid(orderId) {
  if (!confirm("Confirm you have paid this order?")) return;

  const res = await fetch(`/api/orders/pay/${orderId}`, {
    method: "POST",
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  alert("Payment marked as PAID ✅");
  loadOrders();
}

// Render orders
function renderOrders(orders) {
  const container = document.getElementById("orders");

  if (!orders.length) {
    container.innerHTML = `
      <div class="no-orders">
        <i class="fas fa-shopping-cart"></i>
        <p>No orders found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders
    .map((order) => {
      const statusClass = `status-${order.status.toLowerCase()}`;

      return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-id">
            Order #${order.id}
            ${
              order.payment.method === "COD" && order.payment.status === "UNPAID"
                ? `
                  <button class="btn btn-success btn-sm" onclick="markPaid(${order.id})">
                    💰 Mark as Paid
                  </button>
                `
                : ""
            }
            <button class="btn btn-sm btn-secondary" onclick='viewOrderDetails(${JSON.stringify(order).replace(/'/g, "&#39;")})'>
              👁 Details
            </button>
          </div>
          <div class="order-status ${statusClass}">${order.status}</div>
        </div>

        <div class="order-details">
          <div class="order-detail-item">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">${order.payment.method}</span>
          </div>
          <div class="order-detail-item">
            <span class="detail-label">Payment Status</span>
            <span class="detail-value">${order.payment.status}</span>
          </div>
          <div class="order-detail-item">
            <span class="detail-label">Created</span>
            <span class="detail-value">${new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div class="order-items">
          <h4>📦 Items (${order.items.length})</h4>
          <div class="item-list">
            ${order.items.slice(0, 3).map((item) => `
              <div class="item-row">
                <span class="item-name">${item.name || `Product #${item.productId}`}</span>
                <span class="item-qty">Qty: ${item.qty}</span>
              </div>
            `).join("")}
            ${order.items.length > 3 ? `<p style="color: #999; font-size: 13px; margin-top: 10px;">+ ${order.items.length - 3} more items</p>` : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

// View order details in modal
function viewOrderDetails(order) {
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
            <div class="modal-item-row" style="animation-delay: ${index * 0.1}s">
              <div class="item-details">
                <span class="modal-item-name">${item.name || `Product #${item.productId}`}</span>
                <span class="modal-item-qty">Qty: ${item.qty}</span>
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

// Close modal
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