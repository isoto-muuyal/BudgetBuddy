export const config = {
  mailersend: {
    apiKey: process.env.MAILERSEND_API_KEY || "mlsn.b39bfc4d464de08fea1e28aaca9f8d0b04fb18f46528648de7bc70c9f014a993",
    fromEmail: process.env.FROM_EMAIL || "noreply@muuyal.tech",
    fromName: process.env.FROM_NAME || "BudgetWise by Muuyal",
  },
  ai: {
    service: process.env.AI_SERVICE || "huggingface", // "ollama" or "huggingface"
    baseUrl: process.env.AI_BASE_URL || "https://router.huggingface.co/featherless-ai/v1/completions",
    model: process.env.AI_MODEL || "instruction-pretrain/finance-Llama3-8B",
    accessToken: process.env.AI_ACCESS_TOKEN || "",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your_jwt_secret_key",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/budgetwise",
  },
  uploads: {
    directory: process.env.UPLOADS_DIR || "./uploads",
    maxSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB
  },
};
