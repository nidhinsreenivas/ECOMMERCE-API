
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let app;
let User;
let Category;
let Product;
let mongoServer;

const createTestUser = async (role = "customer") => {
  const user = await User.create({
    name: `Test ${role}`,
    email: `${role}@example.com`,
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

const createCategory = async (name, parent = null) => {
  return Category.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: `${name} category`,
    parent,
  });
};

const createProduct = async (category, overrides = {}) => {
  return Product.create({
    name: "Test Smartphone",
    sku: "TEST-PHONE-001",
    description: "A smartphone for automated testing",
    price: 50000,
    salePrice: 45000,
    stock: 20,
    category: category._id,
    ...overrides,
  });
};

const productPayload = (categoryId, overrides = {}) => ({
  name: "Test Smartphone",
  sku: "TEST-PHONE-001",
  description: "A smartphone for automated testing",
  price: 50000,
  salePrice: 45000,
  stock: 20,
  category: categoryId.toString(),
  ...overrides,
});

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

  const appModule = await import("../src/app.js");
  app = appModule.default;

  User = (await import("../src/models/User.js")).default;
  Category = (
    await import("../src/modules/categories/category.model.js")
  ).default;
  Product = (
    await import("../src/modules/products/product.model.js")
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
  ]);
});

describe("Product API", () => {
  test("GET /api/products - should list products publicly", async () => {
    const category = await createCategory("Electronics");
    await createProduct(category);

    const response = await request(app)
      .get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.pagination.totalProducts).toBe(1);
  });

  test("GET /api/products/:id - should retrieve a product", async () => {
    const category = await createCategory("Electronics");
    const product = await createProduct(category);

    const response = await request(app)
      .get(`/api/products/${product._id}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe("Test Smartphone");
    expect(response.body.data.category.name).toBe("Electronics");
  });

  test("POST /api/products - admin should create a product", async () => {
    const { token } = await createTestUser("admin");
    const category = await createCategory("Electronics");

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(productPayload(category._id));

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe("Test Smartphone");
    expect(response.body.data.sku).toBe("TEST-PHONE-001");
    expect(response.body.data.salePrice).toBe(45000);
  });

  test("POST /api/products - customer should not create products", async () => {
    const { token } = await createTestUser("customer");
    const category = await createCategory("Electronics");

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(productPayload(category._id));

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test("POST /api/products - should reject duplicate SKU", async () => {
    const { token } = await createTestUser("admin");
    const category = await createCategory("Electronics");

    await createProduct(category);

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(productPayload(category._id, {
        name: "Another Smartphone",
        sku: "test-phone-001",
      }));

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("SKU already exists");
  });

  test("POST /api/products - should reject invalid sale price", async () => {
    const { token } = await createTestUser("admin");
    const category = await createCategory("Electronics");

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(productPayload(category._id, {
        salePrice: 50000,
      }));

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("GET /api/products - should search products by name", async () => {
    const category = await createCategory("Electronics");

    await createProduct(category, {
      name: "Samsung Galaxy",
      sku: "SAMSUNG-001",
    });

    await createProduct(category, {
      name: "Apple iPhone",
      sku: "APPLE-001",
    });

    const response = await request(app)
      .get("/api/products?search=Samsung");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].name).toBe("Samsung Galaxy");
  });

  test("GET /api/products - should include descendant categories", async () => {
    const root = await createCategory("Electronics");
    const child = await createCategory("Mobiles", root._id);
    const grandchild = await createCategory("Android Phones", child._id);

    await createProduct(root, {
      name: "Television",
      sku: "TV-001",
    });

    await createProduct(child, {
      name: "Mobile Phone",
      sku: "MOBILE-001",
    });

    await createProduct(grandchild, {
      name: "Android Phone",
      sku: "ANDROID-001",
    });

    const response = await request(app)
      .get(`/api/products?category=${root._id}`);

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(3);
  });

  test("GET /api/products - should filter using effective sale price", async () => {
    const category = await createCategory("Electronics");

    await createProduct(category, {
      name: "Discounted Phone",
      sku: "DISCOUNT-001",
      price: 50000,
      salePrice: 30000,
    });

    await createProduct(category, {
      name: "Regular Phone",
      sku: "REGULAR-001",
      price: 50000,
      salePrice: null,
    });

    const response = await request(app)
      .get("/api/products?minPrice=25000&maxPrice=35000");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].name).toBe("Discounted Phone");
  });

  test("GET /api/products - should sort products by effective price", async () => {
    const category = await createCategory("Electronics");

    await createProduct(category, {
      name: "Expensive Phone",
      sku: "EXPENSIVE-001",
      price: 70000,
      salePrice: null,
    });

    await createProduct(category, {
      name: "Affordable Phone",
      sku: "AFFORDABLE-001",
      price: 50000,
      salePrice: 30000,
    });

    const response = await request(app)
      .get("/api/products?sort=price_asc");

    expect(response.status).toBe(200);
    expect(response.body.products[0].name).toBe("Affordable Phone");
  });

  test("GET /api/products - should support pagination", async () => {
    const category = await createCategory("Electronics");

    for (let i = 1; i <= 5; i++) {
      await createProduct(category, {
        name: `Product ${i}`,
        sku: `PRODUCT-${i}`,
      });
    }

    const response = await request(app)
      .get("/api/products?page=1&limit=2");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(2);
    expect(response.body.pagination.totalProducts).toBe(5);
    expect(response.body.pagination.totalPages).toBe(3);
    expect(response.body.pagination.hasNextPage).toBe(true);
  });

  test("PATCH /api/products/:id - admin should update a product", async () => {
    const { token } = await createTestUser("admin");
    const category = await createCategory("Electronics");
    const product = await createProduct(category);

    const response = await request(app)
      .patch(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Smartphone",
        salePrice: 40000,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Updated Smartphone");
    expect(response.body.data.salePrice).toBe(40000);
  });

  test("DELETE /api/products/:id - admin should delete a product", async () => {
    const { token } = await createTestUser("admin");
    const category = await createCategory("Electronics");
    const product = await createProduct(category);

    const response = await request(app)
      .delete(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const deletedProduct = await Product.findById(product._id);
    expect(deletedProduct).toBeNull();
  });
});
