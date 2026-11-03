
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let app;
let User;
let Category;
let Product;
let Order;
let mongoServer;

const createTestUser = async (role = "customer", email) => {
  const user = await User.create({
    name: `Test ${role}`,
    email: email || `${role}@example.com`,
    password: "TestPassword@2026",
    role,
    isActive: true,
  });

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      algorithm: "HS256",
    }
  );

  return { user, token };
};

const createCategory = async () => {
  return Category.create({
    name: "Electronics",
    slug: "electronics",
    description: "Electronic products",
  });
};

const createProduct = async (category, overrides = {}) => {
  return Product.create({
    name: "Test Smartphone",
    sku: "TEST-PHONE-001",
    description: "A smartphone for order testing",
    price: 50000,
    salePrice: 45000,
    stock: 20,
    category: category._id,
    ...overrides,
  });
};

const shippingAddress = {
  fullName: "Test Customer",
  phone: "9876543210",
  addressLine: "123 Main Street",
  city: "Kochi",
  state: "Kerala",
  postalCode: "682001",
  country: "India",
};

const placeOrder = (token, items) => {
  return request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({
      items,
      shippingAddress,
    });
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test_jwt_secret_for_automated_testing_only";
  process.env.JWT_EXPIRES_IN = "1h";

  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri());

  app = (await import("../src/app.js")).default;
  User = (await import("../src/models/User.js")).default;

  Category = (
    await import("../src/modules/categories/category.model.js")
  ).default;

  Product = (
    await import("../src/modules/products/product.model.js")
  ).default;

  Order = (
    await import("../src/modules/orders/order.model.js")
  ).default;
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
  ]);
});

describe("Order API", () => {
  test("POST /api/orders - customer should place an order", async () => {
    const { token, user } = await createTestUser();
    const category = await createCategory();
    const product = await createProduct(category);

    const response = await placeOrder(token, [
      {
        product: product._id.toString(),
        quantity: 2,
      },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.order.customer.toString()).toBe(
      user._id.toString()
    );
    expect(response.body.order.items).toHaveLength(1);
    expect(response.body.order.status).toBe("pending");
  });

  test("POST /api/orders - should calculate total using sale price", async () => {
    const { token } = await createTestUser();
    const category = await createCategory();
    const product = await createProduct(category);

    const response = await placeOrder(token, [
      {
        product: product._id.toString(),
        quantity: 2,
      },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.order.items[0].unitPrice).toBe(45000);
    expect(response.body.order.items[0].subtotal).toBe(90000);
    expect(response.body.order.totalAmount).toBe(90000);
  });

  test("POST /api/orders - should deduct stock after ordering", async () => {
    const { token } = await createTestUser();
    const category = await createCategory();
    const product = await createProduct(category, {
      stock: 20,
    });

    const response = await placeOrder(token, [
      {
        product: product._id.toString(),
        quantity: 3,
      },
    ]);

    expect(response.status).toBe(201);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.stock).toBe(17);
  });

  test("POST /api/orders - should reject insufficient stock", async () => {
    const { token } = await createTestUser();
    const category = await createCategory();
    const product = await createProduct(category, {
      stock: 2,
    });

    const response = await placeOrder(token, [
      {
        product: product._id.toString(),
        quantity: 5,
      },
    ]);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.stock).toBe(2);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("POST /api/orders - should combine duplicate product entries", async () => {
    const { token } = await createTestUser();
    const category = await createCategory();
    const product = await createProduct(category);

    const response = await placeOrder(token, [
      {
        product: product._id.toString(),
        quantity: 2,
      },
      {
        product: product._id.toString(),
        quantity: 3,
      },
    ]);

    expect(response.status).toBe(201);
    expect(response.body.order.items).toHaveLength(1);
    expect(response.body.order.items[0].quantity).toBe(5);
    expect(response.body.order.orderTotal).toBeUndefined();
    expect(response.body.order.totalAmount).toBe(225000);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(15);
  });

  test("POST /api/orders - should reject invalid order data", async () => {
    const { token } = await createTestUser();

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [],
        shippingAddress: {},
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("GET /api/orders/my-orders - customer should see only their orders", async () => {
    const firstCustomer = await createTestUser(
      "customer",
      "first@example.com"
    );

    const secondCustomer = await createTestUser(
      "customer",
      "second@example.com"
    );

    const category = await createCategory();
    const product = await createProduct(category);

    await placeOrder(firstCustomer.token, [
      {
        product: product._id.toString(),
        quantity: 1,
      },
    ]);

    await placeOrder(secondCustomer.token, [
      {
        product: product._id.toString(),
        quantity: 1,
      },
    ]);

    const response = await request(app)
      .get("/api/orders/my-orders")
      .set("Authorization", `Bearer ${firstCustomer.token}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
    expect(response.body.pagination.totalOrders).toBe(1);
    expect(response.body.orders[0].customer._id.toString()).toBe(
      firstCustomer.user._id.toString()
    );
  });

  test("GET /api/orders/my-orders/:id - customer should not access another customer's order", async () => {
    const firstCustomer = await createTestUser(
      "customer",
      "first@example.com"
    );

    const secondCustomer = await createTestUser(
      "customer",
      "second@example.com"
    );

    const category = await createCategory();
    const product = await createProduct(category);

    const orderResponse = await placeOrder(firstCustomer.token, [
      {
        product: product._id.toString(),
        quantity: 1,
      },
    ]);

    const orderId = orderResponse.body.order._id;

    const response = await request(app)
      .get(`/api/orders/my-orders/${orderId}`)
      .set("Authorization", `Bearer ${secondCustomer.token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Order not found");
  });

  test("GET /api/orders - customer should not access admin order listing", async () => {
    const { token } = await createTestUser();

    const response = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  test("GET /api/orders - admin should view all orders", async () => {
    const { token: adminToken } = await createTestUser("admin");
    const customer = await createTestUser();

    const category = await createCategory();
    const product = await createProduct(category);

    await placeOrder(customer.token, [
      {
        product: product._id.toString(),
        quantity: 1,
      },
    ]);

    const response = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.orders).toHaveLength(1);
  });

  test("PATCH /api/orders/:id/status - admin should cancel and restore stock", async () => {
    const { token: adminToken } = await createTestUser("admin");
    const customer = await createTestUser();

    const category = await createCategory();
    const product = await createProduct(category, {
      stock: 20,
    });

    const orderResponse = await placeOrder(customer.token, [
      {
        product: product._id.toString(),
        quantity: 3,
      },
    ]);

    const orderId = orderResponse.body.order._id;

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(17);

    const response = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "cancelled",
      });

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("cancelled");

    const restoredProduct = await Product.findById(product._id);
    expect(restoredProduct.stock).toBe(20);
  });

  test("PATCH /api/orders/:id/status - should reject invalid status transition", async () => {
    const { token: adminToken } = await createTestUser("admin");
    const customer = await createTestUser();

    const category = await createCategory();
    const product = await createProduct(category);

    const orderResponse = await placeOrder(customer.token, [
      {
        product: product._id.toString(),
        quantity: 1,
      },
    ]);

    const orderId = orderResponse.body.order._id;

    const response = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "delivered",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("PATCH /api/orders/:id/status - should reject repeated cancellation", async () => {
    const { token: adminToken } = await createTestUser("admin");
    const customer = await createTestUser();

    const category = await createCategory();
    const product = await createProduct(category, {
      stock: 20,
    });

    const orderResponse = await placeOrder(customer.token, [
      {
        product: product._id.toString(),
        quantity: 2,
      },
    ]);

    const orderId = orderResponse.body.order._id;

    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "cancelled",
      });

    const response = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "cancelled",
      });

    expect(response.status).toBe(400);

    const restoredProduct = await Product.findById(product._id);
    expect(restoredProduct.stock).toBe(20);
  });

  test("GET /api/orders - admin should filter, sort and paginate orders", async () => {
    const { token: adminToken } = await createTestUser("admin");
    const customer = await createTestUser();

    const category = await createCategory();

    const firstProduct = await createProduct(category, {
      name: "Affordable Phone",
      sku: "AFFORDABLE-001",
      price: 20000,
      salePrice: null,
    });

    const secondProduct = await createProduct(category, {
      name: "Premium Phone",
      sku: "PREMIUM-001",
      price: 50000,
      salePrice: null,
    });

    await placeOrder(customer.token, [
      {
        product: firstProduct._id.toString(),
        quantity: 1,
      },
    ]);

    await placeOrder(customer.token, [
      {
        product: secondProduct._id.toString(),
        quantity: 1,
      },
    ]);

    const response = await request(app)
      .get("/api/orders?sort=amount_desc&page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
    expect(response.body.orders[0].totalAmount).toBe(50000);
    expect(response.body.pagination.totalOrders).toBe(2);
    expect(response.body.pagination.totalPages).toBe(2);
    expect(response.body.pagination.hasNextPage).toBe(true);
  });
});
