export const config = {
  mailersend: {
    apiKey: process.env.MAILERSEND_API_KEY || "",
    fromEmail: process.env.FROM_EMAIL || "noreply@muuyal.tech",
    fromName: process.env.FROM_NAME || "BudgetWise by Muuyal",
  },
  ai: {
    service: process.env.AI_SERVICE || "huggingface", // "ollama" or "huggingface"
    // Categorization API - optimized for structured JSON output
    categorization: {
      baseUrl: process.env.AI_CATEGORIZATION_BASE_URL || "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      model: process.env.AI_CATEGORIZATION_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",
      accessToken: process.env.AI_CATEGORIZATION_ACCESS_TOKEN || process.env.AI_ACCESS_TOKEN || "",
    },
    // Recommendations API - optimized for analysis and recommendations
    recommendations: {
      baseUrl: process.env.AI_RECOMMENDATIONS_BASE_URL || "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct",
      model: process.env.AI_RECOMMENDATIONS_MODEL || "meta-llama/Llama-3.1-8B-Instruct",
      accessToken: process.env.AI_RECOMMENDATIONS_ACCESS_TOKEN || process.env.AI_ACCESS_TOKEN || "",
    },
    // Legacy support (deprecated)
    baseUrl: process.env.AI_BASE_URL || "https://router.huggingface.co/featherless-ai/v1/completions",
    model: process.env.AI_MODEL || "instruction-pretrain/finance-Llama3-8B",
    accessToken: process.env.AI_ACCESS_TOKEN || "",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your_jwt_secret_key",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  admin: {
    visitsCsvPath: process.env.ADMIN_VISITS_CSV_PATH || "./data/visits.csv",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUrl: process.env.GOOGLE_REDIRECT_URL || "",
    frontendRedirect: process.env.GOOGLE_FRONTEND_REDIRECT || "",
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/budgetwise",
  },
  uploads: {
    directory: process.env.UPLOADS_DIR || "./uploads",
    maxSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB
  },
};
