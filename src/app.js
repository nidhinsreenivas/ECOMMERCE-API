
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import userRoutes from "./modules/users/user.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import categoryRoutes from "./modules/categories/category.routes.js";

import productRoutes from "./modules/products/product.routes.js";
import { authenticate } from "./middleware/authenticate.js";
import { authorize } from "./middleware/authorize.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import {
  notFound,
  errorHandler
} from "./middleware/errorHandler.js";

const app = express();

// ========================================
// SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

// ========================================
// REQUEST PARSING
// ========================================

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ========================================
// REQUEST LOGGING
// ========================================

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ========================================
// RATE LIMITING
// ========================================

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
}));

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "E-commerce API is running",
    timestamp: new Date().toISOString()
  });
});

// ========================================
// AUTHENTICATION ROUTES
// ========================================

app.use("/api/auth", authRoutes);

// ========================================
// PROTECTED TEST ROUTE
// ========================================

app.get(
  "/api/protected",
  authenticate,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Authentication successful",
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  }
);

// ========================================
// ADMIN ONLY TEST ROUTE
// ========================================

app.get(
  "/api/admin/test",
  authenticate,
  authorize("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome Admin"
    });
  }
);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
// ========================================
// 404 HANDLER
// ========================================

app.use(notFound);

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use(errorHandler);

// Export Express application
export default app;
