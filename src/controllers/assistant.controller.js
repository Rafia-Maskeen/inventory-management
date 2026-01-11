// src/controllers/assistant.controller.js
const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const storePath = path.join(__dirname, "../data/store.json");
const ordersPath = path.join(__dirname, "../data/orders.json");

/* =========================
   FILE HELPERS
========================= */
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

/* =========================
   NORMALIZE + SAFE JSON
========================= */
const normalize = (v) => String(v || "").toLowerCase().trim();

const safeJSON = (txt) => {
  try {
    const cleaned = String(txt || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

/* =========================
   FRIENDLY RESPONSE
========================= */
const ok = (res, message, data = null) =>
  res.json({ success: true, message, data });

const fail = (res, message, extra = null, code = 400) =>
  res.status(code).json({ success: false, message, ...(extra ? { data: extra } : {}) });

/* =========================
   SMALL TALK
========================= */
const detectSmallTalk = (msg) => {
  const t = normalize(msg);
  const hello = ["hi", "hello", "hey", "hy", "assalam", "asalam"];
  if (hello.some((w) => t === w || t.startsWith(w + " "))) return "HELLO";
  if (t.includes("how are you") || t.includes("how r u") || t.includes("how are u")) return "HOW";
  if (t.includes("who are you") || t.includes("what are you")) return "WHO";
  if (t.includes("help") || t.includes("what can you do") || t.includes("commands")) return "HELP";
  return null;
};

/* =========================
   DATA SHAPE SAFETY
========================= */
function ensureStoreSchema(store) {
  if (!store || typeof store !== "object") store = {};
  if (!Array.isArray(store.categories)) store.categories = [];
  if (!Array.isArray(store.products)) store.products = [];
  if (!Array.isArray(store.carts)) store.carts = [];
  if (!store.settings || typeof store.settings !== "object") store.settings = {};
  if (!store.settings.paymentMethods || typeof store.settings.paymentMethods !== "object") {
    store.settings.paymentMethods = {
      COD: { enabled: true, label: "Cash on Delivery" },
    };
  }

  // Backward compatibility for products
  store.products = store.products.map((p) => ({
    id: p.id,
    name: p.name || "",
    description: p.description || "",
    price: p.price ?? 0,
    quantity: p.quantity ?? 0,
    imageUrl: p.imageUrl || "",
    categoryId: p.categoryId,
    discount: p.discount || {
      type: null, // PERCENT | FLAT
      value: 0,
      active: false,
      startAt: null,
      endAt: null,
    },
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  }));

  // Backward compatibility for carts
  store.carts = store.carts.map((c) => ({
    userId: c.userId,
    items: Array.isArray(c.items) ? c.items : [],
    updatedAt: c.updatedAt || new Date().toISOString(),
  }));

  return store;
}

function ensureOrdersSchema(ordersData) {
  if (!ordersData || typeof ordersData !== "object") return { orders: [] };
  if (Array.isArray(ordersData)) return { orders: ordersData };
  if (!Array.isArray(ordersData.orders)) ordersData.orders = [];
  return ordersData;
}

/* =========================
   RESOLUTION HELPERS
========================= */
function findCategory(store, categoryName) {
  const q = normalize(categoryName);
  if (!q) return null;

  // exact match first
  let cat = store.categories.find((c) => normalize(c.name) === q);
  if (cat) return cat;

  // contains match
  cat = store.categories.find((c) => normalize(c.name).includes(q) || q.includes(normalize(c.name)));
  return cat || null;
}

function findProduct(store, productName) {
  const q = normalize(productName);
  if (!q) return null;

  // exact match first
  let p = store.products.find((x) => normalize(x.name) === q);
  if (p) return p;

  // contains match
  p = store.products.find((x) => normalize(x.name).includes(q) || q.includes(normalize(x.name)));
  return p || null;
}

function calcFinalPrice(product) {
  const base = Number(product.price || 0);

  if (!product.discount?.active) {
    return { hasDiscount: false, finalPrice: base };
  }

  // expire check (if endAt set)
  if (product.discount.endAt) {
    const end = new Date(product.discount.endAt);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return { hasDiscount: false, finalPrice: base };
    }
  }

  let final = base;

  if (product.discount.type === "PERCENT") {
    final = base - (base * Number(product.discount.value || 0)) / 100;
  } else if (product.discount.type === "FLAT") {
    final = base - Number(product.discount.value || 0);
  }

  if (final < 0) final = 0;
  return { hasDiscount: true, finalPrice: final };
}

function summarizeCart(store, cart) {
  if (!cart.items.length) return { lines: [], subtotal: 0, discountTotal: 0, total: 0 };

  let subtotal = 0;
  let discountTotal = 0;

  const lines = cart.items.map((it) => {
    const p = store.products.find((x) => x.id === it.productId);
    if (!p) return `• Unknown product × ${it.qty}`;

    const base = Number(p.price || 0);
    const { finalPrice } = calcFinalPrice(p);

    subtotal += base * it.qty;
    discountTotal += (base - finalPrice) * it.qty;

    return `• ${p.name} × ${it.qty}`;
  });

  return {
    lines,
    subtotal,
    discountTotal,
    total: subtotal - discountTotal,
  };
}

function latestBuyerOrder(orders, buyerId) {
  const my = orders.filter((o) => Number(o.buyerId) === Number(buyerId));
  my.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return my[0] || null;
}

/* =========================
   MAIN ASSISTANT
========================= */
exports.runAssistantCommand = async (req, res) => {
  try {
    const { message } = req.body;
    const { role, id: userId } = req.user;

    if (!message) return fail(res, "Message is required");

    // small talk
    const talk = detectSmallTalk(message);
    if (talk) {
      if (talk === "HELLO") {
        return ok(res, "👋 Hey! I’m your friendly AI assistant. Tell me what you want to do (products, cart, orders, stock).");
      }
      if (talk === "HOW") {
        return ok(res, "😊 I’m doing great! Ready to help. What would you like to do today?");
      }
      if (talk === "WHO") {
        return ok(res, "🤖 I’m your Inventory & Shopping Assistant. Admins can manage categories/products/stock/orders. Buyers can browse, cart, checkout, and track orders.");
      }
      if (talk === "HELP") {
        return ok(
          res,
          role === "admin"
            ? "🛠️ Try: “add categories electronics, shoes”, “add 10 stock to laptop”, “show orders paid”, “list discounted products”, “products in clothing”."
            : "🛒 Try: “show products”, “products in electronics”, “add 2 laptops to cart”, “show my cart”, “checkout with COD”, “where is my order”, “payment status”."
        );
      }
    }

    /* =========================
       LOAD DATA
    ========================= */
    let store = ensureStoreSchema(readJson(storePath));
    let ordersData = ensureOrdersSchema(readJson(ordersPath));
    const orders = ordersData.orders;

    /* =========================
       AI INTENT EXTRACTION
    ========================= */
    const systemPrompt = `
You are a very friendly inventory & shopping assistant.

Return ONLY valid JSON (no markdown).
Format:
{
  "intent": "INTENT_NAME",
  "entities": {}
}

ADMIN INTENTS:
- ADD_CATEGORIES                    { "names": string[] }
- ADD_PRODUCTS                      { "products": [ { "name": string, "qty": number, "category": string } ] }
- LIST_CATEGORIES                   { }
- LIST_PRODUCTS                      { "category"?: string }
- LIST_CATEGORY_PRODUCTS             { "category": string }
- CHECK_STOCK                        { "product": string }
- ADD_STOCK                          { "product": string, "qty": number }
- REMOVE_STOCK                       { "product": string, "qty": number }
- LIST_DISCOUNTED_PRODUCTS           { }
- LIST_ORDERS                        { }
- LIST_ORDERS_BY_STATUS              { "status": string }
- LIST_ORDERS_BY_PAYMENT             { "payment": string }   // PAID | UNPAID | PENDING
- LIST_ORDERS_BY_STATUS_AND_PAYMENT  { "status": string, "payment": string }

BUYER INTENTS:
- LIST_CATEGORIES                    { }
- LIST_PRODUCTS                      { }
- LIST_CATEGORY_PRODUCTS             { "category": string }
- LIST_DISCOUNTED_PRODUCTS           { }
- ADD_TO_CART                        { "product": string, "qty"?: number }
- REMOVE_FROM_CART                   { "product": string }
- VIEW_CART                          { }
- CHECKOUT                           { "paymentMethod"?: string }
- PLACE_ORDER_DIRECT                 { "product": string, "qty"?: number, "paymentMethod"?: string }
- ORDER_STATUS                       { "orderId"?: number }
- PAYMENT_STATUS                     { "orderId"?: number }
- MY_ORDERS                          { }
- MY_ORDERS_BY_STATUS                { "status": string }
- MY_ORDERS_BY_PAYMENT               { "payment": string }
- MY_ORDERS_BY_STATUS_AND_PAYMENT    { "status": string, "payment": string }

Rules:
- Default qty = 1 if missing.
- Use category/product names from user text (no IDs unless user explicitly gives ID).
- Keep it simple: one best intent per message.
- User role: ${role}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: message },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const cmd = safeJSON(raw);

    if (!cmd || !cmd.intent) {
      return fail(res, "❌ I couldn't understand that. Please try again.", { raw }, 400);
    }

    const intent = String(cmd.intent || "").trim();
    const e = cmd.entities || {};

    /* =========================
       COMMON LIST HELPERS
    ========================= */
    const listCategoryNames = () => store.categories.map((c) => c.name);

    const listProductsNames = (products) => products.map((p) => p.name);

    const listDiscountedProducts = () => {
      const discounted = store.products.filter((p) => p.discount?.active);
      return discounted.map((p) => {
        const { finalPrice, hasDiscount } = calcFinalPrice(p);
        if (!hasDiscount) return null;
        const badge =
          p.discount.type === "PERCENT"
            ? `-${p.discount.value}%`
            : `-$${p.discount.value}`;
        return `${p.name} (${badge}) → $${finalPrice.toFixed(2)}`;
      }).filter(Boolean);
    };

    const filterOrders = (list, status, payment) => {
      let out = list;
      if (status) out = out.filter((o) => normalize(o.status) === normalize(status));
      if (payment) out = out.filter((o) => normalize(o.payment?.status) === normalize(payment));
      return out;
    };

    const ordersSummary = (list) =>
      list.map((o) => ({
        id: o.id,
        status: o.status,
        payment: o.payment?.status,
        method: o.payment?.method,
      }));

    /* =========================
       ADMIN HANDLERS
    ========================= */
    if (role === "admin") {
      // Add categories
      if (intent === "ADD_CATEGORIES") {
        const names = Array.isArray(e.names) ? e.names : [];
        if (!names.length) return fail(res, "Please provide category names.");

        const added = [];
        names.forEach((name) => {
          const exists = store.categories.find((c) => normalize(c.name) === normalize(name));
          if (!exists) {
            store.categories.push({ id: Date.now() + Math.random(), name: String(name).trim() });
            added.push(String(name).trim());
          }
        });

        writeJson(storePath, store);

        const msg = added.length
          ? `✅ Done! I added these categories:\n${added.map((n) => `• ${n}`).join("\n")}`
          : "ℹ️ All those categories already existed.";

        return ok(res, msg, listCategoryNames());
      }

      // List categories
      if (intent === "LIST_CATEGORIES") {
        return ok(res, "📂 Here are all categories:", listCategoryNames());
      }

      // Add products (multi)
      if (intent === "ADD_PRODUCTS") {
        const products = Array.isArray(e.products) ? e.products : [];
        if (!products.length) return fail(res, "Please provide products to add.");

        const created = [];
        const skipped = [];

        for (const p of products) {
          const name = String(p.name || "").trim();
          const qty = Number(p.qty ?? 1);
          const catName = String(p.category || "").trim();

          if (!name || !catName || Number.isNaN(qty) || qty <= 0) {
            skipped.push({ name, qty, category: catName });
            continue;
          }

          const cat = findCategory(store, catName);
          if (!cat) {
            skipped.push({ name, qty, category: catName, reason: "Category not found" });
            continue;
          }

          store.products.push({
            id: Date.now() + Math.random(),
            name,
            description: "",
            price: 0,
            quantity: qty,
            imageUrl: "",
            categoryId: cat.id,
            discount: { type: null, value: 0, active: false, startAt: null, endAt: null },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          created.push(`${name} × ${qty} → ${cat.name}`);
        }

        writeJson(storePath, store);

        const msg =
          created.length
            ? `✅ Products added successfully:\n${created.map((x) => `• ${x}`).join("\n")}`
            : "❌ I couldn't add any product. Please check names/categories.";

        return ok(res, msg, { added: created, skipped });
      }

      // List products (all)
      if (intent === "LIST_PRODUCTS") {
        return ok(res, "📦 Here are all products:", listProductsNames(store.products));
      }

      // List products by category
      if (intent === "LIST_CATEGORY_PRODUCTS") {
        const catName = String(e.category || "").trim();
        if (!catName) return fail(res, "Please provide a category name.");

        const cat = findCategory(store, catName);
        if (!cat) return ok(res, `❌ I couldn't find category: ${catName}`);

        const list = store.products.filter((p) => p.categoryId === cat.id);
        return ok(res, `📦 Products in ${cat.name}:`, listProductsNames(list));
      }

      // Check stock
      if (intent === "CHECK_STOCK") {
        const prodName = String(e.product || "").trim();
        if (!prodName) return fail(res, "Please tell me which product you want to check.");

        const p = findProduct(store, prodName);
        if (!p) return ok(res, `❌ I couldn't find a product matching: ${prodName}`);

        return ok(res, `📊 Stock for **${p.name}**: ${p.quantity} unit(s).`);
      }

      // Add stock / Remove stock
      if (intent === "ADD_STOCK" || intent === "REMOVE_STOCK") {
        const prodName = String(e.product || "").trim();
        const qty = Number(e.qty ?? 1);

        if (!prodName || Number.isNaN(qty) || qty <= 0) {
          return fail(res, "Please provide product name and a valid quantity.");
        }

        const p = findProduct(store, prodName);
        if (!p) return ok(res, `❌ I couldn't find a product matching: ${prodName}`);

        if (intent === "REMOVE_STOCK" && p.quantity < qty) {
          return ok(res, `❌ Not enough stock. ${p.name} has only ${p.quantity}.`);
        }

        p.quantity += intent === "ADD_STOCK" ? qty : -qty;
        p.updatedAt = new Date().toISOString();
        writeJson(storePath, store);

        return ok(res, `✅ Done! ${p.name} now has ${p.quantity} unit(s) in stock.`);
      }

      // Discounted products
      if (intent === "LIST_DISCOUNTED_PRODUCTS") {
        const lines = listDiscountedProducts();
        if (!lines.length) return ok(res, "ℹ️ There are no active discounted products right now.");
        return ok(res, "🔥 Discounted products:", lines);
      }

      // Orders filters
      if (
        intent === "LIST_ORDERS" ||
        intent === "LIST_ORDERS_BY_STATUS" ||
        intent === "LIST_ORDERS_BY_PAYMENT" ||
        intent === "LIST_ORDERS_BY_STATUS_AND_PAYMENT"
      ) {
        const status = e.status ? String(e.status).toUpperCase() : null;
        const payment = e.payment ? String(e.payment).toUpperCase() : null;

        const filtered = filterOrders(orders, status, payment);

        const msgParts = ["📑 Orders"];
        if (status) msgParts.push(`status=${status}`);
        if (payment) msgParts.push(`payment=${payment}`);

        return ok(res, `${msgParts.join(" ")}:`, ordersSummary(filtered));
      }

      return fail(res, "❌ I understood you, but this admin command is not supported yet.", { intent, entities: e }, 400);
    }

    /* =========================
       BUYER HANDLERS
    ========================= */
    if (role === "buyer") {
      // Ensure cart exists
      let cart = store.carts.find((c) => Number(c.userId) === Number(userId));
      if (!cart) {
        cart = { userId, items: [], updatedAt: new Date().toISOString() };
        store.carts.push(cart);
        writeJson(storePath, store);
      }

      // List categories
      if (intent === "LIST_CATEGORIES") {
        return ok(res, "📂 Here are all categories:", listCategoryNames());
      }

      // List all products
      if (intent === "LIST_PRODUCTS") {
        return ok(res, "🛍️ Here are all products:", listProductsNames(store.products));
      }

      // List products by category
      if (intent === "LIST_CATEGORY_PRODUCTS") {
        const catName = String(e.category || "").trim();
        if (!catName) return fail(res, "Please provide a category name.");

        const cat = findCategory(store, catName);
        if (!cat) return ok(res, `❌ I couldn't find category: ${catName}`);

        const list = store.products.filter((p) => p.categoryId === cat.id);
        return ok(res, `🛍️ Products in ${cat.name}:`, listProductsNames(list));
      }

      // Discounted products
      if (intent === "LIST_DISCOUNTED_PRODUCTS") {
        const lines = listDiscountedProducts();
        if (!lines.length) return ok(res, "ℹ️ No discounted products right now.");
        return ok(res, "🔥 Discounted products:", lines);
      }

      // Add to cart by name
      if (intent === "ADD_TO_CART") {
        const prodName = String(e.product || "").trim();
        const qty = Number(e.qty ?? 1);

        if (!prodName || Number.isNaN(qty) || qty <= 0) {
          return fail(res, "Please tell me the product name and quantity (e.g., add 2 laptops to cart).");
        }

        const p = findProduct(store, prodName);
        if (!p) return ok(res, `❌ I couldn't find a product matching: ${prodName}`);

        if (p.quantity < qty) return ok(res, `❌ Not enough stock. ${p.name} has only ${p.quantity}.`);

        const existing = cart.items.find((i) => i.productId === p.id);
        if (existing) existing.qty += qty;
        else cart.items.push({ productId: p.id, qty });

        cart.updatedAt = new Date().toISOString();
        writeJson(storePath, store);

        return ok(res, `🛒 Added to cart: ${p.name} × ${qty}`);
      }

      // Remove from cart by name
      if (intent === "REMOVE_FROM_CART") {
        const prodName = String(e.product || "").trim();
        if (!prodName) return fail(res, "Please tell me which product to remove from cart.");

        const before = cart.items.length;

        cart.items = cart.items.filter((i) => {
          const p = store.products.find((x) => x.id === i.productId);
          if (!p) return true;
          return !normalize(p.name).includes(normalize(prodName));
        });

        cart.updatedAt = new Date().toISOString();
        writeJson(storePath, store);

        const removed = before - cart.items.length;
        return ok(res, removed ? `🗑️ Removed ${removed} item(s) from your cart.` : "ℹ️ That item wasn’t in your cart.");
      }

      // View cart
      if (intent === "VIEW_CART") {
        const { lines, subtotal, discountTotal, total } = summarizeCart(store, cart);

        if (!cart.items.length) return ok(res, "🛒 Your cart is empty.");

        const summary = [
          ...lines,
          "",
          `Subtotal: $${subtotal.toFixed(2)}`,
          `Discount: -$${discountTotal.toFixed(2)}`,
          `Total: $${total.toFixed(2)}`
        ];

        return ok(res, "🛒 Here’s your cart:", summary);
      }

      // Checkout (cart)
      if (intent === "CHECKOUT") {
        if (!cart.items.length) return ok(res, "❌ Your cart is empty. Add something first 🙂");

        const pm = String(e.paymentMethod || "COD").toUpperCase();
        const pmConfig = store.settings?.paymentMethods?.[pm];

        if (!pmConfig || !pmConfig.enabled) {
          return ok(res, `❌ Payment method "${pm}" is not available right now.`);
        }

        // Validate stock for all cart items
        for (const it of cart.items) {
          const p = store.products.find((x) => x.id === it.productId);
          if (!p) return ok(res, "❌ One of the cart items no longer exists.");
          if (p.quantity < it.qty) return ok(res, `❌ Not enough stock for ${p.name}. Available: ${p.quantity}`);
        }

        // Deduct stock + build priced items
        let subtotal = 0;
        let discountTotal = 0;

        const orderItems = cart.items.map((it) => {
          const p = store.products.find((x) => x.id === it.productId);
          const base = Number(p.price || 0);
          const { finalPrice } = calcFinalPrice(p);

          subtotal += base * it.qty;
          discountTotal += (base - finalPrice) * it.qty;

          // reduce stock
          p.quantity -= it.qty;

          return {
            productId: p.id,
            name: p.name,
            price: base,
            finalPrice,
            qty: it.qty
          };
        });

        const order = {
          id: Date.now(),
          buyerId: userId,
          items: orderItems,
          subtotal,
          discountTotal,
          grandTotal: subtotal - discountTotal,
          payment: { method: pm, status: pm === "COD" ? "UNPAID" : "PENDING" },
          address: { note: "AI checkout (address not provided via chat)" },
          status: "CONFIRMED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        orders.push(order);

        // clear cart
        store.carts = store.carts.filter((c) => Number(c.userId) !== Number(userId));

        writeJson(storePath, store);
        ordersData.orders = orders;
        writeJson(ordersPath, ordersData);

        return ok(res, `✅ Order placed successfully! 🎉\nOrder ID: ${order.id}`);
      }

      // Direct buy (single product)
      if (intent === "PLACE_ORDER_DIRECT") {
        const prodName = String(e.product || "").trim();
        const qty = Number(e.qty ?? 1);
        const pm = String(e.paymentMethod || "COD").toUpperCase();

        if (!prodName || Number.isNaN(qty) || qty <= 0) {
          return fail(res, "Please tell me the product and quantity (e.g., buy 1 laptop).");
        }

        const pmConfig = store.settings?.paymentMethods?.[pm];
        if (!pmConfig || !pmConfig.enabled) {
          return ok(res, `❌ Payment method "${pm}" is not available right now.`);
        }

        const p = findProduct(store, prodName);
        if (!p) return ok(res, `❌ I couldn't find a product matching: ${prodName}`);
        if (p.quantity < qty) return ok(res, `❌ Not enough stock for ${p.name}. Available: ${p.quantity}`);

        const base = Number(p.price || 0);
        const { finalPrice } = calcFinalPrice(p);

        const subtotal = base * qty;
        const discountTotal = (base - finalPrice) * qty;

        // reduce stock
        p.quantity -= qty;

        const order = {
          id: Date.now(),
          buyerId: userId,
          items: [{ productId: p.id, name: p.name, price: base, finalPrice, qty }],
          subtotal,
          discountTotal,
          grandTotal: subtotal - discountTotal,
          payment: { method: pm, status: pm === "COD" ? "UNPAID" : "PENDING" },
          address: { note: "AI direct order (address not provided via chat)" },
          status: "CONFIRMED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        orders.push(order);
        ordersData.orders = orders;

        writeJson(storePath, store);
        writeJson(ordersPath, ordersData);

        return ok(res, `✅ Direct order placed! 🎉\nOrder ID: ${order.id}`);
      }

      // My orders (all)
      if (intent === "MY_ORDERS") {
        const my = orders.filter((o) => Number(o.buyerId) === Number(userId));
        if (!my.length) return ok(res, "ℹ️ You don’t have any orders yet.");
        return ok(res, "📦 Your orders:", ordersSummary(my));
      }

      // My orders filters
      if (
        intent === "MY_ORDERS_BY_STATUS" ||
        intent === "MY_ORDERS_BY_PAYMENT" ||
        intent === "MY_ORDERS_BY_STATUS_AND_PAYMENT"
      ) {
        const my = orders.filter((o) => Number(o.buyerId) === Number(userId));
        const status = e.status ? String(e.status).toUpperCase() : null;
        const payment = e.payment ? String(e.payment).toUpperCase() : null;

        const filtered = filterOrders(my, status, payment);
        if (!filtered.length) return ok(res, "ℹ️ No matching orders found.");
        return ok(res, "📦 Matching orders:", ordersSummary(filtered));
      }

      // Order status (latest or specific)
      if (intent === "ORDER_STATUS") {
        const orderId = e.orderId ? Number(e.orderId) : null;

        let o = null;
        if (orderId) o = orders.find((x) => Number(x.id) === orderId && Number(x.buyerId) === Number(userId));
        else o = latestBuyerOrder(orders, userId);

        if (!o) return ok(res, "ℹ️ I couldn’t find your order.");
        return ok(res, `📦 Order #${o.id} is currently **${o.status}**.`);
      }

      // Payment status (latest or specific)
      if (intent === "PAYMENT_STATUS") {
        const orderId = e.orderId ? Number(e.orderId) : null;

        let o = null;
        if (orderId) o = orders.find((x) => Number(x.id) === orderId && Number(x.buyerId) === Number(userId));
        else o = latestBuyerOrder(orders, userId);

        if (!o) return ok(res, "ℹ️ I couldn’t find your order.");
        return ok(res, `💳 Payment for Order #${o.id}: ${o.payment?.method} — **${o.payment?.status}**`);
      }

      return fail(res, "❌ I understood you, but this buyer command is not supported yet.", { intent, entities: e }, 400);
    }

    return fail(res, "Unsupported role.", null, 403);
  } catch (err) {
    console.error("Assistant error:", err);
    return res.status(500).json({
      success: false,
      message: "Assistant error",
      error: err.message,
    });
  }
};
