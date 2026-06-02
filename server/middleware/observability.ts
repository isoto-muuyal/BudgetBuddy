import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction, Express } from "express";
import { config } from "../config";
import { logger } from "../services/logger";
import { metricsService } from "../services/metrics-service";

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}

export function installObservability(app: Express): void {
  app.use(traceMiddleware);
  app.use(metricsService.httpMiddleware());
  app.use(requestLoggingMiddleware);

  app.get(config.observability.metricsPath, metricsAuthMiddleware, (_req, res) => {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metricsService.render());
  });
}

function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingTraceId = req.header("x-request-id") || req.header("traceparent")?.split("-")[1];
  const traceId = incomingTraceId && incomingTraceId.length <= 64 ? incomingTraceId : randomUUID();
  req.traceId = traceId;
  res.setHeader("x-request-id", traceId);
  next();
}

function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();

  res.on("finish", () => {
    if (req.path === config.observability.metricsPath) return;

    const durationMs = Date.now() - started;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    const fields = {
      traceId: req.traceId,
      method: req.method,
      path: req.path,
      statusCode,
      durationMs,
      userAgent: req.header("user-agent") || "",
      ip: getClientIp(req),
    };

    if (level === "error") {
      logger.error("HTTP request completed", fields);
    } else if (level === "warn") {
      logger.warn("HTTP request completed", fields);
    } else {
      logger.info("HTTP request completed", fields);
    }
  });

  next();
}

function metricsAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = config.observability.metricsBearerToken;
  if (!expectedToken) {
    next();
    return;
  }

  const authorization = req.header("authorization") || "";
  if (authorization === `Bearer ${expectedToken}`) {
    next();
    return;
  }

  res.status(401).send("Unauthorized");
}

function getClientIp(req: Request): string {
  const forwardedFor = req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "";
  }
  return req.ip || "";
}
