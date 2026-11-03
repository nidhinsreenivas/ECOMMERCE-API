import "dotenv/config";

import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("Connecting to MongoDB...");

    await connectDB();

    console.log("MongoDB connection established");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();