import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log("Connecting to database:", process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
.then( client => {
  console.log("Connected to database");
  return client;
}).catch( err => {
  console.error("Database connection error:", err);
  throw err;
});

export const db = drizzle(pool, { schema });