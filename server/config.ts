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
  mcp: {
    baseUrl: process.env.MCP_BASE_URL || "",
    loginPath: process.env.MCP_LOGIN_PATH || "/login",
    toolsPath: process.env.MCP_TOOLS_PATH || "/mcp",
    username: process.env.MCP_USERNAME || "",
    password: process.env.MCP_PASSWORD || "",
    loginBodyJson: process.env.MCP_LOGIN_BODY_JSON || "",
    jwt: process.env.MCP_JWT || "",
    tools: {
      categorizeTransactions: process.env.MCP_TOOL_CATEGORIZE_TRANSACTIONS || "categorize_transactions",
      generateBudgetRecommendations:
        process.env.MCP_TOOL_GENERATE_BUDGET_RECOMMENDATIONS || "generate_budget_recommendations",
      generateHistoryPatterns: process.env.MCP_TOOL_GENERATE_HISTORY_PATTERNS || "generate_history_patterns",
      generateGlobalAdvice: process.env.MCP_TOOL_GENERATE_GLOBAL_ADVICE || "generate_global_advice",
    },
  },
  observability: {
    serviceName: process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || "budgetbuddy-api",
    environment: process.env.OBSERVABILITY_ENV || process.env.NODE_ENV || "development",
    metricsPath: process.env.PROMETHEUS_METRICS_PATH || "/metrics",
    metricsBearerToken: process.env.PROMETHEUS_METRICS_BEARER_TOKEN || "",
    lokiUrl: process.env.GRAFANA_LOKI_URL || process.env.LOKI_URL || "",
    lokiUsername: process.env.GRAFANA_LOKI_USERNAME || process.env.LOKI_USERNAME || "",
    lokiPassword: process.env.GRAFANA_LOKI_PASSWORD || process.env.LOKI_PASSWORD || "",
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
