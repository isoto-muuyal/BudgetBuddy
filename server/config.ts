export const config = {
  mailersend: {
    apiKey: process.env.MAILERSEND_API_KEY || "",
    fromEmail: process.env.FROM_EMAIL || "noreply@muuyal.tech",
    fromName: process.env.FROM_NAME || "BudgetWise by Muuyal",
  },
  contact: {
    recipientEmail: process.env.CONTACT_EMAIL || "israel.soto@muuyal.tech",
  },
  ai: {
    service: process.env.AI_SERVICE || "openai", // set to "mcp" to route through MCP tools instead
    // OpenAI-compatible endpoint (e.g. a local LiteLLM proxy orchestrating Ollama models)
    baseUrl: process.env.OPENAI_API_BASE || "http://localhost:4000/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    // Model aliases: categorization calls use the categorizer model, analysis/recommendation calls use the advisor model
    categorizerModel: process.env.AI_CATEGORIZER_MODEL || "finance-categorizer",
    advisorModel: process.env.AI_ADVISOR_MODEL || "finance-advisor",
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
