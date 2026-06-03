import app from "./app.js";
import { connectDb, isDbConnected } from "./db.js";
import { PORT } from "./config.js";

async function start() {
  try {
    await connectDb();
    console.log("MongoDB connected");
  } catch (e) {
    console.error("MongoDB connection failed:", e.message);
  }

  app.listen(PORT, () => {
    console.log(`Store Intelligence API on http://localhost:${PORT}`);
    console.log(`DB ready: ${isDbConnected()}`);
  });
}

start();
