const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const storePath = path.join(__dirname, "../data/store.json");
const ordersPath = path.join(__dirname, "../data/orders.json");

/* =========================
   FILE HELPERS
========================= */
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

/* =========================
   ENSURE DATA SCHEMAS
========================= */
function ensureStoreSchema(store) {
  if (!store || typeof store !== "object") store = {};
  if (!Array.isArray(store.categories)) store.categories = [];
  if (!Array.isArray(store.products)) store.products = [];
  if (!Array.isArray(store.carts)) store.carts = [];
  if (!store.settings || typeof store.settings !== "object") store.settings = {};
  if (!store.settings.paymentMethods) {
    store.settings.paymentMethods = {
      COD: { enabled: true, label: "Cash on Delivery" },
    };
  }

  store.products = store.products.map((p) => ({
    id: p.id,
    name: p.name || "",
    description: p.description || "",
    price: p.price ?? 0,
    quantity: p.quantity ?? 0,
    imageUrl: p.imageUrl || "",
    categoryId: p.categoryId,
    discount: p.discount || { type: null, value: 0, active: false },
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  }));

  return store;
}

function ensureOrdersSchema(ordersData) {
  if (!ordersData || typeof ordersData !== "object") return { orders: [] };
  if (Array.isArray(ordersData)) return { orders: ordersData };
  if (!Array.isArray(ordersData.orders)) ordersData.orders = [];
  return ordersData;
}

/* =========================
   TOOLS DEFINITION
   These are the functions AI can call
========================= */
const tools = [
  {
    type: "function",
    function: {
      name: "add_categories",
      description: "Add one or more new categories to the inventory",
      parameters: {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: { type: "string" },
            description: "List of category names to add"
          }
        },
        required: ["names"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_category",
      description: "Remove a category from the inventory. Will also remove all products in that category.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Category name to remove"
          }
        },
        required: ["category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "Get all available categories in the inventory",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_products",
      description: "Add one or more products to the inventory",
      parameters: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Product name" },
                category: { type: "string", description: "Category name" },
                quantity: { type: "number", description: "Stock quantity" },
                price: { type: "number", description: "Product price" }
              },
              required: ["name", "category", "quantity"]
            }
          }
        },
        required: ["products"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_product",
      description: "Remove a product from the inventory",
      parameters: {
        type: "object",
        properties: {
          product: {
            type: "string",
            description: "Product name to remove"
          }
        },
        required: ["product"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description: "List all products, optionally filtered by category",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Optional category name to filter by"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_stock",
      description: "Add or remove stock from a product",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name" },
          quantity: { type: "number", description: "Quantity to add (positive) or remove (negative)" }
        },
        required: ["product", "quantity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_product_price",
      description: "Update the price of a product",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name" },
          price: { type: "number", description: "New price" }
        },
        required: ["product", "price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a product to the buyer's shopping cart",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name" },
          quantity: { type: "number", description: "Quantity to add", default: 1 }
        },
        required: ["product"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_from_cart",
      description: "Remove a product from the buyer's shopping cart",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name to remove" }
        },
        required: ["product"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "clear_cart",
      description: "Clear all items from the buyer's shopping cart",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "view_cart",
      description: "Show the buyer's current shopping cart",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "checkout",
      description: "Complete the purchase and create an order from cart",
      parameters: {
        type: "object",
        properties: {
          paymentMethod: {
            type: "string",
            description: "Payment method (COD, etc.)",
            default: "COD"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description: "List orders with optional filters",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by order status (CONFIRMED, SHIPPED, etc.)" },
          payment: { type: "string", description: "Filter by payment status (PAID, UNPAID, PENDING)" },
          myOrders: { type: "boolean", description: "Only show current user's orders", default: false }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Check the status of a specific order or latest order",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "number", description: "Specific order ID, or omit for latest" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_discount",
      description: "Set a discount on a product",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name" },
          type: { type: "string", enum: ["PERCENT", "FLAT"], description: "Discount type" },
          value: { type: "number", description: "Discount value (percentage or flat amount)" },
          active: { type: "boolean", default: true }
        },
        required: ["product", "type", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_discount",
      description: "Remove discount from a product",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", description: "Product name" }
        },
        required: ["product"]
      }
    }
  }
];

/* =========================
   TOOL IMPLEMENTATIONS
========================= */
const toolFunctions = {
  add_categories: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can add categories" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const names = args.names || [];
    const added = [];

    names.forEach((name) => {
      const exists = store.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        store.categories.push({ id: Date.now() + Math.random(), name: name.trim() });
        added.push(name);
      }
    });

    writeJson(storePath, store);
    return { success: true, added, message: `Added ${added.length} categories` };
  },

  remove_category: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can remove categories" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const categoryName = args.category;
    
    const category = store.categories.find(c => 
      c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!category) return { error: `Category '${categoryName}' not found` };

    // Remove all products in this category
    const productsRemoved = store.products.filter(p => p.categoryId === category.id).length;
    store.products = store.products.filter(p => p.categoryId !== category.id);

    // Remove the category
    store.categories = store.categories.filter(c => c.id !== category.id);

    writeJson(storePath, store);
    return { 
      success: true, 
      message: `Removed category '${category.name}' and ${productsRemoved} products in it`
    };
  },

  list_categories: async (args, userId, role) => {
    const store = ensureStoreSchema(readJson(storePath));
    return { categories: store.categories.map(c => c.name) };
  },

  add_products: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can add products" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const products = args.products || [];
    const created = [];

    for (const p of products) {
      const cat = store.categories.find(c => c.name.toLowerCase() === p.category.toLowerCase());
      if (!cat) continue;

      store.products.push({
        id: Date.now() + Math.random(),
        name: p.name,
        description: "",
        price: p.price || 0,
        quantity: p.quantity || 0,
        imageUrl: "",
        categoryId: cat.id,
        discount: { type: null, value: 0, active: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      created.push(p.name);
    }

    writeJson(storePath, store);
    return { success: true, created, message: `Added ${created.length} products` };
  },

  remove_product: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can remove products" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    store.products = store.products.filter(p => p.id !== product.id);

    writeJson(storePath, store);
    return { 
      success: true, 
      message: `Removed product '${product.name}'`
    };
  },

  list_products: async (args, userId, role) => {
    const store = ensureStoreSchema(readJson(storePath));
    let products = store.products;

    if (args.category) {
      const cat = store.categories.find(c => c.name.toLowerCase() === args.category.toLowerCase());
      if (cat) products = products.filter(p => p.categoryId === cat.id);
    }

    return {
      products: products.map(p => ({
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        category: store.categories.find(c => c.id === p.categoryId)?.name
      }))
    };
  },

  update_stock: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can update stock" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    product.quantity += args.quantity;
    if (product.quantity < 0) product.quantity = 0;
    product.updatedAt = new Date().toISOString();

    writeJson(storePath, store);
    return { 
      success: true, 
      product: product.name, 
      newQuantity: product.quantity,
      message: `Stock updated. ${product.name} now has ${product.quantity} units`
    };
  },

  update_product_price: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can update prices" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    product.price = args.price;
    product.updatedAt = new Date().toISOString();

    writeJson(storePath, store);
    return { 
      success: true, 
      message: `Updated ${product.name} price to $${args.price}`
    };
  },

  add_to_cart: async (args, userId, role) => {
    if (role !== "buyer") return { error: "Only buyers can add to cart" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    const qty = args.quantity || 1;
    if (product.quantity < qty) {
      return { error: `Not enough stock. Only ${product.quantity} available` };
    }

    let cart = store.carts.find(c => c.userId === userId);
    if (!cart) {
      cart = { userId, items: [], updatedAt: new Date().toISOString() };
      store.carts.push(cart);
    }

    const existing = cart.items.find(i => i.productId === product.id);
    if (existing) existing.qty += qty;
    else cart.items.push({ productId: product.id, qty });

    cart.updatedAt = new Date().toISOString();
    writeJson(storePath, store);

    return { 
      success: true, 
      message: `Added ${qty}x ${product.name} to cart`,
      cartItems: cart.items.length
    };
  },

  remove_from_cart: async (args, userId, role) => {
    if (role !== "buyer") return { error: "Only buyers have carts" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const cart = store.carts.find(c => c.userId === userId);

    if (!cart) return { error: "Cart is empty" };

    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    cart.items = cart.items.filter(i => i.productId !== product.id);
    cart.updatedAt = new Date().toISOString();

    writeJson(storePath, store);
    return { 
      success: true, 
      message: `Removed ${product.name} from cart`
    };
  },

  clear_cart: async (args, userId, role) => {
    if (role !== "buyer") return { error: "Only buyers have carts" };
    
    const store = ensureStoreSchema(readJson(storePath));
    store.carts = store.carts.filter(c => c.userId !== userId);

    writeJson(storePath, store);
    return { 
      success: true, 
      message: "Cart cleared"
    };
  },

  view_cart: async (args, userId, role) => {
    if (role !== "buyer") return { error: "Only buyers have carts" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const cart = store.carts.find(c => c.userId === userId);

    if (!cart || !cart.items.length) {
      return { items: [], total: 0, message: "Your cart is empty" };
    }

    const items = cart.items.map(it => {
      const p = store.products.find(x => x.id === it.productId);
      return {
        name: p?.name || "Unknown",
        quantity: it.qty,
        price: p?.price || 0,
        subtotal: (p?.price || 0) * it.qty
      };
    });

    const total = items.reduce((sum, it) => sum + it.subtotal, 0);

    return { items, total };
  },

  checkout: async (args, userId, role) => {
    if (role !== "buyer") return { error: "Only buyers can checkout" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const ordersData = ensureOrdersSchema(readJson(ordersPath));
    
    const cart = store.carts.find(c => c.userId === userId);
    if (!cart || !cart.items.length) {
      return { error: "Cart is empty" };
    }

    const pm = args.paymentMethod?.toUpperCase() || "COD";
    
    // Validate and reduce stock
    let total = 0;
    const orderItems = [];

    for (const it of cart.items) {
      const p = store.products.find(x => x.id === it.productId);
      if (!p || p.quantity < it.qty) {
        return { error: `Not enough stock for ${p?.name || 'product'}` };
      }

      p.quantity -= it.qty;
      total += p.price * it.qty;

      orderItems.push({
        productId: p.id,
        name: p.name,
        price: p.price,
        qty: it.qty
      });
    }

    const order = {
      id: Date.now(),
      buyerId: userId,
      items: orderItems,
      total,
      payment: { method: pm, status: pm === "COD" ? "UNPAID" : "PENDING" },
      status: "CONFIRMED",
      createdAt: new Date().toISOString()
    };

    ordersData.orders.push(order);
    store.carts = store.carts.filter(c => c.userId !== userId);

    writeJson(storePath, store);
    writeJson(ordersPath, ordersData);

    return {
      success: true,
      orderId: order.id,
      total: total,
      message: `Order placed successfully! Order ID: ${order.id}`
    };
  },

  list_orders: async (args, userId, role) => {
    const ordersData = ensureOrdersSchema(readJson(ordersPath));
    let orders = ordersData.orders;

    if (role === "buyer" || args.myOrders) {
      orders = orders.filter(o => o.buyerId === userId);
    }

    if (args.status) {
      orders = orders.filter(o => o.status.toLowerCase() === args.status.toLowerCase());
    }

    if (args.payment) {
      orders = orders.filter(o => o.payment?.status.toLowerCase() === args.payment.toLowerCase());
    }

    return {
      orders: orders.map(o => ({
        id: o.id,
        status: o.status,
        payment: o.payment?.status,
        total: o.total,
        createdAt: o.createdAt
      }))
    };
  },

  get_order_status: async (args, userId, role) => {
    const ordersData = ensureOrdersSchema(readJson(ordersPath));
    let order;

    if (args.orderId) {
      order = ordersData.orders.find(o => o.id === args.orderId);
      if (role === "buyer" && order?.buyerId !== userId) {
        return { error: "Order not found" };
      }
    } else {
      // Get latest order for buyer
      const myOrders = ordersData.orders
        .filter(o => o.buyerId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      order = myOrders[0];
    }

    if (!order) return { error: "No orders found" };

    return {
      orderId: order.id,
      status: order.status,
      payment: order.payment?.status,
      total: order.total,
      message: `Order #${order.id} is ${order.status}, payment is ${order.payment?.status}`
    };
  },

  set_discount: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can set discounts" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    product.discount = {
      type: args.type,
      value: args.value,
      active: args.active !== false
    };

    writeJson(storePath, store);
    return {
      success: true,
      message: `Discount set on ${product.name}: ${args.value}${args.type === 'PERCENT' ? '%' : '$'} off`
    };
  },

  remove_discount: async (args, userId, role) => {
    if (role !== "admin") return { error: "Only admins can remove discounts" };
    
    const store = ensureStoreSchema(readJson(storePath));
    const product = store.products.find(p => 
      p.name.toLowerCase().includes(args.product.toLowerCase())
    );

    if (!product) return { error: `Product '${args.product}' not found` };

    product.discount = { type: null, value: 0, active: false };

    writeJson(storePath, store);
    return {
      success: true,
      message: `Removed discount from ${product.name}`
    };
  }
};

/* =========================
   MAIN ASSISTANT HANDLER
========================= */
exports.runAssistantCommand = async (req, res) => {
  try {
    const { message } = req.body;
    const { role, id: userId } = req.user;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // Filter tools based on role
    const availableTools = tools.filter(tool => {
      const name = tool.function.name;
      
      // Admin-only tools
      const adminOnly = ['add_categories', 'remove_category', 'add_products', 'remove_product', 
                         'update_stock', 'update_product_price', 'set_discount', 'remove_discount'];
      if (adminOnly.includes(name) && role !== 'admin') return false;
      
      // Buyer-only tools
      const buyerOnly = ['add_to_cart', 'remove_from_cart', 'clear_cart', 'view_cart', 'checkout'];
      if (buyerOnly.includes(name) && role !== 'buyer') return false;
      
      return true;
    });

    // Enhanced system prompt for conversational AI
    const systemPrompt = `You are a friendly and intelligent inventory assistant for an e-commerce platform. You help ${role}s manage their inventory and shopping.

PERSONALITY:
- Warm, friendly, and conversational
- Professional but approachable
- Helpful and proactive
- Use emojis occasionally to be friendly (but not excessively)

CONVERSATION HANDLING:
1. **Greetings & Small Talk**: Respond naturally to hellos, how are you, etc. WITHOUT using tools
   - "Hi" → "👋 Hey there! I'm your inventory assistant. How can I help you today?"
   - "How are you?" → "I'm doing great, thanks for asking! 😊 Ready to help you with anything you need."
   - "Who are you?" → "I'm your AI inventory assistant! I help ${role}s ${role === 'admin' ? 'manage products, categories, stock, and orders' : 'browse products, shop, and track orders'}. What would you like to do?"

2. **Help Requests**: Explain capabilities clearly
   - For admins: "You can add/remove/manage categories, products, stock, prices, discounts, and view orders"
   - For buyers: "You can browse products, add items to cart, checkout, and track your orders"

3. **Task Requests**: Use tools to accomplish tasks
   - "Show products" → use list_products tool
   - "Add to cart" → use add_to_cart tool
   - "Remove category" → use remove_category tool

CURRENT CONTEXT:
- User role: ${role}
- User ID: ${userId}

IMPORTANT RULES:
- Only use tools when the user wants to DO something or GET information from the system
- For casual conversation, respond directly without tools
- Be concise but friendly
- After using tools, explain what was done in a natural way
- If multiple actions needed, use multiple tools in one go

Now help the user naturally!`;

    // Initial AI call with tools
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: message
      }
    ];

    let response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: availableTools,
      tool_choice: "auto",
      temperature: 0.7
    });

    let assistantMessage = response.choices[0].message;
    const toolCalls = assistantMessage.tool_calls;

    // If AI wants to call tools
    if (toolCalls && toolCalls.length > 0) {
      messages.push(assistantMessage);

      // Execute all tool calls
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`🔧 Calling tool: ${functionName}`, functionArgs);

        let result;
        if (toolFunctions[functionName]) {
          result = await toolFunctions[functionName](functionArgs, userId, role);
        } else {
          result = { error: "Unknown function" };
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Get final response after tool execution
      response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7
      });

      assistantMessage = response.choices[0].message;
    }

    const finalMessage = assistantMessage.content || "Done! ✅";

    return res.json({
      success: true,
      message: finalMessage
    });

  } catch (error) {
    console.error("❌ Assistant error:", error);
    return res.status(500).json({
      success: false,
      message: "Oops! Something went wrong on my end. Please try again later! 😅",
      error: error.message
    });
  }
};