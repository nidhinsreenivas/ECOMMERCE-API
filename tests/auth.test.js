
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let app;
let User;
let mongoServer;

const testUser = {
  name: "Test Customer",
  email: "testcustomer@example.com",
  password: "TestPassword@2026",
  phone: "9876543210",
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
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe("Authentication API", () => {
  test("POST /api/auth/register - should register a customer", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(testUser.email);
    expect(response.body.data.role).toBe("customer");
    expect(response.body.data).not.toHaveProperty("password");
  });

  test("POST /api/auth/register - should reject duplicate email", async () => {
    await User.create(testUser);

    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Email already registered");
  });

  test("POST /api/auth/register - should reject invalid data", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "A",
        email: "invalid-email",
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("POST /api/auth/login - should login and return JWT", async () => {
    await User.create(testUser);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.user.role).toBe("customer");
  });

  test("POST /api/auth/login - should reject incorrect password", async () => {
    await User.create(testUser);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword@123",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid email or password");
  });

  test("POST /api/auth/login - should reject deactivated account", async () => {
    await User.create({
      ...testUser,
      isActive: false,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Your account is deactivated");
  });
});
