const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "../data/store.json");

const readStore = () =>
  JSON.parse(fs.readFileSync(storePath, "utf-8"));

const writeStore = (data) =>
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));

/* =========================
   GET PAYMENT METHODS
========================= */
exports.getPaymentMethods = (req, res) => {
  try {
    const store = readStore();
    res.json(store.settings?.paymentMethods || {});
  } catch (err) {
    console.error("Get payment methods error:", err);
    res.status(500).json({ message: "Failed to load payment methods" });
  }
};

/* =========================
   UPDATE PAYMENT METHODS (ADMIN)
========================= */
exports.updatePaymentMethods = (req, res) => {
  try {
    const { paymentMethods } = req.body;

    if (!paymentMethods) {
      return res.status(400).json({ message: "paymentMethods required" });
    }

    const store = readStore();
    store.settings.paymentMethods = paymentMethods;

    writeStore(store);

    res.json({ message: "Payment methods updated successfully" });
  } catch (err) {
    console.error("Update payment methods error:", err);
    res.status(500).json({ message: "Failed to update payment methods" });
  }
};
