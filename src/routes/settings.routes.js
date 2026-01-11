const express = require("express");
const {
  getPaymentMethods,
  updatePaymentMethods
} = require("../controllers/settings.controller");

const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

// Buyer + Admin
router.get("/payment-methods", protect(["admin", "buyer"]), getPaymentMethods);

// Admin only
router.post("/payment-methods", protect(["admin"]), updatePaymentMethods);

module.exports = router;
