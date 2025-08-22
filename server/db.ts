import pkg from "pg";
const { Pool } = pkg;

import { drizzle } from "drizzle-orm/node-postgres"; // 👈 use node-postgres connector
import ws from "ws";
import * as schema from "@shared/schema";
import util from "util";

console.log("db environment variable:", process.env.DATABASE_URL);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema }); // node-postgres drizzle


if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("db keys: " + Object.keys(db));
