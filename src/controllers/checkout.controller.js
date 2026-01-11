const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "../data/store.json");
const ordersPath = path.join(__dirname, "../data/orders.json");

const read = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const write = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

const calculateFinalPrice = (product) => {
  if (
    product.discount?.active &&
    (!product.discount.endAt || new Date(product.discount.endAt) > new Date())
  ) {
    if (product.discount.type === "PERCENT") {
      return product.price - (product.price * product.discount.value) / 100;
    }
    if (product.discount.type === "FLAT") {
      return product.price - product.discount.value;
    }
  }
  return product.price;
};

exports.checkout = (req, res) => {
  try {
    const userId = req.user.id;
    const { items, address, paymentMethod } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (!address || !paymentMethod) {
      return res.status(400).json({ message: "Missing checkout data" });
    }

    const store = read(storePath);
    const ordersData = read(ordersPath);

    const methodConfig = store.settings?.paymentMethods?.[paymentMethod];
    if (!methodConfig || !methodConfig.enabled) {
      return res.status(400).json({
        message: "Selected payment method is not available",
      });
    }

    // 🔒 HARD SAFETY
    if (!Array.isArray(ordersData.orders)) {
      ordersData.orders = [];
    }

    let subtotal = 0;
    let discountTotal = 0;
    const orderItems = [];

    for (const i of items) {
      const product = store.products.find((p) => p.id === i.productId);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.quantity < i.qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const finalPrice = calculateFinalPrice(product);

      subtotal += product.price * i.qty;
      discountTotal += (product.price - finalPrice) * i.qty;

      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        finalPrice,
        qty: i.qty,
      });

      product.quantity -= i.qty;
    }

    const order = {
      id: Date.now(),
      buyerId: userId,
      items: orderItems,
      subtotal,
      discountTotal,
      grandTotal: subtotal - discountTotal,

      payment: {
        method: paymentMethod,
        status: paymentMethod === "COD" ? "UNPAID" : "PAID",
      },

      address,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ordersData.orders.push(order);

    // clear cart
    store.carts = store.carts.filter((c) => c.userId !== userId);

    write(storePath, store);
    write(ordersPath, ordersData);

    res.json({ message: "Order placed successfully", order });
  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    res.status(500).json({ message: "Checkout failed" });
  }
};
