const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "buyer") {
  window.location.href = "/auth/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

let allCategories = [];
let allProducts = [];
let allOrders = [];

// Navigation
document.addEventListener("DOMContentLoaded", () => {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const section = item.getAttribute("data-section");
      if (!section) return;

      e.preventDefault();
      navigateToSection(section);
    });
  });

  initDashboard();
});

function navigateToSection(section) {
  // Update active nav
  document.querySelectorAll(".nav-item").forEach((nav) => {
    if (nav.getAttribute("data-section") === section) {
      nav.classList.add("active");
    } else {
      nav.classList.remove("active");
    }
  });

  // Update active section
  document.querySelectorAll(".content-section").forEach((sec) => {
    sec.classList.remove("active");
  });
  document.getElementById(section).classList.add("active");

  // Update page title
  const titles = {
    dashboard: "Dashboard",
    products: "Available Products",
  };
  document.getElementById("pageTitle").textContent =
    titles[section] || "Dashboard";
}

async function initDashboard() {
  await loadCategoryWiseProducts();
  await loadBuyerOrders();
  updateDashboardStats();
  loadRecentOrders();
}

let cart = JSON.parse(localStorage.getItem("cart")) || [];
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = count;
}
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
});

// Load Category-wise Products (Original Logic)
async function loadCategoryWiseProducts() {
  const [catRes, prodRes] = await Promise.all([
    fetch("/api/inventory/categories", { headers }),
    fetch("/api/inventory", { headers }),
  ]);

  allCategories = await catRes.json();
  allProducts = await prodRes.json();

  updateCategoryFilter();
  displayCategoryWiseProducts();
}

// Load Buyer Orders (Fixed endpoint)
async function loadBuyerOrders() {
  try {
    const res = await fetch("/api/orders/my", { headers });
    if (res.ok) {
      allOrders = await res.json();
    } else {
      allOrders = [];
    }
  } catch (error) {
    console.error("Error loading orders:", error);
    allOrders = [];
  }
}

// Update Dashboard Stats
function updateDashboardStats() {
  const elTotalProducts = document.getElementById("totalProducts");
  const elTotalCategories = document.getElementById("totalCategories");
  const elTotalOrders = document.getElementById("totalOrders");
  const elPendingOrders = document.getElementById("pendingOrders");

  if (elTotalProducts) elTotalProducts.textContent = allProducts.length;
  if (elTotalCategories) elTotalCategories.textContent = allCategories.length;
  if (elTotalOrders) elTotalOrders.textContent = allOrders.length;

  const pending = allOrders.filter((o) =>
    ["PENDING", "CONFIRMED", "PACKED", "SHIPPED"].includes(o.status)
  ).length;

  if (elPendingOrders) elPendingOrders.textContent = pending;
}

// Display Category-wise Products (Original Logic)
function displayCategoryWiseProducts() {
  const root = document.getElementById("categoryProducts");
  if (!root) return;

  // Group products by categoryId
  const group = new Map();
  allProducts.forEach((p) => {
    const catId = Number(p.categoryId);
    if (!group.has(catId)) group.set(catId, []);
    group.get(catId).push(p);
  });

  root.innerHTML = "";

  if (allCategories.length === 0) {
    root.innerHTML = '<div class="no-data">No categories available</div>';
    return;
  }

  if (allProducts.length === 0) {
    root.innerHTML = '<div class="no-data">No products available</div>';
    return;
  }

  allCategories.forEach((category, index) => {
    const items = group.get(Number(category.id)) || [];

    const categorySection = document.createElement("div");
    categorySection.className = "category-section";
    categorySection.style.animationDelay = `${index * 0.1}s`;

    categorySection.innerHTML = `
    <div class="category-header">
      <h3><i class="fas fa-tag"></i> ${category.name}</h3>
      <span class="product-count">${items.length} products</span>
    </div>
  `;

    if (items.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "no-data";
      emptyMsg.textContent = "No products in this category.";
      categorySection.appendChild(emptyMsg);
    } else {
      const productsGrid = document.createElement("div");
      productsGrid.className = "products-grid";

      items.forEach((product) => {
        const productCard = document.createElement("div");
        productCard.className = "product-card";

        let stockStatus = "in-stock";
        let stockText = "In Stock";

        if (product.quantity === 0) {
          stockStatus = "out-of-stock";
          stockText = "Out of Stock";
        } else if (product.quantity < 10) {
          stockStatus = "low-stock";
          stockText = "Low Stock";
        }
        let priceHtml = `$${product.price}`;
        let countdownHtml = "";

        if (product.discount?.active) {
          const priceInfo = calculateFinalPrice(product);

          priceHtml = `
    <span class="old-price">$${product.price}</span>
    <span class="final-price">$${priceInfo.finalPrice.toFixed(2)}</span>
    <span class="sale-glow">SALE</span>
  `;

          countdownHtml = `
    <div class="discount-timer">
      ⏳ ${getDiscountCountdown(product.discount.endAt)}
    </div>
  `;
        }

        const priceInfo = calculateFinalPrice(product);
        productCard.innerHTML = `
  <div class="product-image">
    ${
      product.imageUrl
        ? `<img src="${product.imageUrl}" />`
        : `<i class="fas fa-box"></i>`
    }
  </div>

  <div class="product-info">
    <h4>${product.name}</h4>

    <div class="product-price">
      ${priceHtml}
      ${countdownHtml}
    </div>

    <div class="product-details">
      <span class="stock-info ${stockStatus}">
        <i class="fas fa-cubes"></i> ${product.quantity} available
      </span>
      <span class="stock-badge ${stockStatus}">
        ${stockText}
      </span>
    </div>
  </div>

<button class="btn btn-secondary" onclick="addToCart(${product.id})">
  <i class="fas fa-cart-plus"></i> Add to Cart
</button>


<button class="btn btn-primary" onclick="buyNowById(${product.id})">
  ⚡ Buy Now
</button>


`;

        productsGrid.appendChild(productCard);
      });

      categorySection.appendChild(productsGrid);
    }

    root.appendChild(categorySection);
  });
}

function addToCart(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) {
    alert("Product not found");
    return;
  }

  if (product.quantity === 0) {
    alert("Product is out of stock");
    return;
  }

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const existing = cart.find((i) => i.productId === productId);
  const finalPrice = calculateFinalPrice(product).finalPrice;

  if (existing) {
    if (existing.qty >= product.quantity) {
      alert("No more stock available");
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      finalPrice,
      qty: 1,
      imageUrl: product.imageUrl || "",
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  // ✅ IMMEDIATE UPDATE - No refresh needed
  updateCartCount();

  // Show success notification
  showNotification(`${product.name} added to cart!`);
}

function showNotification(message) {
  // Remove existing notification if any
  const existing = document.querySelector(".cart-notification");
  if (existing) existing.remove();

  // Create notification
  const notification = document.createElement("div");
  notification.className = "cart-notification";
  notification.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add("show"), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function buyNowById(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) {
    alert("Product not found");
    return;
  }

  localStorage.setItem(
    "directBuy",
    JSON.stringify([
      {
        productId: product.id,
        qty: 1,
      },
    ])
  );

  window.location.href = "./checkout.html";
}

// Update Category Filter
function updateCategoryFilter() {
  const select = document.getElementById("categoryFilterBuyer");
  if (!select) return;

  const options = allCategories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  select.innerHTML = '<option value="">All Categories</option>' + options;
}

// Filter Products by Category
function filterProductsByCategory() {
  const categoryId = document.getElementById("categoryFilterBuyer").value;

  if (!categoryId) {
    displayCategoryWiseProducts();
    return;
  }

  const root = document.getElementById("categoryProducts");
  const category = allCategories.find((c) => c.id == categoryId);
  const products = allProducts.filter((p) => p.categoryId == categoryId);

  root.innerHTML = "";

  const categorySection = document.createElement("div");
  categorySection.className = "category-section";

  categorySection.innerHTML = `
    <div class="category-header">
      <h3><i class="fas fa-tag"></i> ${category.name}</h3>
      <span class="product-count">${products.length} products</span>
    </div>
  `;

  if (products.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "no-data";
    emptyMsg.textContent = "No products available in this category";
    categorySection.appendChild(emptyMsg);
  } else {
    const productsGrid = document.createElement("div");
    productsGrid.className = "products-grid";

    products.forEach((product) => {
      const productCard = document.createElement("div");
      productCard.className = "product-card";

      let stockStatus = "in-stock";
      let stockText = "In Stock";

      if (product.quantity === 0) {
        stockStatus = "out-of-stock";
        stockText = "Out of Stock";
      } else if (product.quantity < 10) {
        stockStatus = "low-stock";
        stockText = "Low Stock";
      }
      const priceInfo = calculateFinalPrice(product);
      productCard.innerHTML = `
        

<div class="product-image">
  ${
    product.imageUrl
      ? `<img src="${product.imageUrl}" alt="${product.name}" />`
      : `<i class="fas fa-box"></i>`
  }

  ${
    priceInfo.hasDiscount
      ? `<span class="discount-badge">
          ${
            product.discount.type === "PERCENT"
              ? `-${product.discount.value}%`
              : `-$${product.discount.value}`
          }
        </span>`
      : ""
  }
</div>


        <div class="product-info">
          <h4>${product.name}</h4>
          <div class="product-details">
            <span class="stock-info ${stockStatus}">
              <i class="fas fa-cubes"></i> ${product.quantity} available
            </span>
            <span class="stock-badge ${stockStatus}">${stockText}</span>
          </div>
        </div>
        <button 
          class="btn btn-primary order-btn" 
          onclick="openOrderModal(${product.id}, '${escapeQuotes(
        product.name
      )}', ${product.quantity})"
          ${product.quantity === 0 ? "disabled" : ""}
        >
          <i class="fas fa-shopping-cart"></i> 
          ${product.quantity === 0 ? "Out of Stock" : "Order Now"}
        </button>
      `;

      productsGrid.appendChild(productCard);
    });

    categorySection.appendChild(productsGrid);
  }

  root.appendChild(categorySection);
}

// Search Products
function searchProducts() {
  const searchTerm = document
    .getElementById("searchProduct")
    .value.toLowerCase();

  if (!searchTerm) {
    displayCategoryWiseProducts();
    return;
  }

  const filteredProducts = allProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm)
  );

  const root = document.getElementById("categoryProducts");
  root.innerHTML = "";

  if (filteredProducts.length === 0) {
    root.innerHTML =
      '<div class="no-data">No products found matching your search</div>';
    return;
  }

  const categorySection = document.createElement("div");
  categorySection.className = "category-section";

  categorySection.innerHTML = `
    <div class="category-header">
      <h3><i class="fas fa-search"></i> Search Results</h3>
      <span class="product-count">${filteredProducts.length} products</span>
    </div>
  `;

  const productsGrid = document.createElement("div");
  productsGrid.className = "products-grid";

  filteredProducts.forEach((product) => {
    const productCard = document.createElement("div");
    productCard.className = "product-card";

    let stockStatus = "in-stock";
    let stockText = "In Stock";

    if (product.quantity === 0) {
      stockStatus = "out-of-stock";
      stockText = "Out of Stock";
    } else if (product.quantity < 10) {
      stockStatus = "low-stock";
      stockText = "Low Stock";
    }

    const category = allCategories.find((c) => c.id === product.categoryId);
    const priceInfo = calculateFinalPrice(product);
    productCard.innerHTML = `


<div class="product-image">
  ${
    product.imageUrl
      ? `<img src="${product.imageUrl}" alt="${product.name}" />`
      : `<i class="fas fa-box"></i>`
  }

  ${
    priceInfo.hasDiscount
      ? `<span class="discount-badge">
          ${
            product.discount.type === "PERCENT"
              ? `-${product.discount.value}%`
              : `-$${product.discount.value}`
          }
        </span>`
      : ""
  }
</div>


      <div class="product-info">
        <h4>${product.name}</h4>
        <p class="category-label"><i class="fas fa-tag"></i> ${
          category ? category.name : "Unknown"
        }</p>
        <div class="product-details">
          <span class="stock-info ${stockStatus}">
            <i class="fas fa-cubes"></i> ${product.quantity} available
          </span>
          <span class="stock-badge ${stockStatus}">${stockText}</span>
        </div>
      </div>
      <button 
        class="btn btn-primary order-btn" 
        onclick="openOrderModal(${product.id}, '${escapeQuotes(
      product.name
    )}', ${product.quantity})"
        ${product.quantity === 0 ? "disabled" : ""}
      >
        <i class="fas fa-shopping-cart"></i> 
        ${product.quantity === 0 ? "Out of Stock" : "Order Now"}
      </button>
    `;

    productsGrid.appendChild(productCard);
  });

  categorySection.appendChild(productsGrid);
  root.appendChild(categorySection);
}

// Order Modal
let selectedProductForOrder = null;

function openOrderModal(productId, productName, stock) {
  selectedProductForOrder = { id: productId, name: productName, stock: stock };

  document.getElementById("orderProductId").value = productId;
  document.getElementById("orderProductName").textContent = productName;
  document.getElementById("orderProductStock").textContent = stock;
  document.getElementById("orderQuantity").value = "";
  document.getElementById("orderQuantity").max = stock;

  openModal("orderModal");
}

// Place Order (Original Logic)
async function confirmOrder() {
  const quantity = Number(document.getElementById("orderQuantity").value);

  if (!quantity || quantity <= 0) {
    alert("Please enter a valid quantity");
    return;
  }

  if (quantity > selectedProductForOrder.stock) {
    alert(`Only ${selectedProductForOrder.stock} units available`);
    return;
  }

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: [{ productId: selectedProductForOrder.id, qty: quantity }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Order failed");
      return;
    }

    alert(
      `Order placed successfully for ${quantity} unit(s) of ${selectedProductForOrder.name}`
    );
    closeModal("orderModal");

    // Refresh data
    await loadCategoryWiseProducts();
    await loadBuyerOrders();
    updateDashboardStats();
    loadRecentOrders();
  } catch (error) {
    console.error("Error placing order:", error);
    alert("Failed to place order. Please try again.");
  }
}

// Recent Orders
function loadRecentOrders() {
  const container = document.getElementById("recentOrders");
  if (!container) return;

  const recent = allOrders.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<div class="no-data">No orders yet</div>';
    return;
  }

  container.innerHTML = recent
    .map((order, index) => {
      const statusClass = order.status ? order.status.toLowerCase() : "pending";
      return `
      <div class="recent-order-card" style="animation-delay: ${index * 0.1}s">
        <strong>Order #${order.id}</strong>
        <span class="order-status status-${statusClass}">
          ${order.status || "PENDING"}
        </span>
      </div>
    `;
    })
    .join("");
}

// Modal Functions
function openModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function openCart() {
  // ✅ Refresh cart display with latest data
  updateCartCount();
  renderCart();
  openModal("cartModal");
}

function renderCart() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = "<p class='no-data'>Your cart is empty</p>";
    if (totalEl) totalEl.textContent = "0";
    return;
  }

  let total = 0;

  container.innerHTML = cart
    .map((item, index) => {
      const lineTotal = item.finalPrice * item.qty;
      total += lineTotal;

      return `
        <div class="cart-item">
          <img src="${
            item.imageUrl ? item.imageUrl : "/uploads/placeholder.png"
          }" alt="${item.name}" />
          <div class="cart-info">
            <strong>${item.name}</strong>
            <p>$${item.finalPrice.toFixed(2)} × ${
        item.qty
      } = $${lineTotal.toFixed(2)}</p>
          </div>
          <button class="btn-remove" onclick="removeFromCart(${index})" title="Remove from cart">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    })
    .join("");

  if (totalEl) totalEl.textContent = total.toFixed(2);
}

function removeFromCart(index) {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const removedItem = cart[index];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));

  // ✅ IMMEDIATE UPDATE - No refresh needed
  updateCartCount();
  renderCart();

  showNotification(`${removedItem.name} removed from cart`);
}

function checkoutCart() {
  if (JSON.parse(localStorage.getItem("cart") || "[]").length === 0) {
    alert("Cart is empty");
    return;
  }
  window.location.href = "./checkout.html";
}

// Utility
function escapeQuotes(str) {
  return String(str).replaceAll("'", "\\'").replaceAll('"', "&quot;");
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "/auth/login.html";
}

// Close modals on outside click
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
  }
};

function calculateFinalPrice(product) {
  if (!product.discount?.active) {
    return { finalPrice: product.price, hasDiscount: false };
  }

  const now = new Date();
  if (product.discount.endAt && new Date(product.discount.endAt) < now) {
    return { finalPrice: product.price, hasDiscount: false };
  }

  let final = product.price;

  if (product.discount.type === "PERCENT") {
    final = product.price - (product.price * product.discount.value) / 100;
  }

  if (product.discount.type === "FLAT") {
    final = product.price - product.discount.value;
  }

  return { finalPrice: Math.max(final, 0), hasDiscount: true };
}

function getDiscountCountdown(endAt) {
  const diff = new Date(endAt) - new Date();
  if (diff <= 0) return "Expired";

  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return `${hrs}h ${mins}m ${secs}s`;
}

function buyNow(product) {
  localStorage.setItem(
    "directBuy",
    JSON.stringify([
      {
        productId: product.id,
        qty: 1,
      },
    ])
  );
  window.location.href = "./checkout.html";
}
