const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "../data/store.json");

const readStore = () =>
  JSON.parse(fs.readFileSync(storePath, "utf-8"));

exports.resolveCategoryByName = (name) => {
  const store = readStore();
  return store.categories.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
};

exports.resolveProductByName = (name) => {
  const store = readStore();
  return store.products.find(
    p => p.name.toLowerCase().includes(name.toLowerCase())
  );
};

exports.resolveLatestOrderForUser = (userId) => {
  const orders = readOrders();
  return orders
    .filter(o => o.buyerId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
};

exports.readOrders = () => {
  const ordersPath = path.join(__dirname, "../data/orders.json");
  return JSON.parse(fs.readFileSync(ordersPath, "utf-8")).orders;
};
