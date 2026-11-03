import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";

const createAdmin = async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error("Admin environment variables are missing");
    }

    if (ADMIN_PASSWORD.length < 12) {
      throw new Error("Admin password must contain at least 12 characters");
    }

    await connectDB();

    const email = ADMIN_EMAIL.trim().toLowerCase();

    let admin = await User.findOne({ email }).select("+password");

    if (admin) {
      admin.name = ADMIN_NAME;
      admin.password = ADMIN_PASSWORD;
      admin.role = "admin";
      admin.isActive = true;

      await admin.save();

      console.log("Existing account updated as admin.");
    } else {
      admin = await User.create({
        name: ADMIN_NAME,
        email,
        password: ADMIN_PASSWORD,
        role: "admin",
        isActive: true
      });

      console.log("New admin account created.");
    }

    console.log("Admin email:", admin.email);
    console.log("Admin role:", admin.role);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();