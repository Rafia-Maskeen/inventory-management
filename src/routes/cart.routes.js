const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItem,
  clearCart
} = require("../controllers/cart.controller");

const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", protect(["buyer"]), getCart);
router.post("/add", protect(["buyer"]), addToCart);
router.put("/update", protect(["buyer"]), updateCartItem);
router.delete("/clear", protect(["buyer"]), clearCart);

module.exports = router;
