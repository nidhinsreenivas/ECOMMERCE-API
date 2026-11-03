
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

const createTestCategory = async (name, parent = null) => {
  return Category.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: `${name} category`,
    parent,
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

  const appModule = await import("../src/app.js");
  app = appModule.default;

  const userModule = await import("../src/models/User.js");
  User = userModule.default;

  const categoryModule = await import(
    "../src/modules/categories/category.model.js"
  );
  Category = categoryModule.default;

  const productModule = await import(
    "../src/modules/products/product.model.js"
  );
  Product = productModule.default;
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

describe("Category API", () => {
  test("GET /api/categories - should return categories publicly", async () => {
    await createTestCategory("Electronics");

    const response = await request(app)
      .get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
  });

  test("POST /api/categories - admin should create a category", async () => {
    const { token } = await createTestUser("admin");

    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Electronics",
        description: "Electronic products",
        parent: null,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe("Electronics");
    expect(response.body.data.slug).toBe("electronics");
  });

  test("POST /api/categories - customer should not create categories", async () => {
    const { token } = await createTestUser("customer");

    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Electronics",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test("GET /api/categories/tree - should return nested categories", async () => {
    const root = await createTestCategory("Electronics");
    const child = await createTestCategory("Mobiles", root._id);
    await createTestCategory("Android Phones", child._id);

    const response = await request(app)
      .get("/api/categories/tree");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const electronics = response.body.data.find(
      (category) => category.name === "Electronics"
    );

    expect(electronics).toBeDefined();
    expect(electronics.children).toHaveLength(1);
    expect(electronics.children[0].name).toBe("Mobiles");
    expect(electronics.children[0].children[0].name).toBe(
      "Android Phones"
    );
  });

  test("PATCH /api/categories/:id - should prevent circular relationships", async () => {
    const { token } = await createTestUser("admin");

    const root = await createTestCategory("Electronics");
    const child = await createTestCategory("Mobiles", root._id);

    const response = await request(app)
      .patch(`/api/categories/${root._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        parent: child._id.toString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Circular category relationship detected"
    );
  });

  test("DELETE /api/categories/:id - should prevent deleting categories with children", async () => {
    const { token } = await createTestUser("admin");

    const root = await createTestCategory("Electronics");
    await createTestCategory("Mobiles", root._id);

    const response = await request(app)
      .delete(`/api/categories/${root._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Cannot delete category because it has subcategories"
    );
  });

  test("DELETE /api/categories/:id - should prevent deleting categories with products", async () => {
    const { token } = await createTestUser("admin");

    const category = await createTestCategory("Electronics");

    await Product.create({
      name: "Test Smartphone",
      sku: "TEST-PHONE-001",
      description: "Test smartphone product",
      price: 50000,
      salePrice: 45000,
      stock: 10,
      category: category._id,
    });

    const response = await request(app)
      .delete(`/api/categories/${category._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Cannot delete category because products are assigned to it"
    );
  });

  test("DELETE /api/categories/:id - should delete an empty category", async () => {
    const { token } = await createTestUser("admin");

    const category = await createTestCategory("Empty Category");

    const response = await request(app)
      .delete(`/api/categories/${category._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const deletedCategory = await Category.findById(category._id);

    expect(deletedCategory).toBeNull();
  });
});
