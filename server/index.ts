import 'dotenv/config'; 
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite-helpers";
import { ensureDatabaseSchema, ensureSeedAdmin, ensureSeedUser } from "./db";
import { installObservability } from "./middleware/observability";
import { logger } from "./services/logger";

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? [process.env.FRONTEND_URL || "https://budgetwise.muuyal.tech", /\.muuyal\.tech$/]
    : "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

installObservability(app);

const isDev = process.env.NODE_ENV === "development";

(async () => {
  await ensureDatabaseSchema();
  await ensureSeedUser();
  await ensureSeedAdmin();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error("Unhandled request error", {
      traceId: _req.traceId,
      status,
      error: message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
    res.status(status).json({ message, traceId: _req.traceId });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (isDev) {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5003', 10);
  logger.info("Starting server", { port, mode: isDev ? "development" : "production" });
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    logger.info("Server listening", { port });
  });
})();
