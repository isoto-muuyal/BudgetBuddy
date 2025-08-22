export const config = {
  mailersend: {
    apiKey: process.env.MAILERSEND_API_KEY || "mlsn.b8a6462646c2e158d9642f84e5cc27121534e0fdd317bb4885ed184f835e29ca",
    fromEmail: process.env.FROM_EMAIL || "noreply@budgetwise.com",
    fromName: process.env.FROM_NAME || "BudgetWise",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama2",
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
