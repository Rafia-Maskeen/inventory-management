const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/store.json");

// --------------------
// Helpers
// --------------------
const readData = () => JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const writeData = (data) =>
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

/**
 * Ensure schema + backward compatibility
 */
const ensureSchema = (data) => {
  if (!data.categories) data.categories = [];
  if (!data.products) data.products = [];

  data.products = data.products.map((p) => ({
    id: p.id,
    name: p.name || "",
    description: p.description || "",
    price: p.price ?? 0,
    quantity: p.quantity ?? 0,
    imageUrl: p.imageUrl || "",
    categoryId: p.categoryId,
    discount: p.discount || {
      type: null, // "PERCENT" | "FLAT"
      value: 0,
      active: false,
      startAt: null,
      endAt: null,
    },
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  }));

  return data;
};

// ======================================================
// CATEGORIES
// ======================================================
exports.getCategories = (req, res) => {
  const data = ensureSchema(readData());
  res.json(data.categories);
};

exports.addCategory = (req, res) => {
  const { name } = req.body;
  if (!name?.trim())
    return res.status(400).json({ message: "Category name is required" });

  const data = ensureSchema(readData());

  const exists = data.categories.some(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (exists)
    return res.status(400).json({ message: "Category already exists" });

  const category = {
    id: Date.now(),
    name: name.trim(),
  };

  data.categories.push(category);
  writeData(data);

  res.json({ message: "Category added", category });
};

exports.updateCategory = (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name?.trim())
    return res.status(400).json({ message: "Category name is required" });

  const data = ensureSchema(readData());
  const category = data.categories.find((c) => c.id == id);
  if (!category) return res.status(404).json({ message: "Category not found" });

  category.name = name.trim();
  writeData(data);

  res.json({ message: "Category updated", category });
};

exports.deleteCategory = (req, res) => {
  const { id } = req.params;
  const data = ensureSchema(readData());

  const used = data.products.some((p) => p.categoryId == id);
  if (used)
    return res
      .status(400)
      .json({ message: "Cannot delete category with products" });

  data.categories = data.categories.filter((c) => c.id != id);
  writeData(data);

  res.json({ message: "Category deleted" });
};

// ======================================================
// PRODUCTS
// ======================================================
exports.getProducts = (req, res) => {
  const data = ensureSchema(readData());
  res.json(data.products);
};

exports.getProductsByCategory = (req, res) => {
  const data = ensureSchema(readData());
  const products = data.products.filter(
    (p) => p.categoryId == req.params.categoryId
  );
  res.json(products);
};

exports.addProduct = (req, res) => {
  const { name, description = "", price, quantity, categoryId } = req.body;

  if (!name || price == null || quantity == null || !categoryId) {
    return res.status(400).json({
      message: "name, price, quantity, categoryId are required",
    });
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";


  const data = ensureSchema(readData());

  const product = {
    id: Date.now(),
    name: name.trim(),
    description: description.trim(),
    price: Number(price),
    quantity: Number(quantity),
    imageUrl,
    categoryId: Number(categoryId),
    discount: {
      type: null,
      value: 0,
      active: false,
      startAt: null,
      endAt: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.products.push(product);
  writeData(data);

  res.json({ message: "Product added", product });
};

exports.updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const data = ensureSchema(readData());

    const product = data.products.find((p) => p.id == id);
    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const { name, description, price, quantity, categoryId } = req.body;

    if (req.file) {
      // ✅ CORRECT PATH
      product.imageUrl = `/uploads/${req.file.filename}`;
    }

    if (name !== undefined) product.name = name.trim();
    if (description !== undefined)
      product.description = description.trim();

    if (price !== undefined) {
      const p = Number(price);
      if (p < 0)
        return res.status(400).json({ message: "Invalid price" });
      product.price = p;
    }

    if (quantity !== undefined)
      product.quantity = Number(quantity);

    if (categoryId !== undefined)
      product.categoryId = Number(categoryId);

    product.updatedAt = new Date().toISOString();
    writeData(data);

    res.json({ message: "Product updated", product });
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);
    res.status(500).json({ message: "Failed to update product" });
  }
};


exports.deleteProduct = (req, res) => {
  const { id } = req.params;
  const data = ensureSchema(readData());

  data.products = data.products.filter((p) => p.id != id);
  writeData(data);

  res.json({ message: "Product deleted" });
};

// ======================================================
// STOCK
// ======================================================
exports.addStock = (req, res) => {
  const { id, quantity } = req.body;
  const data = ensureSchema(readData());

  const product = data.products.find((p) => p.id == id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const q = Number(quantity);
  if (Number.isNaN(q) || q <= 0)
    return res.status(400).json({ message: "Invalid quantity" });

  product.quantity += q;
  product.updatedAt = new Date().toISOString();
  writeData(data);

  res.json({ message: "Stock added", product });
};

exports.reduceStock = (req, res) => {
  const { id, quantity } = req.body;
  const data = ensureSchema(readData());

  const product = data.products.find((p) => p.id == id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const q = Number(quantity);
  if (Number.isNaN(q) || q <= 0)
    return res.status(400).json({ message: "Invalid quantity" });

  if (product.quantity < q)
    return res.status(400).json({ message: "Insufficient stock" });

  product.quantity -= q;
  product.updatedAt = new Date().toISOString();
  writeData(data);

  res.json({ message: "Stock reduced", product });
};

// ======================================================
// DISCOUNT MANAGEMENT (ADMIN)
// ======================================================
exports.setDiscount = (req, res) => {
  const { id } = req.params;
  const { type, value, active, startAt, endAt } = req.body;

  const data = ensureSchema(readData());
  const product = data.products.find(p => p.id == id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  if (active) {
    if (!type || !value || !endAt) {
      return res.status(400).json({
        message: "Discount type, value and expiry date are required"
      });
    }
  }

  product.discount = {
    type: active ? type : null,
    value: active ? Number(value) : 0,
    active: Boolean(active),
    startAt: active ? (startAt || new Date().toISOString()) : null,
    endAt: active ? endAt : null,
  };

  product.updatedAt = new Date().toISOString();
  writeData(data);

  res.json({ message: "Discount updated", product });
};

