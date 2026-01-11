const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "../data/store.json");

const readStore = () =>
  JSON.parse(fs.readFileSync(storePath, "utf-8"));

const writeStore = (data) =>
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));

/* =========================
   GET CART
========================= */
exports.getCart = (req, res) => {
  const data = readStore();
  const userId = req.user.id;

  if (!Array.isArray(data.carts)) {
    data.carts = [];
  }

  const cart = data.carts.find(c => c.userId === userId);
  res.json(cart || { userId, items: [] });
};

/* =========================
   ADD TO CART
========================= */
exports.addToCart = (req, res) => {
  const { productId, qty } = req.body;
  const userId = req.user.id;

  if (!productId || qty <= 0) {
    return res.status(400).json({ message: "Invalid data" });
  }

  const data = readStore();

  // ✅ critical safety
  if (!Array.isArray(data.carts)) {
    data.carts = [];
  }

  const product = data.products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  let cart = data.carts.find(c => c.userId === userId);

  if (!cart) {
    cart = {
      userId,
      items: [],
      updatedAt: new Date().toISOString()
    };
    data.carts.push(cart);
  }

  const item = cart.items.find(i => i.productId === productId);

  if (item) {
    item.qty += qty;
  } else {
    cart.items.push({ productId, qty });
  }

  cart.updatedAt = new Date().toISOString();
  writeStore(data);

  res.json({ message: "Added to cart", cart });
};

/* =========================
   UPDATE CART ITEM
========================= */
exports.updateCartItem = (req, res) => {
  const { productId, qty } = req.body;
  const userId = req.user.id;

  const data = readStore();

  if (!Array.isArray(data.carts)) {
    data.carts = [];
  }

  const cart = data.carts.find(c => c.userId === userId);
  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  const item = cart.items.find(i => i.productId === productId);
  if (!item) {
    return res.status(404).json({ message: "Item not in cart" });
  }

  if (qty <= 0) {
    cart.items = cart.items.filter(i => i.productId !== productId);
  } else {
    item.qty = qty;
  }

  cart.updatedAt = new Date().toISOString();
  writeStore(data);

  res.json({ message: "Cart updated", cart });
};

/* =========================
   CLEAR CART
========================= */
exports.clearCart = (req, res) => {
  const data = readStore();
  const userId = req.user.id;

  if (!Array.isArray(data.carts)) {
    data.carts = [];
  }

  data.carts = data.carts.filter(c => c.userId !== userId);
  writeStore(data);

  res.json({ message: "Cart cleared" });
};
