import mongoose from "mongoose";
import { MONGODB_URI } from "./config.js";

let connected = false;

export async function connectDb() {
  if (connected) return;
  await mongoose.connect(MONGODB_URI);
  connected = true;
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDb() {
  if (connected) {
    await mongoose.disconnect();
    connected = false;
  }
}
