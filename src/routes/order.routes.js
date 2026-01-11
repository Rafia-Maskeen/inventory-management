const express = require("express");
const {
  createOrder,
  getAllOrders,
  getBuyerOrders,
  updateOrderStatus,
  cancelOrder,
  markPaid
} = require("../controllers/order.controller");

const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

// buyer
router.post("/", protect(["buyer"]), createOrder);
router.post("/cancel/:id", protect(["buyer", "admin"]), cancelOrder);
router.get("/my", protect(["buyer"]), getBuyerOrders);
router.post("/pay/:id", protect(["buyer"]), markPaid);


// admin
router.get(
  "/",
  protect(["admin"]),
  getAllOrders
);

router.post("/status/:id", protect(["admin"]), updateOrderStatus);

module.exports = router;
