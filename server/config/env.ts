import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

// Log loaded environment variables for debugging
console.log("Environment variables loaded from .env file");
console.log("AI_BASE_URL:", process.env.AI_BASE_URL);
console.log("AI_MODEL:", process.env.AI_MODEL);
console.log("MAILERSEND_API_KEY:", process.env.MAILERSEND_API_KEY);
console.log("FROM_EMAIL:", process.env.FROM_EMAIL);
console.log("DATABASE_URL:", process.env.DATABASE_URL);
