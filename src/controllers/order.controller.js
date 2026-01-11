const fs = require("fs");
const path = require("path");

const ordersPath = path.join(__dirname, "../data/orders.json");
const storePath = path.join(__dirname, "../data/store.json");

/* =======================
   HELPERS
======================= */
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

const writeJSON = (p, d) =>
  fs.writeFileSync(p, JSON.stringify(d, null, 2));

const readOrders = () => {
  const data = readJSON(ordersPath);
  return Array.isArray(data.orders) ? data.orders : [];
};

const writeOrders = (orders) => {
  writeJSON(ordersPath, { orders });
};

/* =======================
   CREATE ORDER
======================= */
exports.createOrder = (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length)
      return res.status(400).json({ message: "No items" });

    const store = readJSON(storePath);
    const orders = readOrders();

    // validate stock
    for (const item of items) {
      const product = store.products.find(p => p.id === item.productId);
      if (!product)
        return res.status(404).json({ message: "Product not found" });

      if (product.quantity < item.qty)
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}`
        });
    }

    // reduce stock
    items.forEach(item => {
      const product = store.products.find(p => p.id === item.productId);
      product.quantity -= item.qty;
    });

    const order = {
      id: Date.now(),
      buyerId: req.user.id,
      items,
      status: "CONFIRMED",
      payment: {
        method: "COD",
        status: "UNPAID"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.push(order);

    writeJSON(storePath, store);
    writeOrders(orders);

    res.json({ message: "Order placed", order });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =======================
   ADMIN: GET ALL ORDERS
======================= */
exports.getAllOrders = (req, res) => {
  try {
    res.json(readOrders());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load orders" });
  }
};

/* =======================
   BUYER: GET OWN ORDERS
======================= */
exports.getBuyerOrders = (req, res) => {
  try {
    const buyerId = Number(req.user.id);
    const orders = readOrders().filter(
      o => Number(o.buyerId) === buyerId
    );
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load buyer orders" });
  }
};

/* =======================
   UPDATE ORDER STATUS
======================= */
exports.updateOrderStatus = (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const allowed = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "REJECTED"];
    if (!allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const orders = readOrders();
    const order = orders.find(o => o.id === orderId);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    order.status = status;
    order.updatedAt = new Date().toISOString();

    writeOrders(orders);

    res.json({ message: "Status updated", order });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =======================
   CANCEL ORDER
======================= */
exports.cancelOrder = (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const store = readJSON(storePath);
    const orders = readOrders();

    const order = orders.find(o => o.id === orderId);
    if (!order)
      return res.status(404).json({ message: "Order not found" });

    if (order.status !== "CONFIRMED")
      return res.status(400).json({ message: "Cannot cancel now" });

    // restore stock
    order.items.forEach(item => {
      const product = store.products.find(p => p.id === item.productId);
      if (product) product.quantity += item.qty;
    });

    order.status = "CANCELLED";
    order.updatedAt = new Date().toISOString();

    writeJSON(storePath, store);
    writeOrders(orders);

    res.json({ message: "Order cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =======================
   MARK PAID (ADMIN)
======================= */
exports.markPaid = (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const buyerId = req.user.id;

    const data = readOrders();
    const orders = Array.isArray(data) ? data : data.orders;

    const order = orders.find(o => o.id === orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 🔐 buyer can mark only own order
    if (Number(order.buyerId) !== Number(buyerId)) {
      return res.status(403).json({ message: "Not your order" });
    }

    if (order.payment.method !== "COD") {
      return res.status(400).json({
        message: "Online payments are auto-paid"
      });
    }

    if (order.payment.status === "PAID") {
      return res.status(400).json({
        message: "Order already marked as PAID"
      });
    }

    order.payment.status = "PAID";
    order.updatedAt = new Date().toISOString();

    writeOrders(orders);

    res.json({
      message: "Payment marked as PAID",
      order
    });
  } catch (err) {
    console.error("Mark paid error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

