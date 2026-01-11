const API = "/api/inventory";

const token = localStorage.getItem("token");

if (!token || localStorage.getItem("role") !== "admin") {
  window.location.href = "/auth/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

let cachedCategories = [];
let allProducts = [];

// Navigation
document.addEventListener("DOMContentLoaded", () => {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const section = item.getAttribute("data-section");
      if (!section) return;

      e.preventDefault();

      // Update active nav
      document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Update active section
      document.querySelectorAll(".content-section").forEach((sec) => sec.classList.remove("active"));
      document.getElementById(section).classList.add("active");

      // Update page title
      const titles = {
        dashboard: "Dashboard",
        categories: "Categories Management",
        products: "Products Management",
        stock: "Stock Management",
        payments: "Payment Methods"
      };
      document.getElementById("pageTitle").textContent = titles[section] || "Dashboard";

      // Load payments when entering payments section
      if (section === "payments") {
        loadPayments();
      }
    });
  });

  initDashboard();
});

async function initDashboard() {
  await loadCategories();
  await loadProducts();
  await loadDashboardStats();
}

// Dashboard Stats
async function loadDashboardStats() {
  const products = allProducts;
  const categories = cachedCategories;

  const totalProducts = products.length;
  const totalCategories = categories.length;
  const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);

  document.getElementById("totalProducts").textContent = totalProducts;
  document.getElementById("totalCategories").textContent = totalCategories;
  document.getElementById("totalStock").textContent = totalStock;

  // Load orders count
  try {
    const ordersRes = await fetch("/api/orders", { headers });
    if (ordersRes.ok) {
      const orders = await ordersRes.json();
      document.getElementById("totalOrders").textContent = orders.length;
    }
  } catch (e) {
    document.getElementById("totalOrders").textContent = "0";
  }

  // Low stock alert
  const lowStock = products.filter((p) => p.quantity < 10);
  const lowStockList = document.getElementById("lowStockList");

  if (lowStock.length === 0) {
    lowStockList.innerHTML = '<p class="no-data">All products have sufficient stock</p>';
  } else {
    lowStockList.innerHTML = lowStock
      .map(
        (p) => `
      <div class="low-stock-item">
        <div>
          <strong>${p.name}</strong>
          <span class="stock-badge">${p.quantity} units</span>
        </div>
      </div>
    `
      )
      .join("");
  }
}

// Categories
async function loadCategories() {
  const res = await fetch(`${API}/categories`, { headers });
  cachedCategories = await res.json();

  updateCategoryTable();
  updateCategoryDropdowns();
}

function updateCategoryTable() {
  const tbody = document.getElementById("categoryTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  cachedCategories.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td class="action-buttons">
        <button class="btn btn-sm btn-info" onclick="viewCategory(${c.id})">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn btn-sm btn-warning" onclick="openEditCategoryModal(${c.id}, '${escapeQuotes(c.name)}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">
          <i class="fas fa-trash"></i> Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateCategoryDropdowns() {
  const dropdowns = ["productCategory", "editProductCategory", "categoryFilter"];

  const options = cachedCategories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  dropdowns.forEach((id) => {
    const select = document.getElementById(id);
    if (select) {
      if (id === "categoryFilter") {
        select.innerHTML = '<option value="">All Categories</option>' + options;
      } else {
        select.innerHTML = '<option value="">Select Category</option>' + options;
      }
    }
  });
}

function openAddCategoryModal() {
  document.getElementById("categoryName").value = "";
  openModal("addCategoryModal");
}

function openEditCategoryModal(id, name) {
  document.getElementById("editCategoryId").value = id;
  document.getElementById("editCategoryName").value = name;
  openModal("editCategoryModal");
}

async function addCategory() {
  const name = document.getElementById("categoryName").value.trim();
  if (!name) return alert("Please enter a category name");

  const res = await fetch(`${API}/categories`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  closeModal("addCategoryModal");
  await loadCategories();
  await loadProducts();
  await loadDashboardStats();
}

async function updateCategory() {
  const id = document.getElementById("editCategoryId").value;
  const name = document.getElementById("editCategoryName").value.trim();
  if (!name) return alert("Please enter a category name");

  const res = await fetch(`${API}/categories/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ name }),
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  closeModal("editCategoryModal");
  await loadCategories();
  await loadProducts();
}

async function deleteCategory(id) {
  if (!confirm("Delete this category? (Must have NO products inside)")) return;

  const res = await fetch(`${API}/categories/${id}`, {
    method: "DELETE",
    headers,
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  await loadCategories();
  await loadProducts();
  await loadDashboardStats();
}

async function viewCategory(categoryId) {
  const category = cachedCategories.find((c) => c.id === categoryId);
  const categoryProducts = allProducts.filter((p) => p.categoryId === categoryId);

  const modal = document.getElementById("categoryProductsList");

  if (categoryProducts.length === 0) {
    modal.innerHTML = '<p class="no-data">No products in this category</p>';
  } else {
    modal.innerHTML = `
      <h3>${category.name} Products</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Product Name</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${categoryProducts
            .map(
              (p) => `
            <tr>
              <td>${p.id}</td>
              <td>${p.name}</td>
              <td>${p.quantity}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  openModal("viewCategoryModal");
}

// Products
async function loadProducts() {
  const res = await fetch(API, { headers });
  allProducts = await res.json();

  updateProductTable();
  updateStockTable();
}

function updateProductTable() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  const filter = document.getElementById("categoryFilter")?.value;
  const products = filter
    ? allProducts.filter((p) => p.categoryId == filter)
    : allProducts;

  tbody.innerHTML = "";

  const catMap = new Map(cachedCategories.map((c) => [c.id, c.name]));

  products.forEach((p) => {
    const tr = document.createElement("tr");
    const catName = catMap.get(p.categoryId) || "Unknown";

    const priceInfo = calculateFinalPrice(p);

    tr.innerHTML = `
  <td>${p.id}</td>

  <td>
    ${
      p.imageUrl
        ? `<img src="${p.imageUrl}" class="table-product-img" />`
        : `<i class="fas fa-image muted-icon"></i>`
    }
  </td>

  <td><strong>${p.name}</strong></td>

<td>
  ${
    priceInfo.hasDiscount
      ? `
        <span class="old-price">$${p.price}</span>
        <span class="final-price">$${priceInfo.finalPrice.toFixed(2)}</span>
        <div class="discount-timer">⏳ ${getDiscountCountdown(p.discount.endAt)}</div>
      `
      : `$${p.price}`
  }
</td>

  <td>${p.quantity}</td>

  <td><span class="category-badge">${catName}</span></td>

  <td class="action-buttons">
    <button class="btn btn-sm btn-info" onclick="viewProduct(${p.id})">
      <i class="fas fa-eye"></i>
    </button>

    <button class="btn btn-sm btn-warning" onclick="openEditProductModal(
      ${p.id},
      '${escapeQuotes(p.name)}',
      ${p.quantity},
      ${p.categoryId},
      ${p.price ?? 0},
      '${escapeQuotes(p.description ?? "")}',
      '${escapeQuotes(p.imageUrl ?? "")}'
    )">
      <i class="fas fa-edit"></i>
    </button>

    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">
      <i class="fas fa-trash"></i>
    </button>

    <button class="btn btn-sm btn-success" onclick="openDiscountModal(${p.id})">
      <i class="fas fa-percent"></i>
    </button>
  </td>
`;

    tbody.appendChild(tr);
  });
}

function updateStockTable() {
  const tbody = document.getElementById("stockTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  allProducts.forEach((p) => {
    const tr = document.createElement("tr");
    let statusClass = "stock-good";
    let statusText = "Good";

    if (p.quantity < 5) {
      statusClass = "stock-critical";
      statusText = "Critical";
    } else if (p.quantity < 10) {
      statusClass = "stock-low";
      statusText = "Low";
    }

    tr.innerHTML = `
      <td>${p.id}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.quantity}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function filterProducts() {
  updateProductTable();
}

function openAddProductModal() {
  document.getElementById("productName").value = "";
  document.getElementById("productQuantity").value = "";
  document.getElementById("productCategory").value = "";
  document.getElementById("productPrice").value = "";
  document.getElementById("productDescription").value = "";
  document.getElementById("productImage").value = "";

  openModal("addProductModal");
}

function openEditProductModal(id, name, quantity, categoryId, price, description, imageUrl) {
  document.getElementById("editProductId").value = id;
  document.getElementById("editProductName").value = name;
  document.getElementById("editProductQuantity").value = quantity;
  document.getElementById("editProductCategory").value = categoryId;
  document.getElementById("editProductPrice").value = price ?? 0;
  document.getElementById("editProductDescription").value = description || "";
  document.getElementById("editProductImage").value = "";

  const preview = document.getElementById("editProductImagePreview");
  if (imageUrl) {
    preview.src = imageUrl;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  openModal("editProductModal");
}

async function addProduct() {
  const formData = new FormData();

  formData.append("name", document.getElementById("productName").value.trim());
  formData.append("quantity", document.getElementById("productQuantity").value);
  formData.append("price", document.getElementById("productPrice").value);
  formData.append("categoryId", document.getElementById("productCategory").value);
  formData.append("description", document.getElementById("productDescription").value.trim());

  const fileInput = document.getElementById("productImage");
  if (fileInput.files[0]) {
    formData.append("image", fileInput.files[0]);
  }

  const res = await fetch(`${API}/add-product`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  closeModal("addProductModal");
  await loadProducts();
  await loadDashboardStats();
}

async function updateProduct() {
  const id = document.getElementById("editProductId").value;
  const formData = new FormData();

  formData.append("name", document.getElementById("editProductName").value.trim());
  formData.append("quantity", document.getElementById("editProductQuantity").value);
  formData.append("price", document.getElementById("editProductPrice").value);
  formData.append("categoryId", document.getElementById("editProductCategory").value);
  formData.append("description", document.getElementById("editProductDescription").value.trim());

  const fileInput = document.getElementById("editProductImage");
  if (fileInput.files[0]) {
    formData.append("image", fileInput.files[0]);
  }

  const res = await fetch(`${API}/products/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  closeModal("editProductModal");
  await loadProducts();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  const res = await fetch(`${API}/products/${id}`, {
    method: "DELETE",
    headers,
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  await loadProducts();
  await loadDashboardStats();
}

function openDiscountModal(productId) {
  document.getElementById("discountProductId").value = productId;
  document.getElementById("discountType").value = "";
  document.getElementById("discountValue").value = "";
  document.getElementById("discountActive").checked = false;
  openModal("discountModal");
}

async function saveDiscount() {
  const id = document.getElementById("discountProductId").value;
  const type = document.getElementById("discountType").value;
  const value = Number(document.getElementById("discountValue").value);
  const active = document.getElementById("discountActive").checked;
  const endAt = document.getElementById("discountEndAt").value;

  const res = await fetch(`${API}/products/${id}/discount`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type, value, active, endAt }),
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  closeModal("discountModal");
  await loadProducts();
}

// Stock Management
async function addStock() {
  const id = Number(document.getElementById("addStockProductId").value);
  const quantity = Number(document.getElementById("addStockQty").value);

  if (!id || !quantity) return alert("Please fill all fields");

  const res = await fetch(`${API}/add-stock`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id, quantity }),
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  document.getElementById("addStockProductId").value = "";
  document.getElementById("addStockQty").value = "";

  await loadProducts();
  await loadDashboardStats();
}

async function reduceStock() {
  const id = Number(document.getElementById("reduceStockProductId").value);
  const quantity = Number(document.getElementById("reduceStockQty").value);

  if (!id || !quantity) return alert("Please fill all fields");

  const res = await fetch(`${API}/reduce-stock`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id, quantity }),
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message || "Failed");

  document.getElementById("reduceStockProductId").value = "";
  document.getElementById("reduceStockQty").value = "";

  await loadProducts();
  await loadDashboardStats();
}

// ===========================
// PAYMENT METHODS
// ===========================
async function loadPayments() {
  try {
    const res = await fetch("/api/settings/payment-methods", { headers });
    const data = await res.json();

    document.getElementById("codToggle").checked = data.COD?.enabled ?? false;
    document.getElementById("cardToggle").checked = data.CARD?.enabled ?? false;
    document.getElementById("bankToggle").checked = data.BANK_TRANSFER?.enabled ?? false;
    
    document.getElementById("easypaisaToggle").checked = data.EASYPAISA?.enabled ?? false;
    document.getElementById("easypaisaNumber").value = data.EASYPAISA?.accountNumber || "";
    
    document.getElementById("jazzcashToggle").checked = data.JAZZCASH?.enabled ?? false;
    document.getElementById("jazzcashNumber").value = data.JAZZCASH?.accountNumber || "";
  } catch (err) {
    console.error("Failed to load payments:", err);
  }
}

async function savePayments() {
  const paymentMethods = {
    COD: {
      enabled: document.getElementById("codToggle").checked,
      label: "Cash on Delivery"
    },
    CARD: {
      enabled: document.getElementById("cardToggle").checked,
      label: "Credit / Debit Card"
    },
    BANK_TRANSFER: {
      enabled: document.getElementById("bankToggle").checked,
      label: "Bank Transfer"
    },
    EASYPAISA: {
      enabled: document.getElementById("easypaisaToggle").checked,
      label: "EasyPaisa",
      accountNumber: document.getElementById("easypaisaNumber").value.trim()
    },
    JAZZCASH: {
      enabled: document.getElementById("jazzcashToggle").checked,
      label: "JazzCash",
      accountNumber: document.getElementById("jazzcashNumber").value.trim()
    }
  };

  const res = await fetch("/api/settings/payment-methods", {
    method: "POST",
    headers,
    body: JSON.stringify({ paymentMethods })
  });

  if (!res.ok) {
    alert("Failed to save payment settings");
    return;
  }

  alert("✅ Payment methods updated successfully");
}

// Modal Functions
function openModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
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

function viewProduct(productId) {
  const p = allProducts.find((x) => x.id === productId);
  if (!p) return;

  const category = cachedCategories.find((c) => c.id === p.categoryId);
  const priceInfo = calculateFinalPrice(p);

  document.getElementById("viewProductImage").src = p.imageUrl || "https://via.placeholder.com/300";
  document.getElementById("viewProductName").textContent = p.name;
  document.getElementById("viewProductCategory").textContent = `Category: ${category ? category.name : "Unknown"}`;

  const countdown = priceInfo.hasDiscount ? getDiscountCountdown(p.discount.endAt) : "";
  document.getElementById("discountValidity").textContent = priceInfo.hasDiscount ? `⏳ Expires in: ${countdown}` : "";

  document.getElementById("viewProductPrice").innerHTML = priceInfo.hasDiscount
    ? `<span class="old-price">$${p.price}</span><span class="final-price">$${priceInfo.finalPrice.toFixed(2)}</span>`
    : `<span class="final-price">$${p.price}</span>`;

  const stockBadge = document.getElementById("stockBadge");
  if (p.quantity === 0) {
    stockBadge.className = "stock-pill stock-out";
    stockBadge.textContent = "Out of Stock";
  } else if (p.quantity < 10) {
    stockBadge.className = "stock-pill stock-low";
    stockBadge.textContent = "Low Stock";
  } else {
    stockBadge.className = "stock-pill stock-in";
    stockBadge.textContent = "In Stock";
  }

  document.getElementById("viewProductDescription").textContent = p.description || "No description";
  document.getElementById("viewProductCreated").textContent = `Created: ${new Date(p.createdAt).toLocaleString()}`;
  document.getElementById("viewProductUpdated").textContent = `Updated: ${new Date(p.updatedAt).toLocaleString()}`;

  openModal("viewProductModal");
}

function updateAdminDiscountPreview() {
  const type = document.getElementById("discountType").value;
  const value = Number(document.getElementById("discountValue").value);
  const productId = Number(document.getElementById("discountProductId").value);

  const product = allProducts.find((p) => p.id === productId);
  if (!product || !type || !value) return;

  let final = product.price;

  if (type === "PERCENT") {
    final = product.price - (product.price * value) / 100;
  }

  if (type === "FLAT") {
    final = product.price - value;
  }

  document.getElementById("adminPricePreview").innerHTML = `
    <span class="old-price">$${product.price}</span>
    <span class="final-price">$${final.toFixed(2)}</span>
  `;
}

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
  if (!endAt) return "";
  const diff = new Date(endAt) - new Date();
  if (diff <= 0) return "Expired";

  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);

  return `${h}h ${m}m ${s}s`;
}

window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
  }
};