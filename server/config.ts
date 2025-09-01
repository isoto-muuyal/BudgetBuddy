export const config = {
  mailersend: {
    apiKey: process.env.MAILERSEND_API_KEY || "your_mailersend_api_key",
    fromEmail: process.env.FROM_EMAIL || "noreply@budgetwise.com",
    fromName: process.env.FROM_NAME || "BudgetWise",
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
