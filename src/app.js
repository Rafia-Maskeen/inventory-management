const express = require("express");
const cors = require("cors");
const path = require("path");

const inventoryRoutes = require("./routes/inventory.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/order.routes");
const assistantRoutes = require("./routes/assistant.routes");
const cartRoutes = require("./routes/cart.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const settingsRoutes = require("./routes/settings.routes");


const app = express();

app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/inventory", inventoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/settings", settingsRoutes);


// default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin/index.html"));
});

module.exports = app;

app.use((err, req, res, next) => {
  if (err instanceof require("multer").MulterError) {
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(500).json({ message: err.message });
  }
  next();
});
