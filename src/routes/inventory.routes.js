const express = require("express");
const {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,

  getProducts,
  getProductsByCategory,
  addProduct,
  updateProduct,
  deleteProduct,

  addStock,
  reduceStock,
  setDiscount
} = require("../controllers/inventory.controller");

const { protect } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");


const router = express.Router();

// public
router.get("/", getProducts);
router.get("/categories", getCategories);
router.get("/category/:categoryId/products", getProductsByCategory);

// admin
router.post("/categories", protect(["admin"]), addCategory);
router.put("/categories/:id", protect(["admin"]), updateCategory);
router.delete("/categories/:id", protect(["admin"]), deleteCategory);

router.post(
  "/add-product",
  protect(["admin"]),
  upload.single("image"),
  addProduct
);

router.put(
  "/products/:id",
  protect(["admin"]),
  upload.single("image"),
  updateProduct
);

router.delete("/products/:id", protect(["admin"]), deleteProduct);

router.post("/add-stock", protect(["admin"]), addStock);
router.post("/reduce-stock", protect(["admin"]), reduceStock);

// 🔥 DISCOUNT
router.post("/products/:id/discount", protect(["admin"]), setDiscount);

module.exports = router;
